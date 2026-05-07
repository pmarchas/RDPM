const { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard, Notification, powerMonitor } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const os     = require('os');
const net    = require('net');
const dgram  = require('dgram');
const { exec, spawn } = require('child_process');
const QRCode = require('qrcode');
const { autoUpdater } = require('electron-updater');

const isDev = process.env.NODE_ENV === 'development';

// ─── Local settings (per machine) ────────────────────────────────────────────
const settingsDir   = path.join(os.homedir(), '.remote-manager');
const settingsFile  = path.join(settingsDir, 'settings.json');
const homeConfigFile = path.join(settingsDir, 'home.json');

// The Home group always exists locally and is never stored in the shared config
const HOME_GROUP_ID = '__home__';
const HOME_GROUP    = { id: HOME_GROUP_ID, name: 'Home', color: '#f59e0b', isHome: true };

function ensureSettingsDir() {
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
}

const SETTINGS_DEFAULTS = {
  configPath: '', homeConfigPath: '', masterPassword: '',
  theme: 'dark', viewMode: 'grid',
  lockTimeout: 0,           // minutes — 0 = disabled
  lockOnSystemSleep: true,  // lock when OS screen locks / suspends
  passwordWarningDays: 90,  // warn when password is older than N days (0 = disabled)
};

function readLocalSettings() {
  ensureSettingsDir();
  if (!fs.existsSync(settingsFile)) return { ...SETTINGS_DEFAULTS };
  try {
    const data = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    return { ...SETTINGS_DEFAULTS, ...data };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

function writeLocalSettings(settings) {
  ensureSettingsDir();
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
}

// ─── Local Home config (per machine) ─────────────────────────────────────────
function resolveHomeConfigPath(settings) {
  // Use custom path from settings if set, otherwise use default in ~/.remote-manager/
  return (settings && settings.homeConfigPath) ? settings.homeConfigPath : homeConfigFile;
}

function readHomeConfig(filePath) {
  const p = filePath || homeConfigFile;
  if (!fs.existsSync(p)) return { servers: [] };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { servers: data.servers || [] };
  } catch { return { servers: [] }; }
}

function writeHomeConfig(filePath, servers) {
  const p = filePath || homeConfigFile;
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ servers }, null, 2), 'utf8');
}

// ─── Connection history ───────────────────────────────────────────────────────
const historyFile = path.join(settingsDir, 'history.json');
const MAX_HISTORY = 500;

function readHistory() {
  if (!fs.existsSync(historyFile)) return [];
  try { return JSON.parse(fs.readFileSync(historyFile, 'utf8')); } catch { return []; }
}

function addHistory(entry) {
  ensureSettingsDir();
  let history = readHistory();
  history.unshift({ ...entry, id: Date.now(), timestamp: new Date().toISOString() });
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');
}

// ─── Shared config file (network path) ───────────────────────────────────────
function readConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) {
    return { version: '1.0', groups: [], servers: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { version: '1.0', groups: [], servers: [], ...data };
  } catch (err) {
    throw new Error(`No se pudo leer la configuración: ${err.message}`);
  }
}

function writeConfig(configPath, data) {
  if (!configPath) throw new Error('No se ha configurado la ruta del fichero de configuración.');
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) throw new Error(`El directorio no existe: ${dir}`);
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Encryption (AES-256-CBC) ─────────────────────────────────────────────────
function encrypt(text, password) {
  if (!text || !password) return text || '';
  try {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, salt, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return `enc:${salt.toString('hex')}:${iv.toString('hex')}:${encrypted.toString('hex')}`;
  } catch {
    return text;
  }
}

