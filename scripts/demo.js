(function(root){
  'use strict';
  const marker='filet.demo-seeded.v1';
  const keys=['filet.patterns','filet.activity.v1','filet.pace.v1','filet.drafts.v1','filet.draft.v1'];
  function seed(storage,templates,now=new Date(),protocol='https:'){
    if(!['https:','http:'].includes(protocol))return false;
    const written=[];
    try{
      if(storage.getItem(marker)!==null || keys.some(key=>storage.getItem(key)!==null))return false;
      const patterns={};
      templates.forEach((template,i)=>{
        const id='demo-pattern-'+i;
        const {id:templateId,...body}=template;
        patterns[id]={...body,name:body.name.replace(/ · пример$/,'')+' · пример',
          cells:[...body.cells],templateId,pos:Math.floor(body.w*body.h*([.53,.18,0,.62,0,1][i%6])),
          createdAt:now.getTime()-(i+1)*86400000,updatedAt:now.getTime()-i*3600000,
          lastKnittedAt:i<2?now.getTime()-i*3600000:0};
      });
      const days={};
      for(let i=27;i>=0;i--){
        const date=new Date(now);date.setDate(date.getDate()-i);
        const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
        days[key]=i%6===2||i%7===4?0:15+(i*37+51)%105;
      }
      const pace=Array.from({length:24},(_,i)=>({id:'demo-pattern-0',to:i+1,
        ms:i%2?38000:24000,filled:!!(i%2),at:now.getTime()-(24-i)*45000}));
      const entries={'filet.patterns':patterns,'filet.activity.v1':{days,undo:{}},'filet.pace.v1':pace,[marker]:true};
      for(const [key,value] of Object.entries(entries)){
        storage.setItem(key,JSON.stringify(value));written.push(key);
      }
      return true;
    }catch(error){
      for(const key of written){try{storage.removeItem(key);}catch(ignore){}}
      return false;
    }
  }
  root.FiletDemo={seed};
})(typeof window==='undefined'?globalThis:window);
