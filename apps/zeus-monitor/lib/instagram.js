const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function execRoot(cmd) {
  const escapedCmd = cmd.replace(/"/g, '\\"');
  return execSync(`su -c "${escapedCmd}"`, { encoding: 'utf8', stdio: 'pipe' });
}

function getMd5(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function parseXmlNodes(xmlString) {
  const nodes = [];
  const nodeRegex = /<node[^>]*>/g;
  const matches = xmlString.match(nodeRegex) || [];

  for (const match of matches) {
    const node = {};
    const attrRegex = /(\w+(?:-\w+)*)="([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(match)) !== null) {
      node[attrMatch[1]] = attrMatch[2];
    }
    nodes.push(node);
  }
  return nodes;
}

function extractProfileDetails(xmlString) {
  const nodes = parseXmlNodes(xmlString);
  let username = '';
  let bio = '';
  let fullName = '';
  let followers = '';
  let following = '';
  let avatarBounds = null;

  console.log(`[INSTAGRAM] Parsing ${nodes.length} UI nodes...`);

  for (const node of nodes) {
    const resId = node['resource-id'] || '';
    const text = node['text'] || '';
    const desc = node['content-desc'] || '';
    const bounds = node['bounds'] || '';

    // 1. Identify Username (from action bar title)
    if (resId.includes('action_bar_title') && text) {
      username = text;
    }

    // 2. Identify Full Name
    if (resId.includes('profile_header_full_name') && text) {
      fullName = text;
    }

    // 3. Identify Bio Text
    if (resId.includes('profile_header_bio_text') && text) {
      bio = text;
    }

    // 4. Identify Followers and Following Count
    if (resId.includes('row_profile_header_textview_followers_count') || resId.includes('profile_header_familiar_followers_value')) {
      followers = text || desc.replace(/[^0-9.,KMBkmb]/g, '');
    }
    if (resId.includes('row_profile_header_textview_following_count') || resId.includes('profile_header_familiar_following_value')) {
      following = text || desc.replace(/[^0-9.,KMBkmb]/g, '');
    }

    // 5. Identify Profile Picture (Avatar)
    const isAvatarResId = resId.includes('row_profile_header_imageview') || resId.includes('row_profile_header_avatar_container');
    const isAvatarDesc = desc.toLowerCase().includes('profile photo') || desc.toLowerCase().includes('avatar') || desc.toLowerCase().includes('profile picture');
    
    if ((isAvatarResId || isAvatarDesc) && bounds) {
      avatarBounds = bounds;
    }
  }

  // Fallback username check
  if (!username) {
    const topText = nodes.find(n => n['class'] === 'android.widget.TextView' && n['bounds']?.startsWith('[0,'));
    if (topText) username = topText['text'] || '';
  }

  // Parse avatar bounds to coordinates
  let coords = null;
  if (avatarBounds) {
    const match = avatarBounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (match) {
      coords = {
        left: parseInt(match[1]),
        top: parseInt(match[2]),
        right: parseInt(match[3]),
        bottom: parseInt(match[4])
      };
    }
  }

  return { username, bio, fullName, followers, following, coords };
}

async function checkInstagram(targetUser, stateDir, telegram) {
  const stateFilePath = path.join(stateDir, `instagram_${targetUser}.json`);
  const currentPfpPath = path.join(stateDir, `pfp_${targetUser}_current.png`);
  const previousPfpPath = path.join(stateDir, `pfp_${targetUser}_prev.png`);

  let previousState = null;
  if (fs.existsSync(stateFilePath)) {
    try {
      previousState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    } catch (e) {
      console.error(`[INSTAGRAM] Error reading state file for ${targetUser}:`, e.message);
    }
  }

  console.log(`[INSTAGRAM] Starting native automation check for "${targetUser}"...`);

  try {
    // 1. Wake up the device
    console.log('[INSTAGRAM] Waking up screen...');
    execRoot('input keyevent KEYCODE_WAKEUP');
    
    // Swipe up to unlock swipe-only lockscreen
    console.log('[INSTAGRAM] Swiping up to unlock...');
    execRoot('input swipe 500 1500 500 500');
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    
    // 2. Launch Instagram directly to target profile
    console.log(`[INSTAGRAM] Launching Instagram for target: ${targetUser}`);
    const intentUrl = `instagram://user?username=${targetUser}`;
    execRoot(`am start -a android.intent.action.VIEW -d "${intentUrl}"`);
    
    // 3. Wait for content to render
    console.log('[INSTAGRAM] Waiting 7 seconds for profile page to render...');
    await new Promise(resolve => setTimeout(resolve, 7000));

    // 4. Capture screenshot
    const tmpScreenshot = '/data/local/tmp/ig_screen.png';
    console.log('[INSTAGRAM] Taking screenshot...');
    execRoot(`screencap -p ${tmpScreenshot}`);

    // 5. Dump UI Hierarchy
    const tmpXml = '/data/local/tmp/ig_profile.xml';
    console.log('[INSTAGRAM] Dumping window XML...');
    execRoot(`uiautomator dump ${tmpXml}`);

    // 6. Force-stop Instagram app
    console.log('[INSTAGRAM] Stopping Instagram app...');
    execRoot('am force-stop com.instagram.android');
    
    // Put device to sleep
    execRoot('input keyevent KEYCODE_SLEEP');

    // 7. Parse XML file contents
    const localXmlPath = '/data/local/tmp/ig_profile.xml';
    if (!fs.existsSync(localXmlPath)) {
      throw new Error(`uiautomator XML dump failed, file not found at ${localXmlPath}`);
    }

    const xmlContent = fs.readFileSync(localXmlPath, 'utf8');
    const details = extractProfileDetails(xmlContent);
    console.log(`[INSTAGRAM] Parsed details:`, {
      username: details.username,
      fullName: details.fullName,
      bio: details.bio,
      followers: details.followers,
      following: details.following,
      hasCoords: !!details.coords
    });

    if (!details.username && !details.bio) {
      console.warn(`[INSTAGRAM] Parsing failed. Page might not have loaded correctly or app is not logged in.`);
      return;
    }

    const parsedUsername = details.username || targetUser;

    // 8. Handle avatar crop
    let pfpMd5 = '';
    let pfpCropped = false;

    if (details.coords) {
      console.log(`[INSTAGRAM] Cropping avatar using bounds:`, details.coords);
      try {
        const pythonPath = fs.existsSync('/data/data/com.termux/files/usr/bin/python3') ? '/data/data/com.termux/files/usr/bin/python3' : 'python3';
        const cropScript = path.join(__dirname, 'crop.py');
        const cropCmd = `${pythonPath} ${cropScript} ${tmpScreenshot} ${currentPfpPath} ${details.coords.left} ${details.coords.top} ${details.coords.right} ${details.coords.bottom}`;
        const execEnv = { ...process.env };
        if (fs.existsSync('/data/data/com.termux/files/usr/lib/libtermux-exec.so')) {
          execEnv.LD_PRELOAD = '/data/data/com.termux/files/usr/lib/libtermux-exec.so';
        }
        execSync(cropCmd, { env: execEnv });
        pfpCropped = fs.existsSync(currentPfpPath);
        if (pfpCropped) {
          pfpMd5 = getMd5(currentPfpPath);
          console.log(`[INSTAGRAM] Cropped avatar MD5: ${pfpMd5}`);
        }
      } catch (cropErr) {
        console.error('[INSTAGRAM] Avatar crop failed:', cropErr.message);
      }
    }

    // 9. Compare with previous state
    if (!previousState) {
      console.log(`[INSTAGRAM] Initializing state for ${targetUser}.`);
      if (pfpCropped) {
        fs.copyFileSync(currentPfpPath, previousPfpPath);
      }
      fs.writeFileSync(stateFilePath, JSON.stringify({
        username: parsedUsername,
        bio: details.bio,
        fullName: details.fullName,
        followers: details.followers,
        following: details.following,
        pfpMd5: pfpMd5
      }, null, 2));
      return;
    }

    const messages = [];
    let pfpChanged = false;

    // A. Check Username Change
    if (parsedUsername && previousState.username && parsedUsername !== previousState.username) {
      messages.push(`📸 <b>Instagram Username Changed!</b>\nOld: <code>${previousState.username}</code>\nNew: <code>${parsedUsername}</code>`);
    }

    // B. Check Bio Change
    if (details.bio !== previousState.bio) {
      messages.push(
        `📸 <b>Instagram Bio Updated!</b>\n` +
        `👤 User: <code>${parsedUsername}</code>\n` +
        `Old Bio:\n<i>${previousState.bio || '[Empty]'}</i>\n\n` +
        `New Bio:\n<i>${details.bio || '[Empty]'}</i>`
      );
    }

    // C. Check Profile Picture Change
    if (pfpCropped && pfpMd5 && pfpMd5 !== previousState.pfpMd5) {
      pfpChanged = true;
      messages.push(`📸 <b>Instagram Profile Picture Updated!</b>\n👤 User: <code>${parsedUsername}</code>`);
    }

    // D. Check Followers and Following counts
    if (details.followers && previousState.followers && details.followers !== previousState.followers) {
      messages.push(`📸 <b>Instagram Followers Updated!</b>\n👤 User: <code>${parsedUsername}</code>\nOld: <b>${previousState.followers}</b>\nNew: <b>${details.followers}</b>`);
    }
    if (details.following && previousState.following && details.following !== previousState.following) {
      messages.push(`📸 <b>Instagram Following Count Updated!</b>\n👤 User: <code>${parsedUsername}</code>\nOld: <b>${previousState.following}</b>\nNew: <b>${details.following}</b>`);
    }

    // Send notifications
    for (const msg of messages) {
      if (pfpChanged && msg.includes('Profile Picture Updated')) {
        await telegram.sendPhoto(currentPfpPath, msg);
      } else {
        await telegram.sendMessage(msg);
      }
    }

    // Update state file
    if (pfpCropped) {
      fs.copyFileSync(currentPfpPath, previousPfpPath);
    }
    fs.writeFileSync(stateFilePath, JSON.stringify({
      username: parsedUsername,
      bio: details.bio,
      fullName: details.fullName,
      followers: details.followers || previousState.followers,
      following: details.following || previousState.following,
      pfpMd5: pfpMd5 || previousState.pfpMd5
    }, null, 2));

  } catch (error) {
    console.error(`[INSTAGRAM] Critical error running check for ${targetUser}:`, error.message);
  }
}

module.exports = {
  checkInstagram
};
