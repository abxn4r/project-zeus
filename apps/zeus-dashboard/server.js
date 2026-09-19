const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');

const PORT = process.env.PORT || 8080;
const SERVER_ROOT = process.env.SERVER_ROOT || '/data/local/server';
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORTS_DIR = path.join(SERVER_ROOT, 'reports');

// Ensure reports directory exists
try { fs.mkdirSync(REPORTS_DIR, { recursive: true }); } catch (e) {}

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.txt': 'text/plain; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Helper: Append system log entry
function logSystemEvent(level, message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLine = `[${timestamp}] [${level.padEnd(7)}] ${message}\n`;
    const mainLogPath = path.join(SERVER_ROOT, 'logs/main.log');
    try {
        fs.mkdirSync(path.dirname(mainLogPath), { recursive: true });
        fs.appendFileSync(mainLogPath, logLine);
    } catch (e) {}
}

// Helper: Run shell command safely and return output promise
function runCmd(command) {
    return new Promise((resolve) => {
        exec(command, { timeout: 8000, env: { ...process.env, SERVER_ROOT } }, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, output: (stderr || stdout || error.message).trim() });
            } else {
                resolve({ success: true, output: stdout.trim() });
            }
        });
    });
}

// Gather System Telemetry
async function getTelemetry() {
    let cpuTemp = 0;
    try {
        let maxTemp = 0;
        const thermalDir = '/sys/class/thermal';
        if (fs.existsSync(thermalDir)) {
            const zones = fs.readdirSync(thermalDir).filter(name => name.startsWith('thermal_zone'));
            for (const zone of zones) {
                const typePath = path.join(thermalDir, zone, 'type');
                const tempPath = path.join(thermalDir, zone, 'temp');
                if (fs.existsSync(typePath) && fs.existsSync(tempPath)) {
                    const type = fs.readFileSync(typePath, 'utf8').trim();
                    if (type.startsWith('cpu-') && type.endsWith('-usr')) {
                        const temp = parseInt(fs.readFileSync(tempPath, 'utf8').trim(), 10) || 0;
                        if (temp > maxTemp) {
                            maxTemp = temp;
                        }
                    }
                }
            }
        }
        cpuTemp = Math.round(maxTemp / 1000);
        if (cpuTemp === 0) {
            const rawCpu = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim();
            cpuTemp = Math.round(parseInt(rawCpu, 10) / 1000);
        }
    } catch (e) {
        try {
            const rawCpu = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8').trim();
            cpuTemp = Math.round(parseInt(rawCpu, 10) / 1000);
        } catch (err) {}
    }

    let battTemp = 0, battPct = 'N/A', battStatus = 'N/A';
    try {
        const rawBattTemp = fs.readFileSync('/sys/class/power_supply/battery/temp', 'utf8').trim();
        battTemp = Math.round(parseInt(rawBattTemp, 10) / 10);
    } catch (e) {}

    try {
        battPct = fs.readFileSync('/sys/class/power_supply/battery/capacity', 'utf8').trim();
    } catch (e) {}

    try {
        battStatus = fs.readFileSync('/sys/class/power_supply/battery/status', 'utf8').trim();
    } catch (e) {}

    let cpuFreq = 0, cpuGov = 'N/A';
    try {
        cpuFreq = Math.round(parseInt(fs.readFileSync('/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq', 'utf8').trim(), 10) / 1000);
        cpuGov = fs.readFileSync('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor', 'utf8').trim();
    } catch (e) {}

    const freeRes = await runCmd('free -m 2>/dev/null || true');
    let ramTotal = 0, ramUsed = 0, ramFree = 0, ramAvail = 0;
    if (freeRes.success && freeRes.output) {
        const memLine = freeRes.output.split('\n').find(l => l.startsWith('Mem:'));
        if (memLine) {
            const parts = memLine.split(/\s+/);
            ramTotal = parseInt(parts[1], 10) || 0;
            ramUsed = parseInt(parts[2], 10) || 0;
            ramFree = parseInt(parts[3], 10) || 0;
            ramAvail = parseInt(parts[6] || parts[3], 10) || 0;
        }
    }

    const dfRes = await runCmd('df -h /data 2>/dev/null || df /data 2>/dev/null');
    let diskTotal = '104G', diskUsed = '8.4G', diskFree = '95G', diskPct = '9%';
    if (dfRes.success && dfRes.output) {
        const lines = dfRes.output.trim().split('\n');
        if (lines.length >= 2) {
            const dataLine = lines[lines.length - 1].trim();
            const parts = dataLine.split(/\s+/);
            if (parts.length >= 5) {
                diskTotal = parts[1];
                diskUsed = parts[2];
                diskFree = parts[3];
                diskPct = parts[4];
            }
        }
    }

    let ipAddr = 'N/A';
    try {
        const ipRes = await runCmd("ip -4 addr show wlan0 2>/dev/null | grep -oE 'inet [0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+' | awk '{print $2}'");
        if (ipRes.success && ipRes.output) {
            ipAddr = ipRes.output.trim();
            // Sync dynamic IP back to current_ip cache
            fs.writeFileSync(path.join(SERVER_ROOT, 'runtime/current_ip'), ipAddr);
        } else {
            ipAddr = fs.readFileSync(path.join(SERVER_ROOT, 'runtime/current_ip'), 'utf8').trim();
        }
    } catch (e) {
        try {
            ipAddr = fs.readFileSync(path.join(SERVER_ROOT, 'runtime/current_ip'), 'utf8').trim();
        } catch (err) {}
    }

    const uptimeRes = await runCmd('uptime 2>/dev/null || cat /proc/uptime 2>/dev/null');
    const uptimeStr = uptimeRes.output || 'N/A';

    let loadAvg = 'N/A';
    try {
        loadAvg = fs.readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join(' ');
    } catch (e) {}

    let bootCount = '1', lastBoot = 'N/A';
    try {
        bootCount = fs.readFileSync(path.join(SERVER_ROOT, 'state/boot_count'), 'utf8').trim();
        lastBoot = fs.readFileSync(path.join(SERVER_ROOT, 'state/last_boot'), 'utf8').trim();
    } catch (e) {}

    let hostDevice = process.env.DEVICE_NAME;
    if (!hostDevice) {
        const modelRes = await runCmd('getprop ro.product.model 2>/dev/null');
        if (modelRes.success && modelRes.output) {
            const platRes = await runCmd('getprop ro.board.platform 2>/dev/null');
            const platStr = platRes.success && platRes.output ? ` (${platRes.output})` : '';
            hostDevice = `${modelRes.output}${platStr}`;
        } else {
            hostDevice = 'Realme X3 (Snapdragon 855+ / 8GB RAM)';
        }
    }

    return {
        timestamp: new Date().toISOString(),
        host: hostDevice,
        cpu: { temp: cpuTemp, freqMhz: cpuFreq, governor: cpuGov },
        battery: { temp: battTemp, levelPct: battPct, status: battStatus },
        memory: { totalMb: ramTotal, usedMb: ramUsed, freeMb: ramFree, availMb: ramAvail },
        storage: { total: diskTotal, used: diskUsed, free: diskFree, percent: diskPct },
        network: { ip: ipAddr },
        system: { uptime: uptimeStr, loadAverage: loadAvg, bootCount, lastBoot }
    };
}

