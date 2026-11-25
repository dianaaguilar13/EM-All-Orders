/* EVENTS tab - event and post budget vs results, programs sold, where each program sells, history by year.
   Data: events_data.json (built by events_build.py on every Run.bat). Same rules as the new dashboard. */
if(typeof EXCLUDED_SKUS==="undefined")var EXCLUDED_SKUS=new Set([]);

var EV=null,evSelSku=new Set(),evSelEv=new Set(),evPicked=null,evShowAll=false,evApplied=null;
var EV_ORANGE="#ea580c";
var EV_SKU_PATTERNS=["dblv","ticket","kit","gift"];
var EV_CH=["event","post","other"];

/* ── helpers ───────────────────────────────────────────── */
function evEsc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function evN0(v){return Math.round(v).toLocaleString("en-US");}
function evUsd(v){return "$"+evN0(v);}
function evUsdK(v){return Math.abs(v)>=1e6?"$"+(v/1e6).toFixed(2)+"M":"$"+evN0(v/1e3)+"K";}
function evPct1(v){return v.toFixed(1)+"%";}
function evVariance(actual,budget){return budget>0?((actual-budget)/budget)*100:null;}
function evTone(p){return p==null?"none":p>=0?"good":p>=-10?"warn":"bad";}
var EV_TONE={good:"background:#e6f4ea;color:#15803d",warn:"background:#fff4e0;color:#b45309",bad:"background:#fdeaea;color:#b91c1c",none:"background:#f1f5f9;color:#64748b"};
function evPill(actual,budget){var p=evVariance(actual,budget);return '<span style="'+EV_TONE[evTone(p)]+';padding:1px 7px;border-radius:10px;font-size:10.5px;font-weight:700">'+(p==null?"–":(p>=0?"+":"")+p.toFixed(0)+"%")+"</span>";}
function evPostReported(e){return e.post_net_leads!=null||e.post_ss!=null||e.post_units!=null;}
function evHasResults(e){return e.ev_res_att>0||e.ev_res_units>0||e.ev_res_vol>0;}
function evSkuHiddenByDefault(s){if(EXCLUDED_SKUS.has(s))return true;var l=s.toLowerCase();return EV_SKU_PATTERNS.some(function(p){return l.indexOf(p)>=0;});}
/* Picked SKUs are used as given. With none picked, tickets, kits, packages and the other SKUs every tab hides by default are hidden here too. */
function evSkuOk(s,picked){return picked.size?picked.has(s):!evSkuHiddenByDefault(s);}

/* ── load ──────────────────────────────────────────────── */
function evLoad(){
  if(EV||evLoading)return;
  evLoading=true;
  fetch("events_data.json?v="+Date.now()).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(function(d){EV=d;evLoading=false;document.getElementById("events-loading").style.display="none";document.getElementById("events-main").style.display="block";evApply();})
    .catch(function(err){evLoading=false;document.getElementById("events-loading").innerHTML='<div style="color:#b91c1c">Could not load events_data.json ('+evEsc(err.message)+"). Run Run.bat to build it.</div>";});
}
var evLoading=false;

