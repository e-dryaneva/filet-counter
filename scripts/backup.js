/* File format and additive restoration. Preparing a file never writes user data. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./drafts.js'):root.FiletDrafts);if(typeof module==='object'&&module.exports)module.exports=api;else root.FiletBackup=api;})(globalThis,function(Drafts){
  'use strict';
  function validPattern(p){return !!p&&Number.isInteger(p.w)&&p.w>=2&&p.w<=250&&Number.isInteger(p.h)&&p.h>=2&&p.h<=300&&Array.isArray(p.cells)&&p.cells.length===p.h&&p.cells.every(r=>typeof r==='string'&&r.length===p.w&&/^[01]+$/.test(r))&&Number.isInteger(p.pos??0)&&(p.pos??0)>=0&&(p.pos??0)<=p.w*p.h;}
  function prepare(text,{uid,now=Date.now()}={}){
    let data;try{data=JSON.parse(text);}catch{throw Error('Не удалось прочитать файл. Выбери резервную копию приложения в формате JSON.');}
    if(!data||data.format!=='filet-backup')throw Error('Это не резервная копия приложения. Выбери файл, скачанный через «Скачать резервную копию».');
    if(data.version!==1)throw Error('Эта версия копии пока не поддерживается. Открой её в более новой версии приложения.');
    if(!Array.isArray(data.patterns)||data.patterns.length>1000||!data.patterns.every(validPattern))throw Error('В копии повреждены данные схем. Выбери другой файл.');
    const ids=new Map(),patterns=data.patterns.map(p=>{
      const id=uid();if(typeof p.id==='string'){if(ids.has(p.id))throw Error('В копии повторяются идентификаторы схем. Выбери другой файл.');ids.set(p.id,id);}
      return {id,name:String(p.name||'Без названия').slice(0,80),w:p.w,h:p.h,cells:[...p.cells],pos:p.pos||0,templateId:typeof p.templateId==='string'?p.templateId:null,lastKnittedAt:Number(p.lastKnittedAt)||0,firstRtl:p.firstRtl!==false,createdAt:Number(p.createdAt)||now,updatedAt:now};
    });
    const days={};for(const [date,n] of Object.entries(data.activity?.days||{}))if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(n)&&n>=0)days[date]=Math.floor(n);
    const pace=Array.isArray(data.pace)?data.pace.filter(s=>s&&Number.isFinite(s.ms)&&s.ms>=1000&&s.ms<=300000&&Number.isFinite(s.at)&&s.at<=now&&ids.has(s.id)).map(s=>({id:ids.get(s.id),ms:s.ms,at:s.at,to:s.to,filled:s.filled===true})):[];
    const incoming=data.drafts??(data.draft?[data.draft]:[]);
    if(!Array.isArray(incoming)||incoming.length>1000||!incoming.every(Drafts.valid))throw Error('В копии повреждены черновики. Выбери другой файл.');
    const drafts=incoming.map(d=>({version:1,id:uid(),editId:ids.get(d.editId)||null,cols:d.cols,rows:d.rows,cells:[...d.cells],name:d.name.slice(0,80),firstRtl:d.firstRtl!==false,createdAt:Number(d.createdAt)||Number(d.updatedAt)||now,updatedAt:Number(d.updatedAt)||now}));
    const exportedAt=typeof data.exportedAt==='string'&&Number.isFinite(Date.parse(data.exportedAt))?data.exportedAt:null;
    return {patterns,days,pace,drafts,exportedAt};
  }
  async function apply(plan,{storage,store,patterns,onProgress=()=>{}}){
    const write=(key,value)=>{if(!storage.set(key,value))throw Error('Не удалось сохранить всю копию. Освободи место на устройстве и нажми «Повторить». Уже добавленные схемы сохранятся, дубликаты при повторе не появятся.');};
    onProgress('Сохраняем схемы…');
    if(store.kind==='local'){
      const all=storage.get('filet.patterns',{});
      for(const p of plan.patterns){const {id,...body}=p;all[id]=body;}
      write('filet.patterns',all);for(const p of plan.patterns)patterns.set(p.id,p);
    }else{
      for(let i=0;i<plan.patterns.length;i++){
        const p=plan.patterns[i];await store.save(p);patterns.set(p.id,p);onProgress(`Сохраняем схемы: ${i+1} из ${plan.patterns.length}`);
      }
    }
    onProgress('Восстанавливаем прогресс и историю…');
    const activity=storage.get('filet.activity.v1',{days:{},undo:{}});activity.days ||= {};
    for(const [date,n] of Object.entries(plan.days))activity.days[date]=Math.max(activity.days[date]||0,n);
    write('filet.activity.v1',activity);
    const existing=storage.get('filet.pace.v1',[]),seen=new Set(existing.map(s=>`${s.at}:${s.ms}`));
    const added=plan.pace.filter(s=>{const key=`${s.at}:${s.ms}`;if(seen.has(key))return false;seen.add(key);return true;});
    write('filet.pace.v1',[...existing,...added].sort((a,b)=>a.at-b.at).slice(-500));
    if(plan.drafts.length&&!Drafts.merge(storage,plan.drafts))throw Error('Не удалось сохранить черновики. Освободи место на устройстве и нажми «Повторить».');
    return plan.patterns.length;
  }
  return {validPattern,prepare,apply};
});
