(function () {
  'use strict';
  let started = false;
  window.FiletOffline = {
    async start(notify) {
      if (started || !/^https?:$/.test(location.protocol) || !window.isSecureContext ||
          !('serviceWorker' in navigator)) return;
      started = true;
      try {
        await navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'});
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
