(function () {
  'use strict';
  let started = false;
  window.FiletOffline = {
    async start(notify, beforeUpdate) {
      if (started || !/^https?:$/.test(location.protocol) || !window.isSecureContext ||
          !('serviceWorker' in navigator)) return;
      started = true;
      try {
        const registration = await navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'});
        const banner = document.getElementById('appUpdate');
        const button = document.getElementById('applyUpdate');
        const status = document.getElementById('updateStatus');
        const showUpdate = () => { if (registration.waiting && navigator.serviceWorker.controller) banner.hidden = false; };
        const watch = () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', showUpdate);
          showUpdate();
        };
        registration.addEventListener('updatefound', watch); watch();
        document.getElementById('deferUpdate').onclick = () => { banner.hidden = true; };
        button.onclick = async () => {
          button.disabled = true; status.textContent = 'Сохраняем работу и обновляем…';
          try {
            await window.FiletUpdate.activate(registration, beforeUpdate);
            location.reload();
          } catch (error) { status.textContent = error.message; button.disabled = false; }
        };
        const check = () => { registration.update().then(showUpdate).catch(() => {}); };
        window.addEventListener('online', check);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
        check();
        // ready resolves only after all files, including fonts, have been cached.
        await navigator.serviceWorker.ready;
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
