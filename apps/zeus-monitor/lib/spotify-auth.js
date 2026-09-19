const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');

const configPath = path.join(__dirname, '..', 'config.json');

if (!fs.existsSync(configPath)) {
  console.error('[AUTH] config.json not found! Please run deploy and verify configuration first.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const { clientId, clientSecret } = config.spotify;
if (!clientId || clientId.includes('YOUR_')) {
  console.error('[AUTH] Please configure your Spotify clientId in config.json first!');
  process.exit(1);
}
if (!clientSecret || clientSecret.includes('YOUR_')) {
  console.error('[AUTH] Please configure your Spotify clientSecret in config.json first!');
  process.exit(1);
}

// Spotify updated policies: localhost is blocked, must use 127.0.0.1 loopback literal with HTTP
const PORT = 8080;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

const SCOPE = 'playlist-read-private playlist-read-collaborative';
const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}`;

console.log('\n======================================================================');
console.log('⚡ SPOTIFY OAUTH AUTHORIZATION CLI SETUP ⚡');
console.log('======================================================================\n');
console.log('1. Go to your Spotify Developer App Dashboard Settings.');
console.log(`2. Ensure you have added this exact Redirect URI:\n   👉 \x1b[33m${REDIRECT_URI}\x1b[0m`);
console.log('3. Save your settings on the dashboard!');
console.log('4. Now, open this authorization link in your web browser:\n');
console.log(`👉 \x1b[36m${authUrl}\x1b[0m\n`);
console.log('======================================================================');
console.log('👉 METHOD A (Automatic Callback):');
console.log(`   Keep this script running. If port ${PORT} is open, the token will save automatically.`);
console.log('👉 METHOD B (Manual Paste - Recommended for SSH/Headless):');
console.log('   When redirected, copy the entire URL (even if the page fails to load)');
console.log('   from your browser address bar. It will look like:');
console.log('   http://127.0.0.1:8080/callback?code=AQ... ');
console.log('   Copy and paste that URL or code below, and hit Enter!');
console.log('======================================================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const handleCode = async (code) => {
  console.log('[AUTH] Exchanging code for tokens...');
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { refresh_token } = tokenRes.data;
    
    // Write back to config
    config.spotify.refreshToken = refresh_token;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log('\n======================================================================');
    console.log('🎉 SUCCESS: Spotify Refresh Token obtained and saved to config.json! 🎉');
    console.log('======================================================================\n');
    
    server.close();
    rl.close();
    process.exit(0);
  } catch (err) {
    console.error('[AUTH] Error exchanging code for tokens:', err.response?.data || err.message);
    server.close();
    rl.close();
    process.exit(1);
  }
};

// Set up manual prompt listener
rl.question('Paste the code or redirected URL here: ', (input) => {
  let code = input.trim();
  if (code.includes('code=')) {
    const regexMatch = code.match(/[?&]code=([^&]+)/);
    if (regexMatch) {
      code = regexMatch[1];
    }
  }
  if (code) {
    handleCode(code);
  } else {
    console.error('[AUTH] No code found in input.');
    server.close();
    rl.close();
    process.exit(1);
  }
});

// Plain HTTP fallback server just in case
const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url, true);
  if (reqUrl.pathname === '/callback') {
    const code = reqUrl.query.code;
    if (code) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h3>Authentication Successful!</h3><p>You can close this window now.</p>');
      await handleCode(code);
    }
  }
});

server.listen(PORT).on('error', () => {
  console.log(`[AUTH] Port ${PORT} busy. Running in Manual Paste mode only.`);
});
