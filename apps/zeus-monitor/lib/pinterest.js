const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function fetchPinterestProfile(username) {
  const url = `https://www.pinterest.com/${username}/`;
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  const html = response.data;
  const scriptTag = html.match(/<script id="__PWS_INITIAL_PROPS__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!scriptTag) {
    throw new Error('Could not find __PWS_INITIAL_PROPS__ script tag');
  }

  const json = JSON.parse(scriptTag[1]);
  const state = json.initialReduxState;
  if (!state) {
    throw new Error('Could not find initialReduxState in JSON props');
  }

  return state;
}

async function checkPinterest(username, stateDir, telegram) {
  const stateFilePath = path.join(stateDir, `pinterest_${username}.json`);
  let previousState = null;

  if (fs.existsSync(stateFilePath)) {
    try {
      previousState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    } catch (e) {
      console.error(`[PINTEREST] Error reading state file for ${username}:`, e.message);
    }
  }

  console.log(`[PINTEREST] Checking profile for ${username}...`);
  let currentState;
  try {
    currentState = await fetchPinterestProfile(username);
  } catch (error) {
    console.error(`[PINTEREST] Error fetching profile for ${username}:`, error.message);
    return;
  }

  const currentBoards = currentState.boards || {};
  const previousBoards = previousState?.boards || {};

  // Extract user details (to check for pfp and bio/name changes)
  const users = currentState.users || {};
  let currentUser = null;
  for (const uid in users) {
    if (users[uid] && users[uid].username?.toLowerCase() === username.toLowerCase()) {
      currentUser = users[uid];
      break;
    }
  }

  const currentPfpUrl = currentUser?.image_xlarge_url || '';
  const currentName = currentUser?.full_name || '';
  const currentBio = currentUser?.about || '';
  const currentFollowers = currentUser?.follower_count || 0;
  const currentFollowing = currentUser?.following_count || 0;

  // If no previous state, initialize it and exit
  if (!previousState) {
    console.log(`[PINTEREST] Initializing state for ${username}.`);
    fs.writeFileSync(stateFilePath, JSON.stringify({ 
      boards: currentBoards,
      pfpUrl: currentPfpUrl,
      name: currentName,
      bio: currentBio,
      followers: currentFollowers,
      following: currentFollowing
    }, null, 2));
    return;
  }

  const messages = [];
  let pfpChangedMsg = '';

  // 1. Check Profile Picture change
  if (currentPfpUrl && previousState.pfpUrl && currentPfpUrl !== previousState.pfpUrl) {
    pfpChangedMsg = `📌 <b>Pinterest Profile Picture Updated!</b>\n👤 User: <code>${username}</code>`;
  }

  // 2. Check Bio or Name change
  if (currentName !== previousState.name) {
    messages.push(`📌 <b>Pinterest Name Updated!</b>\n👤 User: <code>${username}</code>\nOld Name: <b>${previousState.name || '[Empty]'}</b>\nNew Name: <b>${currentName}</b>`);
  }
  if (currentBio !== previousState.bio) {
    messages.push(
      `📌 <b>Pinterest Bio Updated!</b>\n` +
      `👤 User: <code>${username}</code>\n` +
      `Old Bio:\n<i>${previousState.bio || '[Empty]'}</i>\n\n` +
      `New Bio:\n<i>${currentBio || '[Empty]'}</i>`
    );
  }

  // 3. Check Followers and Following counts
  if (currentFollowers !== previousState.followers) {
    messages.push(`📌 <b>Pinterest Followers Updated!</b>\n👤 User: <code>${username}</code>\nOld: <b>${previousState.followers}</b>\nNew: <b>${currentFollowers}</b>`);
  }
  if (currentFollowing !== previousState.following) {
    messages.push(`📌 <b>Pinterest Following Count Updated!</b>\n👤 User: <code>${username}</code>\nOld: <b>${previousState.following}</b>\nNew: <b>${currentFollowing}</b>`);
  }

  // 4. Check for new boards or updates
  for (const boardId in currentBoards) {
    const currentBoard = currentBoards[boardId];
    const previousBoard = previousBoards[boardId];

    if (!previousBoard) {
      // New board created
      const boardUrl = `https://www.pinterest.com${currentBoard.url}`;
      messages.push(
        `📌 <b>New Pinterest Board Created!</b>\n` +
        `👤 User: <code>${username}</code>\n` +
        `📂 Board Name: <b>${currentBoard.name}</b>\n` +
        `📈 Initial Pins: <b>${currentBoard.pin_count}</b>\n` +
        `🔗 <a href="${boardUrl}">View Board</a>`
      );
    } else if (currentBoard.pin_count > previousBoard.pin_count) {
      // New pin(s) added to existing board
      const diff = currentBoard.pin_count - previousBoard.pin_count;
      const boardUrl = `https://www.pinterest.com${currentBoard.url}`;
      messages.push(
        `📌 <b>New Pin Added!</b>\n` +
        `👤 User: <code>${username}</code>\n` +
        `📂 Board: <b>${currentBoard.name}</b>\n` +
        `🆕 Added: <b>+${diff} pin(s)</b> (Total: ${currentBoard.pin_count})\n` +
        `🔗 <a href="${boardUrl}">View Board</a>`
      );
    }
  }

  // 5. Check for deleted boards
  for (const boardId in previousBoards) {
    if (!currentBoards[boardId]) {
      const deletedBoard = previousBoards[boardId];
      messages.push(
        `📌 <b>Pinterest Board Deleted</b>\n` +
        `👤 User: <code>${username}</code>\n` +
        `📂 Board Name: <b>${deletedBoard.name}</b>`
      );
    }
  }

  // Send profile picture update first (with photo attachment)
  if (pfpChangedMsg) {
    await telegram.sendPhoto(currentPfpUrl, pfpChangedMsg);
  }

  // Send other messages
  for (const msg of messages) {
    await telegram.sendMessage(msg);
  }

  // Save updated state
  fs.writeFileSync(stateFilePath, JSON.stringify({ 
    boards: currentBoards,
    pfpUrl: currentPfpUrl,
    name: currentName,
    bio: currentBio,
    followers: currentFollowers,
    following: currentFollowing
  }, null, 2));
}

module.exports = {
  checkPinterest
};
