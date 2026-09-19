/* ==============================================================================
 * Project Zeus - Phosphor Green CRT Tactical Dashboard Client Application
 * Aesthetic: Dark Brutalist Cyber Terminal / Phosphor Matrix HUD
 * ============================================================================== */

let currentLogTab = 'boot';
let rawLogStream = '';
let isAutoScrollActive = true;
let logFilterQuery = '';

const MAX_HISTORY = 60;
const historyPoints = Array.from({ length: MAX_HISTORY }, (_, i) => 20 + Math.sin(i * 0.25) * 12 + Math.random() * 6);
let scanSweepOffset = 0;

let currentProcessMode = 'table';
let lastProcessData = [];
let processFilterQuery = '';
let hoveredSliceIndex = -1;

let isScanRunning = false;

// -----------------------------------------------------------------------------
// 1. LIVE CLOCK & CLIPBOARD
// -----------------------------------------------------------------------------
function updateClock() {
    const timeEl = document.getElementById('current-time');
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    }
}
setInterval(updateClock, 1000);
updateClock();

function copyIpAddress() {
    const ipEl = document.getElementById('header-ip-val');
    const tooltip = document.getElementById('copy-feedback');
    if (!ipEl) return;

    const text = ipEl.textContent.trim();
    const showFeedback = () => {
        if (tooltip) {
            tooltip.classList.add('visible');
            setTimeout(() => tooltip.classList.remove('visible'), 1600);
        }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showFeedback).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }

    function fallbackCopy(str) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = str;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showFeedback();
        } catch (e) {}
    }
}

// -----------------------------------------------------------------------------
// 2. ASCII PROGRESS BAR GENERATOR (BRUTALIST STANDARD)
// -----------------------------------------------------------------------------
function generateAsciiBar(pct, totalBlocks = 10) {
    const clamped = Math.max(0, Math.min(100, pct));
    const filledCount = Math.round((clamped / 100) * totalBlocks);
    const emptyCount = totalBlocks - filledCount;
    const filled = '█'.repeat(filledCount);
    const empty = '░'.repeat(emptyCount);
    return `[${filled}${empty}] ${clamped.toFixed(0)}%`;
}

