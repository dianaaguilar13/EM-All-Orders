var D=null,Ti=0,Ci=1,Ei=2,Ui=3,Di=4,Ai=5,Ii=6,CRi=7,Si=8,Pi=9,NPi=10,LDPCi=11;
var selP=new Set(),selSku=new Set(),selPcat=new Set(),charts={};
var RD_KEYS=["<=30d","<=45d","<=60d","<=90d",">90d","N/A"],RD_LABELS=["≤30d","≤45d","≤60d","≤90d",">90d","N/A"];

// SKUs excluded from all dropdowns and from global "all-data" totals
var EXCLUDED_SKUS=new Set(["5DC","BT-Dinner Ticket","CAP-2022-06-Ticket-Free","CAP-2022-06-Ticket-VIP Upgrade","CAP-2022-06-VIP Upgrade","CAP-Catapult","CCT Kit","DBL 2022-10 Package","DBL 2022-10 Ticket","DBL 2023-05 Package","DBL 2023-05 Ticket","DBL 2024-05 Package","DBL 2024-05 Ticket","DBL 2025-01 Package","DBL 2025-01 Ticket","DBL 2026-01 Package","DBL 2026-01 Ticket","DBLV 2022-01 Ticket","DBLV 2022-05 Ticket","DBLV 2022-10 Package","DBLV 2022-10 Ticket","DBLV 2023-01 Package","DBLV 2023-01 Ticket","DBLV 2023-09 Package","DBLV 2023-09 Ticket","DBLV 2024-01 Package","DBLV 2024-01 Ticket","DBLV 2024-09 Package","DBLV 2024-09 Ticket","DBLV 2025-01 Package","DBLV 2025-01 Ticket","DBLV 2025-05 Package","DBLV 2025-05 Ticket","DBLV 2025-09 Package","DBLV 2025-09 Ticket","DBLV 2026-05 Package","DBLV 2026-05 Ticket","Deferment","INTSV4ADD","LMI DB CMBO","LMI DB DG","LMI DB DG SP","LMI DB PH GB","LMI DBK PH","LMI IYG CMBO","LMI IYG DG","LMI IYG PH","LMI LM CMBO","LMI LM DG","LMI LMK PH","LMI WWL CMBO","LMI WWL DG","LMI WWL PH","Pending","Pending Order","Unknown"]);

function sumArr(arr){var o=[0,0,0,0,0,0,0,0,0,0,0,0];for(var i=0;i<arr.length;i++){var a=arr[i];if(a)for(var j=0;j<12;j++)o[j]+=(a[j]||0);}return o;}

