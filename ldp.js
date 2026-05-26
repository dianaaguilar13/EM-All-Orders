// ── Less Down Payment Report ──────────────────────────────
if(typeof EXCLUDED_SKUS==="undefined")var EXCLUDED_SKUS=new Set([]);
var LDP = null;
var ldpCharts = {};
var ldpSelP = new Set();
var ldpSelSku = new Set();
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
    var pd=LDP.TMP[pcat_];
    Object.keys(pd).forEach(function(m){if(m>=df&&m<=dt)arr.push(pd[m]);});
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
    return true;
  });
}

function ldpDestroyCharts(){Object.values(ldpCharts).forEach(function(c){try{c.destroy();}catch(e){}});ldpCharts={};}

function ldpApply(){document.getElementById("ldp-msDrop").classList.remove("open");ldpRender();}
function ldpReset(){
  document.getElementById("ldp-df").value="2022-01-01";
  document.getElementById("ldp-dt").value="2026-04-26";
  ["ldp-pcat"].forEach(function(id){document.getElementById(id).value="";});
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

  // KPIs — 4-row grouped layout
  document.getElementById("ldp-kpis").innerHTML=
    '<div class="kpi-row">'+
    // Row 1: Overview context
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+
      '<div class="kpi k1"><div class="kl">Total Units</div><div class="kv">'+totalUnits.toLocaleString()+'</div><div class="ks muted">all orders (excl. EE, Pend, No Pmt)</div></div>'+
      '<div class="kpi k7"><div class="kl">Total LDP Units</div><div class="kv" style="color:#7c3aed">'+ldpValidUnits.toLocaleString()+'</div><div class="ks muted">≤10% down payment</div></div>'+
      '<div class="kpi k7"><div class="kl">LDP %</div><div class="kv" style="color:#7c3aed">'+ldpPct.toFixed(1)+'%</div><div class="ks muted">of all units are LDP</div></div>'+
    '</div>'+
    // Row 2: Outcomes
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+
      '<div class="kpi k2"><div class="kl">Active</div><div class="kv" style="color:#2563eb">'+ldpActive.toLocaleString()+'</div><div class="ks muted">'+(ldpValidUnits>0?(ldpActive/ldpValidUnits*100).toFixed(1):0)+'% of LDP units</div></div>'+
      '<div class="kpi k3"><div class="kl">Inactive</div><div class="kv" style="color:#ef4444">'+ldpInactive.toLocaleString()+'</div><div class="ks red">'+(ldpValidUnits>0?(ldpInactive/ldpValidUnits*100).toFixed(1):0)+'% of LDP units</div></div>'+
      '<div class="kpi k8"><div class="kl">Lost Revenue</div><div class="kv" style="color:#ef4444;font-size:20px">$'+Math.round(lostRev).toLocaleString()+'</div><div class="ks red">on LDP cancellations</div></div>'+
    '</div>'+
    // Row 3: Cancellation focus
    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">'+
      '<div class="kpi k4"><div class="kl">Cancelled LDP</div><div class="kv" style="color:#ef4444">'+ldpCncl.toLocaleString()+'</div><div class="ks red">'+(ldpValidUnits>0?(ldpCncl/ldpValidUnits*100).toFixed(1):0)+'% of LDP units</div></div>'+
      '<div class="kpi k4"><div class="kl">LDP Cancel Rate</div><div class="kv" style="color:#ef4444">'+ldpCancelRate.toFixed(1)+'%</div><div class="ks red">cancellations / LDP units</div></div>'+
    '</div>'+
    // Row 4: Payment metrics
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+
      '<div class="kpi k7"><div class="kl">Avg Down Payment</div><div class="kv" style="color:#7c3aed">'+avgPmt.toFixed(1)+'%</div><div class="ks muted">avg % of program price paid</div></div>'+
      '<div class="kpi k6"><div class="kl">LDP Upgrades %</div><div class="kv" style="color:#16a34a">'+ldpUpgPct.toFixed(1)+'%</div><div class="ks green">'+ldpUpg.toLocaleString()+' upgrades</div></div>'+
      '<div class="kpi k3"><div class="kl">LDP Downgrades %</div><div class="kv" style="color:#7c3aed">'+ldpDwnPct.toFixed(1)+'%</div><div class="ks muted">'+ldpDwn.toLocaleString()+' downgrades</div></div>'+
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