// -----------------------------------------------------------------------------
// 3. SMOOTH PHOSPHOR GREEN OSCILLOSCOPE GRAPH (60 FPS)
// -----------------------------------------------------------------------------
function animateOscilloscopeGraph() {
    const canvas = document.getElementById('realtime-graph');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parentW = canvas.parentElement.clientWidth || 550;
    const parentH = canvas.parentElement.clientHeight || 42;
    if (canvas.width !== parentW) canvas.width = parentW;
    if (canvas.height !== parentH) canvas.height = parentH;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Matrix background grid lines
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.09)';
    ctx.lineWidth = 1;
    for (let y = 10; y < h; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    for (let x = 25; x < w; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }

    // Micro-jitter to the trailing point
    const lastIdx = historyPoints.length - 1;
    const jitter = (Math.random() - 0.5) * 1.5;
    historyPoints[lastIdx] = Math.max(8, Math.min(92, historyPoints[lastIdx] + jitter * 0.12));

    const step = w / (MAX_HISTORY - 1);

    // Soft gradient fill under wave
    ctx.beginPath();
    ctx.moveTo(0, h);

    for (let i = 0; i < historyPoints.length; i++) {
        const x = i * step;
        const val = historyPoints[i];
        const y = h - (val / 100) * (h - 8) - 4;
        ctx.lineTo(x, y);
    }

    ctx.lineTo((historyPoints.length - 1) * step, h);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(0, 255, 102, 0.32)');
    gradient.addColorStop(1, 'rgba(0, 255, 102, 0.01)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Sharp phosphor wave line
    ctx.beginPath();
    for (let i = 0; i < historyPoints.length; i++) {
        const x = i * step;
        const val = historyPoints[i];
        const y = h - (val / 100) * (h - 8) - 4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Radar reticle sweep line
    scanSweepOffset = (scanSweepOffset + 2) % w;
    ctx.strokeStyle = 'rgba(51, 255, 136, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scanSweepOffset, 0);
    ctx.lineTo(scanSweepOffset, h);
    ctx.stroke();

    requestAnimationFrame(animateOscilloscopeGraph);
}

// -----------------------------------------------------------------------------
// 4. TELEMETRY & HARDWARE MATRIX HANDLER
// -----------------------------------------------------------------------------
function updateTelemetryUI(data) {
    if (!data) return;

    // Header & Ribbon
    const hostHeader = document.getElementById('host-header-val');
    if (hostHeader && data.host) {
        hostHeader.textContent = data.host.toUpperCase();
    }
    const footerHost = document.getElementById('footer-host-str');
    if (footerHost && data.host) {
        footerHost.textContent = data.host.toUpperCase();
    }

    const ipHeader = document.getElementById('header-ip-val');
    if (ipHeader && data.network && data.network.ip) {
        ipHeader.textContent = data.network.ip;
    }

    const uptimeEl = document.getElementById('sys-uptime-val');
    if (uptimeEl && data.system && data.system.uptime) {
        const upMatch = data.system.uptime.match(/up\s+([^,]+(?:,\s*[^,]+)?)/);
        uptimeEl.textContent = upMatch ? upMatch[1].trim() : (data.system.uptime !== 'N/A' ? data.system.uptime : 'Active');
    }

    const bootsEl = document.getElementById('sys-boots-val');
    if (bootsEl && data.system && data.system.bootCount) {
        bootsEl.textContent = `#${data.system.bootCount}`;
    }

    const loadEl = document.getElementById('sys-load-val');
    if (loadEl && data.system && data.system.loadAverage) {
        loadEl.textContent = data.system.loadAverage;
    }

    // CPU Thermal & History
    const cpuTemp = data.cpu ? (data.cpu.temp || 0) : 0;
    const cpuPct = Math.min(100, Math.round((cpuTemp / 90) * 100));

    const cpuValEl = document.getElementById('cpu-temp-val');
    if (cpuValEl) {
        cpuValEl.textContent = `${cpuTemp}°C`;
        cpuValEl.className = 'metric-val ' + (cpuTemp > 65 ? 'text-red' : cpuTemp > 45 ? 'text-amber' : 'text-glow-green');
    }

    const cpuBarEl = document.getElementById('cpu-bar');
    if (cpuBarEl) cpuBarEl.textContent = generateAsciiBar(cpuPct);

    // Push calculated point to oscilloscope buffer
    const loadStr = (data.system.loadAverage || '0').split(' ')[0];
    const loadNum = parseFloat(loadStr) || 0;
    const newPointPct = Math.min(95, Math.max(10, Math.round(loadNum * 22 + (cpuTemp / 90) * 40 + Math.random() * 4)));
    historyPoints.push(newPointPct);
    if (historyPoints.length > MAX_HISTORY) historyPoints.shift();

    const graphValEl = document.getElementById('graph-live-val');
    if (graphValEl) graphValEl.textContent = `LOAD: ${loadNum.toFixed(2)} | CPU: ${cpuTemp}°C`;

    // RAM Memory
    const ramTotal = data.memory ? (data.memory.totalMb || 7529) : 7529;
    const ramUsed = data.memory ? (data.memory.usedMb || 0) : 0;
    const ramAvail = data.memory ? (data.memory.availMb || 0) : 0;
    const ramPct = Math.round((ramUsed / ramTotal) * 100);

    const ramValEl = document.getElementById('ram-val');
    if (ramValEl) ramValEl.textContent = `${ramUsed}MB / ${ramTotal}MB`;

    const ramBarEl = document.getElementById('ram-bar');
    if (ramBarEl) ramBarEl.textContent = generateAsciiBar(ramPct);

    const ramAvailEl = document.getElementById('ram-avail-val');
    if (ramAvailEl) ramAvailEl.textContent = `${ramAvail} MB`;

    // Storage (/data)
    const diskTotal = data.storage && data.storage.total !== 'N/A' ? data.storage.total : '104G';
    const diskUsed = data.storage && data.storage.used !== 'N/A' ? data.storage.used : '22G';
    const diskPct = parseInt((data.storage && data.storage.percent) || '22', 10) || 22;

    const diskValEl = document.getElementById('disk-val');
    if (diskValEl) diskValEl.textContent = `${diskUsed} / ${diskTotal} (${diskPct}% used)`;

    const diskBarEl = document.getElementById('disk-bar');
    if (diskBarEl) diskBarEl.textContent = generateAsciiBar(diskPct);

    // Battery & Power
    const battPct = parseInt((data.battery && data.battery.levelPct) || '100', 10) || 100;
    const battTemp = data.battery ? (data.battery.temp || 29) : 29;
    const battStatus = (data.battery && data.battery.status) || 'Full';

    const battValEl = document.getElementById('batt-val');
    if (battValEl) battValEl.textContent = `${battPct}% (${battStatus} | ${battTemp}°C)`;

    const battBarEl = document.getElementById('batt-bar');
    if (battBarEl) battBarEl.textContent = generateAsciiBar(battPct);

    // CPU Details
    const cpuFreqEl = document.getElementById('cpu-freq-val');
    if (cpuFreqEl && data.cpu) {
        cpuFreqEl.textContent = `${data.cpu.freqMhz || 0} MHz`;
    }

    const cpuGovEl = document.getElementById('cpu-gov-val');
    if (cpuGovEl && data.cpu) {
        cpuGovEl.textContent = data.cpu.governor || 'schedutil';
    }
}

// -----------------------------------------------------------------------------
// 5. SERVICES REGISTRY MATRIX
// -----------------------------------------------------------------------------
function updateServicesUI(services) {
    const container = document.getElementById('services-container');
    if (!container || !Array.isArray(services)) return;

    const runningCount = services.filter(s => s.status === 'RUNNING').length;
    const summaryEl = document.getElementById('sys-services-summary');
    if (summaryEl) {
        summaryEl.textContent = `${runningCount}/${services.length} RUNNING`;
        summaryEl.className = 'chip-val ' + (runningCount === services.length ? 'text-glow-green' : 'text-amber');
    }

    container.innerHTML = services.map(svc => {
        const isRunning = svc.status === 'RUNNING';
        return `
            <div class="svc-card">
                <div class="svc-info">
                    <span class="svc-title">&gt; ${svc.title} (${svc.name})</span>
                    <span class="svc-sub">PORT / PROTOCOL: ${svc.port}</span>
                </div>
                <div class="svc-controls">
                    <span class="badge ${isRunning ? 'running' : 'stopped'}">${svc.status}</span>
                    <button class="btn-restart" onclick="restartService('${svc.name}', this)">[RESTART]</button>
                </div>
            </div>
        `;
    }).join('');
}

async function restartService(svcName, btnEl) {
    appendTerminalLine(`> RESTARTING SERVICE [${svcName}]...`);
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = '[RESTARTING...]';
    }

    try {
        const res = await fetch('/api/action/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: svcName })
        });
        const data = await res.json();
        if (data.success) {
            appendTerminalLine(`> SUCCESS: Service [${svcName}] restarted cleanly.`);
        } else {
            appendTerminalLine(`> ERROR: ${data.output || 'Restart failed'}`);
        }
    } catch (err) {
        appendTerminalLine(`> ERROR: Network failure restarting service ${svcName}`);
    } finally {
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.textContent = '[RESTART]';
        }
    }
}