// ── Multi-select ──────────────────────────────────────────
function toggleMs(e){var dr=document.getElementById("msDrop");dr.classList.toggle("open");if(dr.classList.contains("open")){document.getElementById("msQ").focus();renderMsItems();}}
document.addEventListener("click",function(e){if(!document.getElementById("msWrap").contains(e.target))document.getElementById("msDrop").classList.remove("open");});
document.addEventListener("click",function(e){if(!document.getElementById("msSkuWrap").contains(e.target))document.getElementById("msSkuDrop").classList.remove("open");});
document.addEventListener("click",function(e){if(!document.getElementById("msPcatWrap").contains(e.target))document.getElementById("msPcatDrop").classList.remove("open");});
function renderMsItems(){if(!D)return;var q=document.getElementById("msQ").value.toLowerCase();var vis=D.FL.partners.filter(function(p){return p.toLowerCase().indexOf(q)>=0;});var h="";for(var i=0;i<vis.length;i++){var p=vis[i];var ck=selP.has(p)?"checked":"";var e=p.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");h+='<div class="ms-item" data-p="'+e+'" onclick="togP(event,this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";}document.getElementById("msItems").innerHTML=h;}
function togP(ev,el){ev.stopPropagation();var p=el.getAttribute("data-p");if(selP.has(p))selP.delete(p);else selP.add(p);updateMsBtn();renderMsItems();}
function msAll(){var q=document.getElementById("msQ").value.toLowerCase();D.FL.partners.filter(function(p){return p.toLowerCase().indexOf(q)>=0;}).forEach(function(p){selP.add(p);});updateMsBtn();renderMsItems();}
function msClear(){selP.clear();updateMsBtn();renderMsItems();}
function updateMsBtn(){var btn=document.getElementById("msBtn");var cnt=document.getElementById("msCnt");if(selP.size===0){btn.textContent="All Partners";cnt.style.display="none";}else{btn.textContent=selP.size===1?Array.from(selP)[0].slice(0,22):selP.size+" partners selected";cnt.textContent=selP.size;cnt.style.display="inline";}}

// ── SKU Multi-select ──────────────────────────────────────────
function toggleMsSku(e){var dr=document.getElementById("msSkuDrop");dr.classList.toggle("open");if(dr.classList.contains("open")){document.getElementById("msSkuQ").focus();renderMsSkuItems();}}
function renderMsSkuItems(){if(!D)return;var q=document.getElementById("msSkuQ").value.toLowerCase();var incl=D.FL.skus.filter(function(s){return!EXCLUDED_SKUS.has(s)&&s.toLowerCase().indexOf(q)>=0;});var excl=D.FL.skus.filter(function(s){return EXCLUDED_SKUS.has(s)&&s.toLowerCase().indexOf(q)>=0;});var h="";for(var i=0;i<incl.length;i++){var s=incl[i];var ck=selSku.has(s)?"checked":"";var esc=s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");h+='<div class="ms-item" data-p="'+esc+'" onclick="togSku(event,this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+esc+"</span></div>";}if(excl.length>0){h+='<div style="padding:5px 10px 3px;font-size:10px;color:#94a3b8;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">⚠ Excluded by default</div>';for(var i=0;i<excl.length;i++){var s=excl[i];var ck=selSku.has(s)?"checked":"";var esc=s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");h+='<div class="ms-item" data-p="'+esc+'" onclick="togSku(event,this)" style="opacity:0.65"><input type="checkbox" '+ck+' onclick="return false"><span style="color:#94a3b8">'+esc+"</span></div>";}}document.getElementById("msSkuItems").innerHTML=h;}
function togSku(ev,el){ev.stopPropagation();var s=el.getAttribute("data-p");if(selSku.has(s))selSku.delete(s);else selSku.add(s);updateMsSkuBtn();renderMsSkuItems();}
function skuAll(){var q=document.getElementById("msSkuQ").value.toLowerCase();D.FL.skus.filter(function(s){return!EXCLUDED_SKUS.has(s)&&s.toLowerCase().indexOf(q)>=0;}).forEach(function(s){selSku.add(s);});updateMsSkuBtn();renderMsSkuItems();}
function skuClear(){selSku.clear();updateMsSkuBtn();renderMsSkuItems();}
function updateMsSkuBtn(){var btn=document.getElementById("msSkuBtn");var cnt=document.getElementById("msSkuCnt");if(selSku.size===0){btn.textContent="All SKUs";cnt.style.display="none";}else{btn.textContent=selSku.size===1?Array.from(selSku)[0].slice(0,22):selSku.size+" SKUs selected";cnt.textContent=selSku.size;cnt.style.display="inline";}}

// ── PCat Multi-select ──────────────────────────────────────────
var PCAT_OPTS=["Enrollment Mentor","Event","Marketing","Affiliate"];
function toggleMsPcat(e){var dr=document.getElementById("msPcatDrop");dr.classList.toggle("open");if(dr.classList.contains("open"))renderMsPcatItems();}
function renderMsPcatItems(){var h="";for(var i=0;i<PCAT_OPTS.length;i++){var p=PCAT_OPTS[i];var ck=selPcat.has(p)?"checked":"";h+='<div class="ms-item" data-p="'+p+'" onclick="togPcat(event,this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+p+"</span></div>";}document.getElementById("msPcatItems").innerHTML=h;}
function togPcat(ev,el){ev.stopPropagation();var p=el.getAttribute("data-p");if(selPcat.has(p))selPcat.delete(p);else selPcat.add(p);updateMsPcatBtn();renderMsPcatItems();}
function pcatAll(){PCAT_OPTS.forEach(function(p){selPcat.add(p);});updateMsPcatBtn();renderMsPcatItems();}
function pcatClear(){selPcat.clear();updateMsPcatBtn();renderMsPcatItems();}
function updateMsPcatBtn(){var btn=document.getElementById("msPcatBtn");var cnt=document.getElementById("msPcatCnt");if(selPcat.size===0){btn.textContent="All Categories";cnt.style.display="none";}else{btn.textContent=selPcat.size===1?Array.from(selPcat)[0]:selPcat.size+" categories";cnt.textContent=selPcat.size;cnt.style.display="inline";}}

// ── Filters ───────────────────────────────────────────────
function getRange(){return{df:document.getElementById("df").value.slice(0,7),dt:document.getElementById("dt").value.slice(0,7)};}
function getPcat(){return selPcat.size>0?Array.from(selPcat)[0]:"";}
function getSku(){return selSku.size>0?Array.from(selSku)[0]:"";}
function fmtM(m){var p=m.split("-");return new Date(parseInt(p[0]),parseInt(p[1])-1).toLocaleString("default",{month:"short",year:"2-digit"});}

function myToKey(my){
  var mo={"Jan":"01","Feb":"02","Mar":"03","Apr":"04","May":"05","Jun":"06","Jul":"07","Aug":"08","Sep":"09","Oct":"10","Nov":"11","Dec":"12"};
  var p=my.split(" ");return(p.length===2&&mo[p[0]])?p[1]+"-"+mo[p[0]]:null;
}

// Get base tree for current partner/pcat filter
var CNCL_DECOMP_PATH=[]; // [{dim, label, value}]
var CNCL_DIM_LABELS={
  "act":"Active Status","cncl":"Cancel Status","sku":"SKU",
  "pcat":"Partner Category","month":"Month"
};
var CNCL_DIM_ORDER=["act","cncl","sku","pcat","month"];

function cnclDecompGetItems(dim){
  var r=getRange(),pcat=getPcat(),sku=getSku();
  var ts=getTimeSeries();
  var tot=sumArr(ts.map(function(x){return x.b;}));
  var T=tot[Ti]||0,C=tot[Ci]||0,E=tot[Ei]||0,U=tot[Ui]||0,Dv=tot[Di]||0;
  var AC=tot[Ai]||0,IN=tot[Ii]||0;

  // Get path selections
  var selAct=null,selCncl=null,selSku2=null,selPcat2=null;
  CNCL_DECOMP_PATH.forEach(function(p){
    if(p.dim==="act")selAct=p.value;
    else if(p.dim==="cncl")selCncl=p.value;
    else if(p.dim==="sku")selSku2=p.value;
    else if(p.dim==="pcat")selPcat2=p.value;
  });

  // Apply act filter ratio
  function actRatio(b){
    if(!selAct)return 1;
    var t=b[Ti]||0;return t>0?(selAct==="Active"?(b[Ai]||0):(b[Ii]||0))/t:0;
  }
  // Apply cncl filter ratio  
  function cnclCount(b){
    if(!selCncl)return b[Ti]||0;
    var c=b[Ci]||0,e=b[Ei]||0,u=b[Ui]||0,d=b[Di]||0,t=b[Ti]||0;
    var sw=b[Si]||0,pe=b[Pi]||0,np=b[NPi]||0;
    if(selCncl==="Cancelled")  return c;
    if(selCncl==="Entry Error")return e;
    if(selCncl==="Upgrade")    return u;
    if(selCncl==="Downgrade")  return d;
    if(selCncl==="Switch")     return sw;
    if(selCncl==="Pend")       return pe;
    if(selCncl==="No Pmt")     return np;
    if(selCncl==="Sale")       return Math.max(0,t-c-e-u-d-sw-pe-np);
    return t;
  }

  if(dim==="act"){
    return[
      {label:"Active",value:"Active",count:AC,color:"#2563eb"},
      {label:"Inactive ("+IN+")",value:"Inactive",count:IN,color:"#ef4444",note:"incl. "+E+" entry errors"}
    ].filter(function(x){return x.count>0;});
  }

  if(dim==="cncl"){
    var valid=T-E;
    var sale=Math.max(0,T-C-E-U-Dv);
    var items=[
      {label:"Sale",value:"Sale",count:Math.round(sale*(selAct?actRatio(tot):1)),color:"#16a34a"},
      {label:"Cancelled",value:"Cancelled",count:Math.round(C*(selAct?actRatio(tot):1)),color:"#f85149"},
      {label:"Entry Error",value:"Entry Error",count:Math.round(E*(selAct?actRatio(tot):1)),color:"#e3b341"},
      {label:"Upgrade",value:"Upgrade",count:Math.round(U*(selAct?actRatio(tot):1)),color:"#3fb950"},
      {label:"Downgrade",value:"Downgrade",count:Math.round(Dv*(selAct?actRatio(tot):1)),color:"#bc8cff"}
    ].filter(function(x){return x.count>0;});
    return items;
  }

  if(dim==="sku"){
    var skuBkts=getSkuBuckets();
    return Object.entries(skuBkts).map(function(e){
      var b=e[1],v=cnclCount(b);
      if(selAct)v=Math.round(v*actRatio(b));
      return{label:e[0],value:e[0],count:v,color:"#388bfd"};
    }).filter(function(x){return x.count>0;}).sort(function(a,b){return b.count-a.count;}).slice(0,20);
  }

  if(dim==="pcat"){
    var r2=getRange();
    var pcatTotals={};
    Object.keys(D.PCM||{}).forEach(function(pc){
      var pm=D.PCM[pc];
      var t=0;
      Object.keys(pm).filter(function(m){return m>=r2.df&&m<=r2.dt;}).forEach(function(m){
        var b=pm[m]||[];
        var v=cnclCount(b);
        if(selAct)v=Math.round(v*actRatio(b));
        t+=v;
      });
      if(t>0)pcatTotals[pc]=t;
    });
    var pcColors={"Marketing":"#388bfd","Enrollment Mentor":"#f85149","Event":"#e3b341","Affiliate":"#3fb950"};
    return Object.entries(pcatTotals).map(function(e){
      return{label:e[0],value:e[0],count:e[1],color:pcColors[e[0]]||"#8b949e"};
    }).filter(function(x){return x.count>0;}).sort(function(a,b){return b.count-a.count;});
  }

  if(dim==="month"){
    return ts.map(function(x){
      var b=x.b;
      var v=cnclCount(b);
      if(selAct)v=Math.round(v*actRatio(b));
      return{label:fmtM(x.m),value:x.m,count:v,color:"#388bfd"};
    }).filter(function(x){return x.count>0;});
  }

  return[];
}

function renderDecomp(){
  var container=document.getElementById("decompTree");
  if(!container)return;
  container.innerHTML="";

  var ts=getTimeSeries();
  var tot=sumArr(ts.map(function(x){return x.b;}));
  var T=tot[Ti]||0;

  var usedDims=CNCL_DECOMP_PATH.map(function(p){return p.dim;});
  var availDims=CNCL_DIM_ORDER.filter(function(d){return usedDims.indexOf(d)<0;});

  // Col 0: Total
  container.appendChild(cnclDecompCol("Total Units",[
    {label:"Total Units",value:null,count:T,color:"#388bfd"}
  ],null));

  // Cols for each path step
  CNCL_DECOMP_PATH.forEach(function(step,i){
    var items=cnclDecompGetItems(step.dim);
    var conn=document.createElement("div");
    conn.style.cssText="width:24px;align-self:stretch;display:flex;align-items:center;flex-shrink:0";
    conn.innerHTML='<div style="width:100%;height:1px;background:#388bfd"></div>';
    container.appendChild(conn);
    container.appendChild(cnclDecompCol(CNCL_DIM_LABELS[step.dim],items,step));
  });

  // Add breakdown dropdown
  if(availDims.length>0){
    var conn=document.createElement("div");
    conn.style.cssText="width:24px;align-self:stretch;display:flex;align-items:center;flex-shrink:0";
    conn.innerHTML='<div style="width:100%;height:1px;background:#30363d;border-top:1px dashed #388bfd44"></div>';
    container.appendChild(conn);

    var addCol=document.createElement("div");
    addCol.style.cssText="display:flex;flex-direction:column;flex-shrink:0;width:168px;align-items:center;justify-content:center;padding:20px 8px";
    addCol.innerHTML=
      '<div style="font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;text-align:center">Add breakdown</div>'+
      '<select id="cncl-decomp-next" style="width:100%;background:#f1f5f9;border:1px solid #388bfd44;color:#e6edf3;padding:6px 8px;border-radius:6px;font-size:12px;cursor:pointer;outline:none">'+
        '<option value="">Select dimension...</option>'+
        availDims.map(function(d){return'<option value="'+d+'">'+CNCL_DIM_LABELS[d]+'</option>';}).join("")+
      '</select>'+
      '<div id="cncl-decomp-items" style="margin-top:10px;width:100%;display:flex;flex-direction:column;gap:4px;max-height:320px;overflow-y:auto"></div>';
    container.appendChild(addCol);

    setTimeout(function(){
      var sel=document.getElementById("cncl-decomp-next");
      if(!sel)return;
      sel.onchange=function(){
        var dim=this.value;if(!dim)return;
        var items=cnclDecompGetItems(dim);
        var wrap=document.getElementById("cncl-decomp-items");
        if(!wrap)return;
        wrap.innerHTML="";
        var maxV=Math.max.apply(null,items.map(function(x){return x.count;}).concat([1]));
        items.slice(0,15).forEach(function(item){
          var btn=document.createElement("div");
          btn.style.cssText="background:#ffffff;border:1px solid #dde3ea;border-radius:6px;padding:8px 10px;cursor:pointer;transition:all .15s";
          btn.innerHTML=
            '<div style="font-size:10px;color:#8b949e;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+item.label+'">'+item.label+'</div>'+
            '<div style="font-size:17px;font-weight:700;color:'+item.color+';letter-spacing:-0.5px">'+item.count.toLocaleString()+'</div>'+
            '<div style="height:3px;background:#f1f5f9;border-radius:2px;margin-top:4px"><div style="height:100%;width:'+(item.count/maxV*100).toFixed(0)+'%;background:'+item.color+';border-radius:2px"></div></div>';
          btn.onmouseenter=function(){btn.style.borderColor=item.color+"66";btn.style.background="#1c2128";};
          btn.onmouseleave=function(){btn.style.borderColor="#30363d";btn.style.background="#161b22";};
          btn.onclick=function(){
            CNCL_DECOMP_PATH.push({dim:dim,label:item.label,value:item.value});
            renderDecomp();renderDecompBC();
          };
          wrap.appendChild(btn);
        });
      };
    },50);
  }
  renderDecompBC();
}

function cnclDecompCol(title,items,currentStep){
  var col=document.createElement("div");
  col.style.cssText="display:flex;flex-direction:column;flex-shrink:0;width:168px";
  var hdr=document.createElement("div");
  hdr.style.cssText="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.6px;text-align:center;padding:5px 8px 8px;border-bottom:1px solid #dde3ea;margin-bottom:6px";
  hdr.textContent=title;col.appendChild(hdr);
  var wrap=document.createElement("div");
  wrap.style.cssText="display:flex;flex-direction:column;gap:5px;max-height:380px;overflow-y:auto;padding-right:2px";
  var levelTotal=items.reduce(function(s,x){return s+x.count;},0);
  var maxV=Math.max.apply(null,items.map(function(x){return x.count;}).concat([1]));
  var selVal=currentStep?currentStep.value:null;
  items.forEach(function(item){
    var isSel=currentStep&&selVal===item.value;
    var isDim=currentStep&&selVal&&!isSel;
    var node=document.createElement("div");
    node.style.cssText="background:"+(isSel?"#1c2128":"#161b22")+";border:1px solid "+(isSel?item.color:"#30363d")+";border-radius:7px;padding:9px 11px;transition:all .15s;opacity:"+(isDim?"0.25":"1")+";cursor:default";
    node.innerHTML=
      '<div style="font-size:10px;color:#64748b;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:146px" title="'+item.label+'">'+item.label+'</div>'+
      '<div style="font-size:20px;font-weight:700;color:'+item.color+';margin-bottom:5px;letter-spacing:-0.5px">'+item.count.toLocaleString()+'</div>'+
      '<div style="height:3px;background:#f1f5f9;border-radius:2px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:'+(item.count/maxV*100).toFixed(0)+'%;background:'+item.color+';border-radius:2px"></div></div>'+
      '<div style="font-size:10px;color:'+item.color+'">'+(levelTotal>0?(item.count/levelTotal*100).toFixed(1):"0")+'% of level</div>';
    wrap.appendChild(node);
  });
  col.appendChild(wrap);return col;
}

function renderDecompBC(){
  var bc=document.getElementById("decompBC");if(!bc)return;bc.innerHTML="";
  function crumb(text,fn,active){var s=document.createElement("span");s.style.cssText="font-size:11px;color:"+(active?"#388bfd":"#8b949e")+";cursor:pointer;padding:2px 6px;border-radius:4px;font-weight:"+(active?"600":"400");s.textContent=text;if(fn){s.onclick=fn;s.onmouseenter=function(){s.style.background="#21262d";s.style.color="#e6edf3";};s.onmouseleave=function(){s.style.background="";s.style.color=active?"#388bfd":"#8b949e";};}bc.appendChild(s);}
  function sep(){var s=document.createElement("span");s.style.cssText="color:#94a3b8;font-size:12px";s.textContent=">";bc.appendChild(s);}
  crumb("Total Units",function(){CNCL_DECOMP_PATH=[];renderDecomp();renderDecompBC();},CNCL_DECOMP_PATH.length===0);
  CNCL_DECOMP_PATH.forEach(function(step,i){
    sep();
    (function(ci,s){crumb(s.label,function(){CNCL_DECOMP_PATH=CNCL_DECOMP_PATH.slice(0,ci+1);renderDecomp();renderDecompBC();},i===CNCL_DECOMP_PATH.length-1);})(i,step);
  });
  if(CNCL_DECOMP_PATH.length>0){
    var pipe=document.createElement("span");pipe.style.cssText="color:#30363d;padding:0 4px";pipe.textContent="|";bc.appendChild(pipe);
    var rst=document.createElement("span");rst.style.cssText="font-size:11px;color:#f85149;cursor:pointer;padding:2px 8px;border-radius:4px;border:1px solid #f8514933;background:#f8514911";rst.textContent="Reset";
    rst.onclick=function(){CNCL_DECOMP_PATH=[];renderDecomp();renderDecompBC();};
    bc.appendChild(rst);
  }
}


function getTimeSeries(){
  var r=getRange(),byM={};
  var e12=function(){return[0,0,0,0,0,0,0,0,0,0,0,0];};
  var skus=selSku.size>0?Array.from(selSku):null;
  var pcats=selPcat.size>0?Array.from(selPcat):null;

  function addToByM(src,skuKey){
    Object.keys(src).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
      if(!byM[m])byM[m]=e12();
      var v=skuKey?(src[m]&&src[m][skuKey]||null):src[m];
      if(v)for(var i=0;i<12;i++)byM[m][i]+=(v[i]||0);
    });
  }

  // Helper: add aggregate monthly src to byM, subtracting excluded-SKU contributions via skuMonthMap
  function addAggMinusExcluded(aggSrc,skuMonthMap){
    Object.keys(aggSrc).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
      var row=(aggSrc[m]||[]).slice();while(row.length<12)row.push(0);
      var gs=skuMonthMap[m]||{};
      Object.keys(gs).forEach(function(s){if(EXCLUDED_SKUS.has(s)){var v=gs[s];if(v)for(var i=0;i<12;i++)row[i]-=(v[i]||0);}});
      if(!byM[m])byM[m]=e12();
      for(var i=0;i<12;i++)byM[m][i]+=(row[i]||0);
    });
  }

  if(selP.size>0){
    selP.forEach(function(p){
      if(skus){skus.forEach(function(s){addToByM((D.PMSKU&&D.PMSKU[p])||{},s);});}
      else{addAggMinusExcluded((D.PM&&D.PM[p])||{},(D.PMSKU&&D.PMSKU[p])||{});}
    });
  } else if(pcats){
    pcats.forEach(function(pcat){
      if(skus){skus.forEach(function(s){addToByM((D.PCMSKU&&D.PCMSKU[pcat])||{},s);});}
      else{addAggMinusExcluded((D.PCM&&D.PCM[pcat])||{},(D.PCMSKU&&D.PCMSKU[pcat])||{});}
    });
  } else if(skus){
    skus.forEach(function(s){addToByM(D.GMSKU||{},s);});
  } else {
    // No filter: use global M but subtract excluded-SKU contributions
    Object.keys(D.M).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
      var row=(D.M[m]||[]).slice();while(row.length<12)row.push(0);
      var gs=D.GMSKU[m]||{};
      Object.keys(gs).forEach(function(s){if(EXCLUDED_SKUS.has(s)){var v=gs[s];if(v)for(var i=0;i<12;i++)row[i]-=(v[i]||0);}});
      byM[m]=row;
    });
  }
  return Object.keys(byM).sort().map(function(m){return{m:m,b:byM[m]};});
}
function getSkuBuckets(){
  var r=getRange(),src={};
  var skus=selSku.size>0?Array.from(selSku):null;
  var pcats=selPcat.size>0?Array.from(selPcat):null;

  function addSrc(monthSkuMap){
    Object.keys(monthSkuMap).filter(function(m){return m>=r.df&&m<=r.dt;}).forEach(function(m){
      var skuMap=monthSkuMap[m];
      var keys=skus?skus:Object.keys(skuMap).filter(function(s){return!EXCLUDED_SKUS.has(s);});
      keys.forEach(function(s){
        var v=skuMap[s];if(!v)return;
        if(!src[s])src[s]=[0,0,0,0,0,0,0,0,0,0,0,0];
        for(var i=0;i<12;i++)src[s][i]+=(v[i]||0);
      });
    });
  }

  if(selP.size>0){
    selP.forEach(function(p){addSrc((D.PMSKU&&D.PMSKU[p])||{});});
  } else if(pcats){
    pcats.forEach(function(pcat){addSrc((D.PCMSKU&&D.PCMSKU[pcat])||{});});
  } else {
    addSrc(D.GMSKU||{});
  }
  return src;
}
function getRdCounts(){
  var r=getRange(),m={};
  var skus=selSku.size>0?Array.from(selSku):null;
  var pcats=selPcat.size>0?Array.from(selPcat):null;
  function addRd(pm_obj){
    Object.keys(pm_obj).filter(function(mo){return mo>=r.df&&mo<=r.dt;}).forEach(function(mo){
      Object.keys(pm_obj[mo]).forEach(function(k){m[k]=(m[k]||0)+pm_obj[mo][k];});
    });
  }
  if(selP.size>0){selP.forEach(function(p){addRd((D.PMRD&&D.PMRD[p])||{});});}
  else if(pcats){pcats.forEach(function(pcat){addRd((D.PCMRD&&D.PCMRD[pcat])||{});});}
  else{addRd(D.GMRD||{});}
  if(skus){
    var ts=getTimeSeries();
    var skuTotal=ts.reduce(function(s,x){return s+(x.b[0]||0);},0);
    var allTotal=0;
    if(pcats){pcats.forEach(function(pcat){var src=D.PCM[pcat]||{};Object.keys(src).filter(function(mo){return mo>=r.df&&mo<=r.dt;}).forEach(function(mo){allTotal+=(src[mo][0]||0);});});}
    else{Object.keys(D.M).filter(function(mo){return mo>=r.df&&mo<=r.dt;}).forEach(function(mo){allTotal+=(D.M[mo][0]||0);});}
    var ratio=allTotal>0?skuTotal/allTotal:0;
    Object.keys(m).forEach(function(k){m[k]=Math.round(m[k]*ratio);});
  }
  return m;
}
function destroyCharts(){Object.values(charts).forEach(function(c){try{c.destroy();}catch(e){}});charts={};}
function applyFilters(){["msDrop","msSkuDrop","msPcatDrop"].forEach(function(id){document.getElementById(id).classList.remove("open");});render();}
function resetFilters(){document.getElementById("df").value="2022-01-01";document.getElementById("dt").value="2026-04-20";["fAct","fCncl"].forEach(function(id){document.getElementById(id).value="";});selP.clear();updateMsBtn();selSku.clear();updateMsSkuBtn();selPcat.clear();updateMsPcatBtn();render();}


function toggleSkuReasons(id){
  var row=document.getElementById("reasons_"+id);
  var icon=document.getElementById("icon_"+id);
  if(!row)return;
  if(row.style.display==="none"){
    row.style.display="";
    if(icon)icon.innerHTML="&#9660;";
  } else {
    row.style.display="none";
    if(icon)icon.innerHTML="&#9654;";
  }
}

// row: [id,contactid,date,active,cncl,inv_total,refunds,pcat,partner]
function getSkuDetailRows(sku){
  var r=getRange();
  var fAct=document.getElementById("fAct").value;
  var fCncl=document.getElementById("fCncl").value;
  var allRows=(D.order_rows&&D.order_rows[sku])||[];
  return allRows.filter(function(row){
    var dateM=row[2].slice(0,7);
    if(dateM<r.df||dateM>r.dt)return false;
    if(fAct&&row[3]!==fAct)return false;
    if(fCncl&&row[4]!==fCncl)return false;
    if(selPcat.size>0&&!selPcat.has(row[7]))return false;
    if(selP.size>0&&!selP.has(row[8]))return false;
    return true;
  });
}

function downloadSkuDetailCsv(){
  var skuBkts=getSkuBuckets();
  var csvRows=[["SKU","Order ID","Contact ID","Date","Product Name","Status","Cancel Status","Refund Days","Invoice Total","Lost Revenue","Partner Category","Referral Partner"]];
  Object.keys(skuBkts).sort().forEach(function(sku){
    getSkuDetailRows(sku).forEach(function(row){
      csvRows.push([sku,row[0],row[1],row[2],row[9]||"",row[3],row[4],row[11]||"",row[5],row[10]||0,row[7],row[8]]);
    });
  });
  var csv=csvRows.map(function(r){return r.map(function(v){
    var s=String(v==null?"":v);
    return s.indexOf(",")>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;
  }).join(",");}).join("\n");
  var blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  var rng=getRange();
  a.download="sku_detail_"+rng.df+"_"+rng.dt+".csv";
  a.click();
}

function render(){
  destroyCharts();
  var ts=getTimeSeries();
  var tot=sumArr(ts.map(function(x){return x.b;}));
  var T=tot[Ti],C=tot[Ci],E=tot[Ei],U=tot[Ui],Dv=tot[Di],AC=tot[Ai],IN=tot[Ii],LR=tot[CRi];
  var Sw=tot[Si]||0,Pe=tot[Pi]||0,NP=tot[NPi]||0,LDPc=tot[LDPCi]||0;
  var net=T-E-Pe-NP, rate=net>0?(C/net*100):0;
  var ldpCancelRate=C>0?(LDPc/C*100):0;
  var sale=Math.max(0,T-C-E-U-Dv-Sw-Pe-NP);
  var pcat=getPcat();
  document.getElementById("rcLbl").textContent=T.toLocaleString()+" records "+(selP.size>0?selP.size+" partner(s)":pcat||"all data");

  document.getElementById("kpiRow").innerHTML=
    '<div class="kpi-top-row">'+
      '<div class="kpi k1"><div class="kl">Total Units</div><div class="kv">'+net.toLocaleString()+'</div><div class="ks muted">excl. entry error, pend, no pmt</div></div>'+
      '<div class="kpi k2"><div class="kl">Active</div><div class="kv" style="color:#2563eb">'+AC.toLocaleString()+'</div><div class="ks muted">'+(net>0?(AC/net*100).toFixed(1):0)+'% of units</div></div>'+
      '<div class="kpi k4"><div class="kl">Cancelled</div><div class="kv" style="color:#ef4444">'+C.toLocaleString()+'</div><div class="ks red">'+(net>0?(C/net*100).toFixed(1):0)+'% of units</div></div>'+
      '<div class="kpi k4"><div class="kl">Cancel Rate</div><div class="kv" style="color:#ef4444">'+rate.toFixed(1)+'%</div><div class="ks red">cancellations / total units</div>'+(LDPc>0?'<div style="margin-top:6px;padding-top:6px;border-top:1px solid #fee2e2"><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px">LDP Cancel %</div><div style="font-size:16px;font-weight:700;color:#ef4444">'+ldpCancelRate.toFixed(1)+'%</div><div style="font-size:10px;color:#64748b">'+LDPc+' of '+C+' cancels</div></div>':'')+'</div>'+
      '<div class="kpi k8"><div class="kl">Lost Revenue</div><div class="kv" style="color:#ef4444;font-size:22px">$'+Math.round(LR).toLocaleString()+'</div><div class="ks red">payments on cancels</div></div>'+
    '</div>'+
    '<div class="kpi-groups">'+
      '<div class="kpi-group-card adj">'+
        '<div class="kpi-group-hdr"><span style="font-size:16px">📧</span><span style="color:#b45309">ADJUSTMENTS &amp; EXCEPTIONS</span></div>'+
        '<div class="kpi-group-inner">'+
          '<div class="kpi-mini"><div class="kl">ENTRY ERROR</div><div class="kv-mini" style="color:#f59e0b">'+E.toLocaleString()+'</div><div class="ks amber">excl. from units</div></div>'+
          '<div class="kpi-mini"><div class="kl">PEND</div><div class="kv-mini" style="color:#f59e0b">'+Pe.toLocaleString()+'</div><div class="ks amber">excl. from units</div></div>'+
          '<div class="kpi-mini"><div class="kl">NO PMT</div><div class="kv-mini" style="color:#64748b">'+NP.toLocaleString()+'</div><div class="ks muted">excl. from units</div></div>'+
        '</div>'+
      '</div>'+
      '<div class="kpi-group-card chg">'+
        '<div class="kpi-group-hdr"><span style="font-size:16px">📈</span><span style="color:#7c3aed">CHANGE EVENTS</span></div>'+
        '<div class="kpi-group-inner">'+
          '<div class="kpi-mini"><div class="kl">UPGRADES</div><div class="kv-mini" style="color:#16a34a">'+U.toLocaleString()+'</div><div class="ks green">upgrade events</div></div>'+
          '<div class="kpi-mini"><div class="kl">DOWNGRADES</div><div class="kv-mini" style="color:#7c3aed">'+Dv.toLocaleString()+'</div><div class="ks muted">downgrade events</div></div>'+
          '<div class="kpi-mini"><div class="kl">SWITCH</div><div class="kv-mini" style="color:#0d9488">'+Sw.toLocaleString()+'</div><div class="ks muted">active · switch events</div></div>'+
        '</div>'+
      '</div>'+
    '</div>';

  var mLabels=ts.map(function(x){return fmtM(x.m);});
  charts.trend=new Chart(document.getElementById("trendChart"),{type:"bar",data:{labels:mLabels,datasets:[
    {label:"Cancelled",data:ts.map(function(x){return x.b[Ci];}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3,stack:"s"},
    {label:"Entry Error",data:ts.map(function(x){return x.b[Ei];}),backgroundColor:"rgba(227,179,65,0.8)",borderRadius:3,stack:"s"},
    {label:"Upgrade",data:ts.map(function(x){return x.b[Ui];}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
    {label:"Downgrade",data:ts.map(function(x){return x.b[Di];}),backgroundColor:"rgba(188,140,255,0.8)",borderRadius:3,stack:"s"},
    {label:"Switch",data:ts.map(function(x){return x.b[Si]||0;}),backgroundColor:"rgba(13,148,136,0.8)",borderRadius:3,stack:"s"},
    {label:"Pend",data:ts.map(function(x){return x.b[Pi]||0;}),backgroundColor:"rgba(251,191,36,0.7)",borderRadius:3,stack:"s"},
    {label:"No Pmt",data:ts.map(function(x){return x.b[NPi]||0;}),backgroundColor:"rgba(100,116,139,0.7)",borderRadius:3,stack:"s"},
    {label:"Cancel %",data:ts.map(function(x){var v=x.b[Ti]-x.b[Ei]-(x.b[Pi]||0)-(x.b[NPi]||0);return v>0?+(x.b[Ci]/v*100).toFixed(2):0;}),type:"line",yAxisID:"y2",borderColor:"#388bfd",backgroundColor:"rgba(56,139,253,0.07)",fill:true,tension:0.35,pointRadius:2,pointBackgroundColor:"#388bfd",borderWidth:2}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},scales:{
    x:{stacked:true,ticks:{color:"#8b949e",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#21262d44"}},
    y:{stacked:true,ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},
    y2:{position:"right",ticks:{color:"#388bfd",font:{size:10},callback:function(v){return v+"%";}},grid:{display:false}}
  }}});

  var skuBkts=getSkuBuckets();
  var skuArr=Object.keys(skuBkts).map(function(sku){
    var v=skuBkts[sku];
    var sw=v[Si]||0,pe=v[Pi]||0,np=v[NPi]||0;
    var net_=Math.max(0,v[Ti]-v[Ei]-pe-np);
    return{sku:sku,T:v[Ti],C:v[Ci],E:v[Ei],U:v[Ui],D:v[Di],AC:v[Ai],IN:v[Ii],LR:v[CRi],
           Sw:sw,Pe:pe,NP:np,net:net_,
           sale:Math.max(0,v[Ti]-v[Ci]-v[Ei]-v[Ui]-v[Di]-sw-pe-np),
           rate:net_>0?(v[Ci]/net_*100):0};
  }).filter(function(s){return s.T>0;}).sort(function(a,b){return b.C-a.C;});
  var top15=skuArr.slice(0,15),bh=Math.max(280,top15.length*38);
  document.getElementById("skuBarWrap").style.height=bh+"px";
  document.getElementById("skuGrpWrap").style.height=bh+"px";
  if(top15.length>0){
    charts.skuBar=new Chart(document.getElementById("skuBarChart"),{type:"bar",data:{labels:top15.map(function(s){return s.sku;}),datasets:[{data:top15.map(function(s){return +s.rate.toFixed(1);}),backgroundColor:top15.map(function(s){return s.rate>30?"rgba(248,81,73,0.85)":s.rate>15?"rgba(227,179,65,0.85)":"rgba(56,139,253,0.85)";}),borderRadius:4}]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ctx.parsed.x.toFixed(1)+"%";}}}},scales:{x:{ticks:{color:"#8b949e",font:{size:10},callback:function(v){return v+"%";}},grid:{color:"#21262d44"}},y:{ticks:{color:"#334155",font:{size:10}},grid:{display:false}}}}});
    charts.skuGrp=new Chart(document.getElementById("skuGrpChart"),{type:"bar",data:{labels:top15.map(function(s){return s.sku;}),datasets:[
      {label:"Cancelled",  data:top15.map(function(s){return s.C;}), backgroundColor:"rgba(248,81,73,0.8)", borderRadius:3},
      {label:"Entry Error",data:top15.map(function(s){return s.E;}), backgroundColor:"rgba(227,179,65,0.8)",borderRadius:3},
      {label:"Upgraded",   data:top15.map(function(s){return s.U;}), backgroundColor:"rgba(63,185,80,0.8)", borderRadius:3},
      {label:"Downgraded", data:top15.map(function(s){return s.D;}), backgroundColor:"rgba(188,140,255,0.8)",borderRadius:3},
      {label:"Switch",     data:top15.map(function(s){return s.Sw;}),backgroundColor:"rgba(13,148,136,0.8)",borderRadius:3},
      {label:"Pend",       data:top15.map(function(s){return s.Pe;}),backgroundColor:"rgba(251,191,36,0.7)",borderRadius:3},
      {label:"No Pmt",     data:top15.map(function(s){return s.NP;}),backgroundColor:"rgba(100,116,139,0.7)",borderRadius:3}
    ]},options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},y:{ticks:{color:"#334155",font:{size:10}},grid:{display:false}}}}});
  }
  // Partner category donut - fully date+filter+sku aware
  var r2=getRange(),pcat2=getPcat(),sku2=getSku();
  var donutData={};
  function addDB(v){
    var c=v[Ci]||0,e=v[Ei]||0,u=v[Ui]||0,d=v[Di]||0,t=v[Ti]||0;
    var sw=v[Si]||0,pe=v[Pi]||0,np=v[NPi]||0;
    var s=Math.max(0,t-c-e-u-d-sw-pe-np);
    donutData["Cancelled"]  =(donutData["Cancelled"]  ||0)+c;
    donutData["Entry Error"]=(donutData["Entry Error"]||0)+e;
    donutData["Upgrade"]    =(donutData["Upgrade"]    ||0)+u;
    donutData["Downgrade"]  =(donutData["Downgrade"]  ||0)+d;
    donutData["Switch"]     =(donutData["Switch"]     ||0)+sw;
    donutData["Pend"]       =(donutData["Pend"]       ||0)+pe;
    donutData["No Pmt"]     =(donutData["No Pmt"]     ||0)+np;
    donutData["Sale"]       =(donutData["Sale"]       ||0)+s;
  }
  if(selP.size>0){
    selP.forEach(function(p){
      var pm=(D.PMSKU&&D.PMSKU[p])||{};
      Object.keys(pm).filter(function(m){return m>=r2.df&&m<=r2.dt;}).forEach(function(m){
        sku2?(pm[m][sku2]&&addDB(pm[m][sku2])):Object.values(pm[m]).forEach(addDB);
      });
    });
  } else {
    var gm2=pcat2?(D.PCMSKU&&D.PCMSKU[pcat2]||{}):((selP.size===0&&!pcat2)?D.GMSKU||{}:{});
    if(!pcat2&&selP.size===0){
      // Show pcat breakdown
      Object.keys(D.PCMSKU||{}).forEach(function(pc){
        var pm=D.PCMSKU[pc];var tot=0;
        Object.keys(pm).filter(function(m){return m>=r2.df&&m<=r2.dt;}).forEach(function(m){
          var keys=sku2?[sku2]:Object.keys(pm[m]);
          keys.forEach(function(s){var v=pm[m][s];if(v)tot+=(v[Ci]||0)+(v[Ei]||0);});
        });
        if(tot>0)donutData[pc]=(donutData[pc]||0)+tot;
      });
    } else {
      Object.keys(gm2).filter(function(m){return m>=r2.df&&m<=r2.dt;}).forEach(function(m){
        sku2?(gm2[m][sku2]&&addDB(gm2[m][sku2])):Object.values(gm2[m]).forEach(addDB);
      });
    }
  }
  var donutKeys=Object.keys(donutData).filter(function(k){return donutData[k]>0;}).sort(function(a,b){return donutData[b]-donutData[a];});
  var donutColors={"Marketing":"#388bfd","Enrollment Mentor":"#f85149","Affiliate":"#3fb950","Event":"#e3b341","Cancelled":"#f85149","Entry Error":"#e3b341","Upgrade":"#3fb950","Downgrade":"#bc8cff","Sale":"#16a34a"};
  charts.pcat=new Chart(document.getElementById("pcatChart"),{type:"doughnut",data:{labels:donutKeys,datasets:[{data:donutKeys.map(function(k){return donutData[k];}),backgroundColor:donutKeys.map(function(k){return donutColors[k]||"#2563eb";}),borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:"62%",plugins:{legend:{position:"right",labels:{color:"#8b949e",font:{size:11},boxWidth:10,padding:8}}}}});
    var rdCounts=getRdCounts();
  // Implicit N/A: any cancelled orders not captured in date buckets (e.g. no REFUND_CREDIT_DATE in Snowflake)
  var rdDateSum=["<=30d","<=45d","<=60d","<=90d",">90d"].reduce(function(s,k){return s+(rdCounts[k]||0);},0);
  rdCounts["N/A"]=Math.max(rdCounts["N/A"]||0, C-rdDateSum);
  var rdTotal=RD_KEYS.reduce(function(s,k){return s+(rdCounts[k]||0);},0);
  charts.rd=new Chart(document.getElementById("rdChart"),{type:"bar",data:{labels:RD_LABELS,datasets:[{data:RD_KEYS.map(function(k){return rdCounts[k]||0;}),backgroundColor:RD_KEYS.map(function(k){return k==="N/A"?"rgba(100,116,139,0.65)":"rgba(56,139,253,0.75)";}),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){var tot=rdTotal;return ctx.parsed.y+' orders ('+(tot>0?(ctx.parsed.y/tot*100).toFixed(1):0)+'% of cancelled)';}}}},scales:{x:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},y:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}}}}});
  var rdRateEl=document.getElementById("rdRateChart");
  if(rdRateEl){
    if(charts.rdRate){try{charts.rdRate.destroy();}catch(e){}}
    charts.rdRate=new Chart(rdRateEl,{type:"bar",data:{labels:RD_LABELS,datasets:[{data:RD_KEYS.map(function(k){return net>0?+((rdCounts[k]||0)/net*100).toFixed(2):0;}),backgroundColor:RD_KEYS.map(function(k){return k==="N/A"?"rgba(100,116,139,0.65)":"rgba(239,68,68,0.75)";}),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ctx.parsed.y.toFixed(2)+'% of net units';}}}},scales:{x:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},y:{ticks:{color:"#8b949e",font:{size:10},callback:function(v){return v+"%";}},grid:{color:"#21262d44"}}}}});
  }

  var skuRd=D.SKURD||{};
  var mx=Math.max.apply(null,skuArr.map(function(s){return s.rate;}).concat([1]));
  document.getElementById("tblInfo").innerHTML='<span>'+skuArr.length+' SKUs '+T.toLocaleString()+' units</span><button onclick="downloadSkuDetailCsv()" style="margin-left:10px;color:#2563eb;border:1px solid #2563eb44;background:transparent;padding:3px 10px;border-radius:16px;font-size:11px;cursor:pointer">&#11015; Download CSV</button>';

  var rows="";
  for(var i=0;i<skuArr.length;i++){
    var s=skuArr[i];
    var displayT=s.net;
    var cl=s.rate>30?"#ef4444":s.rate>15?"#f59e0b":"#16a34a";
    var bg=s.rate>30?"#ef4444":s.rate>15?"#f59e0b":"#2563eb";
    var safeId="sku_"+s.sku.replace(/[^a-zA-Z0-9]/g,"_");
    rows+="<tr style='cursor:pointer' data-sid='"+safeId+"' onclick='toggleSkuReasons(this.dataset.sid)'>"+
      "<td><span style='font-size:10px;color:#2563eb;margin-right:4px' id='icon_"+safeId+"'>&#9654;</span><span class='pill'>"+s.sku+"</span></td>"+
      "<td class='num'>"+displayT.toLocaleString()+"</td>"+
      "<td class='num' style='color:#2563eb'>"+s.AC.toLocaleString()+"</td>"+
      "<td class='num' style='color:#ef4444'>"+s.IN.toLocaleString()+"</td>"+
      "<td class='num'>"+s.sale.toLocaleString()+"</td>"+
      "<td class='num' style='color:#ef4444'>"+s.C.toLocaleString()+"</td>"+
      "<td class='num' style='color:#f59e0b'>"+s.E.toLocaleString()+"</td>"+
      "<td class='num' style='color:#16a34a'>"+s.U.toLocaleString()+"</td>"+
      "<td class='num' style='color:#7c3aed'>"+s.D.toLocaleString()+"</td>"+
      "<td class='num' style='color:#0d9488'>"+s.Sw.toLocaleString()+"</td>"+
      "<td class='num' style='color:#f59e0b'>"+s.Pe.toLocaleString()+"</td>"+
      "<td class='num' style='color:#64748b'>"+s.NP.toLocaleString()+"</td>"+
      (function(){var rd=skuRd[s.sku]||{};var parts=RD_KEYS.filter(function(k){return rd[k]>0;}).map(function(k){return RD_LABELS[RD_KEYS.indexOf(k)]+':'+rd[k];});return "<td style='font-size:10px;color:#64748b;white-space:nowrap'>"+(parts.length?parts.join(' · '):'—')+"</td>";})()+
      "<td><div class='bw'><div class='bb'><div class='bf' style='width:"+(mx>0?(s.rate/mx*100).toFixed(0):0)+"%;background:"+bg+"'></div></div>"+
      "<span class='num' style='min-width:38px;font-size:11px;color:"+cl+"'>"+s.rate.toFixed(2)+"%</span></div></td>"+
      "<td class='num' style='color:#ef4444'>$"+Math.round(s.LR).toLocaleString()+"</td>"+
      "</tr>";
    // Hidden detail rows table
    var detailRows=getSkuDetailRows(s.sku);
    var detailHtml='<tr id="reasons_'+safeId+'" style="display:none"><td colspan="15" style="padding:0;background:#f8fafc;border-top:1px solid #dde3ea">';
    detailHtml+='<div style="padding:10px 16px 12px 24px">';
    detailHtml+='<div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">'+s.sku+' — '+detailRows.length.toLocaleString()+' orders'+(detailRows.length>500?' (showing first 500)':'')+'</div>';
    detailHtml+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
    detailHtml+='<thead><tr style="background:#f1f5f9">';
    ['Order ID','Contact ID','Date','Product Name','Status','Cancel Status','Refund Days','Invoice Total','Lost Revenue'].forEach(function(h){
      detailHtml+='<th style="padding:6px 10px;text-align:left;font-weight:600;color:#374151;border-bottom:1px solid #dde3ea;white-space:nowrap">'+h+'</th>';
    });
    detailHtml+='</tr></thead><tbody>';
    var cncl_colors={"Sale":"#16a34a","Cancelled":"#ef4444","Entry Error":"#f59e0b","Upgrade":"#2563eb","Downgrade":"#7c3aed"};
    var limit=Math.min(detailRows.length,500);
    for(var di=0;di<limit;di++){
      var dr=detailRows[di];
      // dr: [id,contactid,date,active,cncl,inv_total,refunds,pcat,partner]
      var actColor=dr[3]==="Active"?"#16a34a":"#ef4444";
      var cnclColor=cncl_colors[dr[4]]||"#64748b";
      var bg=di%2===0?"#ffffff":"#f8fafc";
      detailHtml+='<tr style="background:'+bg+'">';
      detailHtml+='<td style="padding:5px 10px;color:#2563eb;font-family:monospace;font-size:11px">'+dr[0]+'</td>';
      detailHtml+='<td style="padding:5px 10px;color:#64748b;font-family:monospace;font-size:11px">'+dr[1]+'</td>';
      detailHtml+='<td style="padding:5px 10px;color:#374151;white-space:nowrap">'+dr[2]+'</td>';
      detailHtml+='<td style="padding:5px 10px;color:#374151;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(dr[9]||'')+'">'+( dr[9]||'—')+'</td>';
      detailHtml+='<td style="padding:5px 10px"><span style="color:'+actColor+';font-weight:600;font-size:11px">'+dr[3]+'</span></td>';
      detailHtml+='<td style="padding:5px 10px"><span style="color:'+cnclColor+';font-weight:600;font-size:11px">'+dr[4]+'</span></td>';
      var rdVal=dr[11]||'—';var rdColor=rdVal==='N/A'?'#94a3b8':rdVal==='—'?'#94a3b8':'#2563eb';
      detailHtml+='<td style="padding:5px 10px;font-size:11px;font-weight:600;color:'+rdColor+'">'+rdVal+'</td>';
      detailHtml+='<td style="padding:5px 10px;text-align:right;color:#374151">$'+(dr[5]||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>';
      var orderLr=dr[10]||0;
      detailHtml+='<td style="padding:5px 10px;text-align:right;color:'+(orderLr>0?"#ef4444":"#94a3b8")+'">'+(orderLr>0?'$'+orderLr.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'—')+'</td>';
      detailHtml+='</tr>';
    }
    detailHtml+='</tbody></table></div></div></td></tr>';
    rows+=detailHtml;
  }
  
document.getElementById("skuTbody").innerHTML=rows;
  document.getElementById("skuTfoot").innerHTML="<td>Total</td><td class='num'>"+net.toLocaleString()+"</td><td class='num' style='color:#58a6ff'>"+AC.toLocaleString()+"</td><td class='num' style='color:#f85149'>"+IN.toLocaleString()+"</td><td class='num'>"+sale.toLocaleString()+"</td><td class='num' style='color:#ff7b72'>"+C.toLocaleString()+"</td><td class='num' style='color:#e3b341'>"+E.toLocaleString()+"</td><td class='num' style='color:#56d364'>"+U.toLocaleString()+"</td><td class='num' style='color:#bc8cff'>"+Dv.toLocaleString()+"</td><td class='num' style='color:#0d9488'>"+Sw.toLocaleString()+"</td><td class='num' style='color:#f59e0b'>"+Pe.toLocaleString()+"</td><td class='num' style='color:#64748b'>"+NP.toLocaleString()+"</td><td style='color:#94a3b8;font-size:11px'>—</td><td class='num'>"+rate.toFixed(2)+"%</td><td class='num' style='color:#ff7b72'>$"+Math.round(LR).toLocaleString()+"</td>";

  // ── FY Quarterly Cancel Rate Chart ──────────────────────────────────────────
  if(charts.qfy){try{charts.qfy.destroy();}catch(e){}}
  var qfyEl=document.getElementById("qfyChart");
  if(qfyEl&&D.QFY){
    var QFY=D.QFY;
    var fys=Object.keys(QFY).filter(function(fy){return Object.keys(QFY[fy]).length>0;}).sort();
    var quarters=["Q1","Q2","Q3","Q4"];
    var FY_COLORS=["#4285f4","#ea4335","#fbbc04","#34a853","#a142f4","#00acc1","#ff6d00"];
    var qfyDs=fys.map(function(fy,i){
      return{
        label:fy,
        data:quarters.map(function(q){
          var b=(QFY[fy]||{})[q];
          if(!b)return null;
          var denom=b[0]-b[2]-(b[9]||0)-(b[10]||0);
          return denom>0?parseFloat((b[1]/denom*100).toFixed(1)):0;
        }),
        backgroundColor:FY_COLORS[i%FY_COLORS.length],
        borderRadius:4,borderSkipped:false
      };
    });
    charts.qfy=new Chart(qfyEl.getContext("2d"),{
      type:"bar",
      data:{labels:["Cancel Rate Q1","Cancel Rate Q2","Cancel Rate Q3","Cancel Rate Q4"],datasets:qfyDs},
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{position:"top",labels:{color:"#64748b",font:{size:11},boxWidth:12,padding:12}},
          tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+": "+(ctx.raw!=null?ctx.raw.toFixed(1)+"%":"N/A");}}}
        },
        scales:{
          x:{ticks:{color:"#64748b",font:{size:11}},grid:{display:false}},
          y:{beginAtZero:true,ticks:{color:"#64748b",font:{size:10},callback:function(v){return v+"%";}},grid:{color:"#f1f5f9"}}
        }
      }
    });
  }
}

