(function () {
  'use strict';
  window.FiletUpdate = {
    waitForInstall(registration) {
      const worker = registration.installing;
      if (!worker) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const finish = error => { clearTimeout(timer); worker.removeEventListener('statechange', check); error ? reject(error) : resolve(); };
        const check = () => {
          if (worker.state === 'installed' || worker.state === 'activated') finish();
          else if (worker.state === 'redundant') finish(Error('Не удалось загрузить обновление. Попробуй ещё раз с интернетом.'));
        };
        const timer = setTimeout(() => finish(Error('Загрузка занимает больше времени. Попробуй ещё раз.')), 45000);
        worker.addEventListener('statechange', check); check();
      });
    },
    async activate(registration, beforeUpdate = async () => true) {
      if (!await beforeUpdate()) throw Error('Сначала сохрани работу или скачай резервную копию.');
      const worker = registration.waiting || registration.active;
      if (!worker) throw Error('Обновление ещё загружается. Попробуй ещё раз.');
      if (worker.state === 'activated') return;
      await new Promise((resolve, reject) => {
        const finish = error => { clearTimeout(timer); worker.removeEventListener('statechange', check); error ? reject(error) : resolve(); };
        const check = () => {
          if (worker.state === 'activated') finish();
          else if (worker.state === 'redundant') finish(Error('Обновление не установилось. Попробуй ещё раз.'));
        };
        const timer = setTimeout(() => finish(Error('Не удалось переключить версию. Попробуй ещё раз.')), 15000);
        worker.addEventListener('statechange', check);
        worker.postMessage({type:'FILET_ACTIVATE_UPDATE'}); check();
      });
    }
  };
})();