function decrypt(text, password) {
  if (!text || !password || !String(text).startsWith('enc:')) return text || '';
  try {
    const parts = text.split(':');
    if (parts.length < 4) return '';
    const [, saltHex, ivHex, encryptedHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const key = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

// ─── Connection launchers ─────────────────────────────────────────────────────
function launchRDP(server) {
  const host = server.host;
  const port = server.port || 3389;
  const username = server.username || '';

  if (process.platform === 'win32') {
    const rdpLines = [
      `full address:s:${host}:${port}`,
      `username:s:${username}`,
      'screen mode id:i:2',
      'use multimon:i:0',
      'desktopwidth:i:1920',
      'desktopheight:i:1080',
      'session bpp:i:32',
      'compression:i:1',
      'keyboardhook:i:2',
      'audiocapturemode:i:0',
      'videoplaybackmode:i:1',
      'connection type:i:7',
      'networkautodetect:i:1',
      'bandwidthautodetect:i:1',
      'displayconnectionbar:i:1',
      'disable wallpaper:i:0',
      'bitmapcachepersistenable:i:1',
      'redirectprinters:i:1',
      'autoreconnection enabled:i:1',
      'authentication level:i:2',
      'prompt for credentials:i:0',
      'negotiate security layer:i:1',
    ];
    const tmpFile = path.join(os.tmpdir(), `rm_${Date.now()}.rdp`);
    fs.writeFileSync(tmpFile, rdpLines.join('\r\n') + '\r\n', 'utf8');
    exec(`mstsc "${tmpFile}"`);
  } else if (process.platform === 'darwin') {
    const rdpLines = [
      `full address:s:${host}:${port}`,
      `username:s:${username}`,
      'screen mode id:i:2',
      'use multimon:i:0',
      'desktopwidth:i:1920',
      'desktopheight:i:1080',
      'session bpp:i:32',
      'compression:i:1',
      'authentication level:i:2',
      'prompt for credentials:i:0',
      'autoreconnection enabled:i:1',
      'negotiate security layer:i:1',
    ];
    const tmpFile = path.join(os.tmpdir(), `rdpm_${Date.now()}.rdp`);
    fs.writeFileSync(tmpFile, rdpLines.join('\r\n') + '\r\n', 'utf8');
    exec(`open "${tmpFile}"`);
  } else {
    exec(`remmina -c rdp://${username ? username + '@' : ''}${host}:${port}`, (err) => {
      if (err) exec(`xfreerdp /v:${host}:${port} /u:${username} /dynamic-resolution`);
    });
  }
}

function launchVNC(server) {
  const host = server.host;
  const port = server.port || 5900;
  const vncUrl = `vnc://${host}:${port}`;

  if (process.platform === 'win32') {
    const vncClients = [
      { exe: 'C:\\Program Files\\TightVNC\\tvnviewer.exe', args: [`${host}::${port}`] },
      { exe: 'C:\\Program Files (x86)\\TightVNC\\tvnviewer.exe', args: [`${host}::${port}`] },
      { exe: 'C:\\Program Files\\RealVNC\\VNC Viewer\\vncviewer.exe', args: [`${host}:${port}`] },
      { exe: 'C:\\Program Files (x86)\\RealVNC\\VNC Viewer\\vncviewer.exe', args: [`${host}:${port}`] },
      { exe: 'C:\\Program Files\\TigerVNC\\vncviewer.exe', args: [`${host}:${port}`] },
    ];
    let launched = false;
    for (const client of vncClients) {
      if (fs.existsSync(client.exe)) {
        spawn(client.exe, client.args, { detached: true, stdio: 'ignore' }).unref();
        launched = true;
        break;
      }
    }
    if (!launched) shell.openExternal(vncUrl);
  } else if (process.platform === 'darwin') {
    shell.openExternal(vncUrl);
  } else {
    exec(`vncviewer ${host}:${port}`, (err) => { if (err) shell.openExternal(vncUrl); });
  }
}

// Escape a string so it can be embedded safely inside a Tcl/expect double-quoted string
function tclEscape(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\[/g,  '\\[')
    .replace(/\]/g,  '\\]')
    .replace(/\$/g,  '\\$')
    .replace(/\{/g,  '\\{')
    .replace(/\}/g,  '\\}');
}

// Write a temp expect script, return its path (caller must delete when done)
function writeExpectScript(sshCmd, password) {
  const script = [
    '#!/usr/bin/expect -f',
    'set timeout 30',
    `set pwd "${tclEscape(password)}"`,
    `spawn ${sshCmd}`,
    'expect {',
    '    -re {(yes/no|yes/no/\\[fingerprint\\])} { send "yes\\r"; exp_continue }',
    '    -re {[Pp]assword[^:]*:}               { send "$pwd\\r" }',
    '    -re {[Pp]assphrase[^:]*:}             { send "$pwd\\r" }',
    '    eof     { exit 0 }',
    '    timeout { exit 1 }',
    '}',
    'interact',
  ].join('\n');

  const tmpFile = path.join(os.tmpdir(), `rdpm_ssh_${Date.now()}.exp`);
  fs.writeFileSync(tmpFile, script, { mode: 0o600 });
  // Self-destruct after 8 s (enough for expect to load it)
  setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch {} }, 8000);
  return tmpFile;
}