// -----------------------------------------------------------------------------
// 6. TOP PROCESSES MONITOR (TABULAR + RADAR TOGGLE)
// -----------------------------------------------------------------------------
function updateProcessesUI(processes) {
    if (!Array.isArray(processes)) return;
    lastProcessData = processes;

    if (currentProcessMode === 'table') {
        renderProcessTable();
    } else {
        drawProcessesPie();
    }
}

function filterProcesses(query) {
    processFilterQuery = (query || '').toLowerCase().trim();
    if (currentProcessMode === 'table') {
        renderProcessTable();
    }
}

function renderProcessTable() {
    const tbody = document.getElementById('process-table-body');
    if (!tbody) return;

    let procs = lastProcessData;
    if (processFilterQuery) {
        procs = procs.filter(p =>
            p.cmd.toLowerCase().includes(processFilterQuery) ||
            p.pid.toString().includes(processFilterQuery) ||
            p.user.toLowerCase().includes(processFilterQuery)
        );
    }

    if (procs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--phosphor-dim);">&gt; NO MATCHING PROCESSES</td></tr>`;
        return;
    }

    tbody.innerHTML = procs.map(proc => `
        <tr>
            <td style="color: var(--phosphor-dim);">${proc.pid}</td>
            <td>${proc.user}</td>
            <td style="text-align: right; font-weight: bold; color: var(--phosphor-bright);">${proc.cpu}%</td>
            <td style="text-align: right; color: var(--phosphor-glow);">${proc.mem}%</td>
            <td class="cmd-cell" title="${proc.cmd}">${proc.cmd}</td>
        </tr>
    `).join('');
}

