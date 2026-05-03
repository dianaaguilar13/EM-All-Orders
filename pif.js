var PIF=null,pifCharts={},pifSelSku=new Set(),pifSelP=new Set();
var PIF_ROWS=null; // lazy loaded detail records
var pifExpandedSku=null; // currently expanded SKU row
var pifTreePath=[]; // stores labels: ["PIF","Active","LS",...]
var PIF_LEVEL_TITLES=["Total Orders","Payment Type","Active Status","Division","Month"];

// ── Multi-select SKU ───────────────────────────────────────
function pifToggleSku(e){e.stopPropagation();var dr=document.getElementById("pif-skuDrop");dr.classList.toggle("open");if(dr.classList.contains("open")){document.getElementById("pif-skuQ").focus();pifRenderSkuItems();}}
function pifRenderSkuItems(){if(!PIF)return;var q=document.getElementById("pif-skuQ").value.toLowerCase();var vis=PIF.FL.skus.filter(function(s){return s.toLowerCase().indexOf(q)>=0;});var h="";vis.forEach(function(s){var ck=pifSelSku.has(s)?"checked":"";var e=s.replace(/&/g,"&amp;");h+='<div class="ms-item" data-s="'+e+'" onclick="pifTogSkuItem(this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";});document.getElementById("pif-skuItems").innerHTML=h;}
function pifTogSkuItem(el){var s=el.getAttribute("data-s");if(pifSelSku.has(s))pifSelSku.delete(s);else pifSelSku.add(s);pifUpdateSkuBtn();pifRenderSkuItems();}
function pifSkuAll(){PIF.FL.skus.filter(function(s){return s.toLowerCase().indexOf(document.getElementById("pif-skuQ").value.toLowerCase())>=0;}).forEach(function(s){pifSelSku.add(s);});pifUpdateSkuBtn();pifRenderSkuItems();}
function pifSkuClear(){pifSelSku.clear();pifUpdateSkuBtn();pifRenderSkuItems();}
function pifUpdateSkuBtn(){var btn=document.getElementById("pif-skuBtn");var cnt=document.getElementById("pif-skuCnt");if(pifSelSku.size===0){btn.textContent="All SKUs";cnt.style.display="none";}else{btn.textContent=pifSelSku.size===1?Array.from(pifSelSku)[0].slice(0,18):pifSelSku.size+" SKUs";cnt.textContent=pifSelSku.size;cnt.style.display="inline";}}

// ── Multi-select Partner ───────────────────────────────────
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
function pifActFilter(){return document.getElementById("pif-act").value;}
function fmtM2(m){var p=m.split("-");return new Date(parseInt(p[0]),parseInt(p[1])-1).toLocaleString("default",{month:"short",year:"2-digit"});}

function pifApply(){["pif-skuDrop","pif-msDrop"].forEach(function(id){document.getElementById(id).classList.remove("open");});pifRender();}
function pifReset(){document.getElementById("pif-df").value="2026-04-01";document.getElementById("pif-dt").value="2026-04-28";["pif-pcat","pif-div","pif-act"].forEach(function(id){document.getElementById(id).value="";});pifSelSku.clear();pifUpdateSkuBtn();pifSelP.clear();pifUpdateMsBtn();pifRender();}

// Get totals applying all filters
function pifGetTotals(){
  // Derive totals by summing pifGetSkuData (ensures KPIs match SKU table)
  var skuArr=pifGetSkuData();
  if(skuArr.length>0){
    var tot=[0,0,0,0,0.0,0.0,0.0,0,0,0,0,0,0];
    skuArr.forEach(function(s){
      tot[0]+=s.total; tot[1]+=s.pif; tot[2]+=s.pp; tot[3]+=s.late;
      tot[4]+=s.pifInv; tot[5]+=s.ppInv; tot[6]+=s.lateInv;
    });
    return tot;
  }
  // Fallback: sum monthly data
  var ts=pifGetMonthly();
  var tot=[0,0,0,0,0,0,0,0,0,0,0,0,0];
  ts.forEach(function(x){var v=x.b;if(v)for(var i=0;i<13;i++)tot[i]+=(v[i]||0);});
  return tot;
}

function pifGetMonthly(){
  var r=pifRange(),pcat=pifPcat(),div=pifDiv(),act=pifActFilter();
  var empty=[0,0,0,0,0,0,0,0,0,0,0,0,0];
  var skuArr=Array.from(pifSelSku);
  var hasSku=skuArr.length>0;
  var hasP=pifSelP.size>0;
  var partArr=Array.from(pifSelP);

  function applyAct(b){
    if(!act||!b)return b;
    if(act==="Active"){
      // Use exact active breakdowns: b[7]=active_total, b[9]=active_pif, b[10]=active_pp
      var n=b[7]||0,apif=b[9]||0,app=b[10]||0,alate=Math.max(0,n-apif-app);
      var ratio=b[0]>0?n/b[0]:0;
      return[n,apif,app,alate,(b[4]||0)*ratio,(b[5]||0)*ratio,(b[6]||0)*ratio,n,0];
    } else {
      // Inactive: b[8]=inactive_total, b[11]=inactive_pif, b[12]=inactive_pp
      var n=b[8]||0,ipif=b[11]||0,ipp=b[12]||0,ilate=Math.max(0,n-ipif-ipp);
      var ratio=b[0]>0?n/b[0]:0;
      return[n,ipif,ipp,ilate,(b[4]||0)*ratio,(b[5]||0)*ratio,(b[6]||0)*ratio,0,n];
    }
  }

  function buildFromSrc(srcMap){
    // srcMap = {month: bucket}
    var byM={};
    Object.keys(srcMap).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
      byM[m]=srcMap[m];
    });
    return Object.keys(byM).sort().map(function(m){return{m:m,b:applyAct(byM[m])};}).filter(function(x){return x.b[0]>0;});
  }

  function mergeSources(sources){
    var byM={};
    sources.forEach(function(src){
      Object.keys(src).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
        if(!byM[m])byM[m]=[0,0,0,0,0.0,0.0,0.0,0,0,0,0,0,0];
        var v=src[m];for(var i=0;i<13;i++)byM[m][i]+=(v[i]||0);
      });
    });
    return Object.keys(byM).sort().map(function(m){return{m:m,b:applyAct(byM[m])};}).filter(function(x){return x.b[0]>0;});
  }

  // PRIORITY 1: SKU + Pcat
  if(hasSku&&pcat){
    var sources=[];
    skuArr.forEach(function(sku){
      var src=((PIF.SMNPC&&PIF.SMNPC[sku])||{})[pcat]||{};
      sources.push(src);
    });
    return mergeSources(sources);
  }

  // PRIORITY 2: SKU + Partner
  if(hasSku&&hasP){
    var sources=[];
    partArr.forEach(function(p){
      skuArr.forEach(function(sku){
        var src=(((PIF.PMSKU&&PIF.PMSKU[p])||{})[sku])||{};
        sources.push(src);
      });
    });
    return mergeSources(sources);
  }

  // PRIORITY 3: SKU only
  if(hasSku){
    var sources=[];
    skuArr.forEach(function(sku){
      sources.push((PIF.SMN&&PIF.SMN[sku])||{});
    });
    return mergeSources(sources);
  }

  // PRIORITY 4: Partner only
  if(hasP){
    var sources=[];
    partArr.forEach(function(p){sources.push((PIF.PM&&PIF.PM[p])||{});});
    return mergeSources(sources);
  }

  // PRIORITY 5: Pcat only
  if(pcat) return buildFromSrc((PIF.PCM&&PIF.PCM[pcat])||{});

  // PRIORITY 6: Division only
  if(div) return buildFromSrc(PIF.MDIV[div]||{});

  // PRIORITY 7: Global
  return buildFromSrc(PIF.M);
}