// ── CSV Download ───────────────────────────────────────────
function downloadCancelCsv(){
  var r=getRange(),pcat=getPcat(),sku=getSku();
  var skuBkts=getSkuBuckets();
  var ts=getTimeSeries();
  var tot=sumArr(ts.map(function(x){return x.b;}));
  var T=tot[0],C=tot[1],E=tot[2],U=tot[3],Dv=tot[4],AC=tot[5],IN=tot[6],LR=tot[7];
  var Sw=tot[8]||0,Pe=tot[9]||0,NP=tot[10]||0;
  var net=T-E-Pe-NP, rate=net>0?(C/net*100):0;

  var rows=[["SKU","Net Units","Active","Cancelled","Entry Error","Upgrades","Downgrades","Switch","Pend","No Pmt","Cancel Rate %","Lost Revenue"]];
  Object.entries(skuBkts).forEach(function(e){
    var s=e[0],v=e[1];
    var sT=v[0],sC=v[1],sE=v[2],sU=v[3],sD=v[4],sA=v[5],sLR=v[7]||0;
    var sSw=v[8]||0,sPe=v[9]||0,sNP=v[10]||0;
    var sNet=sT-sE-sPe-sNP;
    var sRate=sNet>0?(sC/sNet*100):0;
    rows.push([s,sNet,sA,sC,sE,sU,sD,sSw,sPe,sNP,sRate.toFixed(1),Math.round(sLR)]);
  });
  // Summary row
  rows.push(["TOTAL",net,AC,C,E,U,Dv,Sw,Pe,NP,rate.toFixed(1),Math.round(LR)]);

  var csv=rows.map(function(r){return r.map(function(v){
    var s=String(v==null?"":v);
    return s.indexOf(",")>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;
  }).join(",");}).join("\n");

  var blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="cancellations_"+r.df+"_"+r.dt+".csv";
  a.click();
}