/* ── filters ───────────────────────────────────────────── */
function evDraft(){
  return{from:document.getElementById("events-df").value,to:document.getElementById("events-dt").value,
    skus:new Set(evSelSku),events:new Set(evSelEv),type:document.getElementById("events-type").value,post:document.getElementById("events-post").value};
}
function evToggleDrop(which,e){
  e.stopPropagation();
  ["sku","ev"].forEach(function(w){if(w!==which)document.getElementById("events-"+w+"Drop").classList.remove("open");});
  var dr=document.getElementById("events-"+which+"Drop");dr.classList.toggle("open");
  if(dr.classList.contains("open")){document.getElementById("events-"+which+"Q").focus();which==="sku"?evRenderSkuItems():evRenderEvItems();}
}
function evVisibleSkus(){var q=document.getElementById("events-skuQ").value.toLowerCase();return(EV?EV.skus:[]).filter(function(s){return s.toLowerCase().indexOf(q)>=0;});}
function evRenderSkuItems(){
  if(!EV)return;
  var all=evVisibleSkus(),incl=all.filter(function(s){return!evSkuHiddenByDefault(s);}),excl=all.filter(evSkuHiddenByDefault);
  var item=function(s,dim){return'<div class="ms-item" data-s="'+evEsc(s)+'" onclick="evTogSku(event,this)"'+(dim?' style="opacity:.65"':"")+'><input type="checkbox" '+(evSelSku.has(s)?"checked":"")+' onclick="return false"><span'+(dim?' style="color:#94a3b8"':"")+">"+evEsc(s)+"</span></div>";};
  var h=incl.map(function(s){return item(s,false);}).join("");
  if(excl.length)h+='<div style="padding:5px 10px 3px;font-size:10px;color:#94a3b8;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">⚠ Hidden by default</div>'+excl.map(function(s){return item(s,true);}).join("");
  document.getElementById("events-skuItems").innerHTML=h;
}
function evTogSku(e,el){e.stopPropagation();var s=el.getAttribute("data-s");evSelSku.has(s)?evSelSku.delete(s):evSelSku.add(s);evUpdateSkuBtn();evRenderSkuItems();}
function evSkuAll(){evVisibleSkus().filter(function(s){return!evSkuHiddenByDefault(s);}).forEach(function(s){evSelSku.add(s);});evUpdateSkuBtn();evRenderSkuItems();}
function evSkuClear(){evSelSku.clear();evUpdateSkuBtn();evRenderSkuItems();}
function evUpdateSkuBtn(){
  var b=document.getElementById("events-skuBtn"),c=document.getElementById("events-skuCnt");
  if(!evSelSku.size){b.textContent="All SKUs";c.style.display="none";}
  else{b.textContent=evSelSku.size===1?Array.from(evSelSku)[0]:evSelSku.size+" SKUs selected";c.textContent=evSelSku.size;c.style.display="inline";}
}
function evVisibleEvents(){var q=document.getElementById("events-evQ").value.toLowerCase();return(EV?EV.events:[]).filter(function(e){return(e.code+" "+e.name).toLowerCase().indexOf(q)>=0;});}
function evEvLabel(e){return e.code+(e.type==="IN-PERSON"?" (in person)":"")+" · "+e.name;}
function evRenderEvItems(){
  if(!EV)return;
  var vis=evVisibleEvents(),groups={};
  vis.forEach(function(e){(groups[e.year]=groups[e.year]||[]).push(e);});
  var h="";
  Object.keys(groups).sort(function(a,b){return b-a;}).forEach(function(y){
    var list=groups[y],allSel=list.every(function(e){return evSelEv.has(e.id);});
    h+='<div style="padding:5px 10px 3px;font-size:10px;font-weight:700;background:#f1f5f9;color:'+EV_ORANGE+';display:flex;justify-content:space-between;cursor:pointer;user-select:none" data-y="'+y+'" onclick="evTogYear(event,this)"><span>'+y+'</span><span style="font-size:9px;opacity:.75">'+(allSel?"✓ deselect all":"+ select all")+"</span></div>";
    list.forEach(function(e){h+='<div class="ms-item" data-id="'+evEsc(e.id)+'" onclick="evTogEv(event,this)"><input type="checkbox" '+(evSelEv.has(e.id)?"checked":"")+' onclick="return false"><span>'+evEsc(evEvLabel(e))+"</span></div>";});
  });
  document.getElementById("events-evItems").innerHTML=h;
}
function evTogEv(e,el){e.stopPropagation();var id=el.getAttribute("data-id");evSelEv.has(id)?evSelEv.delete(id):evSelEv.add(id);evUpdateEvBtn();evRenderEvItems();}
function evTogYear(e,el){
  e.stopPropagation();var y=el.getAttribute("data-y");
  var ids=evVisibleEvents().filter(function(x){return String(x.year)===y;}).map(function(x){return x.id;});
  var all=ids.every(function(i){return evSelEv.has(i);});
  ids.forEach(function(i){all?evSelEv.delete(i):evSelEv.add(i);});
  evUpdateEvBtn();evRenderEvItems();
}
function evEvAll(){evVisibleEvents().forEach(function(e){evSelEv.add(e.id);});evUpdateEvBtn();evRenderEvItems();}
function evEvClear(){evSelEv.clear();evUpdateEvBtn();evRenderEvItems();}
function evUpdateEvBtn(){
  var b=document.getElementById("events-evBtn"),c=document.getElementById("events-evCnt");
  if(!evSelEv.size){b.textContent="All events";c.style.display="none";}
  else{b.textContent=evSelEv.size===1?Array.from(evSelEv)[0]:evSelEv.size+" events selected";c.textContent=evSelEv.size;c.style.display="inline";}
}
document.addEventListener("click",function(e){
  [["events-skuWrap","events-skuDrop"],["events-evWrap","events-evDrop"]].forEach(function(p){
    var w=document.getElementById(p[0]);if(w&&!w.contains(e.target))document.getElementById(p[1]).classList.remove("open");
  });
});
function evApply(){["events-skuDrop","events-evDrop"].forEach(function(id){document.getElementById(id).classList.remove("open");});evApplied=evDraft();evRender();}
function evReset(){
  var y=new Date().getFullYear();
  document.getElementById("events-df").value="2022-01-01";document.getElementById("events-dt").value=y+"-12-31";
  document.getElementById("events-type").value="";document.getElementById("events-post").value="";
  evSelSku.clear();evSelEv.clear();evPicked=null;evShowAll=false;evUpdateSkuBtn();evUpdateEvBtn();evApply();
}
function evPick(id){evPicked=id;evRender();}
function evToggleAll(){evShowAll=!evShowAll;evRender();}

