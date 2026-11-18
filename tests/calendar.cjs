const assert=require('node:assert/strict');const {FiletCalendar:{monthData}}=require('../scripts/calendar.js');
const today=new Date(2026,10,19,12);
const november=monthData({'2026-10-31':900,'2026-11-01':10,'2026-11-02':20,'2026-11-04':6,'2026-11-30':50},2026,10,today);
assert.equal(november.count,30);assert.equal(november.offset,6);assert.equal(november.total,36);assert.equal(november.active,3);assert.equal(november.best,2);assert.equal(november.average,12);assert(november.dates[29].future);
assert.equal(monthData({},2024,1,today).count,29);assert.equal(monthData({},2025,1,today).count,28);
const december=monthData({'2025-12-31':5},2025,11,today);assert.equal(december.total,5);assert.equal(december.dates[30].date.getDate(),31);
assert.equal(monthData({},2026,0,today).average,0);
console.log('PASS: month lengths, leap years, boundaries, future dates and monthly statistics');
