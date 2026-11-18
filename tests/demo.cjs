const assert = require('node:assert/strict');
require('../scripts/demo.js');
const templates = [{id:'sample',name:'Ромбы',w:2,h:2,cells:['0','1','1','0']}];
const now = new Date(2026,10,18,12);
function storage(initial={}) {
  const data = new Map(Object.entries(initial));
  return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
}
const fresh=storage();
assert.equal(FiletDemo.seed(fresh,templates,now,'https:'),true);
assert.equal(Object.keys(JSON.parse(fresh.getItem('filet.activity.v1')).days).length,28);
assert.equal(JSON.parse(fresh.getItem('filet.patterns'))['demo-pattern-0'].templateId,'sample');
assert.equal(FiletDemo.seed(fresh,templates,now,'https:'),false);
for(const key of ['filet.patterns','filet.activity.v1','filet.pace.v1','filet.drafts.v1','filet.draft.v1']) {
  const existing=storage({[key]:'{}'});
  assert.equal(FiletDemo.seed(existing,templates,now),false);
  assert.equal(existing.data.size,1);
}
assert.equal(FiletDemo.seed(storage(),templates,now,'file:'),false);
const limited=storage();
const write=limited.setItem;
limited.setItem=(k,v)=>{if(k==='filet.pace.v1')throw Error('Quota');write(k,v);};
assert.equal(FiletDemo.seed(limited,templates,now),false);
assert.equal(limited.data.size,0);
console.log('Demo seed: passed');
