/** Coordinates checks/downloads separately from the user-approved install. */
export function createUpdateController({ check, relaunch }) {
  let state = { phase:'idle', visible:false, version:'', received:0, total:0, error:'' };
  let candidate = null;
  let pendingCheck = null;
  let pendingInstall = null;
  let manualCheck = false;
  const listeners = new Set();
  const publish = patch => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const release = async update => { await update?.close().catch(() => {}); };

  function checkForUpdates({ manual = false } = {}) {
    if (pendingInstall) return pendingInstall;
    if (pendingCheck) {
      if (manual) { manualCheck = true; publish({ visible:true }); }
      return pendingCheck;
    }
    if (candidate && state.phase === 'ready') {
      if (manual) publish({ visible:true });
      return Promise.resolve();
    }
    if (state.phase === 'installed') {
      if (manual) publish({ visible:true });
      return Promise.resolve();
    }
    manualCheck = manual;
    publish({ phase:'checking', visible:manual, version:'', received:0, total:0, error:'' });
    pendingCheck = (async () => {
      let found = null;
      try {
        found = await check({ timeout:15000 });
        if (!found) { publish({ phase:'current', visible:manualCheck }); return; }
        candidate = found;
        publish({ phase:'downloading', visible:true, version:found.version });
        await found.download(event => {
          if (event.event === 'Started') publish({ total:Math.max(0, event.data.contentLength || 0) });
          if (event.event === 'Progress') publish({ received:state.received + Math.max(0, event.data.chunkLength) });
        }, { timeout:300000 });
        // The download promise resolves only after the package signature passes.
        publish({ phase:'ready', visible:true });
      } catch {
        candidate = null;
        await release(found);
        publish({ phase:'error', visible:manualCheck || Boolean(found), error:found ? 'download' : 'check' });
      } finally { pendingCheck = null; }
    })();
    return pendingCheck;
  }

  function installUpdate() {
    if (pendingInstall) return pendingInstall;
    if (state.phase !== 'ready' || !candidate) return Promise.resolve();
    const update = candidate;
    publish({ phase:'installing', visible:true, error:'' });
    pendingInstall = (async () => {
      try {
        await update.install();
      } catch {
        publish({ phase:'ready', visible:true, error:'install' });
        return;
      }
      candidate = null;
      await release(update);
      publish({ phase:'installed', visible:true, error:'' });
      try { await relaunch(); }
      catch { publish({ error:'restart' }); }
    })().finally(() => { pendingInstall = null; });
    return pendingInstall;
  }

  async function restart() {
    if (state.phase !== 'installed' || pendingInstall) return;
    try { await relaunch(); }
    catch { publish({ visible:true, error:'restart' }); }
  }

  return {
    getSnapshot:() => state,
    subscribe:listener => { listeners.add(listener); return () => listeners.delete(listener); },
    checkForUpdates, installUpdate, restart,
    dismiss:() => { if (state.phase !== 'installing') publish({ visible:false }); },
  };
}