function openInTerminalMac(cmd) {
  const safe = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const appleScript = `tell application "Terminal"\n  activate\n  do script "${safe}"\nend tell`;
  exec(`osascript -e '${appleScript}'`, (err) => {
    if (err) {
      const iterm = `tell application "iTerm"\n  create window with default profile command "${safe}"\nend tell`;
      exec(`osascript -e '${iterm}'`);
    }
  });
}

function openInTerminalLinux(cmd) {
  const terminals = [
    `gnome-terminal -- bash -c "${cmd}; exec bash"`,
    `xterm -e "bash -c '${cmd}; exec bash'"`,
    `konsole --noclose -e bash -c "${cmd}"`,
  ];
  const tryNext = (i) => {
    if (i >= terminals.length) return;
    exec(terminals[i], (e) => { if (e) tryNext(i + 1); });
  };
  tryNext(0);
}

function buildSSHCommand(server) {
  const host     = server.host;
  const port     = server.port || 22;
  const username = server.username || '';
  const target   = username ? `${username}@${host}` : host;
  const portFlag = port !== 22 ? `-p ${port} ` : '';
  const keyFlag  = server.keyPath ? `-i "${server.keyPath}" ` : '';

  // Jump host / Bastión
  let jumpFlag = '';
  const jh = server.jumpHost;
  if (jh && jh.enabled && jh.host) {
    const jhUser = jh.username ? `${jh.username}@` : '';
    const jhPort = jh.port || 22;
    const jhKey  = jh.keyPath ? `-i "${jh.keyPath}" ` : '';
    jumpFlag = `-J ${jhKey}${jhUser}${jh.host}:${jhPort} `;
  }

  return `ssh -o StrictHostKeyChecking=ask ${portFlag}${keyFlag}${jumpFlag}${target}`;
}

