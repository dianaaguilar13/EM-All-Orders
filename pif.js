var PIF=null,pifCharts={},pifSelSku=new Set(),pifSelP=new Set();
var PIF_ROWS=null; // lazy loaded detail records
var pifExpandedSku=null; // currently expanded SKU row
var pifTreePath=[]; // stores labels: ["PIF","Active","LS",...]

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
function pifRange(){return{df:document.getElementById("pif-df").value.slice(0,10),dt:document.getElementById("pif-dt").value.slice(0,10)};}
function pifPcat(){return document.getElementById("pif-pcat").value;}
function pifDiv(){return document.getElementById("pif-div").value;}
function pifActFilter(){return document.getElementById("pif-act").value;}
function fmtM2(m){var p=m.split("-");return new Date(parseInt(p[0]),parseInt(p[1])-1).toLocaleString("default",{month:"short",year:"2-digit"});}

function pifApply(){["pif-skuDrop","pif-msDrop"].forEach(function(id){document.getElementById(id).classList.remove("open");});pifRender();}
function pifReset(){document.getElementById("pif-df").value="2026-04-01";document.getElementById("pif-dt").value="2026-04-28";["pif-pcat","pif-div","pif-act"].forEach(function(id){document.getElementById(id).value="";});pifSelSku.clear();pifUpdateSkuBtn();pifSelP.clear();pifUpdateMsBtn();pifRender();}

// Get totals applying all filters


