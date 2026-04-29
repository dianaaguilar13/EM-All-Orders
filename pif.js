var PIF=null,pifCharts={},pifSelSku=new Set(),pifSelP=new Set();
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
function pifReset(){document.getElementById("pif-df").value="2022-01-01";document.getElementById("pif-dt").value="2026-04-28";["pif-pcat","pif-div","pif-act"].forEach(function(id){document.getElementById(id).value="";});pifSelSku.clear();pifUpdateSkuBtn();pifSelP.clear();pifUpdateMsBtn();pifRender();}

// Get totals applying all filters
function pifGetTotals(){
  // Always derive totals by summing filtered monthly data
  var ts=pifGetMonthly();
  var tot=[0,0,0,0,0,0,0,0,0];
  ts.forEach(function(x){var v=x.b;if(v)for(var i=0;i<9;i++)tot[i]+=(v[i]||0);});
  return tot;
}

function pifGetMonthly(){
  var r=pifRange(),pcat=pifPcat(),div=pifDiv();
  var empty=[0,0,0,0,0,0,0,0,0];
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
  // Use PSMN (sku monthly) if available, else fallback to S
  var r=pifRange(),pcat=pifPcat();
  var skuTotals={};
  // Build from per-sku monthly data filtered by date
  var smn=PIF.SMN||null;
  if(smn){
    Object.keys(smn).forEach(function(sku){
      if(pifSelSku.size>0&&!pifSelSku.has(sku))return;
      var pm=smn[sku];
      Object.keys(pm).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
        var v=pm[m];
        if(!skuTotals[sku])skuTotals[sku]=[0,0,0,0,0,0,0];
        for(var i=0;i<7;i++)skuTotals[sku][i]+=(v[i]||0);
      });
    });
  } else {
    // Fallback: use S (all time) - no date filtering
    Object.entries(PIF.S).forEach(function(e){
      if(pifSelSku.size>0&&!pifSelSku.has(e[0]))return;
      skuTotals[e[0]]=e[1];
    });
  }
  return Object.entries(skuTotals)
    .filter(function(e){return e[1][0]>=1;})
    .map(function(e){
      var s=e[0],v=e[1];
      var total=v[0],pif=v[1],pp=v[2],late=v[3],pifInv=v[4]||0,ppInv=v[5]||0,lateInv=v[6]||0;
      var allPif=pif+late;
      return{sku:s,total:total,pif:pif,pp:pp,late:late,allPif:allPif,
        pifInv:pifInv,ppInv:ppInv,lateInv:lateInv,
        pifRate:total>0?(allPif/total*100):0};
    }).sort(function(a,b){return b.total-a.total;});
}

// ── Decomp Tree ────────────────────────────────────────────
// GT structure: cls(PIF/PP/PIF_LATE) -> act(Active/Inactive) -> div -> month -> count
function pifCountTree(node,depth){
  if(!node)return 0;
  if(typeof node==="number")return node;
  if(typeof node!=="object")return 0;
  var t=0;Object.values(node).forEach(function(v){t+=pifCountTree(v,depth-1);});return t;
}

function pifCountFiltered(node,depth,df,dt){
  if(!node)return 0;
  if(typeof node==="number")return node;
  if(depth===0)return 0;
  if(depth===1){var t=0;Object.keys(node).forEach(function(m){if(m>=df&&m<=dt)t+=node[m];});return t;}
  var t=0;Object.values(node).forEach(function(v){t+=pifCountFiltered(v,depth-1,df,dt);});return t;
}

