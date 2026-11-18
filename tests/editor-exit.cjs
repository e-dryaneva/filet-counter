const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const Drafts = require('../scripts/drafts.js');

function editor({ retained = false, edited = false, editId = null, fail = false } = {}) {
  const data = new Map(), elements = new Map(), events = [];
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '' });
    return elements.get(id);
  };
  const context = {
    $, Drafts, Date, uid: () => 'exit-draft', screen: 'imp', librarySection: 'home',
    imp: { editId, cols: 2, rows: 2, cells: [[0, 0], [0, 0]], firstRtl: true },
    LS: {
      get: (key, fallback) => structuredClone(data.get(key) ?? fallback),
      set: (key, value) => { if (fail) return false; data.set(key, structuredClone(value)); return true; }
    },
    show: screen => { events.push(['screen', screen]); context.screen = screen; },
    renderLibrary: () => events.push(['library', context.librarySection]),
    toast: message => events.push(['toast', message]),
    storageError: message => events.push(['error', message]),
    askDecision: () => { throw Error('Leaving the editor must not open a confirmation'); },
    openKnit: () => { throw Error('Leaving the editor must return to My patterns'); }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('let undoStack='), source.indexOf('function syncHistory(')), context);
  vm.runInContext('draftBaseline=JSON.stringify(editorSnapshot())', context);
  if (retained) vm.runInContext('draftRetained=true', context);
  if (edited) context.imp.cells[0][0] = 1;
  vm.runInContext(source.slice(source.indexOf("$('impBack').onclick ="), source.indexOf('function blank(')), context);
  $('impBack').onclick();
  return { context, events, drafts: Drafts.list(context.LS) };
}

for (const options of [{ edited: true }, { retained: true }, { edited: true, editId: 'existing-pattern' }]) {
  const result = editor(options);
  assert.deepEqual(result.events, [
    ['screen', 'lib'], ['library', 'mine'], ['toast', 'Черновик сохранён']
  ], 'Save first, return to My patterns, then notify without a confirmation');
  assert.equal(result.drafts.length, 1);
  assert.equal(result.drafts[0].cells[0], options.edited ? '10' : '00');
  assert.equal(result.drafts[0].editId, options.editId ?? null);
}
const untouched = editor();
assert.deepEqual(untouched.events, [['screen', 'lib'], ['library', 'mine']]);
assert.equal(untouched.drafts.length, 0, 'Opening and leaving an untouched editor creates no empty draft');
const failed = editor({ edited: true, fail: true });
assert.equal(failed.context.screen, 'imp', 'A failed save keeps the drawing in the editor');
assert.equal(failed.events.length, 1);
assert.equal(failed.events[0][0], 'error', 'Never show a successful-save notification on failure');
console.log('PASS: editor exit saves, navigates and notifies; empty and failed saves handled');
