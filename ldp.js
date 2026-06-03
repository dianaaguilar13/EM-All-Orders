// ── Less Down Payment Report ──────────────────────────────
if(typeof EXCLUDED_SKUS==="undefined")var EXCLUDED_SKUS=new Set([]);
var LDP = null;
var ldpCharts = {};
var ldpSelP = new Set();
var ldpSelSku = new Set();
var ldpSelDiv = "";  // division filter ("" = all)
function ldpGetDiv(uid){
  uid=(uid||"").toLowerCase();
  if(uid.indexOf("jj969")>=0)return"LT/LCC";
  if(uid.indexOf("ho175")>=0)return"B&L";
  if(uid.indexOf("zu201")>=0)return"HWB";
  if(uid.indexOf("it175")>=0)return"MYM";
  return"Other";
}
// LDP bucket indices (11-element): total,cncl,entry_err,upgrade,downgrade,active,inactive,lost_rev,switch,pend,no_pmt
var LTi=0,LCi=1,LEi=2,LUi=3,LDi=4,LAi=5,LIi=6,LLRi=7,LSi=8,LPi=9,LNPi=10;

function ldpSumArr(arr){
  var o=[0,0,0,0,0,0,0,0,0,0,0];
  for(var i=0;i<arr.length;i++){var a=arr[i];if(a)for(var j=0;j<11;j++)o[j]+=(a[j]||0);}
  return o;
}

// Compute Total Units (all orders net) from TM/TMS/TMP aggregates for LDP% context
function ldpGetTotalUnits(r_, pcat_){
  if(!LDP||!LDP.TM)return 0;
  var df=r_.df,dt=r_.dt;
  var arr=[];
  if(ldpSelSku.size>0&&LDP.TMS){
    ldpSelSku.forEach(function(sku){
      var sd=LDP.TMS[sku]||{};
      Object.keys(sd).forEach(function(m){if(m>=df&&m<=dt)arr.push(sd[m]);});
    });
  }else if(pcat_&&LDP.TMP&&LDP.TMP[pcat_]){
    // Use TMP[pcat] but subtract excluded-SKU contributions via TMPS[pcat][sku]
    var tmAdj={};
    var pd=LDP.TMP[pcat_];
    Object.keys(pd).forEach(function(m){if(m>=df&&m<=dt)tmAdj[m]=(pd[m]||[]).slice();});
    if(LDP.TMPS&&LDP.TMPS[pcat_]){
      var pcSkus=LDP.TMPS[pcat_];
      Object.keys(pcSkus).forEach(function(sku){
        if(!EXCLUDED_SKUS.has(sku))return;
        var sd=pcSkus[sku]||{};
        Object.keys(sd).forEach(function(m){
          if(tmAdj[m]){var v=sd[m];if(v)for(var i=0;i<11;i++)tmAdj[m][i]=(tmAdj[m][i]||0)-(v[i]||0);}
        });
      });
    }
    Object.keys(tmAdj).forEach(function(m){arr.push(tmAdj[m]);});
  }else{
    // No filter: use TM but subtract excluded-SKU contributions via TMS
    var tmAdj={};
    Object.keys(LDP.TM).forEach(function(m){if(m>=df&&m<=dt)tmAdj[m]=(LDP.TM[m]||[]).slice();});
    if(LDP.TMS){
      Object.keys(LDP.TMS).forEach(function(sku){
        if(!EXCLUDED_SKUS.has(sku))return;
        var sd=LDP.TMS[sku]||{};
        Object.keys(sd).forEach(function(m){
          if(tmAdj[m]){var v=sd[m];if(v)for(var i=0;i<11;i++)tmAdj[m][i]=(tmAdj[m][i]||0)-(v[i]||0);}
        });
      });
    }
    Object.keys(tmAdj).forEach(function(m){arr.push(tmAdj[m]);});
  }
  var tot=ldpSumArr(arr);
  return Math.max(0,tot[LTi]-tot[LEi]-tot[LPi]-tot[LNPi]);
}

// ── Filters ───────────────────────────────────────────────
function ldpGetRange(){return{df:document.getElementById("ldp-df").value.slice(0,7),dt:document.getElementById("ldp-dt").value.slice(0,7)};}
function ldpGetPcat(){return document.getElementById("ldp-pcat").value;}