function toggleProcessView() {
    const btn = document.getElementById('btn-proc-toggle');
    const tableWrap = document.getElementById('proc-table-wrap');
    const radarWrap = document.getElementById('proc-radar-wrap');

    if (currentProcessMode === 'table') {
        currentProcessMode = 'radar';
        if (tableWrap) tableWrap.style.display = 'none';
        if (radarWrap) radarWrap.style.display = 'flex';
        if (btn) btn.textContent = '[TABLE]';
        drawProcessesPie();
    } else {
        currentProcessMode = 'table';
        if (tableWrap) tableWrap.style.display = 'block';
        if (radarWrap) radarWrap.style.display = 'none';
        if (btn) btn.textContent = '[RADAR]';
        renderProcessTable();
    }
}

function drawProcessesPie() {
    const canvas = document.getElementById('processes-pie-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const parentW = canvas.parentElement.clientWidth || 260;
    const parentH = canvas.parentElement.clientHeight || 170;
    if (canvas.width !== parentW) canvas.width = parentW;
    if (canvas.height !== parentH) canvas.height = parentH;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!lastProcessData || lastProcessData.length === 0) {
        ctx.fillStyle = '#00ff66';
        ctx.font = '12px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('> NO PROCESS TELEMETRY', w / 2, h / 2);
        return;
    }

    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.42;

    // Tactical Radar Circles
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.33, 0, Math.PI * 2); ctx.stroke();

    let totalCpu = lastProcessData.reduce((acc, p) => acc + (parseFloat(p.cpu) || 0.1), 0);
    if (totalCpu === 0) totalCpu = 1;

    let startAngle = -Math.PI / 2;

    lastProcessData.forEach((proc, idx) => {
        const cpuVal = parseFloat(proc.cpu) || 0.1;
        const sliceAngle = (cpuVal / totalCpu) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;

        proc.startAngle = startAngle;
        proc.endAngle = endAngle;

        const isHovered = (idx === hoveredSliceIndex);
        const greenVal = 70 + (idx * 28) % 180;

        ctx.fillStyle = isHovered 
            ? 'rgba(0, 255, 102, 0.5)' 
            : `rgba(0, ${greenVal}, 102, 0.22)`;
        ctx.strokeStyle = isHovered ? '#00ff66' : 'rgba(0, 255, 102, 0.35)';
        ctx.lineWidth = isHovered ? 2 : 1;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        startAngle = endAngle;
    });

    // Center reticle
    ctx.fillStyle = '#020703';
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
}

function setupRadarHover() {
    const canvas = document.getElementById('processes-pie-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousemove', (evt) => {
        if (!lastProcessData || lastProcessData.length === 0) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = (evt.clientX - rect.left) * (canvas.width / rect.width);
        const mouseY = (evt.clientY - rect.top) * (canvas.height / rect.height);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const dx = mouseX - cx;
        const dy = mouseY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let newHovered = -1;
        if (dist <= Math.min(canvas.width, canvas.height) * 0.42) {
            let angle = Math.atan2(dy, dx);
            if (angle < -Math.PI / 2) angle += Math.PI * 2;

            for (let i = 0; i < lastProcessData.length; i++) {
                if (angle >= lastProcessData[i].startAngle && angle <= lastProcessData[i].endAngle) {
                    newHovered = i;
                    break;
                }
            }
        }

        if (newHovered !== hoveredSliceIndex) {
            hoveredSliceIndex = newHovered;
            drawProcessesPie();
            updateHoverDetails(hoveredSliceIndex);
        }
    });

    canvas.addEventListener('mouseleave', () => {
        hoveredSliceIndex = -1;
        drawProcessesPie();
        updateHoverDetails(-1);
    });
}

function updateHoverDetails(idx) {
    const box = document.getElementById('process-hover-details');
    if (!box) return;

    if (idx === -1 || !lastProcessData[idx]) {
        box.innerHTML = `<span class="lbl" style="color: var(--phosphor-dim);">&gt; HOVER RADAR SLICE FOR ANALYSIS</span>`;
        return;
    }

    const proc = lastProcessData[idx];
    box.innerHTML = `
        <div style="line-height: 1.3;">
            <span style="color: var(--phosphor-bright); font-weight: bold;">${proc.cmd}</span><br>
            <span class="lbl" style="color: var(--phosphor-dim);">PID:</span> ${proc.pid} [${proc.user}] | 
            <span class="lbl" style="color: var(--phosphor-dim);">CPU:</span> <strong style="color: var(--phosphor-bright);">${proc.cpu}%</strong> | 
            <span class="lbl" style="color: var(--phosphor-dim);">MEM:</span> ${proc.mem}%
        </div>
    `;
}

