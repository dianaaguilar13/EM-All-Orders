
function crBuildDistBars(dist){
  dist=dist||{};
  if(!Object.keys(dist).length)return'<div style="color:#64748b;font-size:12px">No distribution data</div>';
  var labels={"0":"Same day","1_3":"1-3d","4_7":"4-7d","8_14":"8-14d","15_30":"15-30d","31p":"31+d"};
  var colors={"0":"#16a34a","1_3":"#22c55e","4_7":"#2563eb","8_14":"#d97706","15_30":"#ea580c","31p":"#dc2626"};
  var maxV=Math.max.apply(null,Object.values(dist).concat([1]));
  var bars=Object.keys(labels).map(function(k){
    var v=dist[k]||0,h=Math.max(Math.round(v/maxV*80),2);
    return'<div style="display:flex;flex-direction:column;align-items:center;gap:4px">'+
      '<div style="font-size:10px;color:'+colors[k]+';font-weight:600">'+v+'</div>'+
      '<div style="width:36px;height:'+h+'px;background:'+colors[k]+';border-radius:3px 3px 0 0"></div>'+
      '<div style="font-size:9px;color:#64748b;text-align:center">'+labels[k]+'</div></div>';
  }).join("");
  return bars+'<div style="margin-left:8px;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:18px">'+
    '<div style="width:1px;height:80px;background:#2563eb;position:relative">'+
    '<div style="position:absolute;left:4px;top:0;font-size:9px;color:#2563eb;white-space:nowrap">7d target</div></div></div>';
}

var CR=null,crCharts={},crSelReq=new Set(),crSelSku=new Set(),crSelPcat=new Set();

var CR_LT_SKUS=new Set(["BTM BT Add-on","BTM","BTM-Mopp","BTMP","BTMP-Mopp","BTME","MC-Elite","MC-Elite-Mopp","MC-Elite-MC","MM-SC-KAT","BTMP-MOPP"]);
var CR_LCC_SKUS=new Set(["DBC","LMC","DBCA","DBCE","ELEVADD","LMCA","ELEV"]);

// ── Helpers ────────────────────────────────────────────────
function crFmtM(m){var p=m.split("-");return new Date(parseInt(p[0]),parseInt(p[1])-1).toLocaleString("default",{month:"short",year:"2-digit"});}
function crFmt$(v){return"$"+(v||0).toLocaleString(undefined,{maximumFractionDigits:0});}
function crDestroyCharts(){Object.values(crCharts).forEach(function(c){try{c.destroy();}catch(e){}});crCharts={};}

