// ── Less Down Payment Report ──────────────────────────────
var LDP = null;
var ldpCharts = {};
var ldpSelP = new Set();
var ldpSelSku = new Set();
var Ti=0,Ci=1,Ei=2,Ui=3,Di=4,Ai=5,Ii=6;

function ldpSumArr(arr){
  var o=[0,0,0,0,0,0,0];
  for(var i=0;i<arr.length;i++){var a=arr[i];if(a)for(var j=0;j<7;j++)o[j]+=(a[j]||0);}
  return o;
}

function ldpGetCncl(cs){
  cs=(cs||"").toLowerCase().trim();
  if(cs.indexOf("upgrade")>=0)return"Upgrade";
  if(cs.indexOf("downgrade")>=0)return"Downgrade";
  if(cs.indexOf("switch")>=0)return"Switch";
  if(cs.indexOf("entry error")>=0||cs.indexOf("error")>=0)return"Entry Error";
  if(cs.indexOf("cncl")>=0||cs.indexOf("lrev")>=0)return"Cancelled";
  return"Sale";
}

// ── Filters ───────────────────────────────────────────────
function ldpGetRange(){return{df:document.getElementById("ldp-df").value.slice(0,7),dt:document.getElementById("ldp-dt").value.slice(0,7)};}
function ldpGetPcat(){return document.getElementById("ldp-pcat").value;}