function pifGetMonthly(){
  var r=pifRange(),pcat=pifPcat(),div=pifDiv(),act=pifActFilter();
  var empty=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
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
    Object.keys(srcMap).filter(function(m){return m>=r.df.slice(0,7)&&m<=r.dt.slice(0,7);}).forEach(function(m){
      byM[m]=srcMap[m];
    });
    return Object.keys(byM).sort().map(function(m){return{m:m,b:applyAct(byM[m])};}).filter(function(x){return x.b[0]>0;});
  }

  function mergeSources(sources){
    var byM={};
    sources.forEach(function(src){
      Object.keys(src).filter(function(m){return m>=r.df.slice(0,7)&&m<=r.dt.slice(0,7);}).forEach(function(m){
        if(!byM[m])byM[m]=[0,0,0,0,0.0,0.0,0.0,0,0,0,0,0,0,0,0];
        var v=src[m];for(var i=0;i<15;i++)byM[m][i]+=(v[i]||0);
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
  // Use PIF_ROWS for exact date filtering (same source as SKU table)
  if(PIF_ROWS&&PIF_ROWS.rows){
    var r=pifRange(),pcat=pifPcat(),div=pifDiv(),act=pifActFilter();
    var hasP=pifSelP.size>0;
    var clsN=["PIF","PP","PIF_LATE"];
    var tot=[0,0,0,0,0.0,0.0,0.0,0,0,0,0,0,0,0,0];
    Object.keys(PIF_ROWS.rows).forEach(function(sku){
      if(pifSelSku.size>0&&!pifSelSku.has(sku))return;
      (PIF_ROWS.rows[sku]||[]).forEach(function(r2){
        if(r2[3]<r.df||r2[3]>r.dt)return;
        if(pcat&&PIF_ROWS.pcats[r2[7]]!==pcat)return;
        if(hasP&&!pifSelP.has(PIF_ROWS.parts[r2[8]]))return;
        if(div&&PIF_ROWS.divs[r2[10]]!==div)return;
        if(act==="Active"&&r2[12]!==0)return;
        if(act==="Inactive"&&r2[12]!==1)return;
        tot[0]++;
        var cls=clsN[r2[5]];
        if(cls==="PIF")tot[1]++;
        else if(cls==="PP")tot[2]++;
        else if(cls==="PIF_LATE")tot[3]++;
        var cn=PIF_ROWS.cncls[r2[11]]||"";
        if(cn==="Entry Error")tot[13]++;
        else if(cn==="Cancelled")tot[14]++;
        if(r2[12]===0)tot[7]++; else tot[8]++;
      });
    });
    return tot;
  }
  // Fallback: sum from pifGetSkuData (monthly aggregates)
  var skuArr=pifGetSkuData();
  if(skuArr.length>0){
    var tot=[0,0,0,0,0.0,0.0,0.0,0,0,0,0,0,0,0,0];
    skuArr.forEach(function(s){
      tot[0]+=s.total; tot[1]+=s.pif; tot[2]+=s.pp; tot[3]+=s.late;
      tot[4]+=s.pifInv; tot[5]+=s.ppInv; tot[6]+=s.lateInv;
      tot[13]+=(s.ee||0); tot[14]+=(s.cncl||0);
    });
    return tot;
  }
  var ts=pifGetMonthly();
  var tot=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  ts.forEach(function(x){var v=x.b;if(v)for(var i=0;i<15;i++)tot[i]+=(v[i]||0);});
  return tot;
}



function pifGetSkuData(){
  // Use PIF_ROWS for exact date filtering if loaded
  if(PIF_ROWS&&PIF_ROWS.rows){
    var r=pifRange(),pcat=pifPcat(),div=pifDiv(),act=pifActFilter();
    var hasP=pifSelP.size>0;var clsN=["PIF","PP","PIF_LATE"];
    var skuMap={};
    Object.keys(PIF_ROWS.rows).forEach(function(sku){
      if(sku==="Unknown")return; // hide records with no SKU from breakdown
      if(pifSelSku.size>0&&!pifSelSku.has(sku))return;
      (PIF_ROWS.rows[sku]||[]).forEach(function(r2){
        if(r2[3]<r.df||r2[3]>r.dt)return;
        if(pcat&&PIF_ROWS.pcats[r2[7]]!==pcat)return;
        if(hasP&&!pifSelP.has(PIF_ROWS.parts[r2[8]]))return;
        if(div&&PIF_ROWS.divs[r2[10]]!==div)return;
        if(act==="Active"&&r2[12]!==0)return;
        if(act==="Inactive"&&r2[12]!==1)return;
        if(!skuMap[sku])skuMap[sku]={total:0,pif:0,pp:0,late:0,ee:0,cncl:0};
        var s=skuMap[sku];s.total++;
        var cls=clsN[r2[5]];
        if(cls==="PIF")s.pif++;else if(cls==="PP")s.pp++;else if(cls==="PIF_LATE")s.late++;
        var cn=PIF_ROWS.cncls[r2[11]]||"";
        if(cn==="Entry Error")s.ee++;else if(cn==="Cancelled")s.cncl++;
      });
    });
    return Object.entries(skuMap)
      .map(function(e){
        var sk=e[0],v=e[1];var tot2=v.total;
        return{sku:sk,total:tot2,pif:v.pif,pp:v.pp,late:v.late,
          pifInv:0,ppInv:0,lateInv:0,ee:v.ee,cncl:v.cncl,
          pifRate:tot2>0?(v.pif/tot2*100):0,pifRateAll:tot2>0?((v.pif+v.late)/tot2*100):0};
      }).filter(function(x){return x.total>0;}).sort(function(a,b){return b.total-a.total;});
  }

  var r=pifRange(),pcat=pifPcat(),div=pifDiv(),act=pifActFilter();
  var hasP=pifSelP.size>0,partArr=Array.from(pifSelP);

  // Determine source - priority: partner > pcat > global
  var skuTotals={};

  function addSkuMonths(sku, src){
    Object.keys(src).filter(function(m){return m>=r.df.slice(0,7)&&m<=r.dt.slice(0,7);}).forEach(function(m){
      if(!skuTotals[sku])skuTotals[sku]=[0,0,0,0,0.0,0.0,0.0,0,0,0,0,0,0,0,0];
      var v=src[m];for(var i=0;i<15;i++)skuTotals[sku][i]+=(v[i]||0);
    });
  }

  if(hasP&&PIF.PMSKU){
    // Partner filter: use PMSKU[partner][sku][month]
    partArr.forEach(function(p){
      var pm=PIF.PMSKU[p]||{};
      var skus=pifSelSku.size>0?Array.from(pifSelSku):Object.keys(pm);
      skus.forEach(function(sku){ addSkuMonths(sku, pm[sku]||{}); });
    });
  } else if(pcat&&PIF.SMNPC){
    // Pcat filter: use SMNPC[sku][pcat][month]
    var skus=pifSelSku.size>0?Array.from(pifSelSku):Object.keys(PIF.SMNPC);
    skus.forEach(function(sku){
      addSkuMonths(sku, ((PIF.SMNPC[sku])||{})[pcat]||{});
    });
  } else if(PIF.SMN){
    var skus=pifSelSku.size>0?Array.from(pifSelSku):Object.keys(PIF.SMN);
    skus.forEach(function(sku){
      var sm=PIF.SMN[sku]||{};
      Object.keys(sm).filter(function(m){return m>=r.df.slice(0,7)&&m<=r.dt.slice(0,7);}).forEach(function(m){
        if(!skuTotals[sku])skuTotals[sku]=[0,0,0,0,0.0,0.0,0.0,0,0,0,0,0,0,0,0];
        var v=sm[m];for(var i=0;i<7;i++)skuTotals[sku][i]+=(v[i]||0);
        var gv=PIF.M[m]||[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
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
      var ratio2=v[0]>0?total/v[0]:0;
      var ee2=Math.round((v[13]||0)*ratio2);
      var cncl2=Math.round((v[14]||0)*ratio2);
      var ratio2=v[0]>0?total/v[0]:0;var ee2=Math.round((v[13]||0)*ratio2);var cncl2=Math.round((v[14]||0)*ratio2);
      return{sku:s,total:total,pif:pif,pp:pp,late:late,pifInv:(v[4]||0)*ratio2,ppInv:(v[5]||0)*ratio2,lateInv:(v[6]||0)*ratio2,ee:ee2,cncl:cncl2,pifRate:total>0?(pif/total*100):0,pifRateAll:total>0?((pif+late)/total*100):0};
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
  var EE=tot[13]||0,CNCL=tot[14]||0;
  var displayT=T-EE;
  var allPif=P+PL;
  var pifRate=displayT>0?(P/displayT*100):0;
  var pifRateAll=displayT>0?(allPif/displayT*100):0;
  var ppRate=displayT>0?(PP/displayT*100):0;
  var lateRate=displayT>0?(PL/displayT*100):0;
  var cnclRate=displayT>0?(CNCL/displayT*100):0;

  document.getElementById("pif-rcLbl").textContent=T.toLocaleString()+" orders";

  document.getElementById("pif-kpis").innerHTML=
    '<div class="kpi k1"><div class="kl">Total Orders</div><div class="kv" style="color:#1a2332">'+displayT.toLocaleString()+'</div><div class="ks muted">excl. entry errors</div></div>'+
    '<div class="kpi k6"><div class="kl">PIF (on time)</div><div class="kv" style="color:#16a34a">'+P.toLocaleString()+'</div><div class="ks green">'+pifRate.toFixed(1)+'% same day</div></div>'+
    '<div class="kpi k5"><div class="kl">PIF (after 30d)</div><div class="kv" style="color:#f59e0b">'+PL.toLocaleString()+'</div><div class="ks amber">'+lateRate.toFixed(1)+'% late PIF</div></div>'+
    '<div class="kpi k7"><div class="kl">PP</div><div class="kv" style="color:#7c3aed">'+PP.toLocaleString()+'</div><div class="ks muted">'+ppRate.toFixed(1)+'% payment plan</div></div>'+
    '<div class="kpi k4"><div class="kl">Cancel %</div><div class="kv" style="color:#ef4444;font-size:28px">'+cnclRate.toFixed(1)+'%</div><div class="ks red">'+CNCL.toLocaleString()+' cancelled</div></div>'+
    '<div class="kpi k2"><div class="kl">Total PIF Rate</div><div class="kv" style="color:#16a34a">'+pifRate.toFixed(1)+'%</div><div class="ks muted">'+lateRate.toFixed(1)+'% after 30d</div></div>'+
    '<div class="kpi k8"><div class="kl">PIF Revenue</div><div class="kv" style="color:#16a34a;font-size:18px">$'+Math.round(PI).toLocaleString()+'</div><div class="ks muted">total PIF inv value</div></div>';

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
        Object.keys(smnpcSrc).filter(function(m){return m>=r_div.df.slice(0,7)&&m<=r_div.dt.slice(0,7);}).forEach(function(m){
          var v=smnpcSrc[m];
          var dv=mdivSrc[m]||[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
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
      Object.keys(src).filter(function(m){return m>=r_div.df.slice(0,7)&&m<=r_div.dt.slice(0,7);}).forEach(function(m){
        var v=src[m]||[0,0,0,0];t+=(v[0]||0);p+=(v[1]||0)+(v[3]||0);pp+=(v[2]||0);
      });
      if(t>0)divTotals[d]={total:t,pif:p,pp:pp};
    });
    if(pcat_div){
      // Scale by pcat share from PCM
      var pcm=PIF.PCM&&PIF.PCM[pcat_div]||{};
      var pcTotal={};
      var gTotal={};
      Object.keys(pcm).filter(function(m){return m>=r_div.df.slice(0,7)&&m<=r_div.dt.slice(0,7);}).forEach(function(m){
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
      "<td style='font-size:11px;color:#64748b'>"+cat+"</td>"+
      "<td class='num'>"+s.total.toLocaleString()+"</td>"+
      "<td class='num' style='color:#3fb950'>"+s.pif.toLocaleString()+"</td>"+
      "<td class='num' style='color:#e3b341'>"+s.late.toLocaleString()+"</td>"+
      "<td class='num' style='color:#bc8cff'>"+s.pp.toLocaleString()+"</td>"+
      "<td><div class='bw'><div class='bb'><div class='bf' style='width:"+s.pifRate.toFixed(0)+"%;background:"+bg+"'></div></div>"+
      "<span class='num' style='min-width:42px;font-size:11px;color:"+cl+"'>"+s.pifRate.toFixed(1)+"%</span></div></td>"+
      "<td class='num' style='color:#64748b'>$"+Math.round(s.pifInv+s.lateInv).toLocaleString()+"</td>"+
      "<td class='num' style='color:#64748b'>$"+Math.round(s.ppInv).toLocaleString()+"</td></tr>"+
      "<tr id='pif-detail-"+safeId+"' style='display:none'><td colspan='11' style='padding:0'></td></tr>";
  });
  document.getElementById("pif-skuTbody").innerHTML=tRows;
  document.getElementById("pif-tblInfo").innerHTML=
    skuArr.length+" SKUs &middot; "+T.toLocaleString()+" orders &nbsp;"+
    "<button onclick='pifLoadAndDownloadAll()' style='border:1px solid #16a34a33;color:#16a34a;padding:3px 10px;border-radius:5px;font-size:11px;cursor:pointer;background:transparent'>&#11015; Download All CSV</button>";

document.getElementById("pif-loading").style.display="none";
  document.getElementById("pif-main").style.display="block";
}

// ── CSV Download ──────────────────────────────────────────
function pifDownloadSkuById(sku){
  if(!PIF_ROWS||!PIF_ROWS.rows[sku])return;
  var r=pifRange(),pcat=pifPcat(),div=pifDiv(),act=pifActFilter();
  var clsLabels=["PIF","PP","PIF_LATE"];
  var filtered=(PIF_ROWS.rows[sku]||[]).filter(function(r2){
    if(r2[3]<r.df||r2[3]>r.dt)return false;
    if(pcat&&PIF_ROWS.pcats[r2[7]]!==pcat)return false;
    if(pifSelP.size>0&&!pifSelP.has(PIF_ROWS.parts[r2[8]]))return false;
    if(div&&PIF_ROWS.divs[r2[10]]!==div)return false;
    if(act==="Active"&&r2[12]!==0)return false;
    if(act==="Inactive"&&r2[12]!==1)return false;
    return true;
  });
  function esc(v){var s=String(v==null?"":v);return s.indexOf(",")>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;}
  var headers=["Order ID","SKU","SKU Category","Partner Category","Referral Partner","Purchase Date","PIF/PP","Days to PIF","Enrollment Mentor","Division","Active Status"];
  var lines=[headers.join(",")];
  filtered.forEach(function(r2){
    lines.push([esc(r2[1]),esc(sku),esc(PIF_ROWS.cats[r2[2]]||""),esc(PIF_ROWS.pcats[r2[7]]||""),
      esc(PIF_ROWS.parts[r2[8]]||""),esc(r2[3]),esc(clsLabels[r2[5]]||""),
      esc(r2[6]>=0?r2[6]:""),esc(PIF_ROWS.ems[r2[9]]||""),esc(PIF_ROWS.divs[r2[10]]||""),
      esc(r2[12]===0?"Active":"Inactive")].join(","));
  });
  pifDownloadCsv2(lines.join("\n"),"pif_"+sku.replace(/[^a-zA-Z0-9]/g,"_")+"_"+r.df+"_"+r.dt+".csv");
}
function pifDownloadCsv2(csv,filename){
  var blob=new Blob([csv],{type:"text/csv"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();
}



// Normalize pif_rows.json to consistent format regardless of which version generated it
function pifNormalizeRows(data){
  // Handle both key formats: rows_by_sku (old) and rows (new)
  var rows = data.rows || data.rows_by_sku || {};
  // Handle both lookup formats: idx.pcats (old) and pcats (new)
  var idx = data.idx || {};
  var pcats  = data.pcats  || idx.pcats    || [];
  var parts  = data.parts  || idx.partners || [];
  var ems    = data.ems    || idx.ems      || [];
  var cats   = data.cats   || idx.skus     || [];
  var divs   = data.divs   || idx.divs     || [];
  var cncls  = data.cncls  || [];

  // Detect row format by checking if r[2] is a string (old: contactid at [2])
  // vs number (new: cat_idx at [2])
  var needsRemap = false;
  var sample = null;
  Object.keys(rows).some(function(sku){
    if(rows[sku]&&rows[sku].length){sample=rows[sku][0];return true;}
  });
  // Old format: [uid, id, contactid(str), cat_idx, date, month, cls, days, pcat, part, em, div, cncl, act]
  // New format: [uid, id, cat_idx(num),   date,    month,cls,   days,pcat,  part, em,  div, cncl,act, contactid, product]
  if(sample && typeof sample[2]==="string" && typeof sample[3]==="number"){
    needsRemap = true;
  }

  if(needsRemap){
    var remapped = {};
    Object.keys(rows).forEach(function(sku){
      remapped[sku] = rows[sku].map(function(r){
        // old: [uid,id,contactid,cat_idx,date,month,cls,days,pcat,part,em,div,cncl,act]
        // new: [uid,id,cat_idx,  date,  month,cls,  days,pcat,part,em, div,cncl,act,contactid,product]
        return [r[0],r[1],r[3],r[4],r[5],r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13],r[2],""];
      });
    });
    rows = remapped;
  }

  return {rows:rows, pcats:pcats, parts:parts, ems:ems, cats:cats, divs:divs, cncls:cncls};
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
    fetch("pif_rows.json?v=1778048708").then(function(r){return r.json();}).then(function(data){
      PIF_ROWS=pifNormalizeRows(data);
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
    if(r2[3]<r.df||r2[3]>r.dt)return false;
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
  wrap.style.cssText="padding:10px 16px;background:#f8fafc;border-top:1px solid #dde3ea";

  var header=document.createElement("div");
  header.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px";

  var info=document.createElement("span");
  info.style.cssText="font-size:11px;font-weight:600;color:#64748b";
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

  var cols=["Order ID","Contact ID","Product","Purchase Date","PIF / PP","Days to PIF","CNCL Status","Active","Partner Category","Referral Partner","EM","Division"];
  var thead=document.createElement("thead");
  var hrow=document.createElement("tr");
  hrow.style.background="#f8fafc";
  cols.forEach(function(c){
    var th=document.createElement("th");
    th.style.cssText="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;white-space:nowrap;position:sticky;top:0;background:#f8fafc;border-bottom:1px solid #dde3ea";
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
      {v:r2[1],c:"#2563eb"},
      {v:r2[13]||"",c:"#64748b"},
      {v:r2[14]||sku,c:"#1a2332"},
      {v:r2[3],c:"#64748b"},
      {v:clsLabels[r2[5]],c:clsColors[r2[5]],bold:true},
      {v:r2[6]>=0?r2[6]+"d":"-",c:"#64748b"},
      {v:PIF_ROWS.cncls[r2[11]]||"",c:cnclColors[r2[11]||0],bold:true},
      {v:r2[12]===0?"Active":"Inactive",c:r2[12]===0?"#2563eb":"#ef4444",bold:true},
      {v:PIF_ROWS.pcats[r2[7]]||"",c:"#64748b"},
      {v:PIF_ROWS.parts[r2[8]]||"",c:"#64748b"},
      {v:PIF_ROWS.ems[r2[9]]||"",c:"#64748b"},
      {v:PIF_ROWS.divs[r2[10]]||"",c:"#64748b"}
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




function pifDownloadAllCsv(){
  if(!PIF_ROWS)return;
  var r=pifRange(),pcat=pifPcat(),div=pifDiv(),act=pifActFilter();
  var clsLabels=["PIF","PP","PIF_LATE"];
  var filtered=[];
  Object.keys(PIF_ROWS.rows).forEach(function(sku){
    if(pifSelSku.size>0&&!pifSelSku.has(sku))return;
    (PIF_ROWS.rows[sku]||[]).forEach(function(r2){
      if(r2[3]<r.df||r2[3]>r.dt)return;
      if(pcat&&PIF_ROWS.pcats[r2[7]]!==pcat)return;
      if(pifSelP.size>0&&!pifSelP.has(PIF_ROWS.parts[r2[8]]))return;
      if(div&&PIF_ROWS.divs[r2[10]]!==div)return;
      if(act==="Active"&&r2[12]!==0)return;
      if(act==="Inactive"&&r2[12]!==1)return;
      filtered.push([sku,r2]);
    });
  });
  function esc(v){var s=String(v==null?"":v);return s.indexOf(",")>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;}
  var headers=["Order ID","SKU","SKU Category","Partner Category","Referral Partner","Purchase Date","PIF/PP","Days to PIF","Enrollment Mentor","Division","Active Status"];
  var lines=[headers.join(",")];
  filtered.forEach(function(pair){
    var sku=pair[0],r2=pair[1];
    lines.push([esc(r2[1]),esc(sku),esc(PIF_ROWS.cats[r2[2]]||""),esc(PIF_ROWS.pcats[r2[7]]||""),
      esc(PIF_ROWS.parts[r2[8]]||""),esc(r2[3]),esc(clsLabels[r2[5]]||""),
      esc(r2[6]>=0?r2[6]:""),esc(PIF_ROWS.ems[r2[9]]||""),esc(PIF_ROWS.divs[r2[10]]||""),
      esc(r2[12]===0?"Active":"Inactive")].join(","));
  });
  pifDownloadCsv2(lines.join("\n"),"PIF_all_"+r.df+"_"+r.dt+".csv");
}

function pifLoadAndDownloadAll(){
  if(PIF_ROWS){pifDownloadAllCsv();return;}
  fetch("pif_rows.json?v=1778048708").then(function(r){return r.json();}).then(function(data){
    PIF_ROWS=pifNormalizeRows(data);
    pifDownloadAllCsv();
  });
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



// ── Load ───────────────────────────────────────────────────
fetch("pif_data.json?v=1778048708").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
  .then(function(data){PIF=data;pifRenderSkuItems();pifRenderMsItems();pifRender();})
  .catch(function(err){document.getElementById("pif-loading").innerHTML='<div style="color:#ef4444">Failed to load pif_data.json: '+err.message+"</div>";});// ── Decomp Tree ────────────────────────────────────────────
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
