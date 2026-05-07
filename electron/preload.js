const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rm', {
  settings: {
    read:  ()    => ipcRenderer.invoke('settings:read'),
    write: (s)   => ipcRenderer.invoke('settings:write', s),
  },
  config: {
    read:  ()          => ipcRenderer.invoke('config:read'),
    write: (data)      => ipcRenderer.invoke('config:write', data),
    test:  (path)      => ipcRenderer.invoke('config:test', path),
  },
  connection: {
    launch: (server)   => ipcRenderer.invoke('connection:launch', server),
  },
  dialog: {
    openConfig:     ()    => ipcRenderer.invoke('dialog:openConfig'),
    saveConfig:     ()    => ipcRenderer.invoke('dialog:saveConfig'),
    openHomeConfig: ()    => ipcRenderer.invoke('dialog:openHomeConfig'),
    saveHomeConfig: ()    => ipcRenderer.invoke('dialog:saveHomeConfig'),
    openKeyFile:    ()    => ipcRenderer.invoke('dialog:openKeyFile'),
  },
  homeConfig: {
    getDefaultPath: ()    => ipcRenderer.invoke('homeConfig:getDefaultPath'),
  },
  app: {
    version:        ()    => ipcRenderer.invoke('app:version'),
    platform:       ()    => ipcRenderer.invoke('app:platform'),
    settingsPath:   ()    => ipcRenderer.invoke('app:settingsPath'),
    openExternal:   (url) => ipcRenderer.invoke('app:openExternal', url),
    checkUpdate:    ()    => ipcRenderer.invoke('app:checkUpdate'),
    downloadUpdate: ()    => ipcRenderer.invoke('app:downloadUpdate'),
    installUpdate:  ()    => ipcRenderer.invoke('app:installUpdate'),
    onUpdateAvailable:    (cb) => ipcRenderer.on('update:available',     (_, d) => cb(d)),
    onUpdateNotAvailable: (cb) => ipcRenderer.on('update:not-available', (_, d) => cb(d)),
    onUpdateProgress:     (cb) => ipcRenderer.on('update:progress',      (_, d) => cb(d)),
    onUpdateDownloaded:   (cb) => ipcRenderer.on('update:downloaded',    (_, d) => cb(d)),
    onUpdateError:        (cb) => ipcRenderer.on('update:error',         (_, d) => cb(d)),
    // Sistema OS → bloqueo de pantalla
    onSystemLock:   (cb)  => ipcRenderer.on('system:lock', cb),
    offSystemLock:  (cb)  => ipcRenderer.removeListener('system:lock', cb),
  },
  totp: {
    generateQR: (uri)     => ipcRenderer.invoke('totp:generateQR', uri),
  },
  server: {
    pingAll: (servers)    => ipcRenderer.invoke('server:pingAll', servers),
    wol:     (mac, bc)    => ipcRenderer.invoke('server:wol', mac, bc),
  },
  history: {
    read:  ()             => ipcRenderer.invoke('history:read'),
    clear: ()             => ipcRenderer.invoke('history:clear'),
  },
  import: {
    file:  ()             => ipcRenderer.invoke('import:file'),
    putty: ()             => ipcRenderer.invoke('import:putty'),
  },
});