// Gather Services Status
async function getServicesStatus() {
    const services = [
        { name: 'sshd', title: 'SSH / SFTP Server', port: '8022/2222', check: 'pgrep -f sshd >/dev/null || pgrep dropbear >/dev/null' },
        { name: 'ftpd', title: 'PhotoSync FTP Server', port: '2121', check: 'pgrep -f "tcpsvd.*2121" >/dev/null || pgrep -f "photo_ftp_server.py" >/dev/null' },
        { name: 'adbd', title: 'Wireless ADB', port: '5555', check: '[ "$(getprop service.adb.tcp.port)" = "5555" ]' },
        { name: 'tailscale', title: 'Tailscale VPN', port: 'P2P Mesh', check: 'pgrep -f tailscaled >/dev/null' },
        { name: 'zap', title: 'OWASP ZAP', port: '8090', check: 'pgrep -f zap.sh >/dev/null || pgrep -f "zap-.*.jar" >/dev/null' },
        { name: 'watchdog', title: 'Process Supervisor', port: 'Internal', check: 'pgrep -f supervise.sh >/dev/null' },
        { name: 'dashboard', title: 'Tactical Matrix HUD', port: String(PORT), check: 'pgrep -f "node server.js" >/dev/null' }
    ];

    const results = [];
    for (const svc of services) {
        const res = await runCmd(`${svc.check} && echo "RUNNING" || echo "STOPPED"`);
        results.push({
            name: svc.name,
            title: svc.title,
            port: svc.port,
            status: res.output === 'RUNNING' ? 'RUNNING' : 'STOPPED'
        });
    }
    return results;
}