function pifGetDecompLevel(li){
  var tree=PIF.GT||{};
  var r=pifRange(),df=r.df,dt=r.dt;
  var pcat=pifPcat(),div=pifDiv();

  // Get filtered total from monthly data (respects all filters)
  function getFilteredTotal(){
    var ts=pifGetMonthly();
    return ts.reduce(function(s,x){return s+(x.b[0]||0);},0);
  }

  // Get filtered counts by cls from monthly data
  function getFilteredByCls(){
    var ts=pifGetMonthly();
    var m={PIF:0,PP:0,PIF_LATE:0};
    ts.forEach(function(x){m.PIF+=(x.b[1]||0);m.PP+=(x.b[2]||0);m.PIF_LATE+=(x.b[3]||0);});
    return m;
  }

  if(li===0) return [{l:"Total Orders",v:getFilteredTotal(),c:"#388bfd"}];

  if(li===1){
    var cls=getFilteredByCls();
    var clsColors={"PIF":"#3fb950","PP":"#bc8cff","PIF_LATE":"#e3b341"};
    var clsLabels={"PIF":"PIF (on time)","PP":"PP (payment plan)","PIF_LATE":"PIF (after 30 days)"};
    return Object.keys(cls).filter(function(k){return cls[k]>0;}).map(function(k){
      return{l:clsLabels[k],v:cls[k],c:clsColors[k],key:k};
    }).sort(function(a,b){return b.v-a.v;});
  }

  if(li===1){
    // Payment type breakdown
    var clsColors={"PIF":"#3fb950","PP":"#bc8cff","PIF_LATE":"#e3b341"};
    var clsLabels={"PIF":"PIF (on time)","PP":"PP (payment plan)","PIF_LATE":"PIF (after 30 days)"};
    return Object.keys(tree).map(function(cls){
      return{l:clsLabels[cls]||cls,v:pifCountFiltered(tree[cls],3,df,dt),c:clsColors[cls]||"#388bfd",key:cls};
    }).filter(function(x){return x.v>0;}).sort(function(a,b){return b.v-a.v;});
  }

    // Use pcat-specific tree when pcat filter active, else global GT
  var activeTree=pcat&&PIF.PCT&&PIF.PCT[pcat]?PIF.PCT[pcat]:tree;
  function clsKey(lbl){var m={"PIF (on time)":"PIF","PP (payment plan)":"PP","PIF (after 30 days)":"PIF_LATE"};return m[lbl]||lbl;}
  var divColors={"LS":"#388bfd","L&R":"#f85149","HWB":"#e3b341","B&L":"#3fb950","Other":"#8b949e"};

  if(li===2){
    var k=clsKey(pifTreePath[0]);if(!k)return[];
    var node=activeTree[k]||{};
    return[{l:"Active",v:pifCountFiltered(node["Active"],2,df,dt),c:"#58a6ff"},{l:"Inactive",v:pifCountFiltered(node["Inactive"],2,df,dt),c:"#f85149"}].filter(function(x){return x.v>0;});
  }
  if(li===3){
    var k=clsKey(pifTreePath[0]),act=pifTreePath[1];if(!k||!act)return[];
    var node=(activeTree[k]&&activeTree[k][act])||{};
    return Object.keys(node).map(function(d){return{l:d,v:pifCountFiltered(node[d],1,df,dt),c:divColors[d]||"#388bfd"};}).filter(function(x){return x.v>0;}).sort(function(a,b){return b.v-a.v;});
  }
  if(li===4){
    var k=clsKey(pifTreePath[0]),act=pifTreePath[1],d=pifTreePath[2];if(!k||!act||!d)return[];
    var node=(activeTree[k]&&activeTree[k][act]&&activeTree[k][act][d])||{};
    return Object.keys(node).filter(function(m){return m>=df&&m<=dt;}).sort().map(function(m){return{l:fmtM2(m),v:node[m],c:"#388bfd"};}).filter(function(x){return x.v>0;});
  }
  return[];
}

function pifRenderDecomp(){
  var showUpTo=Math.min(pifTreePath.length+1,4);
  var container=document.getElementById("pif-decompTree");
  container.innerHTML="";
  for(var li=0;li<=showUpTo;li++){
    var items=pifGetDecompLevel(li);
    if(!items||!items.length)break;
    var selectedLabel=pifTreePath[li-1]||null;
    var isClickable=(li===showUpTo&&li<4);
    if(li>0){
      var conn=document.createElement("div");
      conn.style.cssText="width:24px;align-self:stretch;display:flex;align-items:center;flex-shrink:0";
      conn.innerHTML='<div style="width:100%;height:1px;background:'+(pifTreePath.length>=li?"#388bfd":"#30363d")+'"></div>';
      container.appendChild(conn);
    }
    var col=document.createElement("div");
    col.style.cssText="display:flex;flex-direction:column;flex-shrink:0;width:168px";
    var hdr=document.createElement("div");
    hdr.style.cssText="font-size:10px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:.6px;text-align:center;padding:5px 8px 8px;border-bottom:1px solid #30363d;margin-bottom:6px";
    hdr.textContent=PIF_LEVEL_TITLES[li];col.appendChild(hdr);
    var wrap=document.createElement("div");
    wrap.style.cssText="display:flex;flex-direction:column;gap:5px;max-height:380px;overflow-y:auto;padding-right:2px";
    var levelTotal=items.reduce(function(s,x){return s+x.v;},0);
    var maxV=Math.max.apply(null,items.map(function(x){return x.v;}).concat([1]));
    items.forEach(function(item){
      var isSel=(selectedLabel===item.l),isDim=(selectedLabel&&!isSel);
      var bw=(item.v/maxV*100).toFixed(0),pct=levelTotal>0?(item.v/levelTotal*100).toFixed(1):"0";
      var node=document.createElement("div");
      node.style.cssText="background:"+(isSel?"#1c2128":"#161b22")+";border:1px solid "+(isSel?item.c:"#30363d")+";border-radius:7px;padding:9px 11px;transition:all .15s;opacity:"+(isDim?"0.25":"1")+";cursor:"+(isClickable?"pointer":"default");
      node.innerHTML='<div style="font-size:10px;color:#8b949e;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:146px" title="'+item.l+'">'+item.l+'</div>'+
        '<div style="font-size:20px;font-weight:700;color:'+item.c+';margin-bottom:5px;letter-spacing:-0.5px">'+item.v.toLocaleString()+'</div>'+
        '<div style="height:3px;background:#21262d;border-radius:2px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:'+bw+'%;background:'+item.c+';border-radius:2px"></div></div>'+
        '<div style="font-size:10px;color:'+item.c+'">'+pct+'% of level</div>'+
        (isClickable?'<div style="font-size:9px;color:#388bfd88;margin-top:2px">click to drill down</div>':"");
      if(isClickable){
        (function(lbl,capturedLi){
          node.onclick=function(){pifTreePath=pifTreePath.slice(0,capturedLi-1);pifTreePath.push(lbl);pifRenderDecomp();pifRenderDecompBC();};
          node.onmouseenter=function(){if(!isSel)node.style.borderColor=item.c+"66";};
          node.onmouseleave=function(){if(!isSel)node.style.borderColor="#30363d";};
        })(item.l,li);
      }
      wrap.appendChild(node);
    });
    col.appendChild(wrap);container.appendChild(col);
  }
  pifRenderDecompBC();
}