function launchSSH(server) {
  const password = server.password || '';
  const sshBase  = buildSSHCommand(server);

  // ── Windows ────────────────────────────────────────────────────────────────
  if (process.platform === 'win32') {
    const plinkPaths = [
      'C:\\Program Files\\PuTTY\\plink.exe',
      'C:\\Program Files (x86)\\PuTTY\\plink.exe',
      path.join(os.homedir(), 'AppData\\Local\\Programs\\PuTTY\\plink.exe'),
    ];
    const plink = plinkPaths.find(p => fs.existsSync(p));
    let sshCmd;
    if (plink && password) {
      const portArg = (server.port || 22) !== 22 ? `-P ${server.port} ` : '';
      const tgt = server.username ? `${server.username}@${server.host}` : server.host;
      sshCmd = `"${plink}" -pw "${password.replace(/"/g, '""')}" -ssh ${portArg}${tgt}`;
    } else if (password) {
      clipboard.writeText(password);
    }
    sshCmd = sshCmd || sshBase;
    exec(`wt.exe new-tab --title "${server.name}" -- ${sshCmd}`, (err) => {
      if (err) exec(`start powershell.exe -NoExit -Command "${sshCmd}"`, (e2) => {
        if (e2) exec(`start cmd.exe /k ${sshCmd}`);
      });
    });
    return (!plink && password) ? 'pwd_copied' : null;
  }

  // ── macOS / Linux ──────────────────────────────────────────────────────────
  const openTerm = (cmd) => process.platform === 'darwin' ? openInTerminalMac(cmd) : openInTerminalLinux(cmd);

  if (!password) { openTerm(sshBase); return null; }

  exec('which sshpass', (err) => {
    if (!err) {
      const safePass = password.replace(/'/g, `'\\''`);
      openTerm(`SSHPASS='${safePass}' sshpass -e ${sshBase}`);
      return;
    }
    const expectBin = process.platform === 'darwin' ? '/usr/bin/expect' : 'expect';
    exec(`which ${expectBin}`, (err2) => {
      if (!err2) {
        const scriptPath = writeExpectScript(sshBase, password);
        openTerm(`${expectBin} "${scriptPath}"`);
        return;
      }
      clipboard.writeText(password);
      openTerm(sshBase);
    });
  });
  return null;
}

function launchConnection(server, settings) {
  const password = server.password && settings.masterPassword
    ? decrypt(server.password, settings.masterPassword)
    : server.password || '';
  const s = { ...server, password };
  switch (server.type) {
    case 'RDP': launchRDP(s); return null;
    case 'VNC': launchVNC(s); return null;
    case 'SSH': return launchSSH(s);
    default: throw new Error(`Tipo de conexión desconocido: ${server.type}`);
  }
}

// ─── Electron window ──────────────────────────────────────────────────────────
let mainWindow;

function resolveIcon() {
  const isWin = process.platform === 'win32';
  const ext   = isWin ? 'ico' : 'png';
  const candidates = [
    path.join(process.resourcesPath || '', `icon.${ext}`),   // packaged
    path.join(__dirname, `../assets/icon.${ext}`),           // dev
    path.join(process.resourcesPath || '', 'icon.png'),      // fallback png
    path.join(__dirname, '../assets/icon.png'),
  ];
  return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'RDPM',
    backgroundColor: '#0f172a',
    icon: resolveIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
    } : {}),
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('settings:read', () => readLocalSettings());
ipcMain.handle('settings:write', (_, settings) => { writeLocalSettings(settings); return true; });

ipcMain.handle('config:read', () => {
  const settings     = readLocalSettings();
  const sharedConfig = readConfig(settings.configPath);
  const homeData     = readHomeConfig(resolveHomeConfigPath(settings));
  const pwd          = settings.masterPassword;

  if (pwd) {
    sharedConfig.servers = (sharedConfig.servers || []).map(s => ({
      ...s, password: s.password ? decrypt(s.password, pwd) : '',
    }));
    homeData.servers = homeData.servers.map(s => ({
      ...s, password: s.password ? decrypt(s.password, pwd) : '',
    }));
  }

  return {
    version: sharedConfig.version || '1.0',
    groups:  [HOME_GROUP, ...(sharedConfig.groups || [])],
    servers: [...homeData.servers, ...(sharedConfig.servers || [])],
  };
});

ipcMain.handle('config:write', (_, data) => {
  const settings = readLocalSettings();
  const pwd      = settings.masterPassword;

  const encPwd = (s) => ({
    ...s,
    password: s.password && pwd ? encrypt(s.password, pwd) : (s.password || ''),
  });

  // Split: Home-group servers → local file, everything else → shared file
  const homeServers   = (data.servers || []).filter(s => s.groupId === HOME_GROUP_ID).map(encPwd);
  const sharedServers = (data.servers || []).filter(s => s.groupId !== HOME_GROUP_ID).map(encPwd);
  const sharedGroups  = (data.groups  || []).filter(g => g.id      !== HOME_GROUP_ID);

  writeHomeConfig(resolveHomeConfigPath(settings), homeServers);

  writeConfig(settings.configPath, {
    version:      data.version || '1.0',
    lastModified: new Date().toISOString(),
    groups:       sharedGroups,
    servers:      sharedServers,
  });
  return true;
});

ipcMain.handle('config:test', (_, configPath) => {
  try {
    if (!configPath) return { ok: false, error: 'Ruta vacía' };
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) return { ok: false, error: `Directorio no encontrado: ${dir}` };
    if (fs.existsSync(configPath)) {
      JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ok: true, exists: true };
    }
    fs.accessSync(dir, fs.constants.W_OK);
    return { ok: true, exists: false };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('connection:launch', (_, server) => {
  const settings = readLocalSettings();
  const hint = launchConnection(server, settings);
  addHistory({ serverId: server.id, serverName: server.name, serverHost: server.host, type: server.type });
  return { ok: true, passwordCopied: hint === 'pwd_copied' };
});

ipcMain.handle('dialog:openConfig', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir fichero de configuración',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
  return null;
});

ipcMain.handle('dialog:saveConfig', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Crear fichero de configuración',
    defaultPath: 'remote-manager-config.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!result.canceled && result.filePath) {
    writeConfig(result.filePath, { version: '1.0', groups: [], servers: [] });
    return result.filePath;
  }
  return null;
});

ipcMain.handle('dialog:openHomeConfig', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir fichero Home (local)',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!result.canceled && result.filePaths.length > 0) return result.filePaths[0];
  return null;
});

ipcMain.handle('dialog:saveHomeConfig', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Crear fichero Home (local)',
    defaultPath: 'home-config.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!result.canceled && result.filePath) {
    writeHomeConfig(result.filePath, []);
    return result.filePath;
  }
  return null;
});

ipcMain.handle('homeConfig:getDefaultPath', () => homeConfigFile);

// ─── TCP ping ─────────────────────────────────────────────────────────────────
function tcpPing(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const start  = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => {
      const ms = Date.now() - start;
      socket.destroy();
      resolve({ up: true, ms });
    });
    socket.on('timeout', () => { socket.destroy(); resolve({ up: false, ms: null }); });
    socket.on('error',   () => { socket.destroy(); resolve({ up: false, ms: null }); });
    socket.connect(port, host);
  });
}

const DEFAULT_PORT = { RDP: 3389, VNC: 5900, SSH: 22 };
let pingStateCache = {}; // { [serverId]: boolean } — previous UP/DOWN state

// Read MAC from the OS ARP cache (works only for LAN hosts)
function lookupMac(ip) {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? `arp -a ${ip}` : `arp -n ${ip}`;
    exec(cmd, (err, stdout) => {
      if (err) { resolve(null); return; }
      const m = stdout.match(/([0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2})/);
      resolve(m ? m[1].replace(/-/g, ':').toUpperCase() : null);
    });
  });
}

ipcMain.handle('server:pingAll', async (_, servers) => {
  const results = await Promise.allSettled(
    servers.map(s =>
      tcpPing(s.host, s.port || DEFAULT_PORT[s.type] || 22)
        .then(r => ({ id: s.id, name: s.name, host: s.host, hasMac: !!s.mac, ...r }))
    )
  );
  const mapped = results.map(r => r.status === 'fulfilled' ? r.value : { id: null, up: false, ms: null });

  // For UP servers that don't have a MAC yet, try to read it from ARP cache
  await Promise.all(
    mapped
      .filter(r => r.id && r.up && !r.hasMac)
      .map(async r => {
        const mac = await lookupMac(r.host);
        if (mac) r.discoveredMac = mac;
      })
  );

  // Fire OS notification when a server transitions UP → DOWN
  if (Notification.isSupported()) {
    mapped.forEach(r => {
      if (!r.id) return;
      const wasUp = pingStateCache[r.id];
      if (wasUp === true && r.up === false) {
        new Notification({
          title: 'RDPM — Servidor caído',
          body:  `${r.name || r.id} no responde`,
          icon:  resolveIcon(),
        }).show();
      }
      pingStateCache[r.id] = r.up;
    });
  }

  return mapped;
});

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);
ipcMain.handle('app:settingsPath', () => settingsFile);
ipcMain.handle('app:openExternal', (_, url) => shell.openExternal(url));
ipcMain.handle('totp:generateQR', async (_, uri) => QRCode.toDataURL(uri, { width: 200, margin: 1 }));

// ─── History ──────────────────────────────────────────────────────────────────
ipcMain.handle('history:read',  () => readHistory());
ipcMain.handle('history:clear', () => { try { fs.writeFileSync(historyFile, '[]', 'utf8'); } catch {} return true; });

// ─── Wake on LAN ─────────────────────────────────────────────────────────────
function createMagicPacket(mac) {
  const hex = mac.replace(/[:\-\.]/g, '');
  if (hex.length !== 12) throw new Error(`MAC inválida: ${mac}`);
  const macBytes = Buffer.from(hex, 'hex');
  const packet   = Buffer.alloc(102);
  packet.fill(0xFF, 0, 6);
  for (let i = 0; i < 16; i++) macBytes.copy(packet, 6 + i * 6);
  return packet;
}

ipcMain.handle('server:wol', (_, mac, broadcast = '255.255.255.255', port = 9) => {
  return new Promise((resolve, reject) => {
    try {
      const packet = createMagicPacket(mac);
      const sock   = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      sock.once('error', (e) => { sock.close(); reject(e); });
      sock.bind(() => {
        sock.setBroadcast(true);
        sock.send(packet, port, broadcast, (e) => { sock.close(); e ? reject(e) : resolve(true); });
      });
    } catch (e) { reject(e); }
  });
});

// ─── Import ───────────────────────────────────────────────────────────────────
// Import from another RDPM / shared config JSON
ipcMain.handle('import:file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar servidores desde fichero',
    filters: [
      { name: 'JSON / CSV', extensions: ['json', 'csv'] },
      { name: 'Todos',      extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true, servers: [] };

  const filePath = result.filePaths[0];
  const ext      = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.csv') {
      // CSV format: name,type,host,port,username,notes
      const lines   = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
      const header  = lines[0].toLowerCase().split(',').map(h => h.trim());
      const col     = (name) => header.indexOf(name);
      const servers = lines.slice(1).map(line => {
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        return {
          name: parts[col('name')]  || '',
          type: (parts[col('type')] || 'SSH').toUpperCase(),
          host: parts[col('host')]  || '',
          port: parts[col('port')]  ? parseInt(parts[col('port')]) : undefined,
          username: parts[col('username')] || '',
          notes:    parts[col('notes')]    || '',
        };
      }).filter(s => s.name && s.host);
      return { servers, source: 'csv' };
    }

    // JSON: RDPM config or array of servers
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const servers = Array.isArray(data) ? data : (data.servers || []);
    return { servers: servers.filter(s => s.name && s.host), source: 'json' };

  } catch (e) {
    return { servers: [], error: e.message };
  }
});

// Import from PuTTY registry (Windows only)
ipcMain.handle('import:putty', () => {
  if (process.platform !== 'win32') return { sessions: [], error: 'Solo disponible en Windows' };
  return new Promise((resolve) => {
    exec('reg query "HKCU\\Software\\SimonTatham\\PuTTY\\Sessions" /f "" /k', (err, stdout) => {
      if (err) { resolve({ sessions: [], error: err.message }); return; }
      const sessionKeys = stdout.split(/\r?\n/)
        .filter(l => l.includes('SimonTatham\\PuTTY\\Sessions\\'))
        .map(l => l.trim());

      let pending = sessionKeys.length;
      if (!pending) { resolve({ sessions: [] }); return; }

      const sessions = [];
      sessionKeys.forEach(key => {
        exec(`reg query "${key}"`, (e2, out2) => {
          if (!e2) {
            const get = (name) => {
              const m = out2.match(new RegExp(`${name}\\s+REG_\\w+\\s+(.+)`));
              return m ? m[1].trim() : '';
            };
            const rawName = key.split('\\').pop();
            const host     = get('HostName');
            const portHex  = get('PortNumber');
            const port     = portHex ? parseInt(portHex, 16) : 22;
            const user     = get('UserName');
            const proto    = get('Protocol') || 'ssh';
            if (host) {
              sessions.push({
                name:     decodeURIComponent(rawName.replace(/%20/g, ' ')),
                type:     proto.toUpperCase() === 'SSH' ? 'SSH' : proto.toUpperCase() === 'RDP' ? 'RDP' : 'SSH',
                host,
                port,
                username: user,
              });
            }
          }
          if (--pending === 0) resolve({ sessions });
        });
      });
    });
  });
});

// ─── SSH key file picker ──────────────────────────────────────────────────────
ipcMain.handle('dialog:openKeyFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar clave privada SSH',
    filters: [
      { name: 'Claves SSH', extensions: ['pem', 'key', 'ppk', 'rsa', 'ed25519', 'pub'] },
      { name: 'Todos',      extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (!result.canceled && result.filePaths.length) return result.filePaths[0];
  return null;
});

// ─── Auto-updater (electron-updater + GitHub Releases) ───────────────────────
autoUpdater.autoDownload    = false; // el usuario decide cuándo descargar
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = false;

function sendUpdate(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

autoUpdater.on('update-available',    info     => sendUpdate('update:available',  info));
autoUpdater.on('update-not-available', info    => sendUpdate('update:not-available', info));
autoUpdater.on('download-progress',   progress => sendUpdate('update:progress',   progress));
autoUpdater.on('update-downloaded',   info     => sendUpdate('update:downloaded', info));
autoUpdater.on('error',               err      => sendUpdate('update:error',      err.message));

ipcMain.handle('app:checkUpdate', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { hasUpdate: !!result?.updateInfo, info: result?.updateInfo || null };
  } catch (err) {
    return { hasUpdate: false, error: err.message };
  }
});

ipcMain.handle('app:downloadUpdate', () => {
  autoUpdater.downloadUpdate();
  return true;
});

ipcMain.handle('app:installUpdate', () => {
  autoUpdater.quitAndInstall(false, true);
});

// ─── Auto-lock: sistema OS → renderer ────────────────────────────────────────
// Notificamos al renderer cuando el sistema entra en suspensión o bloquea pantalla.
// El renderer decide si bloquear o no según su configuración (lockOnSystemSleep).
app.whenReady().then(() => {
  powerMonitor.on('lock-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:lock');
    }
  });
  powerMonitor.on('suspend', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:lock');
    }
  });
});
