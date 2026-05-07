import { useState, useEffect, useCallback, useRef } from 'react';
import { LanguageContext } from './LanguageContext';
import { tr } from './i18n';
import Sidebar from './components/Sidebar';
import ServerGrid from './components/ServerGrid';
import ServerModal from './components/ServerModal';
import SettingsModal from './components/SettingsModal';
import SetupWizard from './components/SetupWizard';
import ContextMenu from './components/ContextMenu';
import AboutModal from './components/AboutModal';
import LockScreen from './components/LockScreen';
import HistoryModal from './components/HistoryModal';
import ImportModal from './components/ImportModal';

const api = window.rm;
const HOME_GROUP_ID = '__home__';

export default function App() {
  const [config, setConfig] = useState({ groups: [], servers: [] });
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [serverModal, setServerModal] = useState({ open: false, server: null });
  const [settingsModal, setSettingsModal] = useState(false);
  const [aboutModal, setAboutModal]       = useState(false);
  const [historyModal, setHistoryModal]   = useState(false);
  const [importModal, setImportModal]     = useState(false);
  const [locked, setLocked] = useState(false);
  const lockTimerRef = useRef(null);
  const [pingResults, setPingResults] = useState({});   // { [id]: { up, ms } }
  const [pinging, setPinging] = useState(false);
  const [ctxMenu, setCtxMenu] = useState({ open: false, x: 0, y: 0, server: null });
  const [toasts, setToasts] = useState([]);
  const searchRef = useRef(null);

  // ── Update state ─────────────────────────────────────────────────────────────
  // status: null | 'available' | 'downloading' | 'downloaded' | 'error' | 'checking' | 'uptodate'
  const [updateStatus,   setUpdateStatus]   = useState(null);
  const [updateInfo,     setUpdateInfo]     = useState(null);   // { version, releaseNotes }
  const [updateProgress, setUpdateProgress] = useState(0);      // 0-100

  useEffect(() => {
    init();
    // Listeners de electron-updater
    api.app.onUpdateAvailable(info => {
      setUpdateInfo(info);
      setUpdateStatus('available');
    });
    api.app.onUpdateNotAvailable(() => {
      setUpdateStatus('uptodate');
      setTimeout(() => setUpdateStatus(null), 3000);
    });
    api.app.onUpdateProgress(p => {
      setUpdateProgress(Math.round(p.percent || 0));
      setUpdateStatus('downloading');
    });
    api.app.onUpdateDownloaded(info => {
      setUpdateInfo(info);
      setUpdateStatus('downloaded');
    });
    api.app.onUpdateError(() => {
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus(null), 4000);
    });
  }, []);

  // ── Cmd/Ctrl+K → enfocar búsqueda ───────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearchQuery('');
        searchRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Auto-ping whenever servers list changes, then every 60 s
  useEffect(() => {
    const servers = config.servers;
    if (!servers?.length) return;
    pingAll(servers);
    const t = setInterval(() => pingAll(servers), 60_000);
    return () => clearInterval(t);
  }, [config.servers]);

  useEffect(() => {
    const close = () => setCtxMenu(c => ({ ...c, open: false }));
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    return () => { document.removeEventListener('click', close); document.removeEventListener('contextmenu', close); };
  }, []);

  // ── Auto-lock: timer de inactividad ──────────────────────────────────────────
  const hasAuth = !!(settings?.totpSecret || settings?.masterPassword);

  useEffect(() => {
    const minutes = settings?.lockTimeout ?? 0;
    if (!minutes || !hasAuth || locked) {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      return;
    }
    const ms = minutes * 60 * 1000;

    function resetTimer() {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => setLocked(true), ms);
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(ev => document.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer(); // arranca el primer timer

    return () => {
      events.forEach(ev => document.removeEventListener(ev, resetTimer));
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, [settings?.lockTimeout, locked, hasAuth]);

  // ── Auto-lock: evento del sistema (bloqueo pantalla / suspensión) ────────────
  useEffect(() => {
    if (!settings?.lockOnSystemSleep || !hasAuth) return;
    const handler = () => setLocked(true);
    api.app.onSystemLock(handler);
    return () => api.app.offSystemLock(handler);
  }, [settings?.lockOnSystemSleep, hasAuth]);

  async function init() {
    setLoading(true);
    try {
      const s = await api.settings.read();
      setSettings(s);
      setViewMode(s.viewMode || 'grid');
      if (s.totpSecret) setLocked(true);
      if (!s.configPath) { setNeedsSetup(true); setLoading(false); return; }
      const cfg = await api.config.read();
      setConfig(cfg);
    } catch (err) { showToast('error', `Error al cargar: ${err.message}`); }
    setLoading(false);
    // Comprueba actualizaciones silenciosamente al arrancar
    setTimeout(() => api.app.checkUpdate().catch(() => {}), 5000);
  }

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus('checking');
    try {
      await api.app.checkUpdate();
    } catch {
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus(null), 4000);
    }
  }, []);

  const saveConfig = useCallback(async (newConfig) => {
    try { await api.config.write(newConfig); setConfig(newConfig); return true; }
    catch (err) { showToast('error', `Error al guardar: ${err.message}`); return false; }
  }, []);

  const showToast = useCallback((type, message) => {
    const id = Date.now();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const handleSetupComplete = async (newSettings) => {
    await api.settings.write(newSettings);
    setSettings(newSettings);
    setNeedsSetup(false);
    const cfg = await api.config.read();
    setConfig(cfg);
    showToast('success', '¡Configuración lista!');
  };

  const handleSettingsSaved = async (newSettings) => {
    await api.settings.write(newSettings);
    setSettings(newSettings);
    setViewMode(newSettings.viewMode || 'grid');
    setSettingsModal(false);
    try { const cfg = await api.config.read(); setConfig(cfg); } catch {}
    showToast('success', 'Ajustes guardados');
  };

  const handleSaveServer = async (server) => {
    const servers = config.servers || [];
    let newServers;
    if (server.id) {
      newServers = servers.map(s => s.id === server.id ? server : s);
    } else {
      const { v4: uuidv4 } = await import('uuid');
      newServers = [...servers, { ...server, id: uuidv4(), createdAt: new Date().toISOString() }];
    }
    const ok = await saveConfig({ ...config, servers: newServers });
    if (ok) { setServerModal({ open: false, server: null }); showToast('success', server.id ? 'Servidor actualizado' : 'Servidor añadido'); }
  };

  const handleDeleteServer = async (serverId) => {
    const newServers = (config.servers || []).filter(s => s.id !== serverId);
    const ok = await saveConfig({ ...config, servers: newServers });
    if (ok) showToast('success', 'Servidor eliminado');
    setCtxMenu(c => ({ ...c, open: false }));
  };

  const handleDuplicateServer = async (server) => {
    const { v4: uuidv4 } = await import('uuid');
    const copy = {
      ...server,
      id: uuidv4(),
      name: `Copia de ${server.name}`,
      createdAt: new Date().toISOString(),
    };
    const ok = await saveConfig({ ...config, servers: [...(config.servers || []), copy] });
    if (ok) {
      showToast('success', `«${copy.name}» creado`);
      setServerModal({ open: true, server: copy }); // abre para editar el nombre/IP
    }
    setCtxMenu(c => ({ ...c, open: false }));
  };

  const handleSaveGroup = async (group) => {
    const { v4: uuidv4 } = await import('uuid');
    const groups = config.groups || [];
    const newGroups = group.id ? groups.map(g => g.id === group.id ? group : g) : [...groups, { ...group, id: uuidv4() }];
    const ok = await saveConfig({ ...config, groups: newGroups });
    if (ok) showToast('success', group.id ? 'Grupo actualizado' : 'Grupo creado');
  };

  const handleDeleteGroup = async (groupId) => {
    if (groupId === HOME_GROUP_ID) return; // Home group is permanent
    const newGroups = (config.groups || []).filter(g => g.id !== groupId);
    const newServers = (config.servers || []).map(s => s.groupId === groupId ? { ...s, groupId: '' } : s);
    const ok = await saveConfig({ ...config, groups: newGroups, servers: newServers });
    if (ok) { if (selectedGroup === groupId) setSelectedGroup('all'); showToast('success', 'Grupo eliminado'); }
  };

  const pingAll = useCallback(async (servers) => {
    if (!servers?.length || pinging) return;
    setPinging(true);
    // Mark all as "checking"
    setPingResults(prev => {
      const next = { ...prev };
      servers.forEach(s => { next[s.id] = { ...next[s.id], checking: true }; });
      return next;
    });
    try {
      const results = await api.server.pingAll(
        servers.map(s => ({ id: s.id, host: s.host, port: s.port, type: s.type, mac: s.mac || '' }))
      );
      setPingResults(prev => {
        const next = { ...prev };
        results.forEach(r => { if (r.id) next[r.id] = { up: r.up, ms: r.ms, checking: false }; });
        return next;
      });
      // Auto-save MACs discovered via ARP for servers that didn't have one
      const discovered = results.filter(r => r.id && r.discoveredMac);
      if (discovered.length) {
        setConfig(prev => {
          const updated = (prev.servers || []).map(s => {
            const found = discovered.find(r => r.id === s.id);
            return (found && !s.mac) ? { ...s, mac: found.discoveredMac } : s;
          });
          // Persist silently
          api.config.write({ ...prev, servers: updated }).catch(() => {});
          return { ...prev, servers: updated };
        });
      }
    } catch {}
    setPinging(false);
  }, [pinging]);

  const handleUpdateNotes = useCallback(async (serverId, notes) => {
    const newServers = (config.servers || []).map(s =>
      s.id === serverId ? { ...s, notes } : s
    );
    await saveConfig({ ...config, servers: newServers });
  }, [config, saveConfig]);

  const handleToggleFavorite = async (server) => {
    const newServers = (config.servers || []).map(s =>
      s.id === server.id ? { ...s, favorite: !s.favorite } : s
    );
    await saveConfig({ ...config, servers: newServers });
  };

  const handleWol = async (server) => {
    if (!server.mac) return;
    try {
      await api.server.wol(server.mac);
      showToast('success', `Magic packet enviado a ${server.name}`);
    } catch (err) {
      showToast('error', `Wake on LAN falló: ${err.message}`);
    }
  };

  const handleImportServers = async (servers) => {
    const { v4: uuidv4 } = await import('uuid');
    const newServers = servers.map(s => ({
      ...s,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      type: (['RDP','VNC','SSH'].includes(s.type) ? s.type : 'SSH'),
    }));
    const ok = await saveConfig({ ...config, servers: [...(config.servers || []), ...newServers] });
    if (ok) {
      showToast('success', `${newServers.length} servidor${newServers.length !== 1 ? 'es' : ''} importado${newServers.length !== 1 ? 's' : ''}`);
      setImportModal(false);
    }
  };

  const handleConnect = async (server) => {
    try {
      const result = await api.connection.launch(server);
      if (result?.passwordCopied) {
        showToast('info', 'Contraseña copiada — pégala cuando el terminal la solicite (Cmd+V / Ctrl+V)');
      }
    } catch (err) { showToast('error', `No se pudo lanzar la conexión: ${err.message}`); }
  };

  const handleContextMenu = (e, server) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ open: true, x: e.clientX, y: e.clientY, server });
  };

  const visibleServers = (() => {
    let list = config.servers || [];
    if (selectedGroup === '__favorites__') {
      list = list.filter(s => s.favorite);
    } else if (selectedGroup !== 'all') {
      list = selectedGroup === 'ungrouped' ? list.filter(s => !s.groupId) : list.filter(s => s.groupId === selectedGroup);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name?.toLowerCase().includes(q) || s.host?.toLowerCase().includes(q) || s.type?.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'type') return (a.type || '').localeCompare(b.type || '');
      if (sortBy === 'group') return (a.groupId || '').localeCompare(b.groupId || '');
      return (a.name || '').localeCompare(b.name || '');
    });
  })();

  const lang = settings?.language || 'es';
  const t = (key, vars) => tr(lang, key, vars);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
      <span style={{ color: 'var(--text-muted)' }}>{tr('es', 'loading')}</span>
    </div>
  );

  if (needsSetup) return <SetupWizard onComplete={handleSetupComplete} />;
  if (locked && hasAuth) return (
    <LockScreen
      totpSecret={settings.totpSecret}
      masterPassword={settings.masterPassword}
      onUnlock={() => {
        setLocked(false);
        // Reinicia el timer tras desbloquear
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      }}
    />
  );

  return (
    <LanguageContext.Provider value={lang}>
    <div className="app-layout">
      <Sidebar groups={config.groups || []} servers={config.servers || []} selectedGroup={selectedGroup} onSelectGroup={setSelectedGroup} onSaveGroup={handleSaveGroup} onDeleteGroup={handleDeleteGroup} onOpenSettings={() => setSettingsModal(true)} onOpenAbout={() => setAboutModal(true)} onOpenHistory={() => setHistoryModal(true)} onOpenImport={() => setImportModal(true)} />

      <div className="app-main">
        <div className="topbar">
          <div className="topbar-title">
            {selectedGroup === 'all' ? t('allServers') : selectedGroup === '__favorites__' ? t('favorites') : selectedGroup === 'ungrouped' ? t('ungrouped') : (config.groups || []).find(g => g.id === selectedGroup)?.name || ''}
            <span className="topbar-count">{visibleServers.length}</span>
          </div>
          <div className="topbar-right">
            <div className="search-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input ref={searchRef} type="text" placeholder={t('search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'inherit', width: 200, padding: '6px 8px' }} />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
              <option value="name">{t('sortName')}</option>
              <option value="type">{t('sortType')}</option>
              <option value="group">{t('sortGroup')}</option>
            </select>
            <button className="btn-icon" data-tip="Verificar conectividad" onClick={() => pingAll(config.servers)} disabled={pinging} style={{ position: 'relative' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ animation: pinging ? 'spin 1s linear infinite' : 'none' }}>
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </button>
            <button className="btn-icon" data-tip={viewMode === 'grid' ? 'Vista lista' : 'Vista cuadrícula'} onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}>
              {viewMode === 'grid' ? <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg> : <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>}
            </button>
            {/* ── Botón de actualización ── */}
            <button
              className={updateStatus === 'available' || updateStatus === 'downloaded' ? 'btn-primary' : 'btn-icon'}
              onClick={updateStatus === 'downloaded' ? () => api.app.installUpdate() : updateStatus === 'available' ? () => { api.app.downloadUpdate(); setUpdateStatus('downloading'); } : handleCheckUpdate}
              disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
              title={updateStatus === 'downloaded' ? t('restartInstall') : updateStatus === 'available' ? `v${updateInfo?.version} ${t('updateAvailable')}` : updateStatus === 'downloading' ? `${t('downloading')} ${updateProgress}%` : updateStatus === 'uptodate' ? t('upToDate') : t('checkUpdates')}
              style={{ position: 'relative', ...(updateStatus === 'available' || updateStatus === 'downloaded' ? { display: 'flex', alignItems: 'center', gap: 6, animation: 'pulse-btn 2s ease-in-out infinite' } : {}) }}
            >
              {updateStatus === 'checking' && <span className="spinner" style={{ width: 14, height: 14 }} />}
              {updateStatus === 'downloading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <span className="spinner" style={{ width: 13, height: 13 }} />
                  {updateProgress}%
                </div>
              )}
              {updateStatus === 'downloaded' && (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                  {t('restartInstall')}
                </>
              )}
              {updateStatus === 'available' && (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  v{updateInfo?.version} {t('updateAvailable')}
                </>
              )}
              {updateStatus === 'uptodate' && <svg width="15" height="15" fill="none" stroke="var(--success)" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
              {(updateStatus === 'error') && <svg width="15" height="15" fill="none" stroke="var(--danger)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
              {!updateStatus && <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>}
            </button>

            <button className="btn-primary" onClick={() => setServerModal({ open: true, server: null })} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              {t('newServer')}
            </button>
          </div>
        </div>
        <ServerGrid servers={visibleServers} groups={config.groups || []} viewMode={viewMode} pingResults={pingResults} onConnect={handleConnect} onEdit={server => setServerModal({ open: true, server })} onDelete={handleDeleteServer} onToggleFavorite={handleToggleFavorite} onWol={handleWol} onContextMenu={handleContextMenu} onAddNew={() => setServerModal({ open: true, server: null })} searchQuery={searchQuery} onUpdateNotes={handleUpdateNotes} passwordWarningDays={settings?.passwordWarningDays ?? 90} />
      </div>

      {serverModal.open && <ServerModal server={serverModal.server} groups={config.groups || []} onSave={handleSaveServer} onClose={() => setServerModal({ open: false, server: null })} />}
      {settingsModal && <SettingsModal settings={settings} onSave={handleSettingsSaved} onClose={() => setSettingsModal(false)} />}
      {aboutModal && <AboutModal onClose={() => setAboutModal(false)} />}
      {ctxMenu.open && ctxMenu.server && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} server={ctxMenu.server}
        onConnect={() => { handleConnect(ctxMenu.server); setCtxMenu(c => ({ ...c, open: false })); }}
        onEdit={() => { setServerModal({ open: true, server: ctxMenu.server }); setCtxMenu(c => ({ ...c, open: false })); }}
        onDuplicate={() => handleDuplicateServer(ctxMenu.server)}
        onDelete={() => handleDeleteServer(ctxMenu.server.id)}
        onToggleFavorite={() => { handleToggleFavorite(ctxMenu.server); setCtxMenu(c => ({ ...c, open: false })); }}
        onWol={() => { handleWol(ctxMenu.server); setCtxMenu(c => ({ ...c, open: false })); }}
      />}
      {historyModal && <HistoryModal onClose={() => setHistoryModal(false)} />}
      {importModal  && <ImportModal groups={config.groups || []} onImport={handleImportServers} onClose={() => setImportModal(false)} />}

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' && <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
            {t.type === 'error'   && <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
            {t.type === 'info'    && <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      <style>{`
        .app-layout { display: flex; height: 100vh; overflow: hidden; }
        /* language provider wrapper */
        .app-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border); background: var(--bg-surface); flex-shrink: 0; }
        .topbar-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .topbar-count { background: var(--bg-elevated); color: var(--text-muted); font-size: 12px; padding: 2px 8px; border-radius: 20px; font-weight: 600; }
        .topbar-right { display: flex; align-items: center; gap: 10px; }
        .search-wrap { display: flex; align-items: center; gap: 4px; background: var(--bg-base); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0 10px; color: var(--text-muted); }
        .search-wrap:focus-within { border-color: var(--accent); }
        .toast-container { position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 10px; z-index: 9999; }
        .toast { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: var(--radius); background: var(--bg-elevated); border: 1px solid var(--border); box-shadow: var(--shadow); font-size: 14px; animation: slideUp .2s ease; min-width: 240px; max-width: 380px; }
        .toast-success { border-left: 3px solid var(--success); }
        .toast-success svg { color: var(--success); }
        .toast-error { border-left: 3px solid var(--danger); }
        .toast-error svg { color: var(--danger); }
        .toast-info { border-left: 3px solid var(--accent); }
        .toast-info svg { color: var(--accent); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-btn {
          0%, 100% { box-shadow: 0 0 0 0 var(--accent); }
          50%       { box-shadow: 0 0 0 5px transparent; }
        }
      `}</style>
    </div>
    </LanguageContext.Provider>
  );
}
