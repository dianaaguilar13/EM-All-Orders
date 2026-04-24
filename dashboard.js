var D=null,Ti=0,Ci=1,Ei=2,Ui=3,Di=4,Ai=5,Ii=6,CRi=7;
var selP=new Set(),charts={},treePath=[],currentTree=null;

function sumArr(arr){var o=[0,0,0,0,0,0,0,0];for(var i=0;i<arr.length;i++){var a=arr[i];if(a)for(var j=0;j<8;j++)o[j]+=(a[j]||0);}return o;}

// ── Multi-select ──────────────────────────────────────────
function toggleMs(e){e.stopPropagation();var dr=document.getElementById("msDrop");dr.classList.toggle("open");if(dr.classList.contains("open")){document.getElementById("msQ").focus();renderMsItems();}}
document.addEventListener("click",function(e){if(!document.getElementById("msWrap").contains(e.target))document.getElementById("msDrop").classList.remove("open");});
function renderMsItems(){if(!D)return;var q=document.getElementById("msQ").value.toLowerCase();var vis=D.FL.partners.filter(function(p){return p.toLowerCase().indexOf(q)>=0;});var h="";for(var i=0;i<vis.length;i++){var p=vis[i];var ck=selP.has(p)?"checked":"";var e=p.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");h+='<div class="ms-item" data-p="'+e+'" onclick="togP(this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";}document.getElementById("msItems").innerHTML=h;}
function togP(el){var p=el.getAttribute("data-p");if(selP.has(p))selP.delete(p);else selP.add(p);updateMsBtn();renderMsItems();}
function msAll(){var q=document.getElementById("msQ").value.toLowerCase();D.FL.partners.filter(function(p){return p.toLowerCase().indexOf(q)>=0;}).forEach(function(p){selP.add(p);});updateMsBtn();renderMsItems();}
function msClear(){selP.clear();updateMsBtn();renderMsItems();}
function updateMsBtn(){var btn=document.getElementById("msBtn");var cnt=document.getElementById("msCnt");if(selP.size===0){btn.textContent="All Partners";cnt.style.display="none";}else{btn.textContent=selP.size===1?Array.from(selP)[0].slice(0,22):selP.size+" partners selected";cnt.textContent=selP.size;cnt.style.display="inline";}}

// ── Filters ───────────────────────────────────────────────
function getRange(){return{df:document.getElementById("df").value.slice(0,7),dt:document.getElementById("dt").value.slice(0,7)};}
function getPcat(){return document.getElementById("fPcat").value;}
function fmtM(m){var p=m.split("-");return new Date(parseInt(p[0]),parseInt(p[1])-1).toLocaleString("default",{month:"short",year:"2-digit"});}

function myToKey(my){
  var mo={"Jan":"01","Feb":"02","Mar":"03","Apr":"04","May":"05","Jun":"06","Jul":"07","Aug":"08","Sep":"09","Oct":"10","Nov":"11","Dec":"12"};
  var p=my.split(" ");return(p.length===2&&mo[p[0]])?p[1]+"-"+mo[p[0]]:null;
}

// Get base tree for current partner/pcat filter
function getBaseTree(){
  if(selP.size===1)return(D.PT&&D.PT[Array.from(selP)[0]])||{};
  if(selP.size>1){
    var m={};
    selP.forEach(function(p){mergeDeepTree(m,(D.PT&&D.PT[p])||{},5);});
    return m;
  }
  if(getPcat())return(D.PCT&&D.PCT[getPcat()])||{};
  return D.GT||{};
}

function mergeDeepTree(dst,src,depth){
  Object.keys(src).forEach(function(k){
    if(depth<=1){dst[k]=(dst[k]||0)+(src[k]||0);}
    else{if(!dst[k])dst[k]={};mergeDeepTree(dst[k],src[k],depth-1);}
  });
}

// Filter tree to date range - returns {my: actMap} only for months in range
function getFilteredTree(){
  var r=getRange();
  var base=getBaseTree();
  var result={};
  Object.keys(base).forEach(function(my){
    var key=myToKey(my);
    if(!key||(key>=r.df&&key<=r.dt))result[my]=base[my];
  });
  return result;
}

function countDeep(node,depth){
  if(!node)return 0;
  if(depth<=0||typeof node!=="object")return(typeof node==="number")?node:0;
  var t=0;Object.values(node).forEach(function(v){t+=countDeep(v,depth-1);});return t;
}

// ── Decomp Tree ───────────────────────────────────────────
// treePath = array of LABELS (not indices) for each drill level
// treePath[0] = "Active" or "Inactive"
// treePath[1] = "Jun 2025"
// treePath[2] = "July" (refund month)
// treePath[3] = "Cancelled"
// treePath[4] = "<=30 days"

function buildDecompTree(){
  treePath=[];
  currentTree=getFilteredTree();
  renderDecomp();
}

var LEVEL_TITLES=["Total Units","Active Status","Month Year (purchase)","Refund Month","CNCL Status","Refund Days"];
var RD_LABELS={"0":"Same day","15":"<=15 days","30":"<=30 days","45":"<=45 days","60":"<=60 days","61":"61+ days"};
var CNCL_COLORS={"Cancelled":"#f85149","Entry Error":"#e3b341","Upgrade":"#3fb950","Downgrade":"#bc8cff","Switch":"#58a6ff","Sale":"#39d353"};

function getLevelItems(levelIdx){
  var tree=currentTree||{};
  if(levelIdx===0){
    return[{l:"Total Units",v:countDeep(tree,5),c:"#388bfd"}];
  }
  if(levelIdx===1){
    var active=0,inactive=0;
    Object.values(tree).forEach(function(actMap){
      active+=countDeep(actMap["Active"]||{},3);
      inactive+=countDeep(actMap["Inactive"]||{},3);
    });
    var items=[];
    if(active>0)items.push({l:"Active",v:active,c:"#58a6ff"});
    if(inactive>0)items.push({l:"Inactive",v:inactive,c:"#f85149"});
    return items;
  }
  if(levelIdx===2){
    var selAct=treePath[0]; // "Active" or "Inactive"
    if(!selAct)return[];
    var myMap={};
    Object.keys(tree).forEach(function(my){
      var cnt=countDeep((tree[my]&&tree[my][selAct])||{},3);
      if(cnt>0)myMap[my]=cnt;
    });
    return Object.entries(myMap).sort(function(a,b){return b[1]-a[1];})
      .map(function(e){return{l:e[0],v:e[1],c:"#388bfd"};});
  }
  if(levelIdx===3){
    var selAct=treePath[0],selMy=treePath[1];
    if(!selAct||!selMy)return[];
    var actNode=(tree[selMy]&&tree[selMy][selAct])||{};
    var rmMap={};
    Object.keys(actNode).forEach(function(cncl){
      Object.keys(actNode[cncl]).forEach(function(rm){
        if(rm==="none")return;
        rmMap[rm]=(rmMap[rm]||0)+countDeep(actNode[cncl][rm],1);
      });
    });
    return Object.entries(rmMap).sort(function(a,b){return b[1]-a[1];})
      .map(function(e){return{l:e[0],v:e[1],c:"#f85149"};});
  }
  if(levelIdx===4){
    var selAct=treePath[0],selMy=treePath[1],selRm=treePath[2];
    if(!selAct||!selMy||!selRm)return[];
    var actNode=(tree[selMy]&&tree[selMy][selAct])||{};
    var cnclMap={};
    Object.keys(actNode).forEach(function(cncl){
      var cnt=countDeep((actNode[cncl]&&actNode[cncl][selRm])||{},1);
      if(cnt>0)cnclMap[cncl]=(cnclMap[cncl]||0)+cnt;
    });
    return Object.entries(cnclMap).sort(function(a,b){return b[1]-a[1];})
      .map(function(e){return{l:e[0],v:e[1],c:CNCL_COLORS[e[0]]||"#388bfd"};});
  }
  if(levelIdx===5){
    var selAct=treePath[0],selMy=treePath[1],selRm=treePath[2],selCncl=treePath[3];
    if(!selAct||!selMy||!selRm||!selCncl)return[];
    var actNode=(tree[selMy]&&tree[selMy][selAct])||{};
    var rdNode=(actNode[selCncl]&&actNode[selCncl][selRm])||{};
    return Object.entries(rdNode).filter(function(e){return e[0]!=="none"&&e[1]>0;})
      .sort(function(a,b){return +a[0]-+b[0];})
      .map(function(e){return{l:RD_LABELS[e[0]]||e[0],v:e[1],c:"#388bfd"};});
  }
  return[];
}

function renderDecomp(){
  var showUpTo=Math.min(treePath.length+1,5);
  var container=document.getElementById("decompTree");
  container.innerHTML="";

  for(var li=0;li<=showUpTo;li++){
    var items=getLevelItems(li);
    if(!items||!items.length)break;

    var isClickable=(li===showUpTo&&li<5);
    var selectedLabel=treePath[li-1]||null; // label selected at this level

    if(li>0){
      var conn=document.createElement("div");
      conn.style.cssText="width:28px;align-self:stretch;display:flex;align-items:center;flex-shrink:0";
      conn.innerHTML='<div style="width:100%;height:1px;background:'+(treePath.length>=li?"#388bfd":"#30363d")+'"></div>';
      container.appendChild(conn);
    }

    var col=document.createElement("div");
    col.style.cssText="display:flex;flex-direction:column;flex-shrink:0;width:162px";
    var hdr=document.createElement("div");
    hdr.style.cssText="font-size:10px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:.6px;text-align:center;padding:5px 8px 8px;border-bottom:1px solid #30363d;margin-bottom:6px";
    hdr.textContent=LEVEL_TITLES[li];
    col.appendChild(hdr);

    var wrap=document.createElement("div");
    wrap.style.cssText="display:flex;flex-direction:column;gap:5px;max-height:420px;overflow-y:auto;padding-right:2px";
    var maxV=Math.max.apply(null,items.map(function(x){return x.v;}).concat([1]));
    var levelTotal=items.reduce(function(s,x){return s+x.v;},0);

    items.forEach(function(item){
      var isSel=(selectedLabel===item.l);
      var isDim=(selectedLabel&&!isSel);
      var bw=(item.v/maxV*100).toFixed(0);
      var pct=levelTotal>0?(item.v/levelTotal*100).toFixed(1):"0";

      var node=document.createElement("div");
      node.style.cssText=
        "background:"+(isSel?"#1c2128":"#161b22")+
        ";border:1px solid "+(isSel?"#388bfd":"#30363d")+
        ";border-radius:7px;padding:9px 11px;transition:all .15s;"+
        "opacity:"+(isDim?"0.3":"1")+
        ";cursor:"+(isClickable?"pointer":"default");

      node.innerHTML=
        '<div style="font-size:10px;color:#8b949e;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px" title="'+item.l+'">'+item.l+'</div>'+
        '<div style="font-size:20px;font-weight:700;color:'+item.c+';margin-bottom:5px;letter-spacing:-0.5px">'+item.v.toLocaleString()+'</div>'+
        '<div style="height:3px;background:#21262d;border-radius:2px;overflow:hidden;margin-bottom:4px">'+
          '<div style="height:100%;width:'+bw+'%;background:'+item.c+';border-radius:2px"></div>'+
        '</div>'+
        '<div style="font-size:10px;font-weight:500;color:'+item.c+'">'+pct+'% of level</div>'+
        (isClickable?'<div style="font-size:9px;color:#388bfd88;margin-top:3px">click to drill down</div>':"");

      if(isClickable){
        (function(capturedLabel,capturedLi){
          node.onclick=function(){
            treePath=treePath.slice(0,capturedLi-1);
            treePath.push(capturedLabel);
            renderDecomp();
            renderDecompBC();
          };
          node.onmouseenter=function(){if(!isSel)node.style.borderColor="#388bfd66";};
          node.onmouseleave=function(){if(!isSel)node.style.borderColor="#30363d";};
        })(item.l, li);
      }
      wrap.appendChild(node);
    });
    col.appendChild(wrap);
    container.appendChild(col);
  }
  renderDecompBC();
}

function renderDecompBC(){
  var bc=document.getElementById("decompBreadcrumb");
  if(!bc)return;
  bc.innerHTML="";
  function crumb(text,fn,active){
    var s=document.createElement("span");
    s.style.cssText="font-size:11px;color:"+(active?"#388bfd":"#8b949e")+";cursor:pointer;padding:2px 6px;border-radius:4px;font-weight:"+(active?"600":"400");
    s.textContent=text;
    if(fn){s.onclick=fn;s.onmouseenter=function(){s.style.background="#21262d";s.style.color="#e6edf3";};s.onmouseleave=function(){s.style.background="";s.style.color=active?"#388bfd":"#8b949e";};}
    bc.appendChild(s);
  }
  function sep(){var s=document.createElement("span");s.style.cssText="color:#30363d;font-size:12px";s.textContent=">";bc.appendChild(s);}
  crumb("Total Units",function(){treePath=[];renderDecomp();renderDecompBC();},treePath.length===0);
  treePath.forEach(function(label,i){
    sep();
    (function(ci,lbl){
      crumb(lbl,function(){treePath=treePath.slice(0,ci+1);renderDecomp();renderDecompBC();},i===treePath.length-1);
    })(i,label);
  });
  if(treePath.length>0){
    var pipe=document.createElement("span");pipe.style.cssText="color:#30363d;padding:0 4px";pipe.textContent="|";bc.appendChild(pipe);
    var rst=document.createElement("span");
    rst.style.cssText="font-size:11px;color:#f85149;cursor:pointer;padding:2px 8px;border-radius:4px;border:1px solid #f8514933;background:#f8514911";
    rst.textContent="Reset";
    rst.onclick=function(){treePath=[];renderDecomp();renderDecompBC();};
    bc.appendChild(rst);
  }
}

// ── Chart data helpers ────────────────────────────────────
function getTimeSeries(){
  var r=getRange(),pcat=getPcat(),byM={};
  if(selP.size>0){selP.forEach(function(p){var pm=(D.PM&&D.PM[p])||{};Object.keys(pm).forEach(function(m){if(m<r.df||m>r.dt)return;if(!byM[m])byM[m]=[0,0,0,0,0,0,0,0];var v=pm[m];for(var i=0;i<8;i++)byM[m][i]+=(v[i]||0);});});}
  else if(pcat){var pm=D.PCM[pcat]||{};Object.keys(pm).forEach(function(m){if(m>=r.df&&m<=r.dt)byM[m]=pm[m];});}
  else{Object.keys(D.M).forEach(function(m){if(m>=r.df&&m<=r.dt)byM[m]=D.M[m];});}
  return Object.keys(byM).sort().map(function(m){return{m:m,b:byM[m]};});
}
function getSkuBuckets(){
  var pcat=getPcat();
  if(selP.size>0){var m={};selP.forEach(function(p){var ps=(D.PSKU&&D.PSKU[p])||{};Object.keys(ps).forEach(function(sku){if(!m[sku])m[sku]=[0,0,0,0,0,0,0,0];var v=ps[sku];for(var i=0;i<8;i++)m[sku][i]+=(v[i]||0);});});return m;}
  if(pcat)return(D.PCSKU&&D.PCSKU[pcat])||D.S;
  return D.S;
}
function getRdCounts(){
  var pcat=getPcat();
  if(selP.size>0){var m={};selP.forEach(function(p){var rd=(D.PRD&&D.PRD[p])||{};Object.keys(rd).forEach(function(k){m[k]=(m[k]||0)+rd[k];});});return m;}
  if(pcat)return(D.PCRD&&D.PCRD[pcat])||D.RD;
  return D.RD;
}

// ── Main render ───────────────────────────────────────────
function destroyCharts(){Object.values(charts).forEach(function(c){try{c.destroy();}catch(e){}});charts={};}
function applyFilters(){document.getElementById("msDrop").classList.remove("open");render();}
function resetFilters(){document.getElementById("df").value="2022-01-01";document.getElementById("dt").value="2026-04-20";["fSku","fPcat","fAct","fCncl"].forEach(function(id){document.getElementById(id).value="";});selP.clear();updateMsBtn();render();}

function render(){
  destroyCharts();
  var ts=getTimeSeries();
  var tot=sumArr(ts.map(function(x){return x.b;}));
  var T=tot[Ti],C=tot[Ci],E=tot[Ei],U=tot[Ui],Dv=tot[Di],AC=tot[Ai],IN=tot[Ii],LR=tot[CRi];
  var valid=T-E,rate=valid>0?(C/valid*100):0,net=T-C-E,sale=Math.max(0,T-C-E-U-Dv);
  var pcat=getPcat();
  document.getElementById("rcLbl").textContent=T.toLocaleString()+" records "+(selP.size>0?selP.size+" partner(s)":pcat||"all data");

  document.getElementById("kpiRow").innerHTML=
    '<div class="kpi k1"><div class="kl">Total Units</div><div class="kv">'+T.toLocaleString()+'</div><div class="ks muted">PAYMENTS_TOTAL &gt; 0</div></div>'+
    '<div class="kpi k2"><div class="kl">Active</div><div class="kv" style="color:#58a6ff">'+AC.toLocaleString()+'</div><div class="ks muted">'+(T>0?(AC/T*100).toFixed(1):0)+'% of total</div></div>'+
    '<div class="kpi k3"><div class="kl">Inactive</div><div class="kv" style="color:#f85149">'+IN.toLocaleString()+'</div><div class="ks red">'+(T>0?(IN/T*100).toFixed(1):0)+'% of total</div></div>'+
    '<div class="kpi k4"><div class="kl">Cancelled</div><div class="kv" style="color:#f85149">'+C.toLocaleString()+'</div><div class="ks red">'+rate.toFixed(2)+'% cancel rate</div></div>'+
    '<div class="kpi k5"><div class="kl">Entry Error</div><div class="kv" style="color:#e3b341">'+E.toLocaleString()+'</div><div class="ks amber">excl. from cancel %</div></div>'+
    '<div class="kpi k6"><div class="kl">Upgrades</div><div class="kv" style="color:#3fb950">'+U.toLocaleString()+'</div><div class="ks green">upgrade events</div></div>'+
    '<div class="kpi k7"><div class="kl">Downgrades</div><div class="kv" style="color:#bc8cff">'+Dv.toLocaleString()+'</div><div class="ks muted">downgrade events</div></div>'+
    '<div class="kpi k8"><div class="kl">Lost Revenue</div><div class="kv" style="color:#39d353">$'+Math.round(LR).toLocaleString()+'</div><div class="ks red">payments on cancels</div></div>';

  var mLabels=ts.map(function(x){return fmtM(x.m);});
  charts.trend=new Chart(document.getElementById("trendChart"),{type:"bar",data:{labels:mLabels,datasets:[
    {label:"Cancelled",data:ts.map(function(x){return x.b[Ci];}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3,stack:"s"},
    {label:"Entry Error",data:ts.map(function(x){return x.b[Ei];}),backgroundColor:"rgba(227,179,65,0.8)",borderRadius:3,stack:"s"},
    {label:"Upgrade",data:ts.map(function(x){return x.b[Ui];}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
    {label:"Downgrade",data:ts.map(function(x){return x.b[Di];}),backgroundColor:"rgba(188,140,255,0.8)",borderRadius:3,stack:"s"},
    {label:"Cancel %",data:ts.map(function(x){var v=x.b[Ti]-x.b[Ei];return v>0?+(x.b[Ci]/v*100).toFixed(2):0;}),type:"line",yAxisID:"y2",borderColor:"#388bfd",backgroundColor:"rgba(56,139,253,0.07)",fill:true,tension:0.35,pointRadius:2,pointBackgroundColor:"#388bfd",borderWidth:2}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},scales:{
    x:{stacked:true,ticks:{color:"#8b949e",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#21262d44"}},
    y:{stacked:true,ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},
    y2:{position:"right",ticks:{color:"#388bfd",font:{size:10},callback:function(v){return v+"%";}},grid:{display:false}}
  }}});

  buildDecompTree();

  var skuBkts=getSkuBuckets();
  var skuArr=Object.keys(skuBkts).map(function(sku){var v=skuBkts[sku];return{sku:sku,T:v[Ti],C:v[Ci],E:v[Ei],U:v[Ui],D:v[Di],AC:v[Ai],IN:v[Ii],LR:v[CRi],sale:Math.max(0,v[Ti]-v[Ci]-v[Ei]-v[Ui]-v[Di]),rate:v[Ti]>0?((v[Ci]+v[Ei])/v[Ti]*100):0};}).filter(function(s){return s.T>0;}).sort(function(a,b){return b.C-a.C;});
  var top15=skuArr.slice(0,15),bh=Math.max(280,top15.length*38);
  document.getElementById("skuBarWrap").style.height=bh+"px";
  document.getElementById("skuGrpWrap").style.height=bh+"px";
  if(top15.length>0){
    charts.skuBar=new Chart(document.getElementById("skuBarChart"),{type:"bar",data:{labels:top15.map(function(s){return s.sku;}),datasets:[{data:top15.map(function(s){return +s.rate.toFixed(1);}),backgroundColor:top15.map(function(s){return s.rate>30?"rgba(248,81,73,0.85)":s.rate>15?"rgba(227,179,65,0.85)":"rgba(56,139,253,0.85)";}),borderRadius:4}]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ctx.parsed.x.toFixed(1)+"%";}}}},scales:{x:{ticks:{color:"#8b949e",font:{size:10},callback:function(v){return v+"%";}},grid:{color:"#21262d44"}},y:{ticks:{color:"#e6edf3",font:{size:10}},grid:{display:false}}}}});
    charts.skuGrp=new Chart(document.getElementById("skuGrpChart"),{type:"bar",data:{labels:top15.map(function(s){return s.sku;}),datasets:[{label:"Cancelled",data:top15.map(function(s){return s.C;}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3},{label:"Entry Error",data:top15.map(function(s){return s.E;}),backgroundColor:"rgba(227,179,65,0.8)",borderRadius:3},{label:"Upgraded",data:top15.map(function(s){return s.U;}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3},{label:"Downgraded",data:top15.map(function(s){return s.D;}),backgroundColor:"rgba(188,140,255,0.8)",borderRadius:3}]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},y:{ticks:{color:"#e6edf3",font:{size:10}},grid:{display:false}}}}});
  }
  var pcatKeys=Object.keys(D.PC).sort(function(a,b){return(D.PC[b].cancelled||0)-(D.PC[a].cancelled||0);});
  charts.pcat=new Chart(document.getElementById("pcatChart"),{type:"doughnut",data:{labels:pcatKeys,datasets:[{data:pcatKeys.map(function(k){return(D.PC[k].cancelled||0)+(D.PC[k].entry_error||0);}),backgroundColor:["#388bfd","#f85149","#3fb950","#e3b341","#bc8cff"],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:"62%",plugins:{legend:{position:"right",labels:{color:"#8b949e",font:{size:11},boxWidth:10,padding:8}}}}});
  var rdCounts=getRdCounts(),rdK=["0","15","30","45","60","61"],rdL=["Same day","<=15d","<=30d","<=45d","<=60d","61+d"];
  charts.rd=new Chart(document.getElementById("rdChart"),{type:"bar",data:{labels:rdL,datasets:[{data:rdK.map(function(k){return rdCounts[k]||0;}),backgroundColor:"rgba(56,139,253,0.75)",borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},y:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}}}}});

  var mx=Math.max.apply(null,skuArr.map(function(s){return s.rate;}).concat([1]));
  document.getElementById("tblInfo").textContent=skuArr.length+" SKUs "+T.toLocaleString()+" units";
  var rows="";
  for(var i=0;i<skuArr.length;i++){var s=skuArr[i];var cl=s.rate>30?"#f85149":s.rate>15?"#e3b341":"#56d364";var bg=s.rate>30?"#f85149":s.rate>15?"#e3b341":"#388bfd";rows+="<tr><td><span class='pill'>"+s.sku+"</span></td><td class='num'>"+s.T.toLocaleString()+"</td><td class='num' style='color:#58a6ff'>"+s.AC.toLocaleString()+"</td><td class='num' style='color:#f85149'>"+s.IN.toLocaleString()+"</td><td class='num'>"+s.sale.toLocaleString()+"</td><td class='num' style='color:#ff7b72'>"+s.C.toLocaleString()+"</td><td class='num' style='color:#e3b341'>"+s.E.toLocaleString()+"</td><td class='num' style='color:#56d364'>"+s.U.toLocaleString()+"</td><td class='num' style='color:#bc8cff'>"+s.D.toLocaleString()+"</td><td class='num'>"+(s.T-s.C-s.E).toLocaleString()+"</td><td><div class='bw'><div class='bb'><div class='bf' style='width:"+(s.rate/mx*100).toFixed(0)+"%;background:"+bg+"'></div></div><span class='num' style='min-width:38px;font-size:11px;color:"+cl+"'>"+s.rate.toFixed(2)+"%</span></div></td><td class='num' style='color:#ff7b72'>$"+Math.round(s.LR).toLocaleString()+"</td></tr>";}
  document.getElementById("skuTbody").innerHTML=rows;
  document.getElementById("skuTfoot").innerHTML="<td>Total</td><td class='num'>"+T.toLocaleString()+"</td><td class='num' style='color:#58a6ff'>"+AC.toLocaleString()+"</td><td class='num' style='color:#f85149'>"+IN.toLocaleString()+"</td><td class='num'>"+sale.toLocaleString()+"</td><td class='num' style='color:#ff7b72'>"+C.toLocaleString()+"</td><td class='num' style='color:#e3b341'>"+E.toLocaleString()+"</td><td class='num' style='color:#56d364'>"+U.toLocaleString()+"</td><td class='num' style='color:#bc8cff'>"+Dv.toLocaleString()+"</td><td class='num'>"+net.toLocaleString()+"</td><td class='num'>"+rate.toFixed(2)+"%</td><td class='num' style='color:#ff7b72'>$"+Math.round(LR).toLocaleString()+"</td>";
}

function initDashboard(){
  document.getElementById("mainContent").innerHTML='<div class="main"><div class="kpi-row" id="kpiRow"></div><div class="card full"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px"><div><div class="ct">Cancel % rate by month</div><div class="cs" style="margin-bottom:0">Stacked by status with cancel rate line</div></div><div class="legend" style="margin-bottom:0"><div class="li"><div class="ld" style="background:#f85149"></div>Cancelled</div><div class="li"><div class="ld" style="background:#e3b341"></div>Entry Error</div><div class="li"><div class="ld" style="background:#3fb950"></div>Upgrade</div><div class="li"><div class="ld" style="background:#bc8cff"></div>Downgrade</div><div class="li"><div class="ld" style="background:#388bfd;width:18px;height:2px;border-radius:0"></div>Cancel %</div></div></div><div style="height:260px;position:relative"><canvas id="trendChart"></canvas></div></div><div class="card full"><div class="ct">Decomposition tree</div><div class="cs">Click any node to drill down. Numbers decrease as you narrow down.</div><div id="decompBreadcrumb" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:10px;min-height:24px"></div><div style="overflow-x:auto;padding-bottom:8px"><div id="decompTree" style="display:flex;align-items:flex-start;gap:0;min-width:max-content;padding:2px"></div></div></div><div class="grid2"><div class="card"><div class="ct">Cancel % by SKU</div><div class="cs">Top 15</div><div id="skuBarWrap" style="height:320px;position:relative"><canvas id="skuBarChart"></canvas></div></div><div class="card"><div class="ct">Volume by SKU</div><div class="cs">Cancelled - Entry Error - Upgrade - Downgrade</div><div id="skuGrpWrap" style="height:320px;position:relative"><canvas id="skuGrpChart"></canvas></div></div></div><div class="grid2"><div class="card"><div class="ct">By partner category</div><div class="cs">Share of cancellations</div><div style="height:200px;position:relative"><canvas id="pcatChart"></canvas></div></div><div class="card"><div class="ct">Refund days</div><div class="cs">Days between order and refund</div><div style="height:200px;position:relative"><canvas id="rdChart"></canvas></div></div></div><div class="card full"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><div class="ct">SKU summary</div><div style="font-size:11px;color:#8b949e" id="tblInfo"></div></div><div class="tbl-wrap"><table><thead><tr><th>SKU</th><th>Total</th><th>Active</th><th>Inactive</th><th>Sale</th><th>Cancelled</th><th>Entry Error</th><th>Upgrade</th><th>Downgrade</th><th>Net Orders</th><th>Cancel %</th><th>Lost Revenue</th></tr></thead><tbody id="skuTbody"></tbody><tfoot><tr class="tfoot" id="skuTfoot"></tr></tfoot></table></div></div></div>';
  var sk=document.getElementById("fSku");D.FL.skus.forEach(function(s){var o=document.createElement("option");o.value=o.textContent=s;sk.appendChild(o);});
  renderMsItems();render();
}

fetch("data.json").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(function(data){D=data;initDashboard();}).catch(function(err){document.getElementById("mainContent").innerHTML='<div class="loading"><div style="color:#f85149">Failed to load data.json: '+err.message+"</div></div>";});