function pifGetTotals(){
  // Derive totals by summing pifGetSkuData (ensures KPIs match SKU table)
  var skuArr=pifGetSkuData();
  if(skuArr.length>0){
    var tot=[0,0,0,0,0.0,0.0,0.0,0,0,0,0,0,0];
    skuArr.forEach(function(s){
      tot[0]+=s.total; tot[1]+=s.pif; tot[2]+=s.pp; tot[3]+=s.late;
      tot[4]+=s.pifInv; tot[5]+=s.ppInv; tot[6]+=s.lateInv;
    });
    return tot;
  }
  // Fallback: sum monthly data
  var ts=pifGetMonthly();
  var tot=[0,0,0,0,0,0,0,0,0,0,0,0,0];
  ts.forEach(function(x){var v=x.b;if(v)for(var i=0;i<13;i++)tot[i]+=(v[i]||0);});
  return tot;
}

function pifGetMonthly(){
  var r=pifRange(),pcat=pifPcat(),div=pifDiv();
  var empty=[0,0,0,0,0,0,0,0,0,0,0,0,0];
  if(div){
    var dData=PIF.MDIV[div]||{};
    var months=Object.keys(dData).filter(function(m){return m>=r.df&&m<=r.dt;}).sort();
    return months.map(function(m){return{m:m,b:dData[m]||empty};});
  }
  if(pcat){
    var pcData=(PIF.PCM&&PIF.PCM[pcat])||{};
    if(Object.keys(pcData).length>0){
      var months=Object.keys(pcData).filter(function(m){return m>=r.df&&m<=r.dt;}).sort();
      return months.map(function(m){return{m:m,b:pcData[m]||empty};});
    }
  }
  var months=Object.keys(PIF.M).filter(function(m){return m>=r.df&&m<=r.dt;}).sort();
  return months.map(function(m){return{m:m,b:PIF.M[m]||empty};});
}

function pifGetSkuData(){
  var r=pifRange(),pcat=pifPcat(),div=pifDiv(),act=pifActFilter();

  // Determine source
  var skuTotals={};

  if(pcat&&PIF.SMNPC){
    // Use SMNPC filtered by pcat
    var skus=pifSelSku.size>0?Array.from(pifSelSku):Object.keys(PIF.SMNPC);
    skus.forEach(function(sku){
      var src=((PIF.SMNPC[sku])||{})[pcat]||{};
      Object.keys(src).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
        if(!skuTotals[sku])skuTotals[sku]=[0,0,0,0,0.0,0.0,0.0,0,0,0,0,0,0];
        var v=src[m];for(var i=0;i<13;i++)skuTotals[sku][i]+=(v[i]||0);
      });
    });
  } else if(PIF.SMN){
    var skus=pifSelSku.size>0?Array.from(pifSelSku):Object.keys(PIF.SMN);
    skus.forEach(function(sku){
      var sm=PIF.SMN[sku]||{};
      Object.keys(sm).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
        if(!skuTotals[sku])skuTotals[sku]=[0,0,0,0,0.0,0.0,0.0,0,0,0,0,0,0];
        var v=sm[m];for(var i=0;i<7;i++)skuTotals[sku][i]+=(v[i]||0);
        var gv=PIF.M[m]||[0,0,0,0,0,0,0,0,0,0,0,0,0];
        var ar=gv[0]>0?(gv[7]||0)/gv[0]:0.9;
        skuTotals[sku][7]+=Math.round((v[0]||0)*ar);
        skuTotals[sku][8]+=Math.round((v[0]||0)*(1-ar));
      });
    });
  } else {
    Object.entries(PIF.S).forEach(function(e){
      if(pifSelSku.size>0&&!pifSelSku.has(e[0]))return;
      skuTotals[e[0]]=e[1];
    });
  }

  var act2=pifActFilter();
  return Object.entries(skuTotals)
    .filter(function(e){return e[1][0]>0;})
    .map(function(e){
      var s=e[0],v=e[1];
      // Apply active filter using exact counts (indices 7-12)
      var total,pif,pp,late,pifInv,ppInv,lateInv;
      if(act2==="Active"){
        total=v[7]||0; pif=v[9]||0; pp=v[10]||0; late=Math.max(0,total-pif-pp);
      } else if(act2==="Inactive"){
        total=v[8]||0; pif=v[11]||0; pp=v[12]||0; late=Math.max(0,total-pif-pp);
      } else {
        total=v[0]; pif=v[1]; pp=v[2]; late=v[3];
      }
      var ratio=v[0]>0?total/v[0]:0;
      pifInv=(v[4]||0)*ratio; ppInv=(v[5]||0)*ratio; lateInv=(v[6]||0)*ratio;
      return{sku:s,total:total,pif:pif,pp:pp,late:late,
        pifInv:pifInv,ppInv:ppInv,lateInv:lateInv,
        pifRate:total>0?((pif+late)/total*100):0};
    }).filter(function(e){return e.total>0;}).sort(function(a,b){return b.total-a.total;});
}


function pifDestroyCharts(){Object.values(pifCharts).forEach(function(c){try{c.destroy();}catch(e){}});pifCharts={};}

