const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const UI=require('../scripts/ui-components.js');
const slice=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to));
class Element{
 constructor(){this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.dataset={};this.attrs={};this.classList={toggle(){}};}
 setAttribute(k,v){this.attrs[k]=String(v);}
 removeAttribute(k){delete this.attrs[k];}
 addEventListener(){}
 querySelector(){return null;}
 focus(){this.focused=true;}
}
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const data=new Map(),patterns=new Map();let confirm=true,undoDelete,opened,seq=0;
const context={$,console,Date,Drafts:require('../scripts/drafts.js'),Float32Array,Float64Array,screen:'imp',patterns,
 imp:{editId:null,mode:'blank',img:null,cols:3,rows:2,cells:[[1,0,1],[0,1,0]],firstRtl:true,sens:.5},
 LS:{get:(k,f)=>structuredClone(data.get(k)??f),set:(k,v)=>{data.set(k,structuredClone(v));return true;}},localStorage:{removeItem:k=>data.delete(k)},
 window:{addEventListener(){},FiletBackup:require('../scripts/backup.js')},document:{addEventListener(){}},
 UI:{...UI,fieldError(el,error){el.setAttribute('aria-invalid',!!error);}},
 syncDir(){},drawEditor(){},drawSrc(){},renderLibrary(){},storageError(){},
 show(screen){context.screen=screen;},openKnit(id){opened=id;},uid:()=> `new-${++seq}`,
 askDecision:async()=>confirm,toast:(message,label,undo)=>{undoDelete=undo;}
};
vm.createContext(context);
vm.runInContext(slice('function validPattern(',"$('exportPatterns').onclick"),context);
vm.runInContext(slice('let undoStack=',"$('impBack').onclick"),context);
vm.runInContext(slice('function blank(',"function handleFile("),context);
vm.runInContext(slice('function draftPatterns(','function templateMatchesFilters('),context);
vm.runInContext(slice('function previewCellSize(','function drawEditor('),context);

context.openImport(null,true);assert.equal($('imp').dataset.step,'1');assert.equal($('stepCheck').disabled,true);
$('stepSave').onclick();assert.equal($('imp').dataset.step,'1','Cannot skip image selection without a grid');
$('srcBlank').onclick();assert.equal($('imp').dataset.step,'2');
context.imp.cells[0][0]=1;$('pname').value='Розы';context.commitEditor();
const drawing=JSON.stringify(context.imp.cells);
$('stepSave').onclick();assert.equal($('savePanel').hidden,false);
$('stepSource').onclick();assert.equal($('srcPanel').hidden,false);assert.equal($('sourceActions').hidden,false);
$('sourceToCheck').onclick();assert.equal($('checkFields').hidden,false);
assert.equal(JSON.stringify(context.imp.cells),drawing,'Step navigation preserves the drawing');
assert.equal($('pname').value,'Розы','Step navigation preserves the name');
$('cols').value='2.5';$('stepSave').onclick();assert.equal($('imp').dataset.step,'2','Invalid dimensions cannot reach save');
$('cols').value='20';$('stepSave').onclick();assert.equal($('imp').dataset.step,'3');
let draft=context.draftPatterns()[0];assert.equal(draft.isDraft,true);assert.equal(draft.name,'Розы');assert.equal(draft.pos,0);assert.ok(draft.updatedAt>0);
assert.equal(patterns.size,0,'Draft stays separate from saved works');
$('filterStatus').value='draft';$('filterSize').value='small';assert.equal(context.myPatternMatchesFilters(draft),true);
assert.equal(context.myPatternMatchesFilters({...draft,isDraft:false}),false);
$('filterStatus').value='new';assert.equal(context.myPatternMatchesFilters(draft),false,'Unstarted and draft are different statuses');
context.resumeDraft(draft.draftId);assert.equal($('imp').dataset.step,'2');assert.equal(JSON.stringify(context.imp.cells),drawing);assert.equal($('pname').value,'Розы');