// -----------------------------------------------------------------------------
// 7. INTERACTIVE CYBER TERMINAL
// -----------------------------------------------------------------------------
async function runCliCmd(cmd) {
    appendTerminalLine(`zeus@realmex3:~# zeus ${cmd}`);
    try {
        const res = await fetch('/api/action/cli', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
        });
        const data = await res.json();
        if (data.output) {
            data.output.split('\n').forEach(line => appendTerminalLine(line));
        } else if (data.error) {
            appendTerminalLine(`> ERROR: ${data.error}`);
        }
    } catch (err) {
        appendTerminalLine(`> ERROR: Command execution failed.`);
    }
}

function handleCliSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('cli-input');
    if (!input) return;
    const cmdStr = input.value.trim();
    if (!cmdStr) return;

    input.value = '';
    const cleanCmd = cmdStr.startsWith('zeus ') ? cmdStr.substring(5) : cmdStr;
    runCliCmd(cleanCmd);
}

function appendTerminalLine(text) {
    const term = document.getElementById('terminal-output');
    if (!term) return;

    const line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = text;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
}

function clearTerminal() {
    const term = document.getElementById('terminal-output');
    if (term) term.innerHTML = '';
}

// -----------------------------------------------------------------------------
// 8. SYSTEM LOG STREAMER & FILTERING
// -----------------------------------------------------------------------------
async function fetchLogStream(logName) {
    currentLogTab = logName;
    try {
        const res = await fetch(`/api/logs?name=${logName}`);
        const data = await res.json();
        if (data && data.logs) {
            rawLogStream = data.logs;
            renderFilteredLogs();
        }
    } catch (e) {}
}

function switchLogTab(logName, btnEl) {
    document.querySelectorAll('.log-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    fetchLogStream(logName);
}

function filterLogStream(query) {
    logFilterQuery = (query || '').toLowerCase().trim();
    renderFilteredLogs();
}

function renderFilteredLogs() {
    const displayEl = document.getElementById('log-display');
    if (!displayEl) return;

    let lines = rawLogStream.split('\n');
    if (logFilterQuery) {
        lines = lines.filter(l => l.toLowerCase().includes(logFilterQuery));
    }

    if (lines.length === 0) {
        displayEl.textContent = `> NO LOG ENTRIES MATCHING [${logFilterQuery}]`;
        return;
    }

    displayEl.textContent = lines.join('\n');

    if (isAutoScrollActive) {
        displayEl.scrollTop = displayEl.scrollHeight;
    }
}

function toggleAutoScroll() {
    isAutoScrollActive = !isAutoScrollActive;
    const btn = document.getElementById('btn-autoscroll');
    if (btn) {
        btn.textContent = `SCROLL: ${isAutoScrollActive ? 'ON' : 'OFF'}`;
    }
}

// -----------------------------------------------------------------------------
// 9. DOCKED VULNERABILITY SCANNER (EXPANDABLE DRAWER)
// -----------------------------------------------------------------------------
function toggleScannerDrawer() {
    const drawer = document.getElementById('scanner-drawer-content');
    const btn = document.getElementById('scanner-drawer-btn');
    if (!drawer) return;

    const isClosed = drawer.style.display === 'none';
    drawer.style.display = isClosed ? 'block' : 'none';
    if (btn) btn.textContent = isClosed ? '[-] COLLAPSE' : '[+] EXPAND';

    if (isClosed) {
        fetchScannerReports();
    }
}

function updateScannerUI(scanner) {
    if (!scanner) return;

    const statusTag = document.getElementById('scanner-status-tag');
    const startBtn = document.getElementById('btn-start-scan');
    const stopBtn = document.getElementById('btn-stop-scan');
    const targetDisplay = document.getElementById('scan-target-display');
    const liveOutput = document.getElementById('scanner-live-output');

    if (scanner.running) {
        isScanRunning = true;
        if (statusTag) {
            statusTag.textContent = `// RUNNING: [${(scanner.type || 'NUCLEI').toUpperCase()}]`;
            statusTag.className = 'panel-tag text-glow-green';
        }
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'inline-block';
        if (targetDisplay) targetDisplay.textContent = `TARGET: ${scanner.target || 'ACTIVE'} (${scanner.type})`;
    } else {
        if (isScanRunning && !scanner.running) {
            fetchScannerReports();
        }
        isScanRunning = false;
        if (statusTag) {
            statusTag.textContent = scanner.exitCode === 0 ? '// SCAN_COMPLETED [OK]' : '// SCANNER_IDLE';
            statusTag.className = 'panel-tag';
        }
        if (startBtn) startBtn.style.display = 'inline-block';
        if (stopBtn) stopBtn.style.display = 'none';
        if (targetDisplay && !scanner.target) targetDisplay.textContent = 'TARGET: NONE';
    }

    if (liveOutput && scanner.output) {
        liveOutput.textContent = scanner.output;
        liveOutput.scrollTop = liveOutput.scrollHeight;
    }
}

async function startScannerJob() {
    const input = document.getElementById('scanner-target-input');
    const select = document.getElementById('scanner-type-select');
    if (!input) return;

    const targetUrl = input.value.trim();
    if (!targetUrl) {
        alert('Please enter a target URL (e.g. https://my-site.com)');
        input.focus();
        return;
    }

    const scanType = select ? select.value : 'nuclei';
    const liveOutput = document.getElementById('scanner-live-output');
    if (liveOutput) liveOutput.textContent = `> Dispatching ${scanType} scan to Project Zeus...`;

    try {
        const res = await fetch('/api/scanner/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: targetUrl, type: scanType })
        });
        const data = await res.json();
        if (data.success) {
            updateScannerUI(data.activeScan);
        } else {
            alert(`Scan failed: ${data.error || 'Unknown error'}`);
        }
    } catch (e) {
        alert('Network error connecting to Zeus Scanner API');
    }
}