/* ── calculations (same rules as the new dashboard) ───── */
function evSelectEvents(f){
  return EV.events.filter(function(e){
    return(!f.from||e.date>=f.from)&&(!f.to||e.date<=f.to)&&(!f.type||e.type===f.type)&&(!f.events.size||f.events.has(e.id))&&(!f.post||(f.post==="reported")===evPostReported(e));
  });
}
function evTotals(list){
  var t={events:list.length,evBud:{att:0,units:0,vol:0},evRes:{att:0,units:0,vol:0},postBud:{leads:0,units:0,vol:0},post:{net:0,ss:0,units:0,vol:0,reported:0}};
  list.forEach(function(e){
    t.evBud.att+=e.ev_bud_att;t.evBud.units+=e.ev_bud_units;t.evBud.vol+=e.ev_bud_vol;
    t.evRes.att+=e.ev_res_att;t.evRes.units+=e.ev_res_units;t.evRes.vol+=e.ev_res_vol;
    t.postBud.leads+=e.post_bud_leads;t.postBud.units+=e.post_bud_units;t.postBud.vol+=e.post_bud_vol;
    if(evPostReported(e)){t.post.reported++;t.post.net+=e.post_net_leads||0;t.post.ss+=e.post_ss||0;t.post.units+=e.post_units||0;t.post.vol+=e.post_vol||0;}
  });
  return t;
}
function evByYear(list){
  var m={};
  list.forEach(function(e){
    if(!evHasResults(e))return;
    var y=m[e.year]=m[e.year]||{year:e.year,events:0,attendees:0,units:0,volume:0,postUnits:0,postVolume:0};
    y.events++;y.attendees+=e.ev_res_att;y.units+=e.ev_res_units;y.volume+=e.ev_res_vol;y.postUnits+=e.post_units||0;y.postVolume+=e.post_vol||0;
  });
  return Object.keys(m).map(function(k){return m[k];}).sort(function(a,b){return a.year-b.year;});
}
function evSalesFor(ids,skuPick){
  /* programs sold under the event codes, by SKU */
  var m={};
  EV.sales.forEach(function(r){
    if(!ids.has(r[0])||!evSkuOk(r[1],skuPick))return;
    var c=m[r[1]]=m[r[1]]||{sku:r[1],units:0,cancelled:0,volume:0,events:{}};
    c.units+=r[2];c.cancelled+=r[3];c.volume+=r[4];c.events[r[0]]=1;
  });
  return Object.keys(m).map(function(k){var c=m[k];c.eventCount=Object.keys(c.events).length;return c;}).sort(function(a,b){return b.volume-a.volume;});
}

/* ── render ────────────────────────────────────────────── */
var EV_TH="text-align:right;padding:6px 8px;border-bottom:1px solid #dde3ea;font-weight:600;color:"+EV_ORANGE+";white-space:nowrap;font-size:11px";
var EV_GRP=EV_TH+";text-align:center;color:#1a2332;border-bottom:2px solid "+EV_ORANGE;
var EV_TD="text-align:right;padding:6px 8px;border-bottom:1px solid #eef2f6;white-space:nowrap";
var EV_TF="border-top:2px solid "+EV_ORANGE;
var EV_SEC="padding:16px 24px;border-bottom:1px solid #dde3ea";
var EV_TITLE="font-weight:600;color:"+EV_ORANGE+";margin-bottom:3px";
var EV_HINT="font-size:11px;color:#64748b;line-height:1.5";