// Read System Logs with Auto-Initialization & Dynamic Kernel Output
async function getLogs(logName = 'boot') {
    if (logName === 'system') {
        const dmesgRes = await runCmd('dmesg 2>/dev/null | tail -n 40 || logcat -d -t 40 2>/dev/null');
        return dmesgRes.output || '> System kernel logcat / dmesg stream active.';
    }

    const logMap = {
        boot: path.join(SERVER_ROOT, 'logs/boot.log'),
        watchdog: path.join(SERVER_ROOT, 'logs/watchdog.log'),
        metrics: path.join(SERVER_ROOT, 'logs/metrics.log'),
        services: path.join(SERVER_ROOT, 'logs/services.log'),
        main: path.join(SERVER_ROOT, 'logs/main.log'),
        maint: path.join(SERVER_ROOT, 'logs/maintenance.log'),
        zap: path.join(SERVER_ROOT, 'logs/zap.log'),
        dashboard: path.join(SERVER_ROOT, 'logs/dashboard.log')
    };

    const filePath = logMap[logName] || path.join(SERVER_ROOT, `logs/${logName}.log`);

    if (!fs.existsSync(filePath)) {
        const initText = `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] [INFO   ] Log stream [${path.basename(filePath)}] initialized.\n`;
        try {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, initText);
            return initText;
        } catch (e) {
            return `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] [INFO   ] Log stream [${path.basename(filePath)}] active. Waiting for events...`;
        }
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
            return `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] [INFO   ] Log stream [${path.basename(filePath)}] active. Waiting for events...`;
        }
        return lines.slice(-40).join('\n');
    } catch (err) {
        return `Error reading log file: ${err.message}`;
    }
}

let cachedProcesses = [];

async function updateTopProcesses() {
    const res = await runCmd('top -b -n 1 | head -n 25');
    if (!res.success || !res.output) return;

    const lines = res.output.split('\n');
    const procList = [];
    let startParsing = false;

    for (let line of lines) {
        line = line.trim();
        if (line.includes('PID') && line.includes('USER') && (line.includes('ARGS') || line.includes('CMD'))) {
            startParsing = true;
            continue;
        }
        if (!startParsing) continue;

        const parts = line.split(/\s+/);
        if (parts.length < 12) continue;

        const pid = parts[0];
        const user = parts[1];
        const cpu = parts[8];
        const mem = parts[9];
        let cmd = parts.slice(11).join(' ');
        if (cmd.length > 50) {
            cmd = cmd.substring(0, 47) + '...';
        }

        procList.push({ pid, user, cpu, mem, cmd });
    }

    if (procList.length > 0) {
        cachedProcesses = procList.slice(0, 10);
    }
}

// -----------------------------------------------------------------------------
// Vulnerability Scanner Coordinator
// -----------------------------------------------------------------------------
let activeScan = {
    running: false,
    target: null,
    type: null,
    startTime: null,
    output: '',
    reportUrl: null,
    exitCode: null
};
let currentScanChild = null;