function ldpToggleMs(e){
  var dr=document.getElementById("ldp-msDrop");
  dr.classList.toggle("open");
  if(dr.classList.contains("open")){document.getElementById("ldp-msQ").focus();ldpRenderMsItems();}
}
document.addEventListener("click",function(e){
  var w=document.getElementById("ldp-msWrap");
  if(w&&!w.contains(e.target))document.getElementById("ldp-msDrop").classList.remove("open");
});
function ldpRenderMsItems(){
  if(!LDP)return;
  var q=document.getElementById("ldp-msQ").value.toLowerCase();
  var vis=LDP.FL.partners.filter(function(p){return p.toLowerCase().indexOf(q)>=0;});
  var h="";
  for(var i=0;i<vis.length;i++){
    var p=vis[i];var ck=ldpSelP.has(p)?"checked":"";
    var e=p.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    h+='<div class="ms-item" data-p="'+e+'" onclick="ldpTogP(event,this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";
  }
  document.getElementById("ldp-msItems").innerHTML=h;
}
function ldpTogP(ev,el){ev.stopPropagation();var p=el.getAttribute("data-p");if(ldpSelP.has(p))ldpSelP.delete(p);else ldpSelP.add(p);ldpUpdateMsBtn();ldpRenderMsItems();}
function ldpMsAll(){LDP.FL.partners.filter(function(p){return p.toLowerCase().indexOf(document.getElementById("ldp-msQ").value.toLowerCase())>=0;}).forEach(function(p){ldpSelP.add(p);});ldpUpdateMsBtn();ldpRenderMsItems();}
function ldpMsClear(){ldpSelP.clear();ldpUpdateMsBtn();ldpRenderMsItems();}
function ldpUpdateMsBtn(){
  var btn=document.getElementById("ldp-msBtn");
  var cnt=document.getElementById("ldp-msCnt");
  if(ldpSelP.size===0){btn.textContent="All Partners";cnt.style.display="none";}
  else{btn.textContent=ldpSelP.size===1?Array.from(ldpSelP)[0].slice(0,22):ldpSelP.size+" partners";cnt.textContent=ldpSelP.size;cnt.style.display="inline";}
}

