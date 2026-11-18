(function () {
  'use strict';
  let started = false;
  window.FiletOffline = {
    async start(notify, beforeUpdate, canReload = () => true) {
      if (started || !/^https?:$/.test(location.protocol) || !window.isSecureContext ||
          !('serviceWorker' in navigator)) return;
      started = true;
      const serviceWorker = navigator.serviceWorker;
      let hadController = !!serviceWorker.controller;
      let pendingReload = false, reloading = false, reloadTimer;
      // A new worker can take control without interrupting a row or an editor.
      const reloadWhenIdle = async () => {
        if (!pendingReload || reloading || document.hidden || !canReload()) return;
        reloading = true;
        try {
          if (beforeUpdate && !await beforeUpdate()) return;
          // The screen may have changed while saving was in progress.
          if (document.hidden || !canReload()) return;
          pendingReload = false;
          location.reload();
        } catch (_) { /* Keep the current page if saving fails. */ }
        finally { reloading = false; }
      };
      const scheduleReload = () => {
        clearTimeout(reloadTimer);
        if (pendingReload) reloadTimer = setTimeout(reloadWhenIdle, 2000);
      };
      serviceWorker.addEventListener('controllerchange', () => {
        if (hadController) { pendingReload = true; scheduleReload(); }
        hadController = true;
      });
      for (const event of ['pointerdown', 'keydown', 'input', 'wheel', 'filet:screenchange']) {
        document.addEventListener(event, scheduleReload, {passive: true});
      }
      try {
        const registration = await serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'});
        let checking = false;
        const check = async () => {
          scheduleReload();
          if (document.hidden || checking) return;
          checking = true;
          try { await registration.update(); } catch (_) { /* Offline stays usable. */ }
          finally { checking = false; }
        };
        window.addEventListener('online', check);
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', check);
        setInterval(check, 60000);
        check();
        await serviceWorker.ready;
        try {
          const key = 'filet-offline-ready-v1';
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            notify('Можно вязать без интернета');
          }
        } catch (_) { /* Storage errors have their own persistent message in the app. */ }
      } catch (_) { /* First launch without a connection can be retried on reload. */ }
    }
  };
})();