function evKpi(label,value,sub){return'<div class="kpi" style="border-left:3px solid '+EV_ORANGE+'"><div class="kl">'+label+'</div><div class="kv">'+value+'</div><div class="ks muted">'+sub+"</div></div>";}
function evBar(name,budget,actual,fmt){
  var max=Math.max(budget,actual,1)*1.08;
  return'<div style="display:grid;grid-template-columns:100px 1fr auto;gap:8px;align-items:center;margin:7px 0"><span style="font-size:12px;color:#64748b">'+name+'</span>'+
    '<div style="position:relative;height:10px;background:#f1f5f9;border-radius:5px"><div style="position:absolute;left:0;top:0;height:10px;width:'+(actual/max*100)+'%;background:'+EV_ORANGE+';border-radius:5px"></div><div style="position:absolute;top:-3px;left:'+(budget/max*100)+'%;width:2px;height:16px;background:#1a2332"></div></div>'+
    '<span style="font-size:12px;font-weight:600;white-space:nowrap">'+fmt(actual)+' <span style="color:#94a3b8;font-weight:400">/ '+fmt(budget)+"</span> "+evPill(actual,budget)+"</span></div>";
}
function evPlain(name,value,sub){return'<div style="display:grid;grid-template-columns:100px 1fr auto;gap:8px;align-items:center;margin:7px 0"><span style="font-size:12px;color:#64748b">'+name+'</span><span></span><span style="font-size:12px;font-weight:600">'+value+(sub?' <span style="color:#94a3b8;font-weight:400">/ '+sub+"</span>":"")+"</span></div>";}
function evCard(title,body){return'<div style="border:1px solid #dde3ea;border-radius:8px;padding:12px;min-width:0"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:8px">'+title+"</div>"+body+"</div>";}
function evSalesTable(rows,empty,limit){
  if(!rows.length)return'<div style="'+EV_HINT+'">'+empty+"</div>";
  var tv=rows.reduce(function(a,r){return a+r.volume;},0),hasEv=rows.some(function(r){return r.eventCount!=null;});
  var h='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="'+EV_TH+';text-align:left">Program (SKU)</th><th style="'+EV_TH+'">Units</th><th style="'+EV_TH+'">Cancelled</th><th style="'+EV_TH+'">Volume</th><th style="'+EV_TH+'">Share</th>'+(hasEv?'<th style="'+EV_TH+'">Events</th>':"")+"</tr></thead><tbody>";
  rows.slice(0,limit).forEach(function(r){
    h+='<tr><td style="'+EV_TD+';text-align:left">'+evEsc(r.sku)+'</td><td style="'+EV_TD+'">'+evN0(r.units)+'</td><td style="'+EV_TD+";color:"+(r.cancelled?"#b91c1c":"#94a3b8")+'">'+evN0(r.cancelled)+'</td><td style="'+EV_TD+'">'+evUsd(r.volume)+'</td><td style="'+EV_TD+'">'+(tv?evPct1(r.volume/tv*100):"–")+"</td>"+(hasEv?'<td style="'+EV_TD+'">'+r.eventCount+"</td>":"")+"</tr>";
  });
  h+='</tbody><tfoot><tr style="font-weight:700;background:#f8fafc"><td style="'+EV_TD+";text-align:left;"+EV_TF+'">Total · '+rows.length+' SKUs</td><td style="'+EV_TD+";"+EV_TF+'">'+evN0(rows.reduce(function(a,r){return a+r.units;},0))+'</td><td style="'+EV_TD+";"+EV_TF+'">'+evN0(rows.reduce(function(a,r){return a+r.cancelled;},0))+'</td><td style="'+EV_TD+";"+EV_TF+'">'+evUsd(tv)+'</td><td style="'+EV_TD+";"+EV_TF+'"></td>'+(hasEv?'<td style="'+EV_TD+";"+EV_TF+'"></td>':"")+"</tr></tfoot></table></div>";
  return h;
}

