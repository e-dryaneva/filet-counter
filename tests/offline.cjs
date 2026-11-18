'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');

function worker({failInstall = false} = {}) {
  const scope = 'https://example.test/crochet/';
  const prefix = `filet-offline:${scope}:`;
  const current = prefix + 'new';
  const storage = new Map([[prefix + 'old', new Map()], ['another-app', new Map()]]);
  const handlers = {};
  const network = [];
  let claimed = false, activatedByUser = false;
  const caches = {
    async open(name) {
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name);
      return {
        async addAll(requests) {
          if (failInstall) throw Error('A font failed to download');
          for (const request of requests) entries.set(request.url, 'cached:' + request.url);
        },
        async match(url) { return entries.get(url); }
      };
    },
    async keys() { return [...storage.keys()]; },
    async delete(name) { return storage.delete(name); }
  };
  vm.runInNewContext(source, {
    URL, Request, caches, importScripts() {},
    fetch: async request => { network.push(request.url); return 'network'; },
    self: {
      registration: {scope},
      async skipWaiting() { activatedByUser = true; },
      FILET_OFFLINE: {version: 'new', assets: ['index.html', 'styles/system.css', 'assets/fonts/font.ttf']},
      clients: {async claim() { claimed = true; }},
      addEventListener(type, handler) { handlers[type] = handler; }
    }
  });
  const lifecycle = type => {
    let promise;
    handlers[type]({waitUntil(value) { promise = value; }});
    return promise;
  };
  const request = (url, method = 'GET', mode = 'cors') => {
    let promise;
    handlers.fetch({request: {url, method, mode}, respondWith(value) { promise = value; }});
    return promise;
  };
  return {scope, prefix, current, storage, network, lifecycle, request, claimed: () => claimed, activatedByUser: () => activatedByUser, message: async type => { let promise; handlers.message({data:{type},waitUntil(value){promise=value;}});await promise; }};
}

(async () => {
  const w = worker();
  await w.lifecycle('install');
  assert.equal(w.storage.get(w.current).size, 3, 'Every release asset is cached');
  assert(w.storage.has(w.prefix + 'old'), 'Installation keeps the active release');
  assert(w.activatedByUser(), 'A complete release activates automatically');
  await w.message('unrelated');
  await w.message('FILET_ACTIVATE_UPDATE');assert(w.activatedByUser(), 'Explicit update activates the waiting release');
  await w.lifecycle('activate');
  assert(!w.storage.has(w.prefix + 'old'));
  assert(w.storage.has('another-app'), 'Unrelated application caches survive');
  assert(w.claimed());
  assert.equal(await w.request(w.scope, 'GET', 'navigate'), 'cached:' + w.scope + 'index.html');
  assert.equal(await w.request(w.scope + 'index.html?launch=home', 'GET', 'navigate'), 'cached:' + w.scope + 'index.html');
  assert.equal(await w.request(w.scope + 'styles/system.css?v=4'), 'cached:' + w.scope + 'styles/system.css');
  assert.equal(await w.request(w.scope + 'assets/fonts/font.ttf'), 'cached:' + w.scope + 'assets/fonts/font.ttf');
  assert.equal(w.network.length, 0, 'Cached pages and fonts need no network');
  assert.equal(w.request(w.scope + 'unknown'), undefined);
  assert.equal(w.request('https://other.test/styles/system.css'), undefined);
  assert.equal(w.request(w.scope + 'index.html', 'POST'), undefined);
  w.storage.get(w.current).delete(w.scope + 'styles/system.css');
  assert.equal(await w.request(w.scope + 'styles/system.css'), 'network', 'Unexpected cache loss falls back to the network');

  const failed = worker({failInstall: true});
  await assert.rejects(failed.lifecycle('install'), /font failed/);
  assert(!failed.storage.has(failed.current), 'A partial release is discarded');
  assert(failed.storage.has(failed.prefix + 'old'), 'A failed update preserves the previous release');
  assert(!failed.activatedByUser(), 'Partial releases never activate');
  console.log('Offline caching: install, update, scope isolation, navigation and assets passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