// Geometry is checked against faint lines independently of the filled-cell mask.
vm.runInContext(slice('function axisProfile(','let srcScale ='),context);
function grid(cols,rows,pitch,padding=7){
 const W=cols*pitch+1+padding*2,H=rows*pitch+1+padding*2,gridInk=new Float32Array(W*H),bin=new Uint8Array(W*H);
 for(let y=0;y<=rows*pitch;y++)for(let x=0;x<=cols*pitch;x++){
  const index=(y+padding)*W+x+padding;
  if(x%pitch===0||y%pitch===0)gridInk[index]=.12;
  else if((Math.floor(x/pitch)+Math.floor(y/pitch)*3)%7===1){gridInk[index]=.7;bin[index]=1;}
 }
 Object.assign(context.imp,{img:{},mode:'img',W,H,bin,gridInk,rect:{x0:0,y0:0,x1:W,y1:H}});
 return {cols,rows};
}
for(const [cols,rows,pitch] of [[37,19,10],[81,41,5],[12,46,7],[20,20,4]]){
 grid(cols,rows,pitch);context.runDetect();
 assert.equal(context.imp.cols,cols,`Detect ${cols} columns at pitch ${pitch}`);assert.equal(context.imp.rows,rows);
 assert.equal($('cols').value,cols);assert.equal($('rows').value,rows);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)assert.equal(context.imp.cells[y][x],(x+y*3)%7===1?1:0,`Cell ${x},${y} at pitch ${pitch}`);
 const cell=context.previewCellSize(cols,rows,280,400);
 assert.ok(cols*cell<=280.001&&rows*cell<=400.001,'Preview fits both axes without changing aspect ratio');
}
context.imp.gridInk.fill(0);context.imp.bin.fill(0);context.runDetect(false);
assert.equal(context.imp.cols,20,'No detected grid keeps explicit dimensions');assert.equal(context.imp.rows,20);
assert.match($('detStatus').textContent,/Не удалось/);

(async()=>{
 const draftId=context.draftPatterns()[0].draftId;
 confirm=false;await context.discardDraft(draftId);assert.equal(context.draftPatterns().length,1,'Cancel leaves the draft intact');
 confirm=true;await context.discardDraft(draftId);assert.equal(context.draftPatterns().length,0);
 const undo=undoDelete;undo();assert.equal(context.draftPatterns().length,1,'Deletion can be undone');
 await context.discardDraft(draftId);const staleUndo=undoDelete;
 context.openImport(null,true);$('srcBlank').onclick();$('pname').value='Новая';context.commitEditor();
 const newerId=context.draftPatterns()[0].draftId;
 staleUndo();assert.equal(context.draftPatterns().length,2,'Undo restores the old draft alongside a newly created one');
 assert.equal(context.draftPatterns().find(d=>d.draftId===newerId).name,'Новая');
 // Five independent works survive switching and reloads, each opening its own drawing.
 for(let i=0;i<3;i++){
  context.openImport(null,true);$('srcBlank').onclick();$('pname').value=`Работа ${i}`;
  context.imp.cells[0][i]=1;context.commitEditor();
 }
 const savedDrafts=structuredClone(context.draftPatterns());assert.equal(savedDrafts.length,5);
 for(const d of savedDrafts){context.resumeDraft(d.draftId);assert.equal($('pname').value,d.name);assert.equal(JSON.stringify(context.imp.cells.map(r=>r.join(''))),JSON.stringify(d.cells));}
 const dismiss=async choice=>{confirm=choice;context.screen='lib';context.openImport(null);await Promise.resolve();};
 await dismiss(null);assert.equal(context.screen,'lib','Closing the choice does not start a new work');assert.equal(context.draftPatterns().length,5);
 await dismiss(true);assert.equal(context.screen,'imp','Continue resumes the latest draft');assert.equal(context.draftPatterns().length,5);
 await dismiss(false);assert.equal(context.screen,'imp');assert.equal($('pname').value,'','New starts independently');assert.equal(context.draftPatterns().length,5,'No draft is overwritten or created just by opening');
 $('srcBlank').onclick();assert.equal(context.draftPatterns().length,6,'Choosing a blank grid stores a sixth draft');
 context.resumeDraft(newerId);
 context.store={save:async p=>patterns.set(p.id,p)};
 vm.runInContext(slice("$('btnSave').onclick = async",'let rz;'),context);
 await $('btnSave').onclick();assert.equal(patterns.size,1);assert.equal(context.draftPatterns().length,5);
 assert.equal(context.draftPatterns().some(d=>d.draftId===newerId),false,'Final save removes only the active draft');assert.equal(patterns.get(opened).name,'Новая');
 // A failed collection write leaves all drafts available for retry.
 context.resumeDraft(context.draftPatterns()[0].draftId);context.store.save=async()=>{throw Error('offline');};
 const beforeFailure=JSON.stringify(context.draftPatterns());await $('btnSave').onclick();assert.equal(JSON.stringify(context.draftPatterns()),beforeFailure);assert.equal($('saveMsg').dataset.state,'error');
 console.log('PASS: creation navigation, validation, faint-grid detection, proportional preview, five drafts, resume/delete/undo/save isolation and new/continue/dismiss');
})().catch(error=>{console.error(error);process.exitCode=1;});