function ldpToggleMs(e){
  e.stopPropagation();
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
    h+='<div class="ms-item" data-p="'+e+'" onclick="ldpTogP(this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";
  }
  document.getElementById("ldp-msItems").innerHTML=h;
}
function ldpTogP(el){var p=el.getAttribute("data-p");if(ldpSelP.has(p))ldpSelP.delete(p);else ldpSelP.add(p);ldpUpdateMsBtn();ldpRenderMsItems();}
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
  e.stopPropagation();
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
  var vis=LDP.FL.skus.filter(function(s){return s.toLowerCase().indexOf(q)>=0;});
  var h="";
  for(var i=0;i<vis.length;i++){
    var s=vis[i];var ck=ldpSelSku.has(s)?"checked":"";
    var e=s.replace(/&/g,"&amp;");
    h+='<div class="ms-item" data-s="'+e+'" onclick="ldpTogSku(this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";
  }
  document.getElementById("ldp-skuItems").innerHTML=h;
}
function ldpTogSku(el){var s=el.getAttribute("data-s");if(ldpSelSku.has(s))ldpSelSku.delete(s);else ldpSelSku.add(s);ldpUpdateSkuBtn();ldpRenderSkuItems();}
function ldpSkuAll(){LDP.FL.skus.filter(function(s){return s.toLowerCase().indexOf(document.getElementById("ldp-skuQ").value.toLowerCase())>=0;}).forEach(function(s){ldpSelSku.add(s);});ldpUpdateSkuBtn();ldpRenderSkuItems();}
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
    var m=row[2];
    if(m<r.df||m>r.dt)return false;
    if(ldpSelSku.size>0&&!ldpSelSku.has(row[1]))return false;
    if(pcat&&row[9]!==pcat)return false;
    if(ldpSelP.size>0&&!ldpSelP.has(row[10]))return false;
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
  var total=rows.length;
  var cancelled=rows.filter(function(r){return r[6]==="Cancelled";}).length;
  var entryErr=rows.filter(function(r){return r[6]==="Entry Error";}).length;
  var upgrades=rows.filter(function(r){return r[6]==="Upgrade";}).length;
  var downgrades=rows.filter(function(r){return r[6]==="Downgrade";}).length;
  var active=rows.filter(function(r){return r[7]==="Active";}).length;
  var inactive=rows.filter(function(r){return r[7]==="Inactive";}).length;
  var validUnits=total-entryErr;
  var cancelRate=validUnits>0?(cancelled/validUnits*100):0;
  var totalInv=rows.reduce(function(s,r){return s+(r[7]||0);},0);
  var totalPay=rows.reduce(function(s,r){return s+(r[8]||0);},0);
  var lostRev=rows.reduce(function(s,r){return s+(r[16]||0);},0);
  var displayTotal=total-entryErr;
  var avgPmt=rows.length>0?rows.reduce(function(s,r){return s+(r[9]||0);},0)/rows.length:0;

  document.getElementById("ldp-rcLbl").textContent=total.toLocaleString()+" LDP records";

  // KPIs
  document.getElementById("ldp-kpis").innerHTML=
    '<div class="kpi k1"><div class="kl">Total LDP</div><div class="kv">'+displayTotal.toLocaleString()+'</div><div class="ks muted">excl. entry errors</div></div>'+
    '<div class="kpi k2"><div class="kl">Active</div><div class="kv" style="color:#2563eb">'+active.toLocaleString()+'</div><div class="ks muted">'+(displayTotal>0?(active/displayTotal*100).toFixed(1):0)+'% continuing</div></div>'+
    '<div class="kpi k3"><div class="kl">Inactive</div><div class="kv" style="color:#ef4444">'+inactive.toLocaleString()+'</div><div class="ks red">'+(displayTotal>0?(inactive/displayTotal*100).toFixed(1):0)+'% of total</div></div>'+
    '<div class="kpi k4"><div class="kl">Cancelled</div><div class="kv" style="color:#ef4444">'+cancelled.toLocaleString()+'</div><div class="ks red">'+cancelRate.toFixed(1)+'% cancel rate</div></div>'+
    '<div class="kpi k5"><div class="kl">Entry Error</div><div class="kv" style="color:#f59e0b">'+entryErr.toLocaleString()+'</div><div class="ks amber">excl. from cancel %</div></div>'+
    '<div class="kpi k6"><div class="kl">Upgrades</div><div class="kv" style="color:#16a34a">'+upgrades.toLocaleString()+'</div><div class="ks green">upgrade events</div></div>'+
    '<div class="kpi k3"><div class="kl">Lost Revenue</div><div class="kv" style="color:#ef4444;font-size:18px">$'+Math.round(lostRev).toLocaleString()+'</div><div class="ks red">on cancellations</div></div>'+
    '<div class="kpi k7"><div class="kl">Avg Down Pmt</div><div class="kv" style="color:#7c3aed">'+avgPmt.toFixed(1)+'%</div><div class="ks muted">avg % of program price</div></div>'+
    '<div class="kpi k8"><div class="kl">Total Program Value</div><div class="kv" style="color:#16a34a;font-size:18px">$'+Math.round(totalInv).toLocaleString()+'</div><div class="ks muted">inv total</div></div>';

  // Monthly trend
  var byMonth={};
  rows.forEach(function(r){
    var m=r[2];
    if(!byMonth[m])byMonth[m]={total:0,cancelled:0,entry_error:0,upgrade:0,active:0,inactive:0};
    byMonth[m].total++;
    if(r[6]==="Cancelled")byMonth[m].cancelled++;
    else if(r[6]==="Entry Error")byMonth[m].entry_error++;
    else if(r[6]==="Upgrade")byMonth[m].upgrade++;
    if(r[7]==="Active")byMonth[m].active++;
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
      {label:"Cancel %",data:months.map(function(m){var v=byMonth[m].total-byMonth[m].entry_error;return v>0?+(byMonth[m].cancelled/v*100).toFixed(1):0;}),
        type:"line",yAxisID:"y2",borderColor:"#f85149",backgroundColor:"rgba(248,81,73,0.07)",fill:true,tension:0.35,pointRadius:2,pointBackgroundColor:"#f85149",borderWidth:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},
      scales:{
        x:{stacked:true,ticks:{color:"#8b949e",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#21262d44"}},
        y:{stacked:true,ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},
        y2:{position:"right",ticks:{color:"#f85149",font:{size:10},callback:function(v){return v+"%";}},grid:{display:false}}
      }}
  });

  // Refund days for cancelled
  var rdMap={};
  rows.forEach(function(r){if(r[6]==="Cancelled"&&r[8]!=="none")rdMap[r[8]]=(rdMap[r[8]]||0)+1;});
  var rdK=["0","15","30","45","60","61"],rdL=["Same day","<=15d","<=30d","<=45d","<=60d","61+d"];
  ldpCharts.rd=new Chart(document.getElementById("ldp-rdChart"),{
    type:"bar",
    data:{labels:rdL,datasets:[{data:rdK.map(function(k){return rdMap[k]||0;}),backgroundColor:"rgba(248,81,73,0.75)",borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ctx.parsed.y+" cancellations";}}}},
      scales:{x:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},y:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}}}}
  });

  // Down payment % distribution
  var pctMap={};
  rows.forEach(function(r){pctMap[Math.round(r[5])]=(pctMap[Math.round(r[5])]||0)+1;});
  var pctBuckets={"<1%":0,"1-3%":0,"3-5%":0,"5-7%":0,"7-10%":0};
  rows.forEach(function(r){
    var p=r[5];
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
  rows.forEach(function(r){pcatMap[r[9]]=(pcatMap[r[9]]||0)+1;});
  var pcatKeys=Object.keys(pcatMap).sort(function(a,b){return pcatMap[b]-pcatMap[a];});
  ldpCharts.pcat=new Chart(document.getElementById("ldp-pcatChart"),{
    type:"doughnut",
    data:{labels:pcatKeys,datasets:[{data:pcatKeys.map(function(k){return pcatMap[k];}),backgroundColor:["#388bfd","#f85149","#3fb950","#e3b341","#bc8cff"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",plugins:{legend:{position:"right",labels:{color:"#8b949e",font:{size:11},boxWidth:10,padding:8}}}}
  });

  // Outcome donut
  var outcomeData=[active,cancelled,entryErr,upgrades,downgrades].filter(function(v){return v>0;});
  var outcomeLabels=["Active","Cancelled","Entry Error","Upgrades","Downgrades"].filter(function(_,i){return [active,cancelled,entryErr,upgrades,downgrades][i]>0;});
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
    var s=r[1];
    if(!skuMap[s])skuMap[s]={total:0,active:0,inactive:0,cancelled:0,entry_error:0,upgrade:0,inv:0,pay:0};
    skuMap[s].total++;
    if(r[7]==="Active")skuMap[s].active++;else skuMap[s].inactive++;
    if(r[6]==="Cancelled")skuMap[s].cancelled++;
    else if(r[6]==="Entry Error")skuMap[s].entry_error++;
    else if(r[6]==="Upgrade")skuMap[s].upgrade++;
    skuMap[s].inv+=r[3];skuMap[s].pay+=r[4];
  });
  var skuArr=Object.entries(skuMap).sort(function(a,b){return b[1].total-a[1].total;});
  var mx=Math.max.apply(null,skuArr.map(function(e){var v=e[1];var valid=v.total-v.entry_error;return valid>0?(v.cancelled/valid*100):0;}).concat([1]));
  var tRows="";
  skuArr.forEach(function(e){
    var s=e[0],v=e[1];
    var valid=v.total-v.entry_error;
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
  document.getElementById("ldp-tblInfo").textContent=skuArr.length+" SKUs · "+total.toLocaleString()+" records";

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
fetch("ldp_data.json").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
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
