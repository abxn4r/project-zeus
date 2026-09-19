const axios = require('axios');
const fs = require('fs');
const path = require('path');

class SpotifyClient {
  constructor(clientId, clientSecret, refreshToken = null) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  async getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    if (this.refreshToken) {
      console.log('[SPOTIFY] Refreshing user access token...');
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        `grant_type=refresh_token&refresh_token=${this.refreshToken}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + response.data.expires_in - 60;
    } else {
      console.log('[SPOTIFY] Fetching client credentials token...');
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + response.data.expires_in - 60;
    }

    return this.accessToken;
  }

  async fetchUserProfile(userId) {
    const token = await this.getAccessToken();
    const response = await axios.get(`https://api.spotify.com/v1/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }

  async fetchUserPlaylists(userId) {
    const token = await this.getAccessToken();
    let playlists = [];
    let url = `https://api.spotify.com/v1/users/${userId}/playlists?limit=50`;

    while (url) {
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const items = response.data.items || [];
      items.forEach(item => {
        if (item) {
          playlists.push({
            id: item.id,
            name: item.name,
            url: item.external_urls?.spotify || '',
            snapshotId: item.snapshot_id,
            tracksCount: item.tracks?.total || 0
          });
        }
      });
      url = response.data.next;
    }
    return playlists;
  }

  async fetchPlaylistTracks(playlistId) {
    const token = await this.getAccessToken();
    let tracks = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
    let playlistName = 'Unknown Playlist';

    try {
      const metaRes = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      playlistName = metaRes.data.name;
    } catch (e) {
      console.error(`[SPOTIFY] Failed to get playlist metadata for ${playlistId}:`, e.message);
    }

    while (url) {
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const items = response.data.items || [];
      items.forEach(item => {
        if (item.track) {
          tracks.push({
            id: item.track.id,
            name: item.track.name,
            artists: item.track.artists.map(a => a.name).join(', '),
            album: item.track.album?.name || 'Unknown Album',
            url: item.track.external_urls?.spotify || ''
          });
        }
      });

      url = response.data.next;
    }

    return { name: playlistName, tracks };
  }

  async checkPlaylist(playlistId, stateDir, telegram) {
    const stateFilePath = path.join(stateDir, `spotify_${playlistId}.json`);
    let previousState = null;

    if (fs.existsSync(stateFilePath)) {
      try {
        previousState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
      } catch (e) {
        console.error(`[SPOTIFY] Error reading state file for playlist ${playlistId}:`, e.message);
      }
    }

    console.log(`[SPOTIFY] Checking playlist ${playlistId}...`);
    let current;
    try {
      current = await this.fetchPlaylistTracks(playlistId);
    } catch (error) {
      console.error(`[SPOTIFY] Error checking playlist ${playlistId}:`, error.message);
      return;
    }

    const { name: playlistName, tracks: currentTracks } = current;

    if (!previousState) {
      console.log(`[SPOTIFY] Initializing state for playlist "${playlistName}" (${playlistId}).`);
      fs.writeFileSync(stateFilePath, JSON.stringify({ name: playlistName, tracks: currentTracks }, null, 2));
      return;
    }

    const previousTracks = previousState.tracks || [];
    const prevMap = new Map(previousTracks.map(t => [t.id, t]));
    const currMap = new Map(currentTracks.map(t => [t.id, t]));

    const messages = [];

    for (const [id, track] of currMap.entries()) {
      if (!prevMap.has(id)) {
        messages.push(
          `🎵 <b>Song Added to Playlist!</b>\n` +
          `📂 Playlist: <b>${playlistName}</b>\n` +
          `🎶 Track: <b>${track.name}</b>\n` +
          `👤 Artist: <code>${track.artists}</code>\n` +
          `💿 Album: <i>${track.album}</i>\n` +
          (track.url ? `🔗 <a href="${track.url}">Listen on Spotify</a>` : '')
        );
      }
    }

    for (const [id, track] of prevMap.entries()) {
      if (!currMap.has(id)) {
        messages.push(
          `🎵 <b>Song Removed from Playlist!</b>\n` +
          `📂 Playlist: <b>${playlistName}</b>\n` +
          `🎶 Track: <b>${track.name}</b>\n` +
          `👤 Artist: <code>${track.artists}</code>`
        );
      }
    }

    for (const msg of messages) {
      await telegram.sendMessage(msg);
    }

    fs.writeFileSync(stateFilePath, JSON.stringify({ name: playlistName, tracks: currentTracks }, null, 2));
  }

  async checkUserAccount(userId, stateDir, telegram) {
    const stateFilePath = path.join(stateDir, `spotify_user_${userId}.json`);
    let previousState = null;

    if (fs.existsSync(stateFilePath)) {
      try {
        previousState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
      } catch (e) {
        console.error(`[SPOTIFY] Error reading state file for user ${userId}:`, e.message);
      }
    }

    console.log(`[SPOTIFY] Checking Spotify account for user: ${userId}...`);
    
    let userProfile, currentPlaylists;
    try {
      userProfile = await this.fetchUserProfile(userId);
      currentPlaylists = await this.fetchUserPlaylists(userId);
    } catch (error) {
      console.error(`[SPOTIFY] Error checking Spotify account for user ${userId}:`, error.message);
      return;
    }

    const currentPfpUrl = userProfile.images?.[0]?.url || '';
    const currentDisplayName = userProfile.display_name || userId;
    const currentFollowers = userProfile.followers?.total || 0;

    const previousPlaylists = previousState?.playlists || [];
    const prevMap = new Map(previousPlaylists.map(p => [p.id, p]));
    const currMap = new Map(currentPlaylists.map(p => [p.id, p]));

    const messages = [];
    let pfpChangedMsg = '';

    if (!previousState) {
      console.log(`[SPOTIFY] Initializing state for Spotify user ${currentDisplayName} (${userId}) with ${currentPlaylists.length} playlists.`);
      for (const playlist of currentPlaylists) {
        await this.checkPlaylist(playlist.id, stateDir, telegram);
      }
      fs.writeFileSync(stateFilePath, JSON.stringify({ 
        displayName: currentDisplayName,
        pfpUrl: currentPfpUrl,
        followers: currentFollowers,
        playlists: currentPlaylists 
      }, null, 2));
      return;
    }

    // 1. Check profile changes (PFP, Display Name, Followers)
    if (currentPfpUrl && previousState.pfpUrl && currentPfpUrl !== previousState.pfpUrl) {
      pfpChangedMsg = `🎵 <b>Spotify Profile Picture Updated!</b>\n👤 User: <code>${currentDisplayName}</code>`;
    }
    if (currentDisplayName !== previousState.displayName) {
      messages.push(`🎵 <b>Spotify Display Name Updated!</b>\n👤 User ID: <code>${userId}</code>\nOld Name: <b>${previousState.displayName || '[Empty]'}</b>\nNew Name: <b>${currentDisplayName}</b>`);
    }
    if (currentFollowers !== previousState.followers) {
      messages.push(`🎵 <b>Spotify Followers Updated!</b>\n👤 User: <code>${currentDisplayName}</code>\nOld: <b>${previousState.followers}</b>\nNew: <b>${currentFollowers}</b>`);
    }

    // 2. Check playlists changes
    for (const [id, playlist] of currMap.entries()) {
      if (!prevMap.has(id)) {
        messages.push(
          `🎵 <b>New Spotify Playlist Created/Followed!</b>\n` +
          `👤 User: <code>${currentDisplayName}</code>\n` +
          `📂 Playlist: <b>${playlist.name}</b>\n` +
          `📈 Tracks: <b>${playlist.tracksCount}</b>\n` +
          `🔗 <a href="${playlist.url}">Open Playlist</a>`
        );
        await this.checkPlaylist(id, stateDir, telegram);
      } else {
        await this.checkPlaylist(id, stateDir, telegram);
      }
    }

    for (const [id, playlist] of prevMap.entries()) {
      if (!currMap.has(id)) {
        messages.push(
          `🎵 <b>Spotify Playlist Deleted/Unfollowed</b>\n` +
          `👤 User: <code>${currentDisplayName}</code>\n` +
          `📂 Playlist Name: <b>${playlist.name}</b>`
        );
        const playlistCachePath = path.join(stateDir, `spotify_${id}.json`);
        if (fs.existsSync(playlistCachePath)) {
          fs.unlinkSync(playlistCachePath);
        }
      }
    }

    if (pfpChangedMsg) {
      await telegram.sendPhoto(currentPfpUrl, pfpChangedMsg);
    }

    for (const msg of messages) {
      await telegram.sendMessage(msg);
    }

    fs.writeFileSync(stateFilePath, JSON.stringify({ 
      displayName: currentDisplayName,
      pfpUrl: currentPfpUrl,
      followers: currentFollowers,
      playlists: currentPlaylists 
    }, null, 2));
  }
}

module.exports = SpotifyClient;