// ── Request Type multi-select ──────────────────────────────
function crToggleReq(e){e.stopPropagation();var dr=document.getElementById("cr-reqDrop");dr.classList.toggle("open");if(dr.classList.contains("open")){document.getElementById("cr-reqQ").focus();crRenderReqItems();}}
function crRenderReqItems(){if(!CR)return;var q=document.getElementById("cr-reqQ").value.toLowerCase();var vis=CR.FL.req_types.filter(function(s){return s.toLowerCase().indexOf(q)>=0;});var h="";vis.forEach(function(s){var ck=crSelReq.has(s)?"checked":"";var e=s.replace(/&/g,"&amp;");h+='<div class="ms-item" data-s="'+e+'" onclick="crTogReqItem(event,this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";});document.getElementById("cr-reqItems").innerHTML=h;}
function crTogReqItem(ev,el){ev.stopPropagation();var s=el.getAttribute("data-s");if(crSelReq.has(s))crSelReq.delete(s);else crSelReq.add(s);crUpdateReqBtn();crRenderReqItems();}
function crReqAll(){CR.FL.req_types.filter(function(s){return s.toLowerCase().indexOf(document.getElementById("cr-reqQ").value.toLowerCase())>=0;}).forEach(function(s){crSelReq.add(s);});crUpdateReqBtn();crRenderReqItems();}
function crReqClear(){crSelReq.clear();crUpdateReqBtn();crRenderReqItems();}
function crUpdateReqBtn(){var btn=document.getElementById("cr-reqBtn");var cnt=document.getElementById("cr-reqCnt");if(crSelReq.size===0){btn.textContent="All Request Types";cnt.style.display="none";}else{btn.textContent=crSelReq.size===1?Array.from(crSelReq)[0].slice(0,22):crSelReq.size+" types";cnt.textContent=crSelReq.size;cnt.style.display="inline";}}

document.addEventListener("click",function(e){
  var rw=document.getElementById("cr-reqWrap");if(rw&&!rw.contains(e.target)){var d=document.getElementById("cr-reqDrop");if(d)d.classList.remove("open");}
  var sw=document.getElementById("cr-skuWrap");if(sw&&!sw.contains(e.target)){var sd=document.getElementById("cr-skuDrop");if(sd)sd.classList.remove("open");}
});

// ── SKU multi-select ───────────────────────────────────────
function crToggleSku(e){e.stopPropagation();var dr=document.getElementById("cr-skuDrop");dr.classList.toggle("open");if(dr.classList.contains("open")){document.getElementById("cr-skuQ").focus();crRenderSkuItems();}}
function crRenderSkuItems(){
  if(!CR)return;
  var q=document.getElementById("cr-skuQ").value.toLowerCase();
  var all=CR.FL.skus.filter(function(s){return s.toLowerCase().indexOf(q)>=0;});
  var ltG=all.filter(function(s){return CR_LT_SKUS.has(s);});
  var lccG=all.filter(function(s){return CR_LCC_SKUS.has(s);});
  var othG=all.filter(function(s){return!CR_LT_SKUS.has(s)&&!CR_LCC_SKUS.has(s);});
  function mkItems(grp){return grp.map(function(s){var ck=crSelSku.has(s)?"checked":"";var esc=s.replace(/&/g,"&amp;");return'<div class="ms-item" data-s="'+esc+'" onclick="crTogSkuItem(event,this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+esc+"</span></div>";}).join("");}
  function mkHdr(label,color,grpId,grp){if(!grp.length)return"";var allSel=grp.every(function(s){return crSelSku.has(s);});return'<div style="padding:4px 10px 3px;font-size:10px;font-weight:700;color:'+color+';background:#f1f5f9;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;letter-spacing:.5px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none" onclick="crTogSkuGroup(event,\''+grpId+'\')"><span style="text-transform:uppercase">'+label+'</span><span style="font-size:9px;opacity:.75">'+(allSel?"✓ deselect all":"+ select all")+"</span></div>";}
  var h=mkHdr("⚡ LT","#0ea5e9","LT",ltG)+mkItems(ltG)+mkHdr("🎯 LCC","#8b5cf6","LCC",lccG)+mkItems(lccG)+(othG.length?'<div style="padding:4px 10px 3px;font-size:10px;font-weight:700;color:#64748b;background:#f1f5f9;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px">Other</div>'+mkItems(othG):"");
  document.getElementById("cr-skuItems").innerHTML=h;
}
function crTogSkuItem(ev,el){ev.stopPropagation();var s=el.getAttribute("data-s");if(crSelSku.has(s))crSelSku.delete(s);else crSelSku.add(s);crUpdateSkuBtn();crRenderSkuItems();}
function crSkuAll(){CR.FL.skus.filter(function(s){return s.toLowerCase().indexOf(document.getElementById("cr-skuQ").value.toLowerCase())>=0;}).forEach(function(s){crSelSku.add(s);});crUpdateSkuBtn();crRenderSkuItems();}
function crSkuClear(){crSelSku.clear();crUpdateSkuBtn();crRenderSkuItems();}
function crTogSkuGroup(ev,grp){ev.stopPropagation();var base=grp==="LT"?CR_LT_SKUS:grp==="LCC"?CR_LCC_SKUS:new Set();var vis=(CR?CR.FL.skus:[]).filter(function(s){return base.has(s);});var allSel=vis.length>0&&vis.every(function(s){return crSelSku.has(s);});vis.forEach(function(s){if(allSel)crSelSku.delete(s);else crSelSku.add(s);});crUpdateSkuBtn();crRenderSkuItems();}
function crUpdateSkuBtn(){var btn=document.getElementById("cr-skuBtn");var cnt=document.getElementById("cr-skuCnt");if(crSelSku.size===0){btn.textContent="All SKUs";cnt.style.display="none";}else{btn.textContent=crSelSku.size===1?Array.from(crSelSku)[0].slice(0,22):crSelSku.size+" SKUs";cnt.textContent=crSelSku.size;cnt.style.display="inline";}}

// ── Filters ────────────────────────────────────────────────
function crGetRange(){return{df:document.getElementById("cr-df").value.slice(0,7),dt:document.getElementById("cr-dt").value.slice(0,7)};}
function crGetStatus(){return document.getElementById("cr-status").value;}
function crGetAssignee(){return document.getElementById("cr-assignee").value;}
function crGetPcat(){return document.getElementById("cr-pcat").value;}

function crApply(){
  document.getElementById("cr-reqDrop").classList.remove("open");
  document.getElementById("cr-skuDrop").classList.remove("open");
  crRender();
}
function crToday(){var t=new Date();return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");}
function crReset(){
  document.getElementById("cr-df").value="2022-01-01";
  document.getElementById("cr-dt").value=crToday();
  ["cr-status","cr-assignee","cr-pcat"].forEach(function(id){document.getElementById(id).value="";});
  crSelReq.clear();crUpdateReqBtn();
  crSelSku.clear();crUpdateSkuBtn();
  crRender();
}

// ── Filter rows ────────────────────────────────────────────
function crFilterRows(){
  var r=crGetRange(),st=crGetStatus(),as=crGetAssignee(),pc=crGetPcat();
  return CR.rows.filter(function(row){
    if(row.month&&(row.month<r.df||row.month>r.dt))return false;
    if(!row.month&&row.created_at&&(row.created_at.slice(0,7)<r.df||row.created_at.slice(0,7)>r.dt))return false;
    if(st&&row.status!==st)return false;
    if(crSelReq.size>0&&!crSelReq.has(row.request_type))return false;
    if(as&&row.assignee!==as)return false;
    if(crSelSku.size>0&&!crSelSku.has(row.sku))return false;
    if(pc&&row.pcat!==pc)return false;
    return true;
  });
}

// ── Resolution bar helper ──────────────────────────────────
function crResBar(avg,target){
  var pct=Math.min(avg/target,2)*50;
  var color=avg<=target?"#16a34a":avg<=target*2?"#d97706":"#dc2626";
  var label=avg<=target?("✓ "+avg+"d avg"):("✗ "+avg+"d avg");
  return'<div style="display:flex;align-items:center;gap:8px;margin-top:4px">'+
    '<div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">'+
    '<div style="height:100%;width:'+pct.toFixed(0)+'%;background:'+color+';border-radius:3px;transition:width .4s"></div></div>'+
    '<span style="font-size:11px;color:'+color+';white-space:nowrap;font-weight:600">'+label+'</span></div>';
}

// ── Main render ────────────────────────────────────────────
function crRender(){
  if(!CR)return;
  crDestroyCharts();
  var r=crGetRange(),st=crGetStatus(),as=crGetAssignee();
  var rows=crFilterRows();

  var total=rows.length;
  var saved=rows.filter(function(r){return r.saved_by;}).length;
  var saveRate=total>0?(saved/total*100):0;
  var revSaved=rows.reduce(function(s,r){return s+(r.rev_saved||0);},0);
  var revLoss=rows.reduce(function(s,r){return s+(r.rev_loss||0);},0);
  var netSave=revSaved-revLoss;
  var TARGET=7;

  document.getElementById("cr-rcLbl").textContent=total.toLocaleString()+" matched records";

  // ── Resolution stats computed from filtered rows ───────────
  var compRows=rows.filter(function(row){
    return row.procedure==="Complete"&&row.res_days!=null&&row.res_days>=0&&row.res_days<=365;
  });
  var nComp=compRows.length;
  var avgAll=nComp>0?Math.round(compRows.reduce(function(s,row){return s+row.res_days;},0)/nComp*10)/10:0;
  var within7Count=compRows.filter(function(row){return row.res_days<=7;}).length;
  var pct7=nComp>0?Math.round(within7Count/nComp*100):0;

  var dist={"0":0,"1_3":0,"4_7":0,"8_14":0,"15_30":0,"31p":0};
  compRows.forEach(function(row){
    var d=row.res_days;
    if(d===0)dist["0"]++;else if(d<=3)dist["1_3"]++;else if(d<=7)dist["4_7"]++;
    else if(d<=14)dist["8_14"]++;else if(d<=30)dist["15_30"]++;else dist["31p"]++;
  });

  var skuResMap={};
  compRows.forEach(function(row){
    var s=row.sku||"?";
    if(!skuResMap[s])skuResMap[s]={n:0,sum:0,within7:0};
    skuResMap[s].n++;skuResMap[s].sum+=row.res_days;if(row.res_days<=7)skuResMap[s].within7++;
  });
  var resBySku={};
  Object.keys(skuResMap).forEach(function(s){
    var v=skuResMap[s];
    resBySku[s]={n:v.n,avg:Math.round(v.sum/v.n*10)/10,within7:v.within7,pct7:Math.round(v.within7/v.n*100)};
  });

  var resByM={};
  compRows.forEach(function(row){
    var m=row.completed_at?row.completed_at.slice(0,7):(row.month||row.created_at.slice(0,7));
    if(!m)return;
    if(!resByM[m])resByM[m]={n:0,sum:0,within7:0};
    resByM[m].n++;resByM[m].sum+=row.res_days;if(row.res_days<=7)resByM[m].within7++;
  });
  Object.keys(resByM).forEach(function(m){
    var v=resByM[m];
    resByM[m].avg=Math.round(v.sum/v.n*10)/10;resByM[m].pct7=Math.round(v.within7/v.n*100);
  });

  // ── SKU / Saved-By / Status maps from filtered rows ────────
  var skuMap={},sbMap={},stMap={},reqMap={};
  rows.forEach(function(row){
    var s=row.sku||"?";
    if(!skuMap[s])skuMap[s]={total:0,saved:0,rev_saved:0,rev_loss:0};
    skuMap[s].total++;if(row.saved_by)skuMap[s].saved++;
    skuMap[s].rev_saved+=row.rev_saved||0;skuMap[s].rev_loss+=row.rev_loss||0;
    var sb=row.saved_by||"Not Saved";sbMap[sb]=(sbMap[sb]||0)+1;
    var st2=row.status||"Unknown";stMap[st2]=(stMap[st2]||0)+1;
    var rt=row.request_type||"Unknown";
    if(!reqMap[rt])reqMap[rt]={total:0,saved:0};
    reqMap[rt].total++;if(row.saved_by)reqMap[rt].saved++;
  });

  // ── KPI cards ─────────────────────────────────────────────
  var resColor=avgAll<=TARGET?"#16a34a":avgAll<=TARGET*2?"#d97706":"#dc2626";
  var pct7Color=pct7>=50?"#16a34a":pct7>=25?"#d97706":"#dc2626";
  document.getElementById("cr-kpis").innerHTML=
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+
      '<div class="kpi k1"><div class="kl">Total Cases</div><div class="kv">'+total.toLocaleString()+'</div><div class="ks muted">matched to orders</div></div>'+
      '<div class="kpi k6"><div class="kl">Saved</div><div class="kv" style="color:#16a34a">'+saved.toLocaleString()+'</div><div class="ks green">'+saveRate.toFixed(1)+'% save rate</div></div>'+
      '<div class="kpi k3"><div class="kl">Lost</div><div class="kv" style="color:#ef4444">'+(total-saved).toLocaleString()+'</div><div class="ks red">'+(100-saveRate).toFixed(1)+'% not saved</div></div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px">'+
      '<div class="kpi k2"><div class="kl">Net Impact</div><div class="kv" style="color:'+(netSave>=0?"#16a34a":"#ef4444")+';font-size:20px">'+crFmt$(netSave)+'</div><div class="ks '+(netSave>=0?"green":"red")+'">saved minus lost</div></div>'+
      '<div class="kpi k6"><div class="kl">Revenue Saved</div><div class="kv" style="color:#16a34a;font-size:20px">'+crFmt$(revSaved)+'</div><div class="ks green">recovered</div></div>'+
      '<div class="kpi k3"><div class="kl">Revenue Loss</div><div class="kv" style="color:#ef4444;font-size:20px">'+crFmt$(revLoss)+'</div><div class="ks red">lost</div></div>'+
    '</div>';

  // ── Resolution Insights Panel ──────────────────────────────
  var skuRes=Object.entries(resBySku).filter(function(e){return e[1].n>=3;});
  var slowest=skuRes.slice().sort(function(a,b){return b[1].avg-a[1].avg;}).slice(0,1);
  var fastest=skuRes.slice().sort(function(a,b){return a[1].avg-b[1].avg;}).slice(0,1);

  var skuRowsHTML=skuRes.slice().sort(function(a,b){return b[1].n-a[1].n;}).slice(0,20).map(function(e){
    var s=e[0],v=e[1];
    var c=v.avg<=TARGET?"#16a34a":v.avg<=TARGET*2?"#d97706":"#dc2626";
    var w=Math.min(v.avg/(TARGET*3)*100,100);
    return'<tr>'+
      '<td><span class="pill">'+s+'</span></td>'+
      '<td class="num">'+v.n+'</td>'+
      '<td><div style="display:flex;align-items:center;gap:6px">'+
        '<div style="width:80px;height:5px;background:#e2e8f0;border-radius:2px"><div style="height:100%;width:'+w.toFixed(0)+'%;background:'+c+'"></div></div>'+
        '<span style="font-size:12px;font-weight:700;color:'+c+'">'+v.avg+'d</span></div></td>'+
      '<td class="num" style="color:#16a34a">'+v.within7+'</td>'+
      '<td><span style="font-size:11px;color:'+c+';font-weight:600">'+v.pct7+'%</span></td>'+
      '</tr>';
  }).join("");

  document.getElementById("cr-resPanel").innerHTML=
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">'+
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px">'+
        '<div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Avg Resolution Time</div>'+
        '<div style="font-size:32px;font-weight:700;color:'+resColor+';letter-spacing:-1px">'+avgAll+'<span style="font-size:16px">d</span></div>'+
        '<div style="font-size:11px;color:#64748b;margin-top:2px">target: <span style="color:#2563eb;font-weight:600">7 days</span> &middot; '+nComp+' resolved</div>'+
        '<div style="height:5px;background:#e2e8f0;border-radius:3px;margin-top:8px;overflow:hidden">'+
          '<div style="height:100%;width:'+Math.min(TARGET/Math.max(avgAll,1)*100,100).toFixed(0)+'%;background:'+resColor+';border-radius:3px"></div></div></div>'+
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px">'+
        '<div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Within 7 Days</div>'+
        '<div style="font-size:32px;font-weight:700;color:'+pct7Color+';letter-spacing:-1px">'+pct7+'<span style="font-size:16px">%</span></div>'+
        '<div style="font-size:11px;color:#64748b;margin-top:2px">'+within7Count+' of '+nComp+' cases</div>'+
        '<div style="height:5px;background:#e2e8f0;border-radius:3px;margin-top:8px;overflow:hidden">'+
          '<div style="height:100%;width:'+pct7.toFixed(0)+'%;background:'+pct7Color+';border-radius:3px"></div></div></div>'+
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px">'+
        '<div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Fastest SKU</div>'+
        (fastest.length?'<div style="font-size:18px;font-weight:700;color:#16a34a;line-height:1.2">'+fastest[0][0]+'</div><div style="font-size:12px;color:#16a34a;margin-top:4px">'+fastest[0][1].avg+'d avg &middot; '+fastest[0][1].n+' cases</div>':'<div style="color:#64748b">No data</div>')+
        '</div>'+
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px">'+
        '<div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Slowest SKU</div>'+
        (slowest.length?'<div style="font-size:18px;font-weight:700;color:#dc2626;line-height:1.2">'+slowest[0][0]+'</div><div style="font-size:12px;color:#dc2626;margin-top:4px">'+slowest[0][1].avg+'d avg &middot; '+slowest[0][1].n+' cases</div>':'<div style="color:#64748b">No data</div>')+
        '</div>'+
    '</div>'+
    '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:16px">'+
      '<div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;writing-mode:vertical-rl;transform:rotate(180deg);padding-right:4px">Cases</div>'+
      crBuildDistBars(dist)+
    '</div>'+
    '<div class="tbl-wrap" style="max-height:280px">'+
    '<table><thead><tr><th>SKU</th><th>Resolved</th><th>Avg Days</th><th>Within 7d</th><th>% On Time</th></tr></thead>'+
    '<tbody>'+skuRowsHTML+'</tbody></table></div>';

  // ── Monthly trend (always from filtered rows) ──────────────
  var byM={};
  rows.forEach(function(row){
    var m=row.month||row.created_at.slice(0,7);if(!m)return;
    if(!byM[m])byM[m]={total:0,saved:0,lost:0,rev_saved:0,rev_loss:0};
    byM[m].total++;
    if(row.saved_by)byM[m].saved++;else byM[m].lost++;
    byM[m].rev_saved+=row.rev_saved||0;byM[m].rev_loss+=row.rev_loss||0;
  });
  var ts=Object.keys(byM).filter(function(m){return m>=r.df&&m<=r.dt;}).sort()
    .map(function(m){return{m:m,b:byM[m]};});

  var mLabels=ts.map(function(x){return crFmtM(x.m);});
  crCharts.trend=new Chart(document.getElementById("cr-trendChart"),{
    type:"bar",
    data:{labels:mLabels,datasets:[
      {label:"Saved",data:ts.map(function(x){return x.b.saved||0;}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
      {label:"Lost",data:ts.map(function(x){return x.b.lost||0;}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3,stack:"s"},
      {label:"Save %",data:ts.map(function(x){var t=x.b.total||0,s=x.b.saved||0;return t>0?+(s/t*100).toFixed(1):0;}),
        type:"line",yAxisID:"y2",borderColor:"#3fb950",backgroundColor:"rgba(63,185,80,0.07)",
        fill:true,tension:0.35,pointRadius:2,pointBackgroundColor:"#3fb950",borderWidth:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},
      scales:{
        x:{stacked:true,ticks:{color:"#64748b",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#e2e8f044"}},
        y:{stacked:true,ticks:{color:"#64748b",font:{size:10}},grid:{color:"#e2e8f044"}},
        y2:{position:"right",ticks:{color:"#16a34a",font:{size:10},callback:function(v){return v+"%";}},grid:{display:false}}
      }}
  });

  // ── Resolution trend (from filtered rows) ────────────────
  var resMonths=Object.keys(resByM).filter(function(m){return m>=r.df&&m<=r.dt;}).sort();
  if(resMonths.length>0){
    crCharts.resTrend=new Chart(document.getElementById("cr-resTrendChart"),{
      type:"bar",
      data:{labels:resMonths.map(crFmtM),datasets:[
        {label:"Avg Days",data:resMonths.map(function(m){return resByM[m].avg||0;}),
          backgroundColor:resMonths.map(function(m){var a=resByM[m].avg||0;return a<=7?"rgba(22,163,74,0.8)":a<=14?"rgba(217,119,6,0.8)":"rgba(220,38,38,0.8)";}),
          borderRadius:3},
        {label:"7d target",data:resMonths.map(function(){return 7;}),
          type:"line",borderColor:"#2563eb",borderDash:[4,4],pointRadius:0,borderWidth:1.5,backgroundColor:"transparent"}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+": "+ctx.parsed.y+"d";}}}},
        scales:{x:{ticks:{color:"#64748b",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#e2e8f044"}},
                y:{ticks:{color:"#64748b",font:{size:10},callback:function(v){return v+"d";}},grid:{color:"#e2e8f044"}}}}
    });
  }

  // ── Revenue trend ─────────────────────────────────────
  crCharts.rev=new Chart(document.getElementById("cr-revChart"),{
    type:"bar",
    data:{labels:mLabels,datasets:[
      {label:"Revenue Saved",data:ts.map(function(x){return Math.round(x.b.rev_saved||0);}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3},
      {label:"Revenue Loss",data:ts.map(function(x){return Math.round(x.b.rev_loss||0);}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false,callbacks:{label:function(ctx){return ctx.dataset.label+": $"+ctx.parsed.y.toLocaleString();}}}},
      scales:{x:{ticks:{color:"#64748b",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#e2e8f044"}},
              y:{ticks:{color:"#64748b",font:{size:10},callback:function(v){return"$"+(v>=1000?(v/1000).toFixed(0)+"k":v);}},grid:{color:"#e2e8f044"}}}}
  });

  // ── Request type chart (from filtered rows) ──────────────
  var reqData=Object.entries(reqMap).filter(function(e){return e[1].total>5;})
    .map(function(e){return{rt:e[0],total:e[1].total,saved:e[1].saved};})
    .sort(function(a,b){return b.total-a.total;}).slice(0,12);

  crCharts.req=new Chart(document.getElementById("cr-reqChart"),{
    type:"bar",
    data:{labels:reqData.map(function(x){return x.rt.length>35?x.rt.slice(0,35)+"…":x.rt;}),
          datasets:[
            {label:"Saved",data:reqData.map(function(x){return x.saved;}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
            {label:"Lost",data:reqData.map(function(x){return x.total-x.saved;}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3,stack:"s"}
          ]},
    options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},
      scales:{x:{stacked:true,ticks:{color:"#64748b",font:{size:10}},grid:{color:"#e2e8f044"}},
              y:{stacked:false,ticks:{color:"#1e293b",font:{size:9}},grid:{display:false}}}}
  });

  // ── Donuts (from filtered rows) ───────────────────────
  var sbData=Object.entries(sbMap).filter(function(e){return e[1]>0;}).sort(function(a,b){return b[1]-a[1];}).slice(0,6);
  crCharts.sb=new Chart(document.getElementById("cr-sbChart"),{
    type:"doughnut",
    data:{labels:sbData.map(function(x){return x[0]||"Not Saved";}),
          datasets:[{data:sbData.map(function(x){return x[1];}),
            backgroundColor:["#3fb950","#388bfd","#e3b341","#bc8cff","#f85149","#58a6ff"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",
      plugins:{legend:{position:"right",labels:{color:"#1e293b",font:{size:10},boxWidth:10,padding:8}}}}
  });

  var stData=Object.entries(stMap).filter(function(e){return e[1]>0;}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
  crCharts.st=new Chart(document.getElementById("cr-stChart"),{
    type:"doughnut",
    data:{labels:stData.map(function(x){return x[0]||"Unknown";}),
          datasets:[{data:stData.map(function(x){return x[1];}),
            backgroundColor:["#388bfd","#3fb950","#e3b341","#f85149","#bc8cff","#58a6ff","#39d353","#8b949e"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",
      plugins:{legend:{position:"right",labels:{color:"#1e293b",font:{size:10},boxWidth:10,padding:8}}}}
  });

  // ── SKU breakdown table (from filtered rows) ──────────
  var skuArr=Object.entries(skuMap).map(function(e){
    var v=e[1],rate=v.total>0?(v.saved/v.total*100):0;
    var res=resBySku[e[0]];
    return{sku:e[0],total:v.total,saved:v.saved,lost:v.total-v.saved,rate:rate,
      rev_saved:v.rev_saved,rev_loss:v.rev_loss,
      avg_days:res?res.avg:null,pct7:res?res.pct7:null};
  }).filter(function(s){return s.total>0;}).sort(function(a,b){return b.total-a.total;});

  var skuRows=skuArr.slice(0,30).map(function(s){
    var cl=s.rate>=50?"#16a34a":s.rate>=30?"#d97706":"#dc2626";
    var bg=s.rate>=50?"#16a34a":s.rate>=30?"#d97706":"#dc2626";
    var resCell=s.avg_days!=null?
      '<span style="font-weight:700;color:'+(s.avg_days<=7?"#16a34a":s.avg_days<=14?"#d97706":"#dc2626")+'">'+s.avg_days+'d</span>'+
      '<span style="font-size:10px;color:#64748b;margin-left:4px">('+s.pct7+'% ≤7d)</span>':
      '<span style="color:#64748b">-</span>';
    return"<tr><td><span class='pill'>"+s.sku+"</span></td>"+
      "<td class='num'>"+s.total+"</td>"+
      "<td class='num' style='color:#16a34a'>"+s.saved+"</td>"+
      "<td class='num' style='color:#dc2626'>"+s.lost+"</td>"+
      "<td><div class='bw'><div class='bb'><div class='bf' style='width:"+s.rate.toFixed(0)+"%;background:"+bg+"'></div></div>"+
      "<span class='num' style='min-width:40px;font-size:11px;color:"+cl+"'>"+s.rate.toFixed(1)+"%</span></div></td>"+
      "<td>"+resCell+"</td>"+
      "<td class='num' style='color:#16a34a'>"+crFmt$(s.rev_saved)+"</td>"+
      "<td class='num' style='color:#dc2626'>"+crFmt$(s.rev_loss)+"</td></tr>";
  }).join("");
  document.getElementById("cr-skuTbody").innerHTML=skuRows;
  document.getElementById("cr-tblInfo").textContent=skuArr.length+" SKUs · "+total.toLocaleString()+" cases";

  // ── Resolved by Month (completed_at based) ────────────
  var resolvedByM={};
  CR.rows.forEach(function(row){
    if(row.procedure!=="Complete")return;
    if(!row.completed_at)return;
    var cm=row.completed_at.slice(0,7);
    if(cm<r.df||cm>r.dt)return;
    if(st&&row.status!==st)return;
    if(crSelReq.size>0&&!crSelReq.has(row.request_type))return;
    if(as&&row.assignee!==as)return;
    if(crSelSku.size>0&&!crSelSku.has(row.sku))return;
    var pc2=crGetPcat();if(pc2&&row.pcat!==pc2)return;
    if(!resolvedByM[cm])resolvedByM[cm]={n:0,contract:0,rev_saved:0,rev_loss:0,refund:0};
    resolvedByM[cm].n++;
    resolvedByM[cm].contract+=row.contract_amt||0;
    resolvedByM[cm].rev_saved+=row.rev_saved||0;
    resolvedByM[cm].rev_loss+=row.rev_loss||0;
    resolvedByM[cm].refund+=row.refund_amt||0;
  });
  var rMonths=Object.keys(resolvedByM).sort();

  if(crCharts.resolved){try{crCharts.resolved.destroy();}catch(e){}}
  if(rMonths.length>0){
    crCharts.resolved=new Chart(document.getElementById("cr-resolvedChart"),{
      type:"bar",
      data:{labels:rMonths.map(crFmtM),datasets:[
        {label:"Resolved Cases",data:rMonths.map(function(m){return resolvedByM[m].n;}),
          backgroundColor:"rgba(37,99,235,0.8)",borderRadius:4}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},
          tooltip:{callbacks:{label:function(ctx){return"Cases: "+ctx.parsed.y;}}}},
        scales:{x:{ticks:{color:"#64748b",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#e2e8f044"}},
                y:{ticks:{color:"#64748b",font:{size:10}},grid:{color:"#e2e8f044"}}}}
    });
  }

  // Table sorted by count desc + total row
  var rSorted=rMonths.slice().sort(function(a,b){return resolvedByM[b].n-resolvedByM[a].n;});
  var totN=0,totC=0,totS=0,totL=0,totR=0;
  rSorted.forEach(function(m){var v=resolvedByM[m];totN+=v.n;totC+=v.contract;totS+=v.rev_saved;totL+=v.rev_loss;totR+=v.refund;});

  var rRows=rSorted.map(function(m){
    var v=resolvedByM[m];
    var pctS=v.contract>0?(v.rev_saved/v.contract*100):0;
    var pctR=v.contract>0?(v.refund/v.contract*100):0;
    var lossIncRef=v.rev_loss+v.refund;
    return"<tr>"+
      "<td style='font-weight:600'>"+crFmtM(m)+"</td>"+
      "<td class='num'>"+v.n+"</td>"+
      "<td class='num'>"+crFmt$(v.contract)+"</td>"+
      "<td class='num' style='color:#16a34a'>"+crFmt$(v.rev_saved)+"</td>"+
      "<td class='num' style='color:#16a34a'>"+pctS.toFixed(1)+"%</td>"+
      "<td class='num' style='color:#dc2626'>"+crFmt$(lossIncRef)+"</td>"+
      "<td class='num' style='color:#d97706'>"+crFmt$(v.refund)+"</td>"+
      "<td class='num' style='color:#d97706'>"+pctR.toFixed(1)+"%</td>"+
      "</tr>";
  }).join("");
  var totPctS=totC>0?(totS/totC*100):0;
  var totPctR=totC>0?(totR/totC*100):0;
  var tFoot="<tr style='font-weight:700;background:#f1f5f9'>"+
    "<td>Total</td><td class='num'>"+totN+"</td>"+
    "<td class='num'>"+crFmt$(totC)+"</td>"+
    "<td class='num' style='color:#16a34a'>"+crFmt$(totS)+"</td>"+
    "<td class='num' style='color:#16a34a'>"+totPctS.toFixed(1)+"%</td>"+
    "<td class='num' style='color:#dc2626'>"+crFmt$(totL+totR)+"</td>"+
    "<td class='num' style='color:#d97706'>"+crFmt$(totR)+"</td>"+
    "<td class='num' style='color:#d97706'>"+totPctR.toFixed(1)+"%</td>"+
    "</tr>";
  document.getElementById("cr-resolvedTbody").innerHTML=rRows;
  document.getElementById("cr-resolvedFoot").innerHTML=tFoot;
  document.getElementById("cr-resolvedSection").style.display=rMonths.length>0?"block":"none";

  // ── Case detail table ─────────────────────────────────
  var caseRows=rows.slice(0,200).map(function(row){
    var saved=!!row.saved_by;
    return"<tr>"+
      "<td class='num' style='font-size:10px;color:#475569'>"+row.id+"</td>"+
      "<td style='font-size:10px;color:#64748b;font-family:monospace'>"+(row.contact_id||row.client_id||"—")+"</td>"+
      "<td style='font-size:10px;color:#334155;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' title='"+(row.client_name||"").replace(/'/g,"&#39;")+"'>"+(row.client_name||"—")+"</td>"+
      "<td><span class='pill'>"+(row.sku||"?")+"</span></td>"+
      "<td style='font-size:10px;color:#475569;white-space:nowrap'>"+(row.date||"—")+"</td>"+
      "<td style='font-size:10px;color:#2563eb;font-weight:600;white-space:nowrap'>"+(row.created_at||"—")+"</td>"+
      "<td style='font-size:10px;color:#8b949e;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>"+row.request_type+"</td>"+
      "<td><span style='font-size:10px;font-weight:600;color:"+(saved?"#3fb950":"#f85149")+"'>"+(saved?"Saved":"Lost")+"</span></td>"+
      "<td style='font-size:10px;color:#388bfd'>"+row.saved_by+"</td>"+
      "<td style='font-size:10px;color:#475569'>"+row.status+"</td>"+
      "<td style='font-size:10px;color:#475569'>"+row.procedure+"</td>"+
      (row.res_days!=null?"<td class='num' style='font-size:11px;font-weight:700;color:"+(row.res_days<=7?"#16a34a":row.res_days<=14?"#d97706":"#dc2626")+"'>"+row.res_days+"d</td>":"<td style='color:#64748b'>-</td>")+
      "<td class='num' style='color:#dc2626'>"+crFmt$(row.rev_loss)+"</td>"+
      "<td class='num' style='color:#16a34a'>"+crFmt$(row.rev_saved)+"</td>"+
      "<td style='font-size:10px;color:#475569'>"+row.assignee+"</td>"+
      "</tr>";
  }).join("");
  document.getElementById("cr-casesTbody").innerHTML=caseRows;
  document.getElementById("cr-casesInfo").textContent="Showing "+Math.min(200,rows.length)+" of "+rows.length+" cases";

  document.getElementById("cr-loading").style.display="none";
  document.getElementById("cr-main").style.display="block";
}


// ── Resolved by Month CSV ────────────────────────────────
function crDownloadResolvedCsv(){
  var r=crGetRange(),st=crGetStatus(),as=crGetAssignee();
  var resolvedByM={};
  CR.rows.forEach(function(row){
    if(row.procedure!=="Complete")return;
    if(!row.completed_at)return;
    var cm=row.completed_at.slice(0,7);
    if(cm<r.df||cm>r.dt)return;
    if(st&&row.status!==st)return;
    if(crSelReq.size>0&&!crSelReq.has(row.request_type))return;
    if(as&&row.assignee!==as)return;
    if(crSelSku.size>0&&!crSelSku.has(row.sku))return;
    var pc2=crGetPcat();if(pc2&&row.pcat!==pc2)return;
    if(!resolvedByM[cm])resolvedByM[cm]={n:0,contract:0,rev_saved:0,rev_loss:0,refund:0};
    resolvedByM[cm].n++;
    resolvedByM[cm].contract+=row.contract_amt||0;
    resolvedByM[cm].rev_saved+=row.rev_saved||0;
    resolvedByM[cm].rev_loss+=row.rev_loss||0;
    resolvedByM[cm].refund+=row.refund_amt||0;
  });
  var months=Object.keys(resolvedByM).sort(function(a,b){return resolvedByM[b].n-resolvedByM[a].n;});
  var headers=["Month","Completed Cases","Contract Amount","Total Saved Sales","Total Saved %","Revenue Loss Incl Refunds","Refund Amount","Refund %"];
  var lines=[headers.join(",")];
  months.forEach(function(m){
    var v=resolvedByM[m];
    var pctS=v.contract>0?(v.rev_saved/v.contract*100):0;
    var pctR=v.contract>0?(v.refund/v.contract*100):0;
    lines.push([crFmtM(m),v.n,Math.round(v.contract),Math.round(v.rev_saved),pctS.toFixed(1)+"%",Math.round(v.rev_loss+v.refund),Math.round(v.refund),pctR.toFixed(1)+"%"].join(","));
  });
  var blob=new Blob([lines.join("\n")],{type:"text/csv"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="resolved_by_month_"+r.df+"_"+r.dt+".csv";
  a.click();
}

// ── CSV Download ──────────────────────────────────────────
function crDownloadCsv(){
  var rows=crFilterRows();
  var headers=["Order ID","Contact ID","Client Name","SKU","Order Date","Case Opened","Request Type","Outcome","Saved By","Status","Procedure","Resolution Days","Rev Loss","Rev Saved","Assignee","Client ID"];
  var lines=[headers.join(",")];
  rows.forEach(function(r){
    var outcome=r.saved_by?"Saved":"Lost";
    lines.push([
      r.id,
      r.contact_id||r.client_id||"",
      '"'+(r.client_name||"").replace(/"/g,'""')+'"',
      '"'+(r.sku||"").replace(/"/g,'""')+'"',
      r.date||"",
      r.created_at||"",
      '"'+(r.request_type||"").replace(/"/g,'""')+'"',
      outcome,
      '"'+(r.saved_by||"").replace(/"/g,'""')+'"',
      '"'+(r.status||"").replace(/"/g,'""')+'"',
      '"'+(r.procedure||"").replace(/"/g,'""')+'"',
      r.res_days!=null?r.res_days:"",
      Math.round(r.rev_loss||0),
      Math.round(r.rev_saved||0),
      '"'+(r.assignee||"").replace(/"/g,'""')+'"',
      r.client_id||""
    ].join(","));
  });
  var csv=lines.join("\n");
  var range=crGetRange();
  var blob=new Blob([csv],{type:"text/csv"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="client_resolution_"+range.df+"_"+range.dt+".csv";
  a.click();
}

// ── Load ───────────────────────────────────────────────────
fetch("cr_data.json").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
  .then(function(data){
    CR=data;
    document.getElementById("cr-dt").value=crToday();
    var stSel=document.getElementById("cr-status");
    CR.FL.statuses.forEach(function(s){var o=document.createElement("option");o.value=o.textContent=s;stSel.appendChild(o);});
    var asSel=document.getElementById("cr-assignee");
    CR.FL.assignees.forEach(function(s){var o=document.createElement("option");o.value=o.textContent=s;asSel.appendChild(o);});
    var pcatSel=document.getElementById("cr-pcat");
    (CR.FL.pcats||[]).forEach(function(p){var o=document.createElement("option");o.value=o.textContent=p;pcatSel.appendChild(o);});
    crRenderReqItems();
    crRenderSkuItems();
    crRender();
  })
  .catch(function(err){document.getElementById("cr-loading").innerHTML='<div style="color:#f85149">Failed to load cr_data.json: '+err.message+"</div>";});
