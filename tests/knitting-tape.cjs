const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const code = source.slice(source.indexOf('function drawTape('), source.indexOf('let mapGeom = null;'));

function render(width, columns, position, rtl) {
  const cells = [], outlines = [], points = [];
  let height;
  const context = {
    clearRect() {}, stroke() {}, fill() {}, beginPath() {}, closePath() {},
    moveTo(x, y) { points.push({x, y}); }, lineTo(x, y) { points.push({x, y}); }
  };
  const sandbox = {
    $: () => ({clientWidth: width}),
    setupCanvas: (_canvas, _width, h) => { height = h; return context; },
    colors: () => ({ink: '#222'}),
    rowRtl: () => rtl,
    cellAt: (p, q) => {
      assert(q >= 0 && q < p.w * p.h, 'No cells outside the pattern');
      return {v: q};
    },
    drawCell: (_c, _k, x, y, size, q) => cells.push({x, y, size, q}),
    rrect: (_c, x, y, w, h) => outlines.push({x, y, w, h})
  };
  vm.runInNewContext(code, sandbox);
  sandbox.drawTape({w: columns, h: 3}, position);
  cells.forEach(cell => {
    assert(cell.x >= 0 && cell.x + cell.size <= width, 'Whole cells fit horizontally');
    assert(cell.y >= 0 && cell.y + cell.size <= height, 'Whole cells fit vertically');
  });
  outlines.forEach(rect => {
    assert(rect.x - 1.25 >= 0 && rect.x + rect.w + 1.25 <= width, 'Current-cell outline is not clipped');
    assert(rect.y - 1.25 >= 0 && rect.y + rect.h + 1.25 <= height);
  });
  points.forEach(point => assert(point.x >= 0 && point.x <= width && point.y <= height));
  assert.equal(outlines.length, position === columns * 3 ? 0 : 1);
  if (position < columns * 3) assert(cells.some(cell => cell.q === position));
  const row = Math.min(2, Math.floor(position / columns));
  cells.forEach(cell => assert.equal(Math.floor(cell.q / columns), row));
  for (let i = 1; i < cells.length; i++) {
    assert.equal(cells[i].q, cells[i - 1].q + 1, 'No gaps in the row');
    assert(rtl ? cells[i].x < cells[i - 1].x : cells[i].x > cells[i - 1].x);
  }
  return cells;
}

for (const width of [248, 313, 375, 775, 1100]) {
  for (const rtl of [false, true]) {
    for (const position of [0, 6, 12, 13, 23, 25, 38, 39]) {
      const cells = render(width, 13, position, rtl);
      assert.equal(cells.length, 13, 'Short rows stay complete, including near the end');
    }
    for (const position of [0, 1, 31, 61, 62, 63, 94, 124, 125, 188, 189]) {
      render(width, 63, position, rtl);
    }
    render(width, 1, 0, rtl);
    render(width, 1, 3, rtl);
  }
}
console.log('Knitting tape: short and long rows, both directions, edges and completion passed.');