function pifRenderDecompBC(){
  var bc=document.getElementById("pif-decompBC");if(!bc)return;bc.innerHTML="";
  function crumb(text,fn,active){var s=document.createElement("span");s.style.cssText="font-size:11px;color:"+(active?"#388bfd":"#8b949e")+";cursor:pointer;padding:2px 6px;border-radius:4px;font-weight:"+(active?"600":"400");s.textContent=text;if(fn){s.onclick=fn;s.onmouseenter=function(){s.style.background="#21262d";s.style.color="#e6edf3";};s.onmouseleave=function(){s.style.background="";s.style.color=active?"#388bfd":"#8b949e";};}bc.appendChild(s);}
  function sep(){var s=document.createElement("span");s.style.cssText="color:#30363d;font-size:12px";s.textContent=">";bc.appendChild(s);}
  crumb("Total",function(){pifTreePath=[];pifRenderDecomp();pifRenderDecompBC();},pifTreePath.length===0);
  pifTreePath.forEach(function(lbl,i){sep();(function(ci,l){crumb(l,function(){pifTreePath=pifTreePath.slice(0,ci+1);pifRenderDecomp();pifRenderDecompBC();},i===pifTreePath.length-1);})(i,lbl);});
  if(pifTreePath.length>0){var pipe=document.createElement("span");pipe.style.cssText="color:#30363d;padding:0 4px";pipe.textContent="|";bc.appendChild(pipe);var rst=document.createElement("span");rst.style.cssText="font-size:11px;color:#f85149;cursor:pointer;padding:2px 8px;border-radius:4px;border:1px solid #f8514933;background:#f8514911";rst.textContent="Reset";rst.onclick=function(){pifTreePath=[];pifRenderDecomp();pifRenderDecompBC();};bc.appendChild(rst);}
}

// ── Main render ────────────────────────────────────────────
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
  pifTreePath=[];
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

  // Division bar
  var divs=["LS","L&R","HWB","B&L","Other"];
  var divData=divs.map(function(d){var v=PIF.DIV[d]||[0,0,0,0];var t=v[0],p=v[1]+v[3];return{d:d,total:t,pif:p,pp:v[2],rate:t>0?(p/t*100):0};}).filter(function(x){return x.total>0;});
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

  // Partner category - use PCM filtered by date range
  var r3=pifRange();
  var pcatTotals={};
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
  var top30=skuArr.slice(0,30);
  var tRows=top30.map(function(s){
    var cl=s.pifRate>=95?"#3fb950":s.pifRate>=80?"#58a6ff":"#bc8cff";
    var bg=s.pifRate>=95?"#3fb950":s.pifRate>=80?"#388bfd":"#bc8cff";
    return"<tr><td><span class='pill'>"+s.sku+"</span></td>"+
      "<td class='num'>"+s.total.toLocaleString()+"</td>"+
      "<td class='num' style='color:#3fb950'>"+s.pif.toLocaleString()+"</td>"+
      "<td class='num' style='color:#e3b341'>"+s.late.toLocaleString()+"</td>"+
      "<td class='num' style='color:#bc8cff'>"+s.pp.toLocaleString()+"</td>"+
      "<td><div class='bw'><div class='bb'><div class='bf' style='width:"+s.pifRate.toFixed(0)+"%;background:"+bg+"'></div></div>"+
      "<span class='num' style='min-width:42px;font-size:11px;color:"+cl+"'>"+s.pifRate.toFixed(1)+"%</span></div></td>"+
      "<td class='num' style='color:#8b949e'>$"+Math.round(s.pifInv+s.lateInv).toLocaleString()+"</td>"+
      "<td class='num' style='color:#8b949e'>$"+Math.round(s.ppInv).toLocaleString()+"</td></tr>";
  }).join("");
  document.getElementById("pif-skuTbody").innerHTML=tRows;
  document.getElementById("pif-tblInfo").textContent=skuArr.length+" SKUs · "+T.toLocaleString()+" orders";

  document.getElementById("pif-loading").style.display="none";
  document.getElementById("pif-main").style.display="block";
}

// ── Load ───────────────────────────────────────────────────
fetch("pif_data.json").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
  .then(function(data){PIF=data;pifRenderSkuItems();pifRenderMsItems();pifRender();})
  .catch(function(err){document.getElementById("pif-loading").innerHTML='<div style="color:#f85149">Failed to load pif_data.json: '+err.message+"</div>";});
