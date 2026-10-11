// Shared by the app and reminder sender. Dates are assigned on demand so overdue
// work rolls forward without changing a card's learning stage or writing every card.
(function(root){
  'use strict';
  var LIMIT=30;
  function nextDay(day){
    var p=day.split('-').map(Number),d=new Date(Date.UTC(p[0],p[1]-1,p[2]+1));
    return d.toISOString().slice(0,10);
  }
  function reviewedToday(cards,stats,day){
    var recorded=Number(((stats.days||{})[day]||{}).reviewed)||0;
    var history=cards.reduce(function(n,c){
      return n+(c.history||[]).filter(function(h){return h.d===day;}).length;
    },0);
    // Card and stats snapshots may arrive separately; honor the larger count.
    return Math.max(0,recorded,history);
  }
  function plan(cards,day,reviewed){
    var dates=new Map(),counts=new Map([[day,Math.max(0,reviewed||0)]]);
    var cursor=day;
    cards.slice().sort(function(a,b){
      return (a.due||day).localeCompare(b.due||day)||
        (a.stage||0)-(b.stage||0)||String(a.id).localeCompare(String(b.id));
    }).forEach(function(c){
      if(c.due>cursor) cursor=c.due;
      while((counts.get(cursor)||0)>=LIMIT) cursor=nextDay(cursor);
      dates.set(c.id,cursor);
      counts.set(cursor,(counts.get(cursor)||0)+1);
    });
    return dates;
  }
  var api={LIMIT:LIMIT,reviewedToday:reviewedToday,plan:plan};
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.ReviewPlan=api;
})(typeof globalThis!=='undefined'?globalThis:this);
