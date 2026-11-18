const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const handlers = new Map(), elements = new Map(), saved = new Map(), activity = [];
let modalOpen = false;

class Element {
  constructor(tagName = 'DIV', id = '', parent = null) {
    this.tagName = tagName;
    this.id = id;
    this.parentElement = parent;
    this.disabled = false;
    this.isContentEditable = false;
  }
  focus() {
    if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY', 'A'].includes(this.tagName) || this.tabIndex !== undefined) document.activeElement = this;
  }
  click() { if (!this.disabled) this.onclick?.(); }
  closest(selector) {
    const matches = selector.split(',').some(part => {
      if (part === '[role="textbox"]') return this.role === 'textbox';
      if (part === '[role="button"]') return this.role === 'button';
      return part.replace('[href]', '').toUpperCase() === this.tagName;
    });
    return matches ? this : this.parentElement?.closest(selector) || null;
  }
}
const $ = id => {
  if (!elements.has(id)) {
    const match = source.match(new RegExp('<([a-z]+)\\b[^>]*\\bid="' + id + '"[^>]*>', 'i'));
    const element = new Element(match?.[1].toUpperCase(), id);
    if (/tabindex=/.test(match?.[0] || '')) element.tabIndex = -1;
    elements.set(id, element);
  }
  return elements.get(id);
};
const document = {
  activeElement: null,
  addEventListener: (type, listener) => handlers.set(type, listener),
  querySelector: selector => selector === 'dialog[open]' && modalOpen ? {} : null
};
const pattern = {id: 'one', w: 3, h: 2, cells: ['010', '101'], pos: 0, firstRtl: true};
const context = {
  $, document, Date, screen: 'lib', curId: null,
  patterns: new Map([[pattern.id, pattern]]),
  menus: {closeAll() {}}, LS: {set() {}}, window: {scrollTo() {}}, navigator: {},
  requestWake() {}, releaseWake() {}, renderLibrary() {},
  rowRtl: (p, row) => row % 2 === 1,
  cellAt: (p, pos) => ({v: pos % 2 === 0}),
  queuePos: (id, pos) => saved.set(id, pos),
  recordKnittingPace() {},
  recordKnittingActivity: (...args) => activity.push(args),
  renderKnit() { $('btnDone').disabled = pattern.pos >= pattern.w * pattern.h; $('btnBack').disabled = pattern.pos <= 0; },
  setKnitTab() { context.renderKnit(); }
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function show(s)'), source.indexOf('function maybeResume(')), context);
vm.runInContext(source.slice(source.indexOf('function openKnit('), source.indexOf('function renderKnit(')), context);

function press(key, extra = {}) {
  const event = {key, target: document.activeElement, defaultPrevented: false, preventDefault() {this.defaultPrevented = true;}, ...extra};
  handlers.get('keydown')(event);
  // Native button activation occurs unless the shortcut consumed the key.
  if (!event.defaultPrevented && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && ['Enter', ' '].includes(key) && event.target?.tagName === 'BUTTON') event.target.click();
  return event;
}
function position(pos) {pattern.pos = pos; context.renderKnit();}
function expectStep(key, delta, extra) {
  const before = pattern.pos, count = activity.length;
  assert.equal(press(key, extra).defaultPrevented, true, `${key} suppresses native scrolling or activation`);
  assert.equal(pattern.pos, before + delta, `${key} changes exactly one cell`);
  assert.equal(activity.length, count + 1, 'The same step updates activity once');
  assert.equal(saved.get(pattern.id), pattern.pos, 'Keyboard progress uses the saving path');
}

const tile = new Element('BUTTON');
tile.onclick = () => context.openKnit(pattern.id);
tile.focus();
press('Enter');
assert.equal(pattern.pos, 0, 'Opening a pattern with Enter does not knit a cell');
assert.equal(document.activeElement, $('colNow'), 'Focus leaves the hidden library tile');
expectStep(' ', 1);
expectStep('Enter', 1);
expectStep('Backspace', -1);

context.show('imp');
$('pname').focus();
context.openKnit(pattern.id);
assert.equal(document.activeElement, $('colNow'), 'Saving a scheme leaves the hidden name input');
expectStep('Enter', 1);
expectStep('Backspace', -1);

$('btnDone').focus();
expectStep('Enter', 1);
expectStep(' ', 1);
$('btnBack').focus();
$('btnBack').click();
expectStep(' ', 1);
expectStep('Backspace', -1);
expectStep('Enter', 1);

const beforeHold = pattern.pos;
for (const key of ['Enter', ' ', 'Backspace']) for (let n = 0; n < 5; n++) assert.equal(press(key, {repeat: true}).defaultPrevented, true);
assert.equal(pattern.pos, beforeHold, 'Holding a key does not silently count extra cells');

$('colNow').focus();
for (const key of ['Enter', ' ', 'Backspace']) {
  for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'isComposing', 'defaultPrevented']) {
    press(key, {[flag]: true});
    assert.equal(pattern.pos, beforeHold, 'Browser shortcuts and composition leave progress unchanged');
  }
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
    new Element(tag).focus(); press(key);
    assert.equal(pattern.pos, beforeHold, 'Typing does not change progress');
  }
  press(key, {target: {isContentEditable: true}});
  const textbox = new Element(); textbox.role = 'textbox';
  press(key, {target: new Element('SPAN', '', textbox)});
  assert.equal(pattern.pos, beforeHold, 'Rich text inputs do not trigger shortcuts');
}
modalOpen = true;
$('colNow').focus();
press(' '); press('Enter'); press('Backspace');
assert.equal(pattern.pos, beforeHold, 'A dialog blocks background knitting shortcuts');
modalOpen = false;

position(5);
expectStep('Enter', 1);
press('Enter'); press(' ');
assert.equal(pattern.pos, 6, 'Completion is a stable upper bound');
expectStep('Backspace', -1);
position(0); press('Backspace'); assert.equal(pattern.pos, 0);

$('knitBack').focus(); press('Enter');
assert.equal(context.screen, 'lib', 'Back retains its native keyboard action');
press(' '); press('Enter'); press('Backspace');
assert.equal(pattern.pos, 0, 'Shortcuts are limited to the knitting screen');
console.log('PASS: entry focus, Space/Enter/Backspace, single-step saving, undo focus, held keys, inputs, dialogs and bounds');
