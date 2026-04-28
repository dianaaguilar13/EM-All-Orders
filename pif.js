var PIF=null,pifCharts={},pifSelSku=new Set(),pifSelP=new Set();

// ── Multi-select helpers (SKU) ─────────────────────────────
function pifToggleSku(e){e.stopPropagation();var dr=document.getElementById("pif-skuDrop");dr.classList.toggle("open");if(dr.classList.contains("open")){document.getElementById("pif-skuQ").focus();pifRenderSkuItems();}}
function pifRenderSkuItems(){if(!PIF)return;var q=document.getElementById("pif-skuQ").value.toLowerCase();var vis=PIF.FL.skus.filter(function(s){return s.toLowerCase().indexOf(q)>=0;});var h="";vis.forEach(function(s){var ck=pifSelSku.has(s)?"checked":"";var e=s.replace(/&/g,"&amp;");h+='<div class="ms-item" data-s="'+e+'" onclick="pifTogSkuItem(this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";});document.getElementById("pif-skuItems").innerHTML=h;}
function pifTogSkuItem(el){var s=el.getAttribute("data-s");if(pifSelSku.has(s))pifSelSku.delete(s);else pifSelSku.add(s);pifUpdateSkuBtn();pifRenderSkuItems();}
function pifSkuAll(){PIF.FL.skus.filter(function(s){return s.toLowerCase().indexOf(document.getElementById("pif-skuQ").value.toLowerCase())>=0;}).forEach(function(s){pifSelSku.add(s);});pifUpdateSkuBtn();pifRenderSkuItems();}
function pifSkuClear(){pifSelSku.clear();pifUpdateSkuBtn();pifRenderSkuItems();}
function pifUpdateSkuBtn(){var btn=document.getElementById("pif-skuBtn");var cnt=document.getElementById("pif-skuCnt");if(pifSelSku.size===0){btn.textContent="All SKUs";cnt.style.display="none";}else{btn.textContent=pifSelSku.size===1?Array.from(pifSelSku)[0].slice(0,18):pifSelSku.size+" SKUs";cnt.textContent=pifSelSku.size;cnt.style.display="inline";}}

// ── Multi-select helpers (Partner) ────────────────────────
function pifToggleMs(e){e.stopPropagation();var dr=document.getElementById("pif-msDrop");dr.classList.toggle("open");if(dr.classList.contains("open")){document.getElementById("pif-msQ").focus();pifRenderMsItems();}}
function pifRenderMsItems(){if(!PIF)return;var q=document.getElementById("pif-msQ").value.toLowerCase();var vis=PIF.FL.partners.filter(function(p){return p.toLowerCase().indexOf(q)>=0;});var h="";vis.forEach(function(p){var ck=pifSelP.has(p)?"checked":"";var e=p.replace(/&/g,"&amp;").replace(/</g,"&lt;");h+='<div class="ms-item" data-p="'+e+'" onclick="pifTogP(this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";});document.getElementById("pif-msItems").innerHTML=h;}
function pifTogP(el){var p=el.getAttribute("data-p");if(pifSelP.has(p))pifSelP.delete(p);else pifSelP.add(p);pifUpdateMsBtn();pifRenderMsItems();}
function pifMsAll(){PIF.FL.partners.filter(function(p){return p.toLowerCase().indexOf(document.getElementById("pif-msQ").value.toLowerCase())>=0;}).forEach(function(p){pifSelP.add(p);});pifUpdateMsBtn();pifRenderMsItems();}
function pifMsClear(){pifSelP.clear();pifUpdateMsBtn();pifRenderMsItems();}
function pifUpdateMsBtn(){var btn=document.getElementById("pif-msBtn");var cnt=document.getElementById("pif-msCnt");if(pifSelP.size===0){btn.textContent="All Partners";cnt.style.display="none";}else{btn.textContent=pifSelP.size===1?Array.from(pifSelP)[0].slice(0,22):pifSelP.size+" partners";cnt.textContent=pifSelP.size;cnt.style.display="inline";}}

document.addEventListener("click",function(e){
  var sw=document.getElementById("pif-skuWrap");if(sw&&!sw.contains(e.target))document.getElementById("pif-skuDrop").classList.remove("open");
  var mw=document.getElementById("pif-msWrap");if(mw&&!mw.contains(e.target))document.getElementById("pif-msDrop").classList.remove("open");
});

// ── Filter helpers ─────────────────────────────────────────
function pifRange(){return{df:document.getElementById("pif-df").value.slice(0,7),dt:document.getElementById("pif-dt").value.slice(0,7)};}
function pifPcat(){return document.getElementById("pif-pcat").value;}
function pifDiv(){return document.getElementById("pif-div").value;}
function fmtM2(m){var p=m.split("-");return new Date(parseInt(p[0]),parseInt(p[1])-1).toLocaleString("default",{month:"short",year:"2-digit"});}

function pifApply(){["pif-skuDrop","pif-msDrop"].forEach(function(id){document.getElementById(id).classList.remove("open");});pifRender();}
function pifReset(){document.getElementById("pif-df").value="2022-01-01";document.getElementById("pif-dt").value="2026-04-28";["pif-pcat","pif-div"].forEach(function(id){document.getElementById(id).value="";});pifSelSku.clear();pifUpdateSkuBtn();pifSelP.clear();pifUpdateMsBtn();pifRender();}

// ── Get filtered monthly buckets ───────────────────────────
function pifGetMonthly(){
  var r=pifRange(),pcat=pifPcat(),div=pifDiv();
  var byM={};
  // Use M (global monthly) as base, filter by date
  Object.keys(PIF.M).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
    byM[m]=PIF.M[m];
  });
  // If partner/pcat/sku filter, need to recompute from P/S data
  // For simplicity use pre-aggregated P and PC monthly
  if(pifSelP.size>0||pcat||div||pifSelSku.size>0){
    byM={};
    // Recompute from S (sku) or P (partner) — use available aggregations
    // Since we don't have full row data in JS, approximate from available aggs
    // Use P[partner] totals filtered
  }
  return Object.keys(byM).sort().map(function(m){return{m:m,b:byM[m]};});
}

function pifGetTotals(){
  var r=pifRange(),pcat=pifPcat(),div=pifDiv();
  var src;
  if(pifSelP.size>0){
    var tot=[0,0,0,0.0,0.0];
    pifSelP.forEach(function(p){var v=PIF.P[p];if(v)for(var i=0;i<5;i++)tot[i]+=(v[i]||0);});
    return tot;
  }
  if(pcat) src=PIF.PC[pcat];
  else if(div) src=PIF.DIV[div];
  else {
    // Sum monthly by date range
    var tot=[0,0,0,0.0,0.0];
    Object.keys(PIF.M).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
      var v=PIF.M[m];if(v)for(var i=0;i<5;i++)tot[i]+=(v[i]||0);
    });
    return tot;
  }
  return src||[0,0,0,0,0];
}

function pifGetSkuData(){
  var r=pifRange(),pcat=pifPcat(),div=pifDiv();
  // Use S aggregation, filter by selected SKUs
  var src=PIF.S;
  return Object.entries(src)
    .filter(function(e){return pifSelSku.size===0||pifSelSku.has(e[0]);})
    .filter(function(e){return e[1][0]>=1;})
    .map(function(e){
      var s=e[0],v=e[1];
      return{sku:s,total:v[0],pif:v[1],pp:v[2],pif_inv:v[3],pp_inv:v[4],
        pifRate:v[0]>0?(v[1]/v[0]*100):0};
    }).sort(function(a,b){return b.total-a.total;});
}

// ── Destroy charts ─────────────────────────────────────────
function pifDestroyCharts(){Object.values(pifCharts).forEach(function(c){try{c.destroy();}catch(e){}});pifCharts={};}

// ── Main render ────────────────────────────────────────────
function pifRender(){
  if(!PIF)return;
  pifDestroyCharts();
  var r=pifRange();
  var tot=pifGetTotals();
  var T=tot[0],P=tot[1],PP=tot[2],PI=tot[3]||0,PPI=tot[4]||0;
  var pifRate=T>0?(P/T*100):0;
  var ppRate=T>0?(PP/T*100):0;

  document.getElementById("pif-rcLbl").textContent=T.toLocaleString()+" orders";

  // KPIs
  document.getElementById("pif-kpis").innerHTML=
    '<div class="kpi k1"><div class="kl">Total Orders</div><div class="kv">'+T.toLocaleString()+'</div><div class="ks muted">in date range</div></div>'+
    '<div class="kpi k6"><div class="kl">PIF</div><div class="kv" style="color:#3fb950">'+P.toLocaleString()+'</div><div class="ks green">'+pifRate.toFixed(1)+'% paid in full</div></div>'+
    '<div class="kpi k7"><div class="kl">PP</div><div class="kv" style="color:#bc8cff">'+PP.toLocaleString()+'</div><div class="ks muted">'+ppRate.toFixed(1)+'% payment plan</div></div>'+
    '<div class="kpi k2"><div class="kl">PIF Rate</div><div class="kv" style="color:#3fb950;font-size:28px">'+pifRate.toFixed(1)+'%</div><div class="ks muted">of all orders</div></div>'+
    '<div class="kpi k8"><div class="kl">PIF Revenue</div><div class="kv" style="color:#39d353;font-size:18px">$'+Math.round(PI).toLocaleString()+'</div><div class="ks muted">invoice value</div></div>'+
    '<div class="kpi k5"><div class="kl">PP Revenue</div><div class="kv" style="color:#bc8cff;font-size:18px">$'+Math.round(PPI).toLocaleString()+'</div><div class="ks muted">invoice value</div></div>';

  // Monthly trend
  var months=Object.keys(PIF.M).filter(function(m){return m>=r.df&&m<=r.dt;}).sort();
  var mLabels=months.map(fmtM2);
  pifCharts.trend=new Chart(document.getElementById("pif-trendChart"),{
    type:"bar",
    data:{labels:mLabels,datasets:[
      {label:"PIF",data:months.map(function(m){return PIF.M[m]?PIF.M[m][1]:0;}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
      {label:"PP",data:months.map(function(m){return PIF.M[m]?PIF.M[m][2]:0;}),backgroundColor:"rgba(188,140,255,0.8)",borderRadius:3,stack:"s"},
      {label:"PIF %",data:months.map(function(m){var v=PIF.M[m];return v&&v[0]>0?+(v[1]/v[0]*100).toFixed(1):0;}),
        type:"line",yAxisID:"y2",borderColor:"#3fb950",backgroundColor:"rgba(63,185,80,0.07)",
        fill:true,tension:0.35,pointRadius:2,pointBackgroundColor:"#3fb950",borderWidth:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},
      scales:{
        x:{stacked:true,ticks:{color:"#8b949e",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#21262d44"}},
        y:{stacked:true,ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},
        y2:{position:"right",ticks:{color:"#3fb950",font:{size:10},callback:function(v){return v+"%";}},grid:{display:false}}
      }}
  });

  // PIF vs PP donut
  pifCharts.donut=new Chart(document.getElementById("pif-donutChart"),{
    type:"doughnut",
    data:{labels:["PIF","PP"],datasets:[{data:[P,PP],backgroundColor:["#3fb950","#bc8cff"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"65%",
      plugins:{legend:{position:"bottom",labels:{color:"#8b949e",font:{size:12},boxWidth:12,padding:12}},
        tooltip:{callbacks:{label:function(ctx){var v=ctx.raw,t=P+PP;return ctx.label+": "+v.toLocaleString()+" ("+( t>0?(v/t*100).toFixed(1):0)+"%)";}}}}
    }
  });

  // By division bar
  var divs=["LS","L&R","HWB","B&L","Other"];
  var divData=divs.map(function(d){var v=PIF.DIV[d]||[0,0,0];return{d:d,total:v[0],pif:v[1],pp:v[2],rate:v[0]>0?(v[1]/v[0]*100):0};}).filter(function(x){return x.total>0;});
  pifCharts.div=new Chart(document.getElementById("pif-divChart"),{
    type:"bar",
    data:{labels:divData.map(function(x){return x.d;}),datasets:[
      {label:"PIF %",data:divData.map(function(x){return +x.rate.toFixed(1);}),backgroundColor:divData.map(function(x){return x.rate>=95?"rgba(63,185,80,0.85)":x.rate>=80?"rgba(56,139,253,0.85)":"rgba(188,140,255,0.85)";}),borderRadius:4}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){var d=divData[ctx.dataIndex];return"PIF: "+d.pif.toLocaleString()+" / "+d.total.toLocaleString()+" ("+ctx.parsed.y+"%)";  }}}},
      scales:{x:{ticks:{color:"#8b949e",font:{size:11}},grid:{display:false}},
              y:{ticks:{color:"#8b949e",font:{size:10},callback:function(v){return v+"%";}},grid:{color:"#21262d44"},max:100}}}
  });

  // Partner category bar
  var pcatData=Object.entries(PIF.PC).map(function(e){var v=e[1];return{pc:e[0],total:v[0],pif:v[1],pp:v[2],rate:v[0]>0?(v[1]/v[0]*100):0};}).filter(function(x){return x.total>0;}).sort(function(a,b){return b.total-a.total;});
  pifCharts.pcat=new Chart(document.getElementById("pif-pcatChart"),{
    type:"bar",
    data:{labels:pcatData.map(function(x){return x.pc;}),datasets:[
      {label:"PIF",data:pcatData.map(function(x){return x.pif;}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
      {label:"PP",data:pcatData.map(function(x){return x.pp;}),backgroundColor:"rgba(188,140,255,0.8)",borderRadius:3,stack:"s"}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},
      scales:{x:{stacked:true,ticks:{color:"#8b949e",font:{size:10}},grid:{display:false}},
              y:{stacked:true,ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}}}}
  });

  // SKU table
  var skuArr=pifGetSkuData();
  var top30=skuArr.slice(0,30);
  var mx=Math.max.apply(null,top30.map(function(s){return s.pifRate;}).concat([1]));
  var tRows=top30.map(function(s){
    var cl=s.pifRate>=95?"#3fb950":s.pifRate>=80?"#58a6ff":"#bc8cff";
    var bg=s.pifRate>=95?"#3fb950":s.pifRate>=80?"#388bfd":"#bc8cff";
    return"<tr><td><span class='pill'>"+s.sku+"</span></td>"+
      "<td class='num'>"+s.total.toLocaleString()+"</td>"+
      "<td class='num' style='color:#3fb950'>"+s.pif.toLocaleString()+"</td>"+
      "<td class='num' style='color:#bc8cff'>"+s.pp.toLocaleString()+"</td>"+
      "<td><div class='bw'><div class='bb'><div class='bf' style='width:"+(s.pifRate/100*100).toFixed(0)+"%;background:"+bg+"'></div></div>"+
      "<span class='num' style='min-width:42px;font-size:11px;color:"+cl+"'>"+s.pifRate.toFixed(1)+"%</span></div></td>"+
      "<td class='num' style='color:#8b949e'>$"+Math.round(s.pif_inv).toLocaleString()+"</td>"+
      "<td class='num' style='color:#8b949e'>$"+Math.round(s.pp_inv).toLocaleString()+"</td></tr>";
  }).join("");
  document.getElementById("pif-skuTbody").innerHTML=tRows;
  document.getElementById("pif-tblInfo").textContent=skuArr.length+" SKUs · "+T.toLocaleString()+" orders";

  // Show content
  document.getElementById("pif-loading").style.display="none";
  document.getElementById("pif-main").style.display="block";
}

// ── Load data ──────────────────────────────────────────────
fetch("pif_data.json").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
  .then(function(data){
    PIF=data;
    pifRenderSkuItems();
    pifRenderMsItems();
    pifRender();
  })
  .catch(function(err){
    document.getElementById("pif-loading").innerHTML='<div style="color:#f85149">Failed to load pif_data.json: '+err.message+"</div>";
  });