function initDashboard(){
  document.getElementById("mainContent").innerHTML='<div class="main"><div class="kpi-row" id="kpiRow"></div><div class="card full"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px"><div><div class="ct">Cancel % rate by month</div><div class="cs" style="margin-bottom:0">Stacked by status with cancel rate line</div></div><div class="legend" style="margin-bottom:0"><div class="li"><div class="ld" style="background:#f85149"></div>Cancelled</div><div class="li"><div class="ld" style="background:#e3b341"></div>Entry Error</div><div class="li"><div class="ld" style="background:#3fb950"></div>Upgrade</div><div class="li"><div class="ld" style="background:#bc8cff"></div>Downgrade</div><div class="li"><div class="ld" style="background:#0d9488"></div>Switch</div><div class="li"><div class="ld" style="background:#fbbf24"></div>Pend</div><div class="li"><div class="ld" style="background:#64748b"></div>No Pmt</div><div class="li"><div class="ld" style="background:#388bfd;width:18px;height:2px;border-radius:0"></div>Cancel %</div></div></div><div style="height:260px;position:relative"><canvas id="trendChart"></canvas></div></div><div class="grid2"><div class="card"><div class="ct">Cancel % by SKU</div><div class="cs">Top 15</div><div id="skuBarWrap" style="height:320px;position:relative"><canvas id="skuBarChart"></canvas></div></div><div class="card"><div class="ct">Volume by SKU</div><div class="cs">Cancelled - Entry Error - Upgrade - Downgrade</div><div id="skuGrpWrap" style="height:320px;position:relative"><canvas id="skuGrpChart"></canvas></div></div></div><div class="grid2"><div class="card"><div class="ct">By partner category</div><div class="cs">Share of cancellations</div><div style="height:200px;position:relative"><canvas id="pcatChart"></canvas></div></div><div class="card"><div class="ct">Cancel Window</div><div class="cs">Refund timing &amp; cancel rate by window — all cancelled orders including N/A (no refund date on record)</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px"><div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Days to Refund — count</div><div style="height:180px;position:relative"><canvas id="rdChart"></canvas></div></div><div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Cancel Rate % by Window</div><div style="height:180px;position:relative"><canvas id="rdRateChart"></canvas></div></div></div></div></div><div class="card full"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><div class="ct">SKU summary</div><div style="font-size:11px;color:#8b949e" id="tblInfo"></div></div><div class="tbl-wrap"><table><thead><tr><th>SKU</th><th>Net Units</th><th>Active</th><th>Inactive</th><th>Sale</th><th>Cancelled</th><th>Entry Error</th><th>Upgrade</th><th>Downgrade</th><th>Switch</th><th>Pend</th><th>No Pmt</th><th>Refund Days</th><th>Cancel %</th><th>Lost Revenue</th></tr></thead><tbody id="skuTbody"></tbody><tfoot><tr class="tfoot" id="skuTfoot"></tr></tfoot></table></div></div><div class="card full"><div class="ct">FY Cancel Rate by Quarter</div><div class="cs">Cancellations ÷ (Total − Entry Errors) · Calendar year · Q1=Jan–Mar, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Oct–Dec</div><div style="height:300px;position:relative"><canvas id="qfyChart"></canvas></div></div></div>';
  renderMsItems();renderMsSkuItems();render();
}

fetch("data.json?v=1777494541").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(function(data){D=data;initDashboard();}).catch(function(err){document.getElementById("mainContent").innerHTML='<div class="loading"><div style="color:#f85149">Failed to load data.json: '+err.message+"</div></div>";});