function getRecentReports() {
    try {
        if (!fs.existsSync(REPORTS_DIR)) return [];
        const files = fs.readdirSync(REPORTS_DIR);
        return files
            .filter(f => f.endsWith('.html') || f.endsWith('.txt') || f.endsWith('.json'))
            .map(f => {
                const stat = fs.statSync(path.join(REPORTS_DIR, f));
                return {
                    filename: f,
                    sizeBytes: stat.size,
                    url: `/reports/${f}`,
                    created: stat.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created))
            .slice(0, 20);
    } catch (e) {
        return [];
    }
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const url = parsedUrl;

    const sendJson = (data, statusCode = 200) => {
        res.writeHead(statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify(data));
    };

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // SSE Realtime Stream
    if (pathname === '/api/stream') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        const sendEvent = async () => {
            const telemetry = await getTelemetry();
            const services = await getServicesStatus();
            const payload = JSON.stringify({ telemetry, services, processes: cachedProcesses, scanner: activeScan });
            res.write(`data: ${payload}\n\n`);
        };

        await sendEvent();
        const interval = setInterval(sendEvent, 1000);

        req.on('close', () => {
            clearInterval(interval);
        });
        return;
    }

    if (pathname === '/api/telemetry') {
        const telemetry = await getTelemetry();
        return sendJson(telemetry);
    }

    if (pathname === '/api/services') {
        const services = await getServicesStatus();
        return sendJson(services);
    }

    if (pathname === '/api/processes') {
        return sendJson(cachedProcesses);
    }

    if (pathname === '/api/upload-photo' && req.method === 'POST') {
        const customName = req.headers['x-filename'] || req.headers['filename'];
        const fileName = customName ? path.basename(decodeURIComponent(customName)) : `ios_photo_${Date.now()}.heic`;
        const destPath = path.join('/sdcard/DCIM/Camera', fileName);

        const fileStream = fs.createWriteStream(destPath);
        req.pipe(fileStream);

        fileStream.on('finish', () => {
            runCmd(`am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://${destPath}" 2>/dev/null`);
            return sendJson({ success: true, saved: destPath, filename: fileName });
        });

        fileStream.on('error', (err) => {
            return sendJson({ error: err.message }, 500);
        });
        return;
    }

    if (pathname === '/api/logs') {
        const logName = url.searchParams.get('name') || 'boot';
        const logText = await getLogs(logName);
        return sendJson({ name: logName, logs: logText });
    }

    // -------------------------------------------------------------------------
    // Scanner API Endpoints
    // -------------------------------------------------------------------------
    if (pathname === '/api/scanner/status') {
        return sendJson({
            activeScan,
            reports: getRecentReports()
        });
    }

    if (pathname === '/api/scanner/reports') {
        return sendJson({ reports: getRecentReports() });
    }

    if (pathname === '/api/scanner/start' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                let target = (parsed.target || '').trim();
                const scanType = (parsed.type || 'nuclei').trim();

                if (!target) {
                    return sendJson({ error: 'Target URL is required (e.g. https://my-site.com)' }, 400);
                }

                if (!target.startsWith('http://') && !target.startsWith('https://')) {
                    target = 'https://' + target;
                }

                if (activeScan.running) {
                    return sendJson({ error: 'A scan is already currently running. Please wait or stop it first.' }, 409);
                }

                logSystemEvent('INFO', `SCANNER: Starting scan (${scanType}) on target: ${target}`);

                activeScan = {
                    running: true,
                    target: target,
                    type: scanType,
                    startTime: new Date().toISOString(),
                    output: `[INIT] Spawning Zeus Vulnerability Scanner for ${target} (${scanType})...\n`,
                    reportUrl: null,
                    exitCode: null
                };

                const zeusScanBin = path.join(SERVER_ROOT, 'bin/zeus-scan');
                const scanScript = fs.existsSync(zeusScanBin) ? zeusScanBin : 'zeus-scan';

                currentScanChild = spawn('sh', [scanScript, target, scanType], {
                    env: {
                        ...process.env,
                        SERVER_ROOT,
                        HOME: '/data/data/com.termux/files/home',
                        PREFIX: '/data/data/com.termux/files/usr',
                        JAVA_HOME: '/data/data/com.termux/files/usr/lib/jvm/java-17-openjdk',
                        PATH: `/data/data/com.termux/files/usr/lib/jvm/java-17-openjdk/bin:${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:${process.env.PATH}`
                    }
                });

                currentScanChild.stdout.on('data', (data) => {
                    const text = data.toString();
                    activeScan.output += text;
                    if (activeScan.output.length > 50000) {
                        activeScan.output = activeScan.output.slice(-40000);
                    }
                });

                currentScanChild.stderr.on('data', (data) => {
                    const text = data.toString();
                    activeScan.output += text;
                });

                currentScanChild.on('close', (code) => {
                    activeScan.running = false;
                    activeScan.exitCode = code;
                    currentScanChild = null;

                    // Locate newly generated report
                    const reports = getRecentReports();
                    if (reports.length > 0) {
                        activeScan.reportUrl = reports[0].url;
                    }

                    logSystemEvent('INFO', `SCANNER: Completed scan for ${target} with code ${code}`);
                });

                return sendJson({ success: true, message: 'Scan initiated successfully', activeScan });
            } catch (e) {
                return sendJson({ error: 'Invalid JSON payload: ' + e.message }, 400);
            }
        });
        return;
    }

    if (pathname === '/api/scanner/stop' && req.method === 'POST') {
        if (activeScan.running && currentScanChild) {
            try {
                currentScanChild.kill('SIGTERM');
                runCmd('pkill -f zeus-scan 2>/dev/null; pkill -f nuclei 2>/dev/null');
                activeScan.running = false;
                activeScan.output += '\n[!] Scan process stopped by user.\n';
                logSystemEvent('WARN', 'SCANNER: Active scan manually aborted by user.');
                return sendJson({ success: true, message: 'Scan stopped' });
            } catch (err) {
                return sendJson({ error: err.message }, 500);
            }
        }
        return sendJson({ error: 'No active scan running to stop.' }, 400);
    }

    // Serve Generated Vulnerability Reports directly to PC Browser
    if (pathname.startsWith('/reports/')) {
        const reqFile = path.basename(pathname);
        const reportPath = path.join(REPORTS_DIR, reqFile);

        if (!fs.existsSync(reportPath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Report not found');
        }

        const ext = path.extname(reportPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'text/html; charset=UTF-8';
        res.writeHead(200, { 'Content-Type': contentType });
        return fs.createReadStream(reportPath).pipe(res);
    }

    if (pathname === '/api/action/restart' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const svcName = parsed.service;
                if (!svcName) return sendJson({ error: 'Missing service name' }, 400);

                logSystemEvent('INFO', `WEB_ADMIN: Requested restart for service [${svcName}]`);

                const zeusBin = path.join(SERVER_ROOT, 'bin/zeus');
                const cmd = fs.existsSync(zeusBin) ? `sh ${zeusBin} restart ${svcName}` : `zeus restart ${svcName}`;
                const result = await runCmd(cmd);
                return sendJson({ success: result.success, output: result.output });
            } catch (e) {
                return sendJson({ error: 'Invalid JSON payload' }, 400);
            }
        });
        return;
    }

    if (pathname === '/api/action/cli' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const commandStr = (parsed.command || 'status').trim();

                const allowed = ['status', 'metrics', 'doctor', 'backup', 'logs', 'runtimes', 'tailscale', 'scan', 'scanner'];
                const subCmd = commandStr.split(' ')[0];

                if (!allowed.includes(subCmd)) {
                    logSystemEvent('WARN', `WEB_ADMIN: Blocked unauthorized command execution attempt [${commandStr}]`);
                    return sendJson({ error: `Command '${subCmd}' not permitted via Web UI.` }, 403);
                }

                logSystemEvent('INFO', `WEB_ADMIN: Executed CLI command [zeus ${commandStr}]`);

                const zeusBin = path.join(SERVER_ROOT, 'bin/zeus');
                const execStr = fs.existsSync(zeusBin) ? `sh ${zeusBin} ${commandStr}` : `zeus ${commandStr}`;
                const result = await runCmd(execStr);
                return sendJson({ success: result.success, output: result.output });
            } catch (e) {
                return sendJson({ error: 'Invalid JSON payload' }, 400);
            }
        });
        return;
    }

    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    logSystemEvent('INFO', `Dashboard & Vulnerability Scanner API Server listening on port ${PORT}`);
    console.log(`[ZEUS HUD] Tactical Dashboard & Scanner API active on port ${PORT}`);
    console.log(`[ZEUS HUD] Server Root: ${SERVER_ROOT}`);
    console.log(`[ZEUS HUD] Reports Dir: ${REPORTS_DIR}`);
    
    // Start background processes monitoring loop
    updateTopProcesses();
    setInterval(updateTopProcesses, 3000);
});