function evRender(){
  var body=document.getElementById("events-body");
  if(!EV||!evApplied)return;
  document.getElementById("events-rcLbl").textContent=EV.events.length?EV.events.length+" events · "+(EV.source||"sheet")+" · "+(EV.generated||""):"No events loaded";
  if(!EV.events.length){
    body.innerHTML='<div style="'+EV_SEC+'"><div style="padding:24px;text-align:center;color:#64748b;background:#f8fafc;border-radius:8px;border:1px dashed #dde3ea">No events have been loaded yet. Add <code>events_sheet_id</code> (and optionally <code>google_api_key</code>) to <code>secrets.json</code>, or save the EVENT &amp; POST tab as <code>events-sheet.csv</code> next to <code>refresh_bti_data.py</code>, then run <code>Run.bat</code>.</div></div>';
    return;
  }
  var f=evApplied,events=evSelectEvents(f),shown=events.filter(evHasResults),t=evTotals(shown);
  var sel=null;
  for(var i=0;i<events.length;i++)if(events[i].id===evPicked)sel=events[i];
  if(!sel)sel=shown[shown.length-1]||events[0]||null;
  var ids=new Set(events.map(function(e){return e.id;}));
  var h="";

  /* KPI cards */
  h+='<div style="'+EV_SEC+'"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">'+
    evKpi("Events",String(t.events),(events.length-shown.length)+" without results")+
    evKpi("Attendees",evN0(t.evRes.att),"budget "+evN0(t.evBud.att))+
    evKpi("Event units",evN0(t.evRes.units),"budget "+evN0(t.evBud.units))+
    evKpi("Event volume",evUsdK(t.evRes.vol),"budget "+evUsdK(t.evBud.vol))+
    evKpi("Event VPA",t.evRes.att?evUsd(t.evRes.vol/t.evRes.att):"–","volume per attendee")+
    evKpi("Event closing %",t.evRes.att?evPct1(t.evRes.units/t.evRes.att*100):"–","units per attendee")+
    evKpi("Post net leads",evN0(t.post.net),t.post.reported+" events reported")+
    evKpi("Post strategy sessions",evN0(t.post.ss),t.post.reported+" events reported")+
    evKpi("Post units",evN0(t.post.units),"budget "+evN0(t.postBud.units)+" (all events)")+
    evKpi("Post volume",evUsdK(t.post.vol),"budget "+evUsdK(t.postBud.vol)+" (all events)")+
    "</div></div>";

  /* events table */
  var heads=["Attend.","Units","Volume","Attend.","Units","Volume","vs budget","Leads","Units","Volume","Net leads","SS","Units","Volume","vs budget"];
  h+='<div style="'+EV_SEC+'"><div style="'+EV_TITLE+'">Events: budget vs results, then the post-event follow-up</div><div style="'+EV_HINT+'">One row per event. <b>Event</b> = what happened at the event. <b>Post</b> = what the post team sold afterwards to the people who attended. Click a row for its detail. The total row adds up the events shown. Green is at or above budget, amber within 10% below, red further below.</div>'+
    '<div style="overflow-x:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:1180px"><thead><tr><th style="'+EV_TH+';text-align:left" rowspan="2">Event</th><th style="'+EV_GRP+'" colspan="3">Event budget</th><th style="'+EV_GRP+'" colspan="4">Event results</th><th style="'+EV_GRP+'" colspan="3">Post budget</th><th style="'+EV_GRP+'" colspan="5">Post results</th></tr><tr>'+
    heads.map(function(x){return'<th style="'+EV_TH+'">'+x+"</th>";}).join("")+"</tr></thead><tbody>";
  shown.forEach(function(e){
    var rep=evPostReported(e),muted=EV_TD+";color:#64748b";
    h+='<tr data-id="'+evEsc(e.id)+'" onclick="evPick(this.getAttribute(\'data-id\'))" style="cursor:pointer'+(sel&&sel.id===e.id?";background:#fff1e6":"")+'"><td style="'+EV_TD+';text-align:left;max-width:280px;overflow:hidden;text-overflow:ellipsis"><b>'+evEsc(e.code)+"</b> "+evEsc(e.name)+(e.type==="IN-PERSON"?' <span style="margin-left:6px;font-size:10px;background:#fff4e0;color:#b45309;padding:1px 6px;border-radius:4px;font-weight:700">In person</span>':"")+"</td>"+
      '<td style="'+muted+'">'+evN0(e.ev_bud_att)+'</td><td style="'+muted+'">'+evN0(e.ev_bud_units)+'</td><td style="'+muted+'">'+evUsd(e.ev_bud_vol)+"</td>"+
      '<td style="'+EV_TD+'">'+evN0(e.ev_res_att)+'</td><td style="'+EV_TD+'">'+evN0(e.ev_res_units)+'</td><td style="'+EV_TD+'">'+evUsd(e.ev_res_vol)+'</td><td style="'+EV_TD+'">'+evPill(e.ev_res_vol,e.ev_bud_vol)+"</td>"+
      '<td style="'+muted+'">'+evN0(e.post_bud_leads)+'</td><td style="'+muted+'">'+evN0(e.post_bud_units)+'</td><td style="'+muted+'">'+evUsd(e.post_bud_vol)+"</td>"+
      (rep?'<td style="'+EV_TD+'">'+evN0(e.post_net_leads||0)+'</td><td style="'+EV_TD+'">'+evN0(e.post_ss||0)+'</td><td style="'+EV_TD+'">'+evN0(e.post_units||0)+'</td><td style="'+EV_TD+'">'+evUsd(e.post_vol||0)+'</td><td style="'+EV_TD+'">'+evPill(e.post_vol||0,e.post_bud_vol)+"</td>":'<td style="'+EV_TD+';text-align:center;color:#94a3b8" colspan="5">post not reported yet</td>')+"</tr>";
  });
  if(!shown.length)h+='<tr><td style="'+EV_TD+';text-align:center;color:#64748b" colspan="16">No events with results match these filters.</td></tr>';
  h+="</tbody>";
  if(shown.length){
    var tf=function(v){return'<td style="'+EV_TD+";"+EV_TF+'">'+v+"</td>";};
    h+='<tfoot><tr style="font-weight:700;background:#f8fafc"><td style="'+EV_TD+";text-align:left;"+EV_TF+'">Total · '+shown.length+" event"+(shown.length>1?"s":"")+"</td>"+
      tf(evN0(t.evBud.att))+tf(evN0(t.evBud.units))+tf(evUsd(t.evBud.vol))+tf(evN0(t.evRes.att))+tf(evN0(t.evRes.units))+tf(evUsd(t.evRes.vol))+tf(evPill(t.evRes.vol,t.evBud.vol))+
      tf(evN0(t.postBud.leads))+tf(evN0(t.postBud.units))+tf(evUsd(t.postBud.vol))+tf(evN0(t.post.net))+tf(evN0(t.post.ss))+tf(evN0(t.post.units))+tf(evUsd(t.post.vol))+tf("")+"</tr></tfoot>";
  }
  h+="</table></div></div>";

  /* event detail */
  if(sel){
    var detail=evSalesFor(new Set([sel.id]),f.skus);
    h+='<div style="'+EV_SEC+'"><div style="'+EV_TITLE+'">'+evEsc(sel.code)+" · "+evEsc(sel.name)+'</div><div style="'+EV_HINT+'">One event on one screen: what was budgeted, what happened, how the post is doing, and which programs sold under the event\'s referral code.</div>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:10px">'+
      evCard("Event: budget vs result",evBar("Attendees",sel.ev_bud_att,sel.ev_res_att,evN0)+evBar("Units",sel.ev_bud_units,sel.ev_res_units,evN0)+evBar("Volume",sel.ev_bud_vol,sel.ev_res_vol,evUsdK)+evPlain("Closing %",sel.ev_res_att?evPct1(sel.ev_res_units/sel.ev_res_att*100):"–",sel.ev_bud_att?"budget "+evPct1(sel.ev_bud_units/sel.ev_bud_att*100):""))+
      evCard("Post: budget vs result"+(evPostReported(sel)?"":" (not reported yet)"),evPostReported(sel)?
        evBar("Net leads",sel.post_bud_leads,sel.post_net_leads||0,evN0)+evBar("Units",sel.post_bud_units,sel.post_units||0,evN0)+evBar("Volume",sel.post_bud_vol,sel.post_vol||0,evUsdK)+evPlain("Strategy sessions",evN0(sel.post_ss||0),"")+evPlain("Close % of SS",sel.post_ss?evPct1((sel.post_units||0)/sel.post_ss*100):"–",""):
        '<div style="'+EV_HINT+'">Post budget: '+evN0(sel.post_bud_leads)+" leads, "+evN0(sel.post_bud_units)+" units, "+evUsd(sel.post_bud_vol)+". Results appear when the post team reports them in the sheet.</div>")+
      evCard("Programs sold at this event",evSalesTable(detail.map(function(r){return{sku:r.sku,units:r.units,cancelled:r.cancelled,volume:r.volume};}),"No orders carry this event's referral code.",1000))+
      "</div></div>";
  }

  /* programs sold */
  var programs=evSalesFor(ids,f.skus);
  var lostBy={};
  EV.unmatched.forEach(function(u){if(!evSkuOk(u[1],f.skus))return;var c=lostBy[u[0]]=lostBy[u[0]]||{partner:u[0],units:0,volume:0};c.units+=u[2];c.volume+=u[3];});
  var lost=Object.keys(lostBy).map(function(k){return lostBy[k];}).sort(function(a,b){return b.volume-a.volume;});
  var limit=evShowAll?1000:15;
  h+='<div style="'+EV_SEC+'"><div style="'+EV_TITLE+'">Programs sold at the events shown</div><div style="'+EV_HINT+'">Orders carrying an event referral code (EV_year_month_event), added up over the events above, by SKU. Units are orders that still stand (Sale, Upgrade, Downgrade, Switch); volume is their net invoice.</div><div style="margin-top:8px">'+
    evSalesTable(programs,"No programs match.",limit)+
    (programs.length>15?'<button class="btn btn-g" style="margin-top:8px" onclick="evToggleAll()">'+(evShowAll?"Show top 15":"Show all "+programs.length)+"</button>":"");
  if(lost.length){
    h+='<details style="margin-top:10px;font-size:12px"><summary style="cursor:pointer;color:#b45309">'+lost.length+" event referral codes match no event in the sheet ("+evUsdK(lost.reduce(function(a,u){return a+u.volume;},0))+')</summary><div style="'+EV_HINT+';margin:4px 0 6px">Either the sheet has no row for that event, or the code names an event type the sheet does not track. Their sales are not in the tables above.</div><table style="border-collapse:collapse;font-size:12px"><thead><tr><th style="'+EV_TH+';text-align:left">Referral code</th><th style="'+EV_TH+'">Orders</th><th style="'+EV_TH+'">Volume</th></tr></thead><tbody>'+
      lost.slice(0,30).map(function(u){return'<tr><td style="'+EV_TD+';text-align:left">'+evEsc(u.partner)+'</td><td style="'+EV_TD+'">'+evN0(u.units)+'</td><td style="'+EV_TD+'">'+evUsd(u.volume)+"</td></tr>";}).join("")+"</tbody></table></details>";
  }
  h+="</div></div>";

  /* where each program sells */
  var ct={event:{units:0,volume:0},post:{units:0,volume:0},other:{units:0,volume:0}},bySku={};
  EV.daily.forEach(function(r){
    var sku=EV.skus[r[1]];
    if((f.from&&r[0]<f.from)||(f.to&&r[0]>f.to)||!evSkuOk(sku,f.skus))return;
    var ch=EV_CH[r[2]];
    ct[ch].units+=r[3];ct[ch].volume+=r[4];
    var c=bySku[sku]=bySku[sku]||{sku:sku,event:{units:0,volume:0},post:{units:0,volume:0},other:{units:0,volume:0}};
    c[ch].units+=r[3];c[ch].volume+=r[4];
  });
  var chSkus=Object.keys(bySku).map(function(k){var c=bySku[k];c.units=c.event.units+c.post.units+c.other.units;c.volume=c.event.volume+c.post.volume+c.other.volume;return c;}).sort(function(a,b){return b.volume-a.volume;});
  var grand=ct.event.units+ct.post.units+ct.other.units;
  var bar=[["event","At the event",EV_ORANGE],["post","Post (by code)","#2563eb"],["other","Other","#64748b"]].map(function(x){
    var share=grand?ct[x[0]].units/grand*100:0;
    return'<div title="'+x[1]+": "+evN0(ct[x[0]].units)+' units" style="width:'+share+"%;background:"+x[2]+';color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden">'+(share>=9?x[1]+" "+share.toFixed(0)+"%":"")+"</div>";
  }).join("");
  h+='<div style="'+EV_SEC+'"><div style="'+EV_TITLE+'">Where each program sells: at the event, in the post, or elsewhere</div><div style="'+EV_HINT+'">Uses the date range and SKUs in the filter bar. <b>Event</b> = referral code starts with EV. <b>Post</b> = an enrollment mentor\'s code with PV or 50 in it (approximate: the post results above attach sales to a post lead, which a referral code cannot show). <b>Other</b> = everything else.</div>'+
    '<div style="display:flex;height:24px;border-radius:6px;overflow:hidden;margin:10px 0 6px;background:#f1f5f9">'+bar+'</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:760px"><thead><tr><th style="'+EV_TH+';text-align:left">SKU</th>'+
    ["Event units","Post units","Other units","Total units","% at event","Event volume","Post volume","Total volume"].map(function(x){return'<th style="'+EV_TH+'">'+x+"</th>";}).join("")+"</tr></thead><tbody>";
  chSkus.slice(0,evShowAll?500:15).forEach(function(r){
    h+='<tr><td style="'+EV_TD+';text-align:left">'+evEsc(r.sku)+'</td><td style="'+EV_TD+'">'+evN0(r.event.units)+'</td><td style="'+EV_TD+'">'+evN0(r.post.units)+'</td><td style="'+EV_TD+'">'+evN0(r.other.units)+'</td><td style="'+EV_TD+';font-weight:600">'+evN0(r.units)+'</td><td style="'+EV_TD+'">'+(r.units?evPct1(r.event.units/r.units*100):"–")+'</td><td style="'+EV_TD+'">'+evUsd(r.event.volume)+'</td><td style="'+EV_TD+'">'+evUsd(r.post.volume)+'</td><td style="'+EV_TD+';font-weight:600">'+evUsd(r.volume)+"</td></tr>";
  });
  var tc=function(v){return'<td style="'+EV_TD+";"+EV_TF+'">'+v+"</td>";};
  h+='</tbody><tfoot><tr style="font-weight:700;background:#f8fafc"><td style="'+EV_TD+";text-align:left;"+EV_TF+'">Total · '+chSkus.length+" SKUs</td>"+tc(evN0(ct.event.units))+tc(evN0(ct.post.units))+tc(evN0(ct.other.units))+tc(evN0(grand))+tc(grand?evPct1(ct.event.units/grand*100):"–")+tc(evUsd(ct.event.volume))+tc(evUsd(ct.post.volume))+tc(evUsd(ct.event.volume+ct.post.volume+ct.other.volume))+"</tr></tfoot></table></div>"+
    (chSkus.length>15?'<button class="btn btn-g" style="margin-top:8px" onclick="evToggleAll()">'+(evShowAll?"Show top 15":"Show all "+chSkus.length)+"</button>":"")+"</div>";

  /* history by year */
  var years=evByYear(events);
  h+='<div style="'+EV_SEC+'"><div style="'+EV_TITLE+'">History by year</div><div style="'+EV_HINT+'">Event results by year for the events in the selection: the numbers to set next year\'s goals from. Closing % is units per attendee.</div><div style="overflow-x:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:720px"><thead><tr>'+
    ["Year","Events","Attendees","Units","Volume","VPA","Closing %","Post units","Post volume"].map(function(x,i){return'<th style="'+EV_TH+";text-align:"+(i?"right":"left")+'">'+x+"</th>";}).join("")+"</tr></thead><tbody>"+
    years.map(function(y){return'<tr><td style="'+EV_TD+';text-align:left;font-weight:600">'+y.year+'</td><td style="'+EV_TD+'">'+y.events+'</td><td style="'+EV_TD+'">'+evN0(y.attendees)+'</td><td style="'+EV_TD+'">'+evN0(y.units)+'</td><td style="'+EV_TD+'">'+evUsd(y.volume)+'</td><td style="'+EV_TD+'">'+(y.attendees?evUsd(y.volume/y.attendees):"–")+'</td><td style="'+EV_TD+'">'+(y.attendees?evPct1(y.units/y.attendees*100):"–")+'</td><td style="'+EV_TD+'">'+evN0(y.postUnits)+'</td><td style="'+EV_TD+'">'+evUsd(y.postVolume)+"</td></tr>";}).join("")+"</tbody></table></div></div>";

  body.innerHTML=h;
}

