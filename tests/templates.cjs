const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const UI=require('../scripts/ui-components.js');

// Exercise the application's handlers with storage and animation controlled by the test.
class Element{
 constructor(){this.disabled=false;this.hidden=false;this.textContent='';this.dataset={};this.attrs=new Map();this.children=[];this.isConnected=true;}
 setAttribute(k,v){this.attrs.set(k,String(v));}
 getAttribute(k){return this.attrs.get(k)??null;}
 removeAttribute(k){this.attrs.delete(k);}
 addEventListener(){}
 getBoundingClientRect(){return {left:20,top:100,width:200,height:200};}
 append(...els){this.children.push(...els);}
 focus(){}
 close(){this.open=false;}
}
const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
let sequence=0,failSave=false,failAnimation=false,holdSave=null;
const persisted=new Map(),messages=[];
const template={id:'template-flower',name:'Цветок',w:2,h:2,cells:['01','10'],firstRtl:true,difficulty:'medium'};
const existing={...template,id:'existing',templateId:template.id,pos:3,createdAt:100,updatedAt:200};
const patterns=new Map([[existing.id,structuredClone(existing)]]);
const context={$,patterns,Date,window:{innerWidth:630},document:{body:{},activeElement:{},createElement:()=>new Element()},screen:'lib',librarySection:'templates',
 UI:{...UI,openDialog(dialog){dialog.open=true;}},
 uid:()=>`copy-${++sequence}`,patternTimeEstimate:()=>'',drawPaperThumb(){},renderLibrary(){},switchLibrarySection(){},
 icon:name=>name,toast:message=>messages.push(message),
 store:{async save(p){if(holdSave)await holdSave;if(failSave)throw Error('Storage unavailable');persisted.set(p.id,structuredClone(p));}},
 async animateTemplateEnvelope(){if(failAnimation)throw Error('Animation interrupted');}
};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('let addingTemplate=false;'),source.indexOf('function drawPaperThumb(')),context);

(async()=>{
 const opener=new Element();
 context.openTemplate(template,opener);
 assert.equal($('previewMine').hidden,false);
 assert.equal($('previewAdd').disabled,false,'An existing copy never blocks another addition');
 assert.equal($('previewAdd').textContent,'Добавить ещё');

 await $('previewAdd').onclick();
 await $('previewAdd').onclick();
 assert.equal(persisted.size,2,'Two deliberate confirmations save two distinct copies');
 assert.equal(patterns.size,3);
 for(const copy of persisted.values()){
  assert.equal(copy.pos,0);assert.equal(copy.templateId,template.id);assert.deepEqual(copy.cells,template.cells);
  assert.notEqual(copy.id,existing.id);assert.equal(copy.firstRtl,true);
 }
 assert.deepEqual(patterns.get(existing.id),existing,'Existing progress and timestamps are untouched');
 assert.equal($('previewAdd').disabled,false);
 assert.equal($('previewAdd').getAttribute('aria-busy'),null);
 context.openTemplate(template,opener);
 assert.equal($('previewAdd').disabled,false,'Reopening an added template preserves the action');

 let release;
 holdSave=new Promise(resolve=>{release=resolve;});
 const pending=$('previewAdd').onclick();
 assert.equal($('previewAdd').disabled,true);
 await $('previewAdd').onclick();
 release();await pending;holdSave=null;
 assert.equal(persisted.size,3,'Fast repeated clicks during a save create only one copy');

 patterns.clear();context.openTemplate(template,opener);
 assert.equal($('previewMine').hidden,true,'Removing the last copy clears its status');
 assert.equal($('previewAdd').textContent,'Добавить в мои схемы');
 failSave=true;
 await $('previewAdd').onclick();
 assert.equal(patterns.size,0);assert.equal($('previewMine').hidden,true);
 assert.equal($('previewAdd').disabled,false,'Storage failure leaves the action retryable');
 assert.match(messages.at(-1),/Не получилось/);
 failSave=false;failAnimation=true;
 await $('previewAdd').onclick();
 assert.equal(patterns.size,1,'Interrupted decoration does not discard a saved copy');
 assert.equal($('previewMine').hidden,false);
 assert.equal($('previewAdd').disabled,false);
 failAnimation=false;

 // Build and activate the actual compact card action from renderLibrary.
 const cardBlock=source.slice(source.indexOf('      const added=hasTemplate(p);'),source.indexOf('    }else acts.append(menu);'));
 function renderAction(){
  Object.assign(context,{p:template,card:new Element(),info:new Element(),sheet:new Element(),acts:new Element(),th:new Element()});
  vm.runInContext('{'+cardBlock+'}',context);
  return context.acts.children[0];
 }
 let action=renderAction();
 assert.equal(action.disabled,false);assert.match(action.getAttribute('aria-label'),/ещё одну/);
 const previous=patterns.size;await action.onclick();
 assert.equal(patterns.size,previous+1,'The compact plus also adds a separate copy');
 action=renderAction();assert.equal(action.disabled,false);
 assert.equal(context.info.children[0].hidden,false);
 patterns.clear();renderAction();assert.equal(context.info.children[0].hidden,true);
 console.log('PASS: repeat template additions, independent progress, busy guard, failure/retry, status and compact action');
})().catch(error=>{console.error(error);process.exitCode=1;});