async function stopScannerJob() {
    if (!confirm('Abort currently active vulnerability scan?')) return;
    try {
        await fetch('/api/scanner/stop', { method: 'POST' });
        fetchScannerReports();
    } catch (e) {}
}

async function fetchScannerReports() {
    const listEl = document.getElementById('scanner-reports-list');
    if (!listEl) return;

    try {
        const res = await fetch('/api/scanner/reports');
        const data = await res.json();
        const reports = data.reports || [];

        if (reports.length === 0) {
            listEl.innerHTML = `<div class="report-empty">&gt; No vulnerability reports generated yet.</div>`;
            return;
        }

        listEl.innerHTML = reports.map(r => {
            const sizeKb = (r.sizeBytes / 1024).toFixed(1);
            const dateStr = new Date(r.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="report-item">
                    <div class="report-meta">
                        <span class="report-name" title="${r.filename}">${r.filename}</span>
                        <span class="report-date">${dateStr} | ${sizeKb} KB</span>
                    </div>
                    <div class="report-actions">
                        <a href="${r.url}" target="_blank" rel="noopener" class="btn-view-report">[VIEW HTML]</a>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        listEl.innerHTML = `<div class="report-empty">&gt; Error loading reports.</div>`;
    }
}

// -----------------------------------------------------------------------------
// 10. REALTIME SSE STREAM & FALLBACK POLLING
// -----------------------------------------------------------------------------
function setupStreamConnection() {
    if (window.EventSource) {
        const source = new EventSource('/api/stream');

        source.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.telemetry) updateTelemetryUI(payload.telemetry);
                if (payload.services) updateServicesUI(payload.services);
                if (payload.processes) updateProcessesUI(payload.processes);
                if (payload.scanner) updateScannerUI(payload.scanner);
            } catch (e) {}
        };

        source.onerror = () => {
            source.close();
            setInterval(pollTelemetryData, 2000);
        };
    } else {
        setInterval(pollTelemetryData, 2000);
    }
}

async function pollTelemetryData() {
    try {
        const [tRes, sRes, pRes, scRes] = await Promise.all([
            fetch('/api/telemetry').then(r => r.json()),
            fetch('/api/services').then(r => r.json()),
            fetch('/api/processes').then(r => r.json()),
            fetch('/api/scanner/status').then(r => r.json()).catch(() => ({}))
        ]);
        updateTelemetryUI(tRes);
        updateServicesUI(sRes);
        updateProcessesUI(pRes);
        if (scRes.activeScan) updateScannerUI(scRes.activeScan);
    } catch (e) {}
}

// -----------------------------------------------------------------------------
// 11. INITIALIZATION
// -----------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    setupStreamConnection();
    fetchLogStream('boot');
    animateOscilloscopeGraph();
    setupRadarHover();

    setInterval(() => {
        fetchLogStream(currentLogTab);
    }, 4000);
});