function pifRender(){
  if(!PIF)return;
  pifDestroyCharts();
  var r=pifRange();
  var tot=pifGetTotals();
  // Bucket: [total, pif, pp, pif_late, pif_inv, pp_inv, pif_late_inv, active, inactive]
  var T=tot[0],P=tot[1],PP=tot[2],PL=tot[3],PI=tot[4]||0,PPI=tot[5]||0,PLI=tot[6]||0;
  var allPif=P+PL;
  var pifRate=T>0?(allPif/T*100):0;
  var ppRate=T>0?(PP/T*100):0;
  var lateRate=T>0?(PL/T*100):0;

  document.getElementById("pif-rcLbl").textContent=T.toLocaleString()+" orders";

  document.getElementById("pif-kpis").innerHTML=
    '<div class="kpi k1"><div class="kl">Total Orders</div><div class="kv">'+T.toLocaleString()+'</div><div class="ks muted">PAYMENTS_TOTAL &gt; 0</div></div>'+
    '<div class="kpi k6"><div class="kl">PIF (on time)</div><div class="kv" style="color:#3fb950">'+P.toLocaleString()+'</div><div class="ks green">'+(T>0?(P/T*100).toFixed(1):0)+'% same day</div></div>'+
    '<div class="kpi k5"><div class="kl">PIF (after 30d)</div><div class="kv" style="color:#e3b341">'+PL.toLocaleString()+'</div><div class="ks amber">'+lateRate.toFixed(1)+'% late PIF</div></div>'+
    '<div class="kpi k7"><div class="kl">PP</div><div class="kv" style="color:#bc8cff">'+PP.toLocaleString()+'</div><div class="ks muted">'+ppRate.toFixed(1)+'% payment plan</div></div>'+
    '<div class="kpi k2"><div class="kl">Total PIF Rate</div><div class="kv" style="color:#3fb950;font-size:28px">'+pifRate.toFixed(1)+'%</div><div class="ks muted">incl. late PIF</div></div>'+
    '<div class="kpi k8"><div class="kl">PIF Revenue</div><div class="kv" style="color:#39d353;font-size:17px">$'+Math.round(PI+PLI).toLocaleString()+'</div><div class="ks muted">total PIF inv value</div></div>';

  // Monthly trend
  var ts=pifGetMonthly();
  var mLabels=ts.map(function(x){return fmtM2(x.m);});
  pifCharts.trend=new Chart(document.getElementById("pif-trendChart"),{
    type:"bar",
    data:{labels:mLabels,datasets:[
      {label:"PIF",data:ts.map(function(x){return x.b[1]||0;}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
      {label:"PIF Late",data:ts.map(function(x){return x.b[3]||0;}),backgroundColor:"rgba(227,179,65,0.8)",borderRadius:3,stack:"s"},
      {label:"PP",data:ts.map(function(x){return x.b[2]||0;}),backgroundColor:"rgba(188,140,255,0.8)",borderRadius:3,stack:"s"},
      {label:"PIF %",data:ts.map(function(x){var t=x.b[0],p=(x.b[1]||0)+(x.b[3]||0);return t>0?+(p/t*100).toFixed(1):0;}),
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

  // Decomp tree
  PIF_DECOMP_PATH=[];
  pifRenderDecomp();

  // Donut: PIF on time / PIF late / PP
  pifCharts.donut=new Chart(document.getElementById("pif-donutChart"),{
    type:"doughnut",
    data:{labels:["PIF on time","PIF after 30d","PP"],
          datasets:[{data:[P,PL,PP],backgroundColor:["#3fb950","#e3b341","#bc8cff"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",
      plugins:{legend:{position:"bottom",labels:{color:"#8b949e",font:{size:11},boxWidth:10,padding:8}},
        tooltip:{callbacks:{label:function(ctx){var v=ctx.raw;return ctx.label+": "+v.toLocaleString()+" ("+(T>0?(v/T*100).toFixed(1):0)+"%)";}}}}
    }
  });

  // Division bar - fully filtered via MDIV+SMNPC
  var r_div=pifRange(),pcat_div=pifPcat();
  var divs=["LS","L&R","HWB","B&L","Other"];
  var divTotals={};
  if(pifSelSku.size>0&&pcat_div){
    // SKU+Pcat: use SMNPC but need division breakdown - approximate from MDIV ratios
    pifSelSku.forEach(function(sku){
      divs.forEach(function(d){
        var mdivSrc=(PIF.MDIV[d]&&PIF.MDIV[d])||{};
        var smnpcSrc=((PIF.SMNPC&&PIF.SMNPC[sku])||{})[pcat_div]||{};
        // Get months in range for this combo
        Object.keys(smnpcSrc).filter(function(m){return m>=r_div.df&&m<=r_div.dt;}).forEach(function(m){
          var v=smnpcSrc[m];
          var dv=mdivSrc[m]||[0,0,0,0,0,0,0,0,0,0,0,0,0];
          var ratio=dv[0]>0?(dv[0]/((PIF.M[m]||[1])[0]||1)):0;
          if(!divTotals[d])divTotals[d]={total:0,pif:0,pp:0};
          var approx=Math.round((v[0]||0)*ratio);
          divTotals[d].total+=approx;
          divTotals[d].pif+=Math.round(((v[1]||0)+(v[3]||0))*ratio);
          divTotals[d].pp+=Math.round((v[2]||0)*ratio);
        });
      });
    });
  } else {
    // Use filtered monthly data summed per division
    divs.forEach(function(d){
      var src=(PIF.MDIV[d])||{};
      var t=0,p=0,pp=0;
      Object.keys(src).filter(function(m){return m>=r_div.df&&m<=r_div.dt;}).forEach(function(m){
        var v=src[m]||[0,0,0,0];t+=(v[0]||0);p+=(v[1]||0)+(v[3]||0);pp+=(v[2]||0);
      });
      if(t>0)divTotals[d]={total:t,pif:p,pp:pp};
    });
    if(pcat_div){
      // Scale by pcat share from PCM
      var pcm=PIF.PCM&&PIF.PCM[pcat_div]||{};
      var pcTotal={};
      var gTotal={};
      Object.keys(pcm).filter(function(m){return m>=r_div.df&&m<=r_div.dt;}).forEach(function(m){
        pcTotal[m]=(pcm[m]||[0])[0]||0;
        gTotal[m]=(PIF.M[m]||[1])[0]||1;
      });
      divs.forEach(function(d){
        if(!divTotals[d])return;
        var ratio=0,cnt=0;
        Object.keys(pcTotal).forEach(function(m){if(gTotal[m]>0){ratio+=pcTotal[m]/gTotal[m];cnt++;}});
        ratio=cnt>0?ratio/cnt:0;
        divTotals[d].total=Math.round(divTotals[d].total*ratio);
        divTotals[d].pif=Math.round(divTotals[d].pif*ratio);
        divTotals[d].pp=Math.round(divTotals[d].pp*ratio);
      });
    }
  }
  var divData=divs.map(function(d){var v=divTotals[d]||{total:0,pif:0,pp:0};return{d:d,total:v.total,pif:v.pif,pp:v.pp,rate:v.total>0?(v.pif/v.total*100):0};}).filter(function(x){return x.total>0;});
  pifCharts.div=new Chart(document.getElementById("pif-divChart"),{
    type:"bar",
    data:{labels:divData.map(function(x){return x.d;}),datasets:[
      {label:"PIF %",data:divData.map(function(x){return +x.rate.toFixed(1);}),
        backgroundColor:divData.map(function(x){return x.rate>=95?"rgba(63,185,80,0.85)":x.rate>=80?"rgba(56,139,253,0.85)":"rgba(188,140,255,0.85)";}),borderRadius:4}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){var d=divData[ctx.dataIndex];return"PIF: "+d.pif.toLocaleString()+" / "+d.total.toLocaleString()+" ("+ctx.parsed.y+"%)";  }}}},
      scales:{x:{ticks:{color:"#8b949e",font:{size:12}},grid:{display:false}},
              y:{ticks:{color:"#8b949e",font:{size:10},callback:function(v){return v+"%";}},grid:{color:"#21262d44"},max:100}}}
  });

  // Partner category - use SMNPC when SKU selected, else PCM
  var r3=pifRange();
  var pcatTotals={};
  if(pifSelSku.size>0){
    // When SKU filter active, sum SMNPC across all pcats for selected SKUs
    pifSelSku.forEach(function(sku){
      Object.keys((PIF.SMNPC&&PIF.SMNPC[sku])||{}).forEach(function(pc){
        var src=PIF.SMNPC[sku][pc];
        Object.keys(src).filter(function(m){return m>=r3.df&&m<=r3.dt;}).forEach(function(m){
          var v=src[m];
          if(!pcatTotals[pc])pcatTotals[pc]={total:0,pif:0,pp:0};
          pcatTotals[pc].total+=(v[0]||0);
          pcatTotals[pc].pif+=(v[1]||0)+(v[3]||0);
          pcatTotals[pc].pp+=(v[2]||0);
        });
      });
    });
  } else {
    Object.keys(PIF.PCM||{}).forEach(function(pc){
      var pm=PIF.PCM[pc];
      Object.keys(pm).filter(function(m){return m>=r3.df&&m<=r3.dt;}).forEach(function(m){
        var v=pm[m];
        if(!pcatTotals[pc])pcatTotals[pc]={total:0,pif:0,pp:0};
        pcatTotals[pc].total+=(v[0]||0);
        pcatTotals[pc].pif+=(v[1]||0)+(v[3]||0);
        pcatTotals[pc].pp+=(v[2]||0);
      });
    });
  }
  var pcatData=Object.entries(pcatTotals).filter(function(e){return e[1].total>0;}).map(function(e){return{pc:e[0],total:e[1].total,pif:e[1].pif,pp:e[1].pp,rate:e[1].total>0?(e[1].pif/e[1].total*100):0};}).sort(function(a,b){return b.total-a.total;});
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
  var r4=pifRange(),pcat4=pifPcat();

  // SKU category lookup from ROWS data (lazy-loaded)
  function getSkuCat(sku){
    if(!PIF_ROWS||!PIF_ROWS.rows[sku]||!PIF_ROWS.rows[sku].length)return"";
    var catIdx=PIF_ROWS.rows[sku][0][2];
    return PIF_ROWS.cats[catIdx]||"";
  }

  var tRows="";
  skuArr.forEach(function(s){
    var cl=s.pifRate>=95?"#3fb950":s.pifRate>=80?"#58a6ff":"#bc8cff";
    var bg=s.pifRate>=95?"#3fb950":s.pifRate>=80?"#388bfd":"#bc8cff";
    var safeId=s.sku.replace(/[^a-zA-Z0-9]/g,"_");
    var cat=getSkuCat(s.sku);
    var skuEsc=s.sku.replace(/&/g,"&amp;").replace(/"/g,"&quot;");
    tRows+="<tr style='cursor:pointer' data-sku='"+skuEsc+"' onclick='pifToggleSkuDetail(this.dataset.sku)'>"+
      "<td style='padding-left:8px'><span id='pif-expand-"+safeId+"' style='color:#388bfd;font-size:10px;margin-right:6px'>&#9654;</span><span class='pill'>"+s.sku+"</span></td>"+
      "<td style='font-size:11px;color:#8b949e'>"+cat+"</td>"+
      "<td class='num'>"+s.total.toLocaleString()+"</td>"+
      "<td class='num' style='color:#3fb950'>"+s.pif.toLocaleString()+"</td>"+
      "<td class='num' style='color:#e3b341'>"+s.late.toLocaleString()+"</td>"+
      "<td class='num' style='color:#bc8cff'>"+s.pp.toLocaleString()+"</td>"+
      "<td><div class='bw'><div class='bb'><div class='bf' style='width:"+s.pifRate.toFixed(0)+"%;background:"+bg+"'></div></div>"+
      "<span class='num' style='min-width:42px;font-size:11px;color:"+cl+"'>"+s.pifRate.toFixed(1)+"%</span></div></td>"+
      "<td class='num' style='color:#8b949e'>$"+Math.round(s.pifInv+s.lateInv).toLocaleString()+"</td>"+
      "<td class='num' style='color:#8b949e'>$"+Math.round(s.ppInv).toLocaleString()+"</td></tr>"+
      "<tr id='pif-detail-"+safeId+"' style='display:none'><td colspan='9' style='padding:0'></td></tr>";
  });
  document.getElementById("pif-skuTbody").innerHTML=tRows;
  document.getElementById("pif-tblInfo").innerHTML=
    skuArr.length+" SKUs &middot; "+T.toLocaleString()+" orders &nbsp;"+
    "<button onclick='pifDownloadAllCsv()' style='background:#21262d;border:1px solid #30363d;color:#3fb950;padding:3px 10px;border-radius:5px;font-size:11px;cursor:pointer'>&#11015; Download All CSV</button>";

document.getElementById("pif-loading").style.display="none";
  document.getElementById("pif-main").style.display="block";
}

// ── CSV Download ──────────────────────────────────────────
function pifDownloadCsv(sku){
  if(!PIF_ROWS)return;
  var r=pifRange(),pcat=pifPcat();
  var filtered=PIF_ROWS.filter(function(row){
    if(row[2]!==sku)return false;
    if(row[13]<r.df||row[13]>r.dt)return false;
    if(pcat&&row[4]!==pcat)return false;
    if(pifSelP.size>0&&!pifSelP.has(row[5]))return false;
    return true;
  });
  var headers=["Order ID","Contact ID","SKU","SKU Category","Partner Category","Referral Partner","Purchase Date","PIF/PP","Days to PIF","Inv Total","Payment","Enrollment Mentor","Division"];
  var csv=[headers.join(",")].concat(filtered.map(function(row){
    return row.slice(0,13).map(function(v){
      var s=String(v==null?"":v);
      return s.indexOf(",")>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;
    }).join(",");
  })).join("\n");
  var blob=new Blob([csv],{type:"text/csv"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="PIF_"+sku+"_"+r.df+"_"+r.dt+".csv";
  a.click();
}

function pifDownloadAllCsv(){
  if(!PIF_ROWS)return;
  var r=pifRange(),pcat=pifPcat();
  var filtered=PIF_ROWS.filter(function(row){
    if(row[13]<r.df||row[13]>r.dt)return false;
    if(pifSelSku.size>0&&!pifSelSku.has(row[2]))return false;
    if(pcat&&row[4]!==pcat)return false;
    if(pifSelP.size>0&&!pifSelP.has(row[5]))return false;
    return true;
  });
  var headers=["Order ID","Contact ID","SKU","SKU Category","Partner Category","Referral Partner","Purchase Date","PIF/PP","Days to PIF","Inv Total","Payment","Enrollment Mentor","Division"];
  var csv=[headers.join(",")].concat(filtered.map(function(row){
    return row.slice(0,13).map(function(v){
      var s=String(v==null?"":v);
      return s.indexOf(",")>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;
    }).join(",");
  })).join("\n");
  var blob=new Blob([csv],{type:"text/csv"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="PIF_all_"+r.df+"_"+r.dt+".csv";
  a.click();
}

function pifToggleSkuDetail(sku){
  var safeId=sku.replace(/[^a-zA-Z0-9]/g,"_");
  var row=document.getElementById("pif-detail-"+safeId);
  var icon=document.getElementById("pif-expand-"+safeId);
  if(!row)return;
  // Toggle: check data attribute
  if(row.getAttribute("data-open")==="1"){
    row.style.display="none";
    row.setAttribute("data-open","0");
    if(icon)icon.innerHTML="&#9654;";
    return;
  }
  // Load rows if needed, then render
  if(!PIF_ROWS){
    fetch("pif_rows.json").then(function(r){return r.json();}).then(function(data){
      PIF_ROWS=data;
      pifRenderSkuDetail(sku,safeId,row,icon);
    });
    return;
  }
  pifRenderSkuDetail(sku,safeId,row,icon);
}

function pifRenderSkuDetail(sku,safeId,row,icon){
  var r=pifRange(),pcat=pifPcat();
  var div=pifDiv(),act=pifActFilter();
  var allRows=(PIF_ROWS.rows[sku]||[]).filter(function(r2){
    if(r2[4]<r.df||r2[4]>r.dt)return false;
    if(pcat&&PIF_ROWS.pcats[r2[7]]!==pcat)return false;
    if(pifSelP.size>0&&!pifSelP.has(PIF_ROWS.parts[r2[8]]))return false;
    if(div&&PIF_ROWS.divs[r2[10]]!==div)return false;
    if(act==="Active"&&r2[12]!==0)return false;
    if(act==="Inactive"&&r2[12]!==1)return false;
    if(pifSelP.size>0&&!pifSelP.has(PIF_ROWS.parts[r2[8]]))return false;
    return true;
  });
  var clsLabels=["PIF","PP","PIF after 30d"];
  var clsColors=["#3fb950","#bc8cff","#e3b341"];

  // Build using DOM to avoid any quote issues
  var wrap=document.createElement("div");
  wrap.style.cssText="padding:10px 16px;background:#0d1117;border-top:1px solid #30363d";

  var header=document.createElement("div");
  header.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px";

  var info=document.createElement("span");
  info.style.cssText="font-size:11px;font-weight:600;color:#8b949e";
  info.textContent=allRows.length.toLocaleString()+" records for "+sku;

  var dlBtn=document.createElement("button");
  dlBtn.style.cssText="background:#21262d;border:1px solid #30363d;color:#3fb950;padding:3px 10px;border-radius:5px;font-size:11px;cursor:pointer";
  dlBtn.textContent="⬇ Download CSV";
  dlBtn.onclick=function(){pifDownloadSkuCsvRows(sku,allRows);};

  header.appendChild(info);
  header.appendChild(dlBtn);
  wrap.appendChild(header);

  var scrollDiv=document.createElement("div");
  scrollDiv.style.cssText="overflow-x:auto;max-height:320px;overflow-y:auto";

  var tbl=document.createElement("table");
  tbl.style.cssText="width:100%;border-collapse:collapse;min-width:700px";

  var cols=["Order ID","Contact ID","Purchase Date","PIF / PP","Days to PIF","CNCL Status","Active","Partner Category","Referral Partner","EM","Division"];
  var thead=document.createElement("thead");
  var hrow=document.createElement("tr");
  hrow.style.background="#161b22";
  cols.forEach(function(c){
    var th=document.createElement("th");
    th.style.cssText="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#8b949e;text-transform:uppercase;white-space:nowrap;position:sticky;top:0;background:#161b22";
    th.textContent=c;
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);
  tbl.appendChild(thead);

  var tbody=document.createElement("tbody");
  allRows.forEach(function(r2){
    var tr=document.createElement("tr");
    tr.style.borderBottom="1px solid #21262d40";
    var cnclColors=["#39d353","#f85149","#e3b341","#3fb950","#bc8cff","#58a6ff"];
    var cells=[
      {v:r2[0],c:"#8b949e"},
      {v:r2[1],c:"#8b949e"},
      {v:r2[3],c:"#e6edf3"},
      {v:clsLabels[r2[5]],c:clsColors[r2[5]],bold:true},
      {v:r2[6]>=0?r2[6]+"d":"-",c:"#8b949e"},
      {v:PIF_ROWS.cncls[r2[11]]||"",c:cnclColors[r2[11]||0],bold:true},
      {v:r2[12]===0?"Active":"Inactive",c:r2[12]===0?"#58a6ff":"#f85149",bold:true},
      {v:PIF_ROWS.pcats[r2[7]]||"",c:"#8b949e"},
      {v:PIF_ROWS.parts[r2[8]]||"",c:"#8b949e"},
      {v:PIF_ROWS.ems[r2[9]]||"",c:"#8b949e"},
      {v:PIF_ROWS.divs[r2[10]]||"",c:"#8b949e"}
    ];
    cells.forEach(function(cell){
      var td=document.createElement("td");
      td.style.cssText="padding:5px 10px;font-size:11px;color:"+cell.c+(cell.bold?";font-weight:600":"");
      td.textContent=cell.v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  scrollDiv.appendChild(tbl);
  wrap.appendChild(scrollDiv);

  var td=row.querySelector("td");
  td.innerHTML="";
  td.appendChild(wrap);
  row.style.display="";
  row.setAttribute("data-open","1");
  if(icon)icon.innerHTML="&#9660;";
}


// ── CSV Downloads ──────────────────────────────────────────
function pifRowsToCsv(rows2){
  var cls_labels=["PIF","PP","PIF after 30d"];
  var header=["Order ID","Contact ID","SKU","SKU Category","Purchase Date","PIF/PP","Days to PIF","CNCL Status","Active Status","Partner Category","Referral Partner","Enrollment Mentor","Division"];
  var lines=[header.join(",")];
  rows2.forEach(function(r2){
    var divLabel=PIF_ROWS.divs[r2[10]]||"";
    var cnclLabel=PIF_ROWS.cncls[r2[11]]||"";
    var actLabel=r2[12]===0?"Active":"Inactive";
    lines.push([
      r2[0],r2[1],
      '"'+(r2._sku||"").replace(/"/g,'""')+'"',
      '"'+(PIF_ROWS.cats[r2[2]]||"").replace(/"/g,'""')+'"',
      r2[3],
      cls_labels[r2[5]],
      r2[6]>=0?r2[6]:"",
      '"'+cnclLabel.replace(/"/g,'""')+'"',
      actLabel,
      '"'+(PIF_ROWS.pcats[r2[7]]||"").replace(/"/g,'""')+'"',
      '"'+(PIF_ROWS.parts[r2[8]]||"").replace(/"/g,'""')+'"',
      '"'+(PIF_ROWS.ems[r2[9]]||"").replace(/"/g,'""')+'"',
      divLabel
    ].join(","));
  });
  return lines.join("\n");
}

function pifDownloadCsv(csvStr, filename){
  var blob=new Blob([csvStr],{type:"text/csv"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
}

function pifDownloadSkuCsvRows(sku,rows2){
  var r=pifRange();
  var tagged=rows2.map(function(r2){var c=r2.slice();c._sku=sku;return c;});
  pifDownloadCsv(pifRowsToCsv(tagged),"pif_"+sku+"_"+r.df+"_"+r.dt+".csv");
}

function pifDownloadAllCsv(){
  pifLoadRows(function(){
    var r=pifRange(),pcat=pifPcat();
    var allRows=[];
    Object.keys(PIF_ROWS.rows).forEach(function(sku){
      (PIF_ROWS.rows[sku]||[]).filter(function(r2){
        if(r2[4]<r.df||r2[4]>r.dt)return false;
        if(pcat&&PIF_ROWS.pcats[r2[7]]!==pcat)return false;
        return true;
      }).forEach(function(r2){var c=r2.slice();c._sku=sku;allRows.push(c);});
    });
    allRows.sort(function(a,b){return a[3]>b[3]?-1:1;});
    pifDownloadCsv(pifRowsToCsv(allRows),"pif_all_"+r.df+"_"+r.dt+".csv");
  });
}

// ── Load ───────────────────────────────────────────────────
fetch("pif_data.json?v=1777488693").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
  .then(function(data){PIF=data;pifRenderSkuItems();pifRenderMsItems();pifRender();})
  .catch(function(err){document.getElementById("pif-loading").innerHTML='<div style="color:#f85149">Failed to load pif_data.json: '+err.message+"</div>";});// ── Decomp Tree ────────────────────────────────────────────
var PIF_DECOMP_PATH = []; // [{dim, label, value}]
// dim options: "cls", "act", "div", "sku", "pcat", "month"
var PIF_DIM_LABELS = {
  "cls":   "Payment Type",
  "act":   "Active Status",
  "div":   "Division",
  "sku":   "SKU",
  "pcat":  "Partner Category",
  "month": "Month"
};
var PIF_DIM_ORDER = ["cls","act","div","sku","pcat","month"];

function pifCountFiltered(node,depth,df,dt){
  if(!node)return 0;
  if(typeof node==="number")return node;
  if(depth===0)return 0;
  if(depth===1){var t=0;Object.keys(node).forEach(function(m){if(m>=df&&m<=dt)t+=node[m];});return t;}
  var t=0;Object.values(node).forEach(function(v){t+=pifCountFiltered(v,depth-1,df,dt);});return t;
}

// Get items for a given dimension, filtered by current path selections
function pifDecompGetItems(dim){
  var r=pifRange(),df=r.df,dt=r.dt;
  var ts=pifGetMonthly();
  var totalFiltered=ts.reduce(function(s,x){return s+(x.b[0]||0);},0);

  // Helper: apply path filters to monthly series
  function getFilteredSeries(extraClsFilter, extraActFilter){
    return ts.map(function(x){
      var b=x.b||[0,0,0,0,0,0,0,0,0,0,0,0,0];
      var total=b[0]||0;
      if(total===0)return null;
      // Apply cls filter from path
      var clsRatio=1;
      if(extraClsFilter){
        var clsC=extraClsFilter==="PIF"?(b[1]||0):extraClsFilter==="PIF_LATE"?(b[3]||0):(b[2]||0);
        clsRatio=total>0?clsC/total:0;
        total=clsC;
      }
      // Apply act filter from path
      if(extraActFilter){
        var actC=extraActFilter==="Active"?(b[7]||0):(b[8]||0);
        total=extraClsFilter?Math.round(total*(actC/(b[0]||1))):actC;
      }
      return{m:x.m,total:total,b:b,clsRatio:clsRatio};
    }).filter(function(x){return x&&x.total>0;});
  }

  // Get applied path selections
  var selCls=null,selAct=null,selDiv=null,selSku=null,selPcat=null;
  PIF_DECOMP_PATH.forEach(function(p){
    if(p.dim==="cls")selCls=p.value;
    else if(p.dim==="act")selAct=p.value;
    else if(p.dim==="div")selDiv=p.value;
    else if(p.dim==="sku")selSku=p.value;
    else if(p.dim==="pcat")selPcat=p.value;
  });

  var clsMap={"PIF":"PIF (on time)","PP":"PP (payment plan)","PIF_LATE":"PIF (after 30 days)"};
  var clsColors={"PIF":"#3fb950","PP":"#bc8cff","PIF_LATE":"#e3b341"};
  var divColors={"LS":"#388bfd","L&R":"#f85149","HWB":"#e3b341","B&L":"#3fb950","Other":"#8b949e"};
  var actColors={"Active":"#58a6ff","Inactive":"#f85149"};

  if(dim==="cls"){
    var tot=pifGetTotals();
    return[
      {label:"PIF (on time)",value:"PIF",count:tot[1]||0,color:"#3fb950"},
      {label:"PIF (after 30 days)",value:"PIF_LATE",count:tot[3]||0,color:"#e3b341"},
      {label:"PP (payment plan)",value:"PP",count:tot[2]||0,color:"#bc8cff"}
    ].filter(function(x){return x.count>0;});
  }

  if(dim==="act"){
    var tot=pifGetTotals();
    var total=tot[0]||1;
    // If cls selected, scale active/inactive
    if(selCls){
      var clsC=selCls==="PIF"?(tot[1]||0):selCls==="PIF_LATE"?(tot[3]||0):(tot[2]||0);
      var ratio=total>0?clsC/total:0;
      return[
        {label:"Active",value:"Active",count:Math.round((tot[7]||0)*ratio),color:"#58a6ff"},
        {label:"Inactive",value:"Inactive",count:Math.round((tot[8]||0)*ratio),color:"#f85149"}
      ].filter(function(x){return x.count>0;});
    }
    return[
      {label:"Active",value:"Active",count:tot[7]||0,color:"#58a6ff"},
      {label:"Inactive",value:"Inactive",count:tot[8]||0,color:"#f85149"}
    ].filter(function(x){return x.count>0;});
  }

  if(dim==="month"){
    var clsIdx=selCls==="PIF"?1:selCls==="PIF_LATE"?3:selCls==="PP"?2:0;
    return ts.map(function(x){
      var b=x.b||[];
      var v=clsIdx>0?(b[clsIdx]||0):(b[0]||0);
      if(selAct){var ratio=b[0]>0?(selAct==="Active"?(b[7]||0):(b[8]||0))/b[0]:0;v=Math.round(v*ratio);}
      return{label:fmtM2(x.m),value:x.m,count:v,color:"#388bfd"};
    }).filter(function(x){return x.count>0;});
  }

  if(dim==="div"){
    var divs=["LS","L&R","HWB","B&L","Other"];
    var clsIdx=selCls==="PIF"?1:selCls==="PIF_LATE"?3:selCls==="PP"?2:0;
    var result={};
    divs.forEach(function(d){
      var src=(PIF.MDIV[d])||{};
      var t=0;
      Object.keys(src).filter(function(m){return m>=df&&m<=dt;}).forEach(function(m){
        var b=src[m]||[];
        var v=clsIdx>0?(b[clsIdx]||0):(b[0]||0);
        if(selAct){var ratio=b[0]>0?(selAct==="Active"?(b[7]||0):(b[8]||0))/b[0]:0;v=Math.round(v*ratio);}
        t+=v;
      });
      if(t>0)result[d]=t;
    });
    // Scale to match filtered total
    var rawTotal=Object.values(result).reduce(function(s,v){return s+v;},0)||1;
    var tot=pifGetTotals();
    var filtTotal=selCls?(selCls==="PIF"?(tot[1]||0):selCls==="PIF_LATE"?(tot[3]||0):(tot[2]||0)):(tot[0]||0);
    if(selAct){var ar=tot[0]>0?(selAct==="Active"?(tot[7]||0):(tot[8]||0))/tot[0]:0;filtTotal=Math.round(filtTotal*ar);}
    var scale=rawTotal>0?filtTotal/rawTotal:1;
    return divs.filter(function(d){return result[d]>0;}).map(function(d){
      return{label:d,value:d,count:Math.round(result[d]*scale),color:divColors[d]||"#388bfd"};
    }).sort(function(a,b){return b.count-a.count;});
  }

  if(dim==="sku"){
    var skuArr=pifGetSkuData();
    return skuArr.filter(function(s){return s.total>0;}).map(function(s){
      var v=selCls==="PIF"?s.pif:selCls==="PIF_LATE"?s.late:selCls==="PP"?s.pp:s.total;
      return{label:s.sku,value:s.sku,count:v,color:"#bc8cff"};
    }).filter(function(x){return x.count>0;}).sort(function(a,b){return b.count-a.count;}).slice(0,20);
  }

  if(dim==="pcat"){
    var tot=pifGetTotals();
    var pcatData={};
    Object.keys(PIF.PCM||{}).forEach(function(pc){
      var pm=PIF.PCM[pc];
      var t=0;
      Object.keys(pm).filter(function(m){return m>=df&&m<=dt;}).forEach(function(m){
        var b=pm[m]||[];
        var v=selCls==="PIF"?(b[1]||0):selCls==="PIF_LATE"?(b[3]||0):selCls==="PP"?(b[2]||0):(b[0]||0);
        t+=v;
      });
      if(t>0)pcatData[pc]=t;
    });
    return Object.entries(pcatData).map(function(e){
      return{label:e[0],value:e[0],count:e[1],color:"#388bfd"};
    }).filter(function(x){return x.count>0;}).sort(function(a,b){return b.count-a.count;});
  }

  return[];
}

function pifRenderDecomp(){
  var container=document.getElementById("pif-decompTree");
  if(!container)return;
  container.innerHTML="";

  var tot=pifGetTotals()[0]||0;
  var usedDims=PIF_DECOMP_PATH.map(function(p){return p.dim;});
  var availDims=PIF_DIM_ORDER.filter(function(d){return usedDims.indexOf(d)<0;});

  // ── Column 0: Total ──────────────────────────────
  container.appendChild(pifDecompCol("Total Orders",[
    {label:"Total Orders",value:null,count:tot,color:"#388bfd",selectable:false}
  ],null,0));

  // ── Columns for each path step ───────────────────
  PIF_DECOMP_PATH.forEach(function(step,i){
    var items=pifDecompGetItems(step.dim);
    if(i>0){var conn=document.createElement("div");conn.style.cssText="width:24px;align-self:stretch;display:flex;align-items:center;flex-shrink:0";conn.innerHTML='<div style="width:100%;height:1px;background:#388bfd"></div>';container.appendChild(conn);}
    else{var conn=document.createElement("div");conn.style.cssText="width:24px;align-self:stretch;display:flex;align-items:center;flex-shrink:0";conn.innerHTML='<div style="width:100%;height:1px;background:#388bfd"></div>';container.appendChild(conn);}
    container.appendChild(pifDecompCol(PIF_DIM_LABELS[step.dim],items,step,i));
  });

  // ── Next column: dropdown to pick next dimension ─
  if(availDims.length>0){
    if(PIF_DECOMP_PATH.length>0){
      var conn=document.createElement("div");conn.style.cssText="width:24px;align-self:stretch;display:flex;align-items:center;flex-shrink:0";
      conn.innerHTML='<div style="width:100%;height:1px;background:#30363d;border-top:1px dashed #388bfd44"></div>';
      container.appendChild(conn);
    }
    var addCol=document.createElement("div");
    addCol.style.cssText="display:flex;flex-direction:column;flex-shrink:0;width:168px;align-items:center;justify-content:center;padding:20px 8px";
    addCol.innerHTML=
      '<div style="font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;text-align:center">Add breakdown</div>'+
      '<select id="pif-decomp-next" style="width:100%;background:#21262d;border:1px solid #388bfd44;color:#e6edf3;padding:6px 8px;border-radius:6px;font-size:12px;font-family:Inter,sans-serif;cursor:pointer;outline:none">'+
        '<option value="">Select dimension...</option>'+
        availDims.map(function(d){return'<option value="'+d+'">'+PIF_DIM_LABELS[d]+'</option>';}).join("")+
      '</select>'+
      '<div id="pif-decomp-next-items" style="margin-top:10px;width:100%;display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto"></div>';
    container.appendChild(addCol);

    // When dropdown changes, show items to pick from
    setTimeout(function(){
      var sel=document.getElementById("pif-decomp-next");
      if(sel) sel.onchange=function(){
        var dim=this.value;
        if(!dim)return;
        var items=pifDecompGetItems(dim);
        var wrap=document.getElementById("pif-decomp-next-items");
        if(!wrap)return;
        wrap.innerHTML="";
        var maxV=Math.max.apply(null,items.map(function(x){return x.count;}).concat([1]));
        items.slice(0,15).forEach(function(item){
          var btn=document.createElement("div");
          btn.style.cssText="background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px 10px;cursor:pointer;transition:all .15s";
          btn.innerHTML=
            '<div style="font-size:10px;color:#8b949e;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+item.label+'">'+item.label+'</div>'+
            '<div style="font-size:17px;font-weight:700;color:'+item.color+';letter-spacing:-0.5px">'+item.count.toLocaleString()+'</div>'+
            '<div style="height:3px;background:#21262d;border-radius:2px;margin-top:4px"><div style="height:100%;width:'+(item.count/maxV*100).toFixed(0)+'%;background:'+item.color+';border-radius:2px"></div></div>';
          btn.onmouseenter=function(){btn.style.borderColor=item.color+"66";btn.style.background="#1c2128";};
          btn.onmouseleave=function(){btn.style.borderColor="#30363d";btn.style.background="#161b22";};
          btn.onclick=function(){
            PIF_DECOMP_PATH.push({dim:dim,label:item.label,value:item.value});
            pifRenderDecomp();pifRenderDecompBC();
          };
          wrap.appendChild(btn);
        });
      };
    },50);
  }

  pifRenderDecompBC();
}

function pifDecompCol(title,items,currentStep,stepIdx){
  var col=document.createElement("div");
  col.style.cssText="display:flex;flex-direction:column;flex-shrink:0;width:168px";
  var hdr=document.createElement("div");
  hdr.style.cssText="font-size:10px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:.6px;text-align:center;padding:5px 8px 8px;border-bottom:1px solid #30363d;margin-bottom:6px";
  hdr.textContent=title;col.appendChild(hdr);
  var wrap=document.createElement("div");wrap.style.cssText="display:flex;flex-direction:column;gap:5px;max-height:380px;overflow-y:auto;padding-right:2px";
  var levelTotal=items.reduce(function(s,x){return s+x.count;},0);
  var maxV=Math.max.apply(null,items.map(function(x){return x.count;}).concat([1]));
  var selVal=currentStep?currentStep.value:null;
  items.forEach(function(item){
    var isSel=currentStep&&(selVal===item.value);
    var isDim=currentStep&&selVal&&!isSel;
    var node=document.createElement("div");
    node.style.cssText="background:"+(isSel?"#1c2128":"#161b22")+";border:1px solid "+(isSel?item.color:"#30363d")+";border-radius:7px;padding:9px 11px;transition:all .15s;opacity:"+(isDim?"0.25":"1")+";cursor:default";
    node.innerHTML=
      '<div style="font-size:10px;color:#8b949e;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:146px" title="'+item.label+'">'+item.label+'</div>'+
      '<div style="font-size:20px;font-weight:700;color:'+item.color+';margin-bottom:5px;letter-spacing:-0.5px">'+item.count.toLocaleString()+'</div>'+
      '<div style="height:3px;background:#21262d;border-radius:2px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:'+(item.count/maxV*100).toFixed(0)+'%;background:'+item.color+';border-radius:2px"></div></div>'+
      '<div style="font-size:10px;color:'+item.color+'">'+( levelTotal>0?(item.count/levelTotal*100).toFixed(1):"0")+'% of level</div>';
    wrap.appendChild(node);
  });
  col.appendChild(wrap);
  return col;
}

function pifRenderDecompBC(){
  var bc=document.getElementById("pif-decompBC");if(!bc)return;bc.innerHTML="";
  function crumb(text,fn,active){var s=document.createElement("span");s.style.cssText="font-size:11px;color:"+(active?"#388bfd":"#8b949e")+";cursor:pointer;padding:2px 6px;border-radius:4px;font-weight:"+(active?"600":"400");s.textContent=text;if(fn){s.onclick=fn;s.onmouseenter=function(){s.style.background="#21262d";s.style.color="#e6edf3";};s.onmouseleave=function(){s.style.background="";s.style.color=active?"#388bfd":"#8b949e";};}bc.appendChild(s);}
  function sep(){var s=document.createElement("span");s.style.cssText="color:#30363d;font-size:12px";s.textContent=">";bc.appendChild(s);}
  crumb("Total",function(){PIF_DECOMP_PATH=[];pifRenderDecomp();pifRenderDecompBC();},PIF_DECOMP_PATH.length===0);
  PIF_DECOMP_PATH.forEach(function(step,i){
    sep();
    (function(ci,s){
      crumb(s.label,function(){PIF_DECOMP_PATH=PIF_DECOMP_PATH.slice(0,ci+1);pifRenderDecomp();pifRenderDecompBC();},i===PIF_DECOMP_PATH.length-1);
    })(i,step);
  });
  if(PIF_DECOMP_PATH.length>0){
    var pipe=document.createElement("span");pipe.style.cssText="color:#30363d;padding:0 4px";pipe.textContent="|";bc.appendChild(pipe);
    var rst=document.createElement("span");rst.style.cssText="font-size:11px;color:#f85149;cursor:pointer;padding:2px 8px;border-radius:4px;border:1px solid #f8514933;background:#f8514911";rst.textContent="Reset";
    rst.onclick=function(){PIF_DECOMP_PATH=[];pifRenderDecomp();pifRenderDecompBC();};
    bc.appendChild(rst);
  }
}
