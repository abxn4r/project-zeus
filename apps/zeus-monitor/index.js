const fs = require('fs');
const path = require('path');
const TelegramClient = require('./lib/telegram');
const SpotifyClient = require('./lib/spotify');
const { checkPinterest } = require('./lib/pinterest');
const { checkInstagram } = require('./lib/instagram');

const configPath = path.join(__dirname, 'config.json');
const stateDir = path.join(__dirname, 'state');

// 1. Load config
if (!fs.existsSync(configPath)) {
  console.error('[CORE] Configuration file config.json not found!');
  console.error('[CORE] Please copy config.json.template to config.json and fill in credentials.');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('[CORE] Error parsing config.json:', e.message);
  process.exit(1);
}

// 2. Ensure state directory exists
if (!fs.existsSync(stateDir)) {
  fs.mkdirSync(stateDir, { recursive: true });
}

// 3. Initialize clients
const telegram = new TelegramClient(config.telegram.botToken, config.telegram.chatId);
const spotify = new SpotifyClient(config.spotify.clientId, config.spotify.clientSecret, config.spotify.refreshToken);

console.log('[CORE] Zeus Account Monitor Bot Starting...');
console.log(`[CORE] Telegram alerts configured for Chat ID: ${config.telegram.chatId}`);

// 4. Register Interval Loops

// A. Spotify Monitor Loop
const hasSpotifyPlaylists = config.spotify.playlists && config.spotify.playlists.length > 0;
const hasSpotifyUsers = config.spotify.userIds && config.spotify.userIds.length > 0;

if (hasSpotifyPlaylists || hasSpotifyUsers) {
  const seconds = config.intervals?.spotify_seconds || 60;
  console.log(`[CORE] Spotify Monitor registered (${hasSpotifyPlaylists ? config.spotify.playlists.length : 0} playlists, ${hasSpotifyUsers ? config.spotify.userIds.length : 0} user accounts), checking every ${seconds}s`);
  
  const runSpotify = async () => {
    // Check specific playlists
    if (hasSpotifyPlaylists) {
      for (const playlistId of config.spotify.playlists) {
        try {
          await spotify.checkPlaylist(playlistId, stateDir, telegram);
        } catch (err) {
          console.error(`[CORE] Spotify playlist error for ${playlistId}:`, err.message);
        }
      }
    }
    
    // Check user profiles (monitors user's public playlists list & track contents)
    if (hasSpotifyUsers) {
      for (const userId of config.spotify.userIds) {
        try {
          await spotify.checkUserAccount(userId, stateDir, telegram);
        } catch (err) {
          console.error(`[CORE] Spotify user account error for ${userId}:`, err.message);
        }
      }
    }
  };
  
  runSpotify(); // Run once immediately on start
  setInterval(runSpotify, seconds * 1000);
}


// B. Pinterest User Loop
if (config.pinterest.usernames && config.pinterest.usernames.length > 0) {
  const seconds = config.intervals?.pinterest_seconds || 300;
  console.log(`[CORE] Pinterest Monitor registered for ${config.pinterest.usernames.length} accounts (checking every ${seconds}s)`);
  
  const runPinterest = async () => {
    for (const username of config.pinterest.usernames) {
      try {
        await checkPinterest(username, stateDir, telegram);
      } catch (err) {
        console.error(`[CORE] Pinterest Loop error for user ${username}:`, err.message);
      }
    }
  };
  
  runPinterest(); // Run once immediately on start
  setInterval(runPinterest, seconds * 1000);
}

// C. Instagram User Loop (On-device Android Automation)
if (config.instagram.usernames && config.instagram.usernames.length > 0) {
  const seconds = config.intervals?.instagram_seconds || 900;
  console.log(`[CORE] Instagram Native Monitor registered for ${config.instagram.usernames.length} accounts (checking every ${seconds}s)`);
  
  const runInstagram = async () => {
    for (const username of config.instagram.usernames) {
      try {
        await checkInstagram(username, stateDir, telegram);
      } catch (err) {
        console.error(`[CORE] Instagram Loop error for user ${username}:`, err.message);
      }
    }
  };
  
  // Stagger the first run by 15 seconds to avoid overlapping on start with initial API calls
  setTimeout(() => {
    runInstagram();
    setInterval(runInstagram, seconds * 1000);
  }, 15000);
}

// Global exception catcher to prevent daemon termination
process.on('uncaughtException', (err) => {
  console.error('[CORE] Uncaught Exception:', err.message, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CORE] Unhandled Rejection at:', promise, 'reason:', reason);
});