/* ── CSV ───────────────────────────────────────────────── */
function evCsv(){
  if(!EV||!evApplied)return;
  var shown=evSelectEvents(evApplied).filter(evHasResults);
  var head=["Event code","Event","Type","Start","End","Event budget attendees","Event budget units","Event budget volume","Event attendees","Event units","Event volume","Post budget leads","Post budget units","Post budget volume","Post gross leads 1","Post gross leads 2","Post net leads","Post strategy sessions","Post units","Post volume"];
  var q=function(v){return'"'+String(v==null?"":v).replace(/"/g,'""')+'"';};
  var lines=shown.map(function(e){return[e.code,e.name,e.type,e.start_date||"",e.end_date||"",e.ev_bud_att,e.ev_bud_units,e.ev_bud_vol,e.ev_res_att,e.ev_res_units,e.ev_res_vol,e.post_bud_leads,e.post_bud_units,e.post_bud_vol,e.post_gross1,e.post_gross2,e.post_net_leads,e.post_ss,e.post_units,e.post_vol].map(q).join(",");});
  var blob=new Blob([[head.map(q).join(",")].concat(lines).join("\n")],{type:"text/csv;charset=utf-8"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="events_"+evApplied.from.slice(0,7)+"_"+evApplied.to.slice(0,7)+".csv";
  document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
}
