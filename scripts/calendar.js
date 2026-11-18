(function(root){
 'use strict';
 function monthData(days,year,month,today=new Date()){
  const start=new Date(year,month,1,12),count=new Date(year,month+1,0,12).getDate();
  const key=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  let total=0,active=0,streak=0,best=0,max=1;
  const dates=Array.from({length:count},(_,i)=>{
   const date=new Date(year,month,i+1,12),future=key(date)>key(today),value=future?0:Math.max(0,Number(days[key(date)])||0);
   total+=value;max=Math.max(max,value);if(value){active++;streak++;best=Math.max(best,streak);}else streak=0;
   return {date,value,future};
  });
  return {start,count,offset:(start.getDay()+6)%7,dates,total,active,best,max,average:active?Math.round(total/active):0};
 }
 root.FiletCalendar={monthData};
})(typeof module==='object'?module.exports:window);