// SKU multi-select
function ldpToggleSku(e){
  var dr=document.getElementById("ldp-skuDrop");
  dr.classList.toggle("open");
  if(dr.classList.contains("open")){document.getElementById("ldp-skuQ").focus();ldpRenderSkuItems();}
}
document.addEventListener("click",function(e){
  var w=document.getElementById("ldp-skuWrap");
  if(w&&!w.contains(e.target))document.getElementById("ldp-skuDrop").classList.remove("open");
});
function ldpRenderSkuItems(){
  if(!LDP)return;
  var q=document.getElementById("ldp-skuQ").value.toLowerCase();
  var incl=LDP.FL.skus.filter(function(s){return!EXCLUDED_SKUS.has(s)&&s.toLowerCase().indexOf(q)>=0;});
  var excl=LDP.FL.skus.filter(function(s){return EXCLUDED_SKUS.has(s)&&s.toLowerCase().indexOf(q)>=0;});
  var h="";
  for(var i=0;i<incl.length;i++){var s=incl[i];var ck=ldpSelSku.has(s)?"checked":"";var e=s.replace(/&/g,"&amp;");h+='<div class="ms-item" data-s="'+e+'" onclick="ldpTogSku(event,this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";}
  if(excl.length>0){h+='<div style="padding:5px 10px 3px;font-size:10px;color:#94a3b8;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">⚠ Excluded by default</div>';for(var i=0;i<excl.length;i++){var s=excl[i];var ck=ldpSelSku.has(s)?"checked":"";var e=s.replace(/&/g,"&amp;");h+='<div class="ms-item" data-s="'+e+'" onclick="ldpTogSku(event,this)" style="opacity:0.65"><input type="checkbox" '+ck+' onclick="return false"><span style="color:#94a3b8">'+e+"</span></div>";}}
  document.getElementById("ldp-skuItems").innerHTML=h;
}
function ldpTogSku(ev,el){ev.stopPropagation();var s=el.getAttribute("data-s");if(ldpSelSku.has(s))ldpSelSku.delete(s);else ldpSelSku.add(s);ldpUpdateSkuBtn();ldpRenderSkuItems();}
function ldpSkuAll(){LDP.FL.skus.filter(function(s){return!EXCLUDED_SKUS.has(s)&&s.toLowerCase().indexOf(document.getElementById("ldp-skuQ").value.toLowerCase())>=0;}).forEach(function(s){ldpSelSku.add(s);});ldpUpdateSkuBtn();ldpRenderSkuItems();}
function ldpSkuClear(){ldpSelSku.clear();ldpUpdateSkuBtn();ldpRenderSkuItems();}
function ldpUpdateSkuBtn(){
  var btn=document.getElementById("ldp-skuBtn");
  var cnt=document.getElementById("ldp-skuCnt");
  if(ldpSelSku.size===0){btn.textContent="All SKUs";cnt.style.display="none";}
  else{btn.textContent=ldpSelSku.size===1?Array.from(ldpSelSku)[0].slice(0,18):ldpSelSku.size+" SKUs selected";cnt.textContent=ldpSelSku.size;cnt.style.display="inline";}
}

function ldpFmtM(m){var p=m.split("-");return new Date(parseInt(p[0]),parseInt(p[1])-1).toLocaleString("default",{month:"short",year:"2-digit"});}

// Get filtered rows
function ldpGetRows(){
  if(!LDP)return[];
  var r=ldpGetRange(),pcat=ldpGetPcat();
  return LDP.rows.filter(function(row){
    var m=row[5]; // month
    if(m<r.df||m>r.dt)return false;
    if(EXCLUDED_SKUS.has(row[3]))return false; // always exclude
    if(ldpSelSku.size>0&&!ldpSelSku.has(row[3]))return false; // sku
    if(pcat&&row[13]!==pcat)return false; // pcat
    if(ldpSelP.size>0&&!ldpSelP.has(row[14]))return false; // partner
    if(ldpSelDiv&&ldpGetDiv(row[0])!==ldpSelDiv)return false; // division
    return true;
  });
}

function ldpDestroyCharts(){Object.values(ldpCharts).forEach(function(c){try{c.destroy();}catch(e){}});ldpCharts={};}

function ldpApply(){
  document.getElementById("ldp-msDrop").classList.remove("open");
  var dd=document.getElementById("ldp-div");if(dd)ldpSelDiv=dd.value;
  ldpRender();
}
function ldpReset(){
  document.getElementById("ldp-df").value="2022-01-01";
  document.getElementById("ldp-dt").value="2026-04-26";
  ["ldp-pcat","ldp-div"].forEach(function(id){var el=document.getElementById(id);if(el)el.value="";});
  ldpSelDiv="";
  ldpSelP.clear();ldpUpdateMsBtn();
  ldpSelSku.clear();ldpUpdateSkuBtn();
  ldpRender();
}

function ldpRender(){
  if(!LDP)return;
  ldpDestroyCharts();
  var rows=ldpGetRows();
  var r_=ldpGetRange(),pcat_=ldpGetPcat();

  var ldpTotal=rows.length;
  var ldpCncl=rows.filter(function(r){return r[10]==="Cancelled";}).length;
  var ldpEE=rows.filter(function(r){return r[10]==="Entry Error";}).length;
  var ldpUpg=rows.filter(function(r){return r[10]==="Upgrade";}).length;
  var ldpDwn=rows.filter(function(r){return r[10]==="Downgrade";}).length;
  var ldpPend=rows.filter(function(r){return r[10]==="Pend";}).length;
  var ldpNoPmt=rows.filter(function(r){return r[10]==="No Pmt";}).length;
  var ldpActive=rows.filter(function(r){return r[11]==="Active";}).length;
  var ldpInactive=rows.filter(function(r){return r[11]==="Inactive";}).length;
  var ldpValidUnits=Math.max(0,ldpTotal-ldpEE-ldpPend-ldpNoPmt);
  var ldpCancelRate=ldpValidUnits>0?(ldpCncl/ldpValidUnits*100):0;
  var lostRev=rows.reduce(function(s,r){return s+(r[16]||0);},0);
  var avgPmt=rows.length>0?rows.reduce(function(s,r){return s+(r[9]||0);},0)/rows.length:0;
  var ldpUpgPct=ldpValidUnits>0?(ldpUpg/ldpValidUnits*100):0;
  var ldpDwnPct=ldpValidUnits>0?(ldpDwn/ldpValidUnits*100):0;

  var totalUnits=ldpGetTotalUnits(r_,pcat_);
  var ldpPct=totalUnits>0?(ldpValidUnits/totalUnits*100):0;

  document.getElementById("ldp-rcLbl").textContent=ldpTotal.toLocaleString()+" LDP records";

  // KPIs — Option C: unified card · General row on top · LDP Outcomes row below
  document.getElementById("ldp-kpis").innerHTML=
    '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.05)">'+
    // ── General row ──
    '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#94a3b8;margin-bottom:8px">📋 All Orders</div>'+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">'+
      '<div class="kpi" style="border-top:3px solid #94a3b8"><div class="kl">Total Units</div><div class="kv" style="color:#475569">'+totalUnits.toLocaleString()+'</div><div class="ks muted">all orders (excl. EE, Pend, No Pmt)</div></div>'+
      '<div class="kpi" style="border-top:3px solid #7c3aed"><div class="kl">Total LDP Units</div><div class="kv" style="color:#7c3aed">'+ldpValidUnits.toLocaleString()+'</div><div class="ks" style="color:#7c3aed">'+ldpPct.toFixed(1)+'% of all orders</div></div>'+
      '<div class="kpi" style="border-top:3px solid #d97706"><div class="kl">Avg Down Payment</div><div class="kv" style="color:#d97706">'+avgPmt.toFixed(1)+'%</div><div class="ks muted">avg % of program price paid</div></div>'+
    '</div>'+
    // ── Divider with LDP label ──
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+
      '<div style="height:1px;background:#ddd6fe;flex:1"></div>'+
      '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#7c3aed">💳 LDP Outcomes</span>'+
      '<div style="height:1px;background:#ddd6fe;flex:1"></div>'+
    '</div>'+
    // ── LDP Outcomes row: 5 KPIs + upgrade/downgrade chips ──
    '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">'+
      '<div class="kpi" style="border-top:3px solid #2563eb"><div class="kl">Active</div><div class="kv" style="color:#2563eb">'+ldpActive.toLocaleString()+'</div><div class="ks muted">'+(ldpValidUnits>0?(ldpActive/ldpValidUnits*100).toFixed(1):0)+'% of LDP</div></div>'+
      '<div class="kpi" style="border-top:3px solid #94a3b8"><div class="kl">Inactive</div><div class="kv" style="color:#64748b">'+ldpInactive.toLocaleString()+'</div><div class="ks muted">'+(ldpValidUnits>0?(ldpInactive/ldpValidUnits*100).toFixed(1):0)+'% of LDP</div></div>'+
      '<div class="kpi" style="border-top:3px solid #ef4444"><div class="kl">Cancelled</div><div class="kv" style="color:#ef4444">'+ldpCncl.toLocaleString()+'</div><div class="ks red">'+(ldpValidUnits>0?(ldpCncl/ldpValidUnits*100).toFixed(1):0)+'%</div></div>'+
      '<div class="kpi" style="border-top:3px solid #ef4444"><div class="kl">Cancel Rate</div><div class="kv" style="color:#ef4444">'+ldpCancelRate.toFixed(1)+'%</div><div class="ks muted">cancellations ÷ LDP</div></div>'+
      '<div class="kpi" style="border-top:3px solid #ef4444"><div class="kl">Lost Revenue</div><div class="kv" style="color:#ef4444;font-size:19px">$'+Math.round(lostRev).toLocaleString()+'</div><div class="ks muted">on LDP cancels</div></div>'+
      '<div style="display:flex;flex-direction:column;gap:5px">'+
        '<div style="flex:1;display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;padding:6px 10px">'+
          '<div style="font-size:18px;font-weight:700;color:#16a34a;letter-spacing:-0.5px">'+ldpUpg.toLocaleString()+'</div>'+
          '<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#166534">↑ Upgrades</div>'+
          '<div style="font-size:10px;color:#16a34a">'+ldpUpgPct.toFixed(1)+'% of LDP</div></div>'+
        '</div>'+
        '<div style="flex:1;display:flex;align-items:center;gap:8px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:7px;padding:6px 10px">'+
          '<div style="font-size:18px;font-weight:700;color:#7c3aed;letter-spacing:-0.5px">'+ldpDwn.toLocaleString()+'</div>'+
          '<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b21a8">↓ Downgrades</div>'+
          '<div style="font-size:10px;color:#7c3aed">'+ldpDwnPct.toFixed(1)+'% of LDP</div></div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '</div>';

  // Monthly trend
  var byMonth={};
  rows.forEach(function(r){
    var m=r[5];
    if(!byMonth[m])byMonth[m]={total:0,cancelled:0,entry_error:0,upgrade:0,active:0,inactive:0,pend:0,no_pmt:0};
    byMonth[m].total++;
    if(r[10]==="Cancelled")byMonth[m].cancelled++;
    else if(r[10]==="Entry Error")byMonth[m].entry_error++;
    else if(r[10]==="Upgrade")byMonth[m].upgrade++;
    else if(r[10]==="Pend")byMonth[m].pend++;
    else if(r[10]==="No Pmt")byMonth[m].no_pmt++;
    if(r[11]==="Active")byMonth[m].active++;
    else byMonth[m].inactive++;
  });
  var months=Object.keys(byMonth).sort();
  var mLabels=months.map(ldpFmtM);
  ldpCharts.trend=new Chart(document.getElementById("ldp-trendChart"),{
    type:"bar",
    data:{labels:mLabels,datasets:[
      {label:"Active",data:months.map(function(m){return byMonth[m].active;}),backgroundColor:"rgba(88,166,255,0.8)",borderRadius:3,stack:"s"},
      {label:"Cancelled",data:months.map(function(m){return byMonth[m].cancelled;}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3,stack:"s"},
      {label:"Entry Error",data:months.map(function(m){return byMonth[m].entry_error;}),backgroundColor:"rgba(227,179,65,0.8)",borderRadius:3,stack:"s"},
      {label:"Upgrade",data:months.map(function(m){return byMonth[m].upgrade;}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
      {label:"Cancel %",data:months.map(function(m){var bm=byMonth[m];var v=bm.total-bm.entry_error-bm.pend-bm.no_pmt;return v>0?+(bm.cancelled/v*100).toFixed(1):0;}),
        type:"line",yAxisID:"y2",borderColor:"#f85149",backgroundColor:"rgba(248,81,73,0.07)",fill:true,tension:0.35,pointRadius:2,pointBackgroundColor:"#f85149",borderWidth:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},
      scales:{
        x:{stacked:true,ticks:{color:"#8b949e",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#21262d44"}},
        y:{stacked:true,ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},
        y2:{position:"right",ticks:{color:"#f85149",font:{size:10},callback:function(v){return v+"%";}},grid:{display:false}}
      }}
  });

  // Refund days for cancelled - map actual rd values to chart buckets
  var rdMap={"Same day":0,"<=30d":0,"<=45d":0,"<=60d":0,"<=90d":0,">90d":0};
  rows.forEach(function(r){
    if(r[10]!=="Cancelled")return;
    var rd=r[12]||"N/A";
    if(rd==="N/A"||rd==="none")return;
    if(rdMap[rd]!==undefined)rdMap[rd]++;
    else rdMap[">90d"]++;
  });
  var rdK=["Same day","<=30d","<=45d","<=60d","<=90d",">90d"],rdL=["Same day","<=30d","<=45d","<=60d","<=90d",">90d"];
  ldpCharts.rd=new Chart(document.getElementById("ldp-rdChart"),{
    type:"bar",
    data:{labels:rdL,datasets:[{data:rdK.map(function(k){return rdMap[k]||0;}),backgroundColor:"rgba(248,81,73,0.75)",borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ctx.parsed.y+" cancellations";}}}},
      scales:{x:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},y:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}}}}
  });

  // Down payment % distribution
  var pctMap={};
  rows.forEach(function(r){pctMap[Math.round(r[9])]=(pctMap[Math.round(r[9])]||0)+1;});
  var pctBuckets={"<1%":0,"1-3%":0,"3-5%":0,"5-7%":0,"7-10%":0};
  rows.forEach(function(r){
    var p=r[9];
    if(p<1)pctBuckets["<1%"]++;
    else if(p<3)pctBuckets["1-3%"]++;
    else if(p<5)pctBuckets["3-5%"]++;
    else if(p<7)pctBuckets["5-7%"]++;
    else pctBuckets["7-10%"]++;
  });
  ldpCharts.pct=new Chart(document.getElementById("ldp-pctChart"),{
    type:"bar",
    data:{labels:Object.keys(pctBuckets),datasets:[{data:Object.values(pctBuckets),backgroundColor:"rgba(56,139,253,0.75)",borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{x:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},y:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}}}}
  });

  // Partner category donut
  var pcatMap={};
  rows.forEach(function(r){pcatMap[r[13]]=(pcatMap[r[13]]||0)+1;});
  var pcatKeys=Object.keys(pcatMap).sort(function(a,b){return pcatMap[b]-pcatMap[a];});
  ldpCharts.pcat=new Chart(document.getElementById("ldp-pcatChart"),{
    type:"doughnut",
    data:{labels:pcatKeys,datasets:[{data:pcatKeys.map(function(k){return pcatMap[k];}),backgroundColor:["#388bfd","#f85149","#3fb950","#e3b341","#bc8cff"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",plugins:{legend:{position:"right",labels:{color:"#8b949e",font:{size:11},boxWidth:10,padding:8}}}}
  });

  // Outcome donut
  var outcomeData=[ldpActive,ldpCncl,ldpEE,ldpUpg,ldpDwn].filter(function(v){return v>0;});
  var outcomeLabels=["Active","Cancelled","Entry Error","Upgrades","Downgrades"].filter(function(_,i){return [ldpActive,ldpCncl,ldpEE,ldpUpg,ldpDwn][i]>0;});
  ldpCharts.outcome=new Chart(document.getElementById("ldp-outcomeChart"),{
    type:"doughnut",
    data:{labels:outcomeLabels,datasets:[{data:outcomeData,backgroundColor:["#58a6ff","#f85149","#e3b341","#3fb950","#bc8cff"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",plugins:{legend:{position:"right",labels:{color:"#8b949e",font:{size:11},boxWidth:10,padding:8}}}}
  });

  // Show main content
  document.getElementById("ldp-content").style.display="none";
  document.getElementById("ldp-main-content").style.display="block";

  // SKU table
  var skuMap={};
  rows.forEach(function(r){
    var s=r[3];
    if(!skuMap[s])skuMap[s]={total:0,active:0,inactive:0,cancelled:0,entry_error:0,upgrade:0,pend:0,no_pmt:0,inv:0,pay:0};
    skuMap[s].total++;
    if(r[11]==="Active")skuMap[s].active++;else skuMap[s].inactive++;
    if(r[10]==="Cancelled")skuMap[s].cancelled++;
    else if(r[10]==="Entry Error")skuMap[s].entry_error++;
    else if(r[10]==="Upgrade")skuMap[s].upgrade++;
    else if(r[10]==="Pend")skuMap[s].pend++;
    else if(r[10]==="No Pmt")skuMap[s].no_pmt++;
    skuMap[s].inv+=r[7];skuMap[s].pay+=r[8];
  });
  var skuArr=Object.entries(skuMap).sort(function(a,b){return b[1].total-a[1].total;});
  var mx=Math.max.apply(null,skuArr.map(function(e){var v=e[1];var valid=v.total-v.entry_error-v.pend-v.no_pmt;return valid>0?(v.cancelled/valid*100):0;}).concat([1]));
  var tRows="";
  skuArr.forEach(function(e){
    var s=e[0],v=e[1];
    var valid=v.total-v.entry_error-v.pend-v.no_pmt;
    var rate=valid>0?(v.cancelled/valid*100):0;
    var avgPct=v.inv>0?(v.pay/v.inv*100).toFixed(1):0;
    var cl=rate>50?"#f85149":rate>30?"#e3b341":"#56d364";
    var bg=rate>50?"#f85149":rate>30?"#e3b341":"#388bfd";
    tRows+="<tr><td><span class='pill'>"+s+"</span></td>"+
      "<td class='num'>"+v.total+"</td>"+
      "<td class='num' style='color:#58a6ff'>"+v.active+"</td>"+
      "<td class='num' style='color:#f85149'>"+v.inactive+"</td>"+
      "<td class='num' style='color:#ff7b72'>"+v.cancelled+"</td>"+
      "<td class='num' style='color:#e3b341'>"+v.entry_error+"</td>"+
      "<td class='num' style='color:#56d364'>"+v.upgrade+"</td>"+
      "<td><div class='bw'><div class='bb'><div class='bf' style='width:"+(rate/mx*100).toFixed(0)+"%;background:"+bg+"'></div></div>"+
      "<span class='num' style='min-width:38px;font-size:11px;color:"+cl+"'>"+rate.toFixed(1)+"%</span></div></td>"+
      "<td class='num' style='color:#8b949e'>"+avgPct+"%</td>"+
      "<td class='num'>$"+Math.round(v.inv).toLocaleString()+"</td></tr>";
  });
  document.getElementById("ldp-skuTbody").innerHTML=tRows;
  document.getElementById("ldp-tblInfo").textContent=skuArr.length+" SKUs · "+ldpTotal.toLocaleString()+" records";

  // Records table (paginated)
  ldpRenderRecords(rows);

  // Payment tracker
  ldpRenderTracker(rows);
}

function ldpRenderRecords(rows){
  var rdL={"0":"Same day","15":"<=15d","30":"<=30d","45":"<=45d","60":"<=60d","61":"61+d","none":"-"};
  var cnclColors={"Cancelled":"#f85149","Entry Error":"#e3b341","Upgrade":"#3fb950","Downgrade":"#bc8cff","Switch":"#58a6ff","Sale":"#39d353"};
  var top=rows.slice(0,500);
  var cnclColors={"Cancelled":"#ef4444","Entry Error":"#f59e0b","Upgrade":"#16a34a","Downgrade":"#7c3aed","Sale":"#64748b","Switch":"#2563eb"};
  var h=top.map(function(r){
    var cColor=cnclColors[r[10]]||"#64748b";
    var aColor=r[11]==="Active"?"#2563eb":"#ef4444";
    return "<tr>"+
      "<td class='num' style='font-size:10px;color:#64748b'>"+r[1]+"</td>"+
      "<td style='font-size:10px;color:#64748b'>"+r[2]+"</td>"+
      "<td><span class='pill'>"+r[3]+"</span></td>"+
      "<td style='font-size:10px;color:#64748b'>"+r[4]+"</td>"+
      "<td class='num' style='color:#64748b'>"+r[6]+"</td>"+
      "<td class='num'>$"+r[7].toLocaleString()+"</td>"+
      "<td class='num'>$"+r[8].toLocaleString()+"</td>"+
      "<td class='num' style='color:"+(r[9]<3?"#ef4444":r[9]<7?"#f59e0b":"#16a34a")+"'>"+r[9].toFixed(1)+"%</td>"+
      "<td><span style='font-size:10px;font-weight:600;color:"+cColor+"'>"+r[10]+"</span></td>"+
      "<td><span style='font-size:10px;font-weight:600;color:"+aColor+"'>"+r[11]+"</span></td>"+
      "<td class='num' style='color:#64748b'>"+r[12]+"</td>"+
      "<td style='font-size:10px;color:#64748b'>"+r[13]+"</td>"+
      "<td style='font-size:10px;color:#64748b'>"+(r[14]||"").slice(0,25)+"</td>"+
      "<td style='font-size:10px;color:#64748b'>"+(r[15]||"")+"</td>"+
      (r[16]>0?"<td class='num' style='color:#ef4444'>$"+Math.round(r[16]).toLocaleString()+"</td>":"<td>-</td>")+
      "</tr>";
  }).join("");
  document.getElementById("ldp-recTbody").innerHTML=h;
  document.getElementById("ldp-recInfo").textContent="Showing "+Math.min(200,rows.length)+" of "+rows.length+" records";
}


// ── CSV Download ─────────────────────────────────────────
function ldpDownloadCsv(){
  var rows=ldpGetRows();
  var headers=["Order ID","Contact ID","SKU","SKU Category","Purchase Date","Inv Total","Paid","Pmt %","CNCL Status","Active Status","Refund Days","Partner Cat","Partner","EM","Lost Revenue"];
  var lines=[headers.join(",")];
  rows.forEach(function(r){
    lines.push([
      r[1],r[2],
      '"'+(r[3]||"").replace(/"/g,'""')+'"',
      '"'+(r[4]||"").replace(/"/g,'""')+'"',
      r[6],r[7],r[8],r[9].toFixed(1),r[10],r[11],r[12],
      '"'+(r[13]||"").replace(/"/g,'""')+'"',
      '"'+(r[14]||"").replace(/"/g,'""')+'"',
      '"'+(r[15]||"").replace(/"/g,'""')+'"',
      Math.round(r[16]||0)
    ].join(","));
  });
  var csv=lines.join("\n");
  var range=ldpGetRange();
  var blob=new Blob([csv],{type:"text/csv"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="ldp_records_"+range.df+"_"+range.dt+".csv";
  a.click();
}

// ── LDP Payment Tracker ───────────────────────────────────────────────────────
function ldpRenderTracker(rows) {
  var el = document.getElementById("ldp-tracker-section");
  if (!el) return;

  // Check if new fields exist (requires data refresh after code update)
  var hasTracking = rows.length > 0 && rows[0].length > 17;
  if (!hasTracking) {
    el.innerHTML = '<div style="padding:20px;color:#94a3b8;font-size:13px;text-align:center">⚠ Payment tracking data not yet available. Please run the data refresh (Run.bat) to populate tracking fields.</div>';
    return;
  }

  // Risk level colors and order
  var RISK_ORDER = ["No Payment","Overdue +30","Overdue +15","On Track","Paid in Full","Cancelled","Downgrade","Upgrade","Entry Error","Pend","Switch","Inactive"];
  var RISK_COLOR = {
    "Paid in Full": {bg:"#dcfce7",txt:"#15803d",border:"#86efac"},
    "On Track":     {bg:"#f0fdf4",txt:"#16a34a",border:"#bbf7d0"},
    "Overdue +15":  {bg:"#fffbeb",txt:"#b45309",border:"#fde68a"},
    "Overdue +30":  {bg:"#fff1f2",txt:"#b91c1c",border:"#fecaca"},
    "No Payment":   {bg:"#3b0764",txt:"#ffffff",border:"#6d28d9"},
    "Cancelled":    {bg:"#f1f5f9",txt:"#475569",border:"#cbd5e1"},
    "Downgrade":    {bg:"#f5f3ff",txt:"#6d28d9",border:"#ddd6fe"},
    "Upgrade":      {bg:"#ecfdf5",txt:"#059669",border:"#6ee7b7"},
  };

  // Count by risk
  var riskCounts = {};
  var riskInv = {};
  var riskBal = {};
  rows.forEach(function(r) {
    var risk = r[21] || "Unknown";
    riskCounts[risk] = (riskCounts[risk] || 0) + 1;
    riskInv[risk]    = (riskInv[risk]    || 0) + (r[7] || 0);
    riskBal[risk]    = (riskBal[risk]    || 0) + (r[22] || 0);
  });

  // KPI summary chips
  var kpiDefs = [
    {key:"No Payment",  label:"No Payment",   icon:"⛔"},
    {key:"Overdue +30", label:"Overdue +30d",  icon:"🔴"},
    {key:"Overdue +15", label:"Overdue +15d",  icon:"🟡"},
    {key:"On Track",    label:"On Track",      icon:"🟢"},
    {key:"Paid in Full",label:"Paid in Full",  icon:"✅"},
    {key:"Cancelled",   label:"Cancelled",     icon:"⚫"},
    {key:"Downgrade",   label:"Downgrade",     icon:"🔽"},
  ];

  var kpiHtml = kpiDefs.map(function(k) {
    var cnt  = riskCounts[k.key] || 0;
    var col  = RISK_COLOR[k.key] || {bg:"#f8fafc",txt:"#475569",border:"#e2e8f0"};
    var bal  = riskBal[k.key] || 0;
    var balStr = bal > 0 ? '<div style="font-size:10px;margin-top:2px;opacity:.75">$'+Math.round(bal).toLocaleString()+' outstanding</div>' : '';
    return '<div style="background:'+col.bg+';border:1px solid '+col.border+';border-radius:8px;padding:10px 14px;min-width:110px;text-align:center">'
      +'<div style="font-size:20px;font-weight:700;color:'+col.txt+'">'+cnt.toLocaleString()+'</div>'
      +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:'+col.txt+';margin-top:2px">'+k.icon+' '+k.label+'</div>'
      +balStr
      +'</div>';
  }).join("");

  // Sort / filter state for table
  var trackerSort  = el._sort  || {col:20, asc:false};  // default: sort by days_since desc
  var trackerRisk  = el._riskF || "";
  var trackerSearch= el._srch  || "";

  // Filter rows for table
  var tRows = rows.filter(function(r) {
    if (trackerRisk && r[21] !== trackerRisk) return false;
    if (trackerSearch) {
      var q = trackerSearch.toLowerCase();
      var hay = ((r[1]||"")+" "+(r[2]||"")+" "+(r[3]||"")+" "+(r[15]||"")+" "+(r[14]||"")).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  // Sort
  tRows.sort(function(a, b) {
    var av = a[trackerSort.col], bv = b[trackerSort.col];
    if (av === null || av === undefined) av = trackerSort.asc ? Infinity : -Infinity;
    if (bv === null || bv === undefined) bv = trackerSort.asc ? Infinity : -Infinity;
    if (av < bv) return trackerSort.asc ? -1 :  1;
    if (av > bv) return trackerSort.asc ?  1 : -1;
    return 0;
  });

  function thSort(col, label) {
    var arrow = trackerSort.col === col ? (trackerSort.asc ? " ▲" : " ▼") : "";
    return '<th onclick="ldpTrackerSort('+col+')" style="cursor:pointer;white-space:nowrap;user-select:none">'+label+arrow+'</th>';
  }

  var SHOW = Math.min(300, tRows.length);
  var tbodyHtml = tRows.slice(0, SHOW).map(function(r) {
    var risk = r[21] || "";
    var col  = RISK_COLOR[risk] || {bg:"",txt:"#475569",border:""};
    var riskBadge = '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:'+col.bg+';color:'+col.txt+';border:1px solid '+col.border+'">'+risk+'</span>';
    var dayCell = (r[20]!==null && r[20]!==undefined) ? r[20]+'d' : '—';
    var dayColor = r[20]>=30?"#b91c1c":r[20]>=15?"#b45309":"#374151";
    var balFmt = r[22]>0 ? '$'+Math.round(r[22]).toLocaleString() : '—';
    var paidFmt = r[17]>0 ? '$'+Math.round(r[17]).toLocaleString() : '—';
    var rowBg = risk==="No Payment"?"#fdf4ff":risk==="Overdue +30"?"#fff5f5":risk==="Overdue +15"?"#fffdf0":"";
    return '<tr style="'+(rowBg?'background:'+rowBg:'')+'">'+
      '<td style="font-size:11px;color:#64748b">'+r[1]+'</td>'+
      '<td style="font-size:11px;color:#64748b">'+r[2]+'</td>'+
      '<td><span style="font-size:11px;font-weight:600;background:#eff6ff;color:#1d4ed8;padding:1px 5px;border-radius:3px">'+r[3]+'</span></td>'+
      '<td style="font-size:11px">'+r[6]+'</td>'+
      '<td style="font-size:11px;color:#6d28d9">$'+r[8].toLocaleString()+'</td>'+
      '<td style="font-size:11px;color:#64748b">'+r[9].toFixed(1)+'%</td>'+
      '<td style="font-size:11px">'+paidFmt+'</td>'+
      '<td style="font-size:11px;color:#dc2626;font-weight:600">'+balFmt+'</td>'+
      '<td style="font-size:11px;color:'+dayColor+';font-weight:600">'+dayCell+'</td>'+
      '<td style="font-size:11px;color:#64748b">'+(r[19]||'—')+'</td>'+
      '<td>'+riskBadge+'</td>'+
      '<td style="font-size:11px;color:#64748b">'+(r[15]||'')+'</td>'+
      '<td style="font-size:11px;color:#64748b">'+(r[14]||'').slice(0,22)+'</td>'+
      '</tr>';
  }).join("");

  // Risk filter buttons
  var riskFilterHtml = ['', 'No Payment','Overdue +30','Overdue +15','On Track','Paid in Full','Cancelled','Downgrade'].map(function(rk) {
    var label = rk === '' ? 'All' : rk;
    var active = trackerRisk === rk;
    var col = rk ? (RISK_COLOR[rk] || {bg:"#f1f5f9",txt:"#475569"}) : {bg:"#1d4ed8",txt:"#fff"};
    var style = active
      ? 'background:'+col.bg+';color:'+col.txt+';border:2px solid '+col.txt+';font-weight:700'
      : 'background:#f8fafc;color:#64748b;border:1px solid #e2e8f0';
    return '<button onclick="ldpTrackerRiskFilter(\''+rk+'\')" style="'+style+';padding:4px 10px;border-radius:5px;font-size:11px;cursor:pointer">'+label+' ('+(rk?riskCounts[rk]||0:rows.length)+')</button>';
  }).join("");

  el.innerHTML =
    '<div style="padding:14px 18px 10px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;border-bottom:1px solid #e2e8f0">'
    +'<span style="font-size:12px;font-weight:700;color:#0d1b3e;text-transform:uppercase;letter-spacing:.5px;margin-right:4px">RISK SUMMARY</span>'
    +kpiHtml+'</div>'
    +'<div style="padding:10px 18px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;border-bottom:1px solid #e2e8f0">'
    +'<span style="font-size:11px;color:#64748b;margin-right:4px">Filter:</span>'+riskFilterHtml
    +'<input id="ldp-tracker-search" placeholder="Search order, contact, EM…" oninput="ldpTrackerSearch(this.value)" value="'+trackerSearch.replace(/"/g,'&quot;')+'" style="margin-left:auto;padding:5px 10px;font-size:12px;border:1px solid #d1d5db;border-radius:5px;width:220px">'
    +'</div>'
    +'<div style="overflow-x:auto">'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead style="background:#1a3566;color:#fff"><tr>'
    +thSort(1,'Invoice ID')+thSort(2,'Contact ID')+thSort(3,'SKU')+thSort(6,'Sale Date')
    +thSort(8,'Deposit')+thSort(9,'Dep %')+thSort(17,'Total Paid')+thSort(22,'Balance')
    +thSort(20,'Days Since Pmt')+thSort(19,'Last Pmt Date')+'<th>Risk</th>'
    +'<th>EM</th><th>Partner</th>'
    +'</tr></thead>'
    +'<tbody>'+tbodyHtml+'</tbody>'
    +'</table>'
    +(tRows.length>SHOW?'<div style="padding:8px 18px;font-size:11px;color:#94a3b8">Showing '+SHOW+' of '+tRows.length+' records — use filters to narrow down</div>':'')
    +'</div>';

  // Store state on element for re-renders
  el._sort  = trackerSort;
  el._riskF = trackerRisk;
  el._srch  = trackerSearch;
}

function ldpTrackerSort(col) {
  var el = document.getElementById("ldp-tracker-section");
  if (!el) return;
  var cur = el._sort || {col:20, asc:false};
  el._sort = {col:col, asc: cur.col===col ? !cur.asc : false};
  // Re-render tracker only (avoid full re-render)
  ldpRenderTracker(ldpGetRows());
}

function ldpTrackerRiskFilter(rk) {
  var el = document.getElementById("ldp-tracker-section");
  if (!el) return;
  el._riskF = rk;
  ldpRenderTracker(ldpGetRows());
}

function ldpTrackerSearch(q) {
  var el = document.getElementById("ldp-tracker-section");
  if (!el) return;
  el._srch = q;
  ldpRenderTracker(ldpGetRows());
}

// Load data and init
fetch("ldp_data.json?v=1777606469").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
  .then(function(data){
    LDP=data;
    // Populate SKU multi-select
    ldpRenderSkuItems();
    ldpRenderMsItems();
    ldpRender();
  })
  .catch(function(err){
    document.getElementById("ldp-content").innerHTML='<div class="loading"><div style="color:#f85149">Failed to load ldp_data.json: '+err.message+"</div></div>";
  });
