var D=null,Ti=0,Ci=1,Ei=2,Ui=3,Di=4,Ai=5,Ii=6,CRi=7,Si=8,Pi=9,NPi=10,LDPCi=11;
var selP=new Set(),selSku=new Set(),selPcat=new Set(),charts={};
var fDiv="";        // active division filter string ("" = all)
var DIV_SKUS={};    // division → Set of SKUs (built from D.sku_div on load)
var cohortWindow=-1;
var cohortLdpWin=0; // 0=same day, 1=+1d, 2=+2d, 3=+3d
// Return deposit $ for a cancellation order row based on selected window
// row[14]=dep_0, row[18]=dep_1, row[19]=dep_2, row[20]=dep_3
function getDepByWin(row){if(cohortLdpWin===1)return row[18]||0;if(cohortLdpWin===2)return row[19]||0;if(cohortLdpWin===3)return row[20]||0;return row[14]||0;}
// Dynamic LDP check: dep > 0 AND dep/inv_total ≤ 10.5%
function isLdpRow(row){var inv=row[5];if(!inv||inv<=0)return false;var dep=getDepByWin(row);return dep>0&&dep/inv<=0.105;}
function setCohortLdpWin(w){cohortLdpWin=w;["coh-dw0","coh-dw1","coh-dw2","coh-dw3"].forEach(function(id,i){var el=document.getElementById(id);if(!el)return;el.style.fontWeight=i===w?"700":"400";el.style.background=i===w?"#7c3aed":"#f1f5f9";el.style.color=i===w?"#fff":"#475569";el.style.borderColor=i===w?"#7c3aed":"#e2e8f0";});renderCohort();}
var RD_KEYS=["<=30d","<=45d","<=60d","<=90d",">90d","N/A"],RD_LABELS=["≤30d","≤45d","≤60d","≤90d",">90d","N/A"];

// SKUs excluded by default — extended from loaded data via patterns on init
var EXCLUDED_SKUS=new Set(["5DC","CAP-2022-06-VIP Upgrade","CAP-Catapult","CAP-2022-06-Ticket-Alumni","DBL 2022-10 Package","DBL 2023-05 Package","DBL 2024-05 Package","DBL 2025-01 Package","DBL 2026-01 Package","Deferment","INTSV4ADD","LMI DB CMBO","LMI DB DG","LMI DB DG SP","LMI DB PH GB","LMI DBK PH","LMI IYG CMBO","LMI IYG DG","LMI IYG PH","LMI LM CMBO","LMI LM DG","LMI LMK PH","LMI WWL CMBO","LMI WWL DG","LMI WWL PH","Pending","Pending Order","Unknown","Affiliate Mailing","FullTime","F&F LIVE","IYG","No Sale"]);
// Any SKU whose name contains one of these substrings (case-insensitive) is also excluded
var EXCLUDED_SKU_PATTERNS=["dblv","ticket","kit","gift"];
// Division groupings shown in the SKU dropdown
var LT_SKUS=new Set(["BTM BT Add-on","BTM","BTM-Mopp","BTMP","BTMP-Mopp","BTME","MC-Elite","MC-Elite-Mopp","MC-Elite-MC","MM-SC-KAT","BTMP-MOPP"]);
var LCC_SKUS=new Set(["DBC","LMC","DBCA","DBCE","ELEVADD","LMCA","ELEV"]);
// Lookup tables built after data loads: pcat/partner → Set of SKU names present in that segment
var PCAT_SKUS={},PARTNER_SKUS={};
function buildExcludedAndMappings(){
  // Extend EXCLUDED_SKUS with pattern matches from the loaded SKU list
  (D.FL.skus||[]).forEach(function(s){
    if(EXCLUDED_SKUS.has(s))return;
    var sl=s.toLowerCase();
    for(var i=0;i<EXCLUDED_SKU_PATTERNS.length;i++)if(sl.indexOf(EXCLUDED_SKU_PATTERNS[i])>=0){EXCLUDED_SKUS.add(s);return;}
  });
  // Build pcat → skus mapping from PCMSKU
  PCAT_SKUS={};
  Object.keys(D.PCMSKU||{}).forEach(function(pcat){
    var s=new Set();
    Object.keys(D.PCMSKU[pcat]).forEach(function(m){Object.keys(D.PCMSKU[pcat][m]||{}).forEach(function(sk){s.add(sk);});});
    PCAT_SKUS[pcat]=s;
  });
  // Build partner → skus mapping from PMSKU
  PARTNER_SKUS={};
  Object.keys(D.PMSKU||{}).forEach(function(p){
    var s=new Set();
    Object.keys(D.PMSKU[p]).forEach(function(m){Object.keys(D.PMSKU[p][m]||{}).forEach(function(sk){s.add(sk);});});
    PARTNER_SKUS[p]=s;
  });
  // Build division → skus mapping from D.sku_div
  DIV_SKUS={};
  Object.keys(D.sku_div||{}).forEach(function(sku){
    var d=D.sku_div[sku];
    if(!DIV_SKUS[d])DIV_SKUS[d]=new Set();
    DIV_SKUS[d].add(sku);
  });
}

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
function renderMsSkuItems(){if(!D)return;var q=document.getElementById("msSkuQ").value.toLowerCase();
  // When a pcat or partner filter is active, only show SKUs present in that segment
  var validSkus=null;
  if(selPcat.size>0||selP.size>0){
    validSkus=new Set();
    selPcat.forEach(function(pc){(PCAT_SKUS[pc]||new Set()).forEach(function(s){validSkus.add(s);});});
    selP.forEach(function(p){(PARTNER_SKUS[p]||new Set()).forEach(function(s){validSkus.add(s);});});
  }
  var allVis=D.FL.skus.filter(function(s){
    if(validSkus&&!validSkus.has(s))return false;
    return s.toLowerCase().indexOf(q)>=0;
  });
  var incl=allVis.filter(function(s){return!EXCLUDED_SKUS.has(s);});
  var excl=allVis.filter(function(s){return EXCLUDED_SKUS.has(s);});
  var ltG=incl.filter(function(s){return LT_SKUS.has(s);});
  var lccG=incl.filter(function(s){return LCC_SKUS.has(s);});
  var othG=incl.filter(function(s){return!LT_SKUS.has(s)&&!LCC_SKUS.has(s);});
  function mkItems(grp){var r="";grp.forEach(function(s){var ck=selSku.has(s)?"checked":"";var esc=s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");r+='<div class="ms-item" data-p="'+esc+'" onclick="togSku(event,this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+esc+"</span></div>";});return r;}
  function mkHdr(label,color,grpId,grp){if(!grp.length)return"";var allSel=grp.every(function(s){return selSku.has(s);});return'<div style="padding:4px 10px 3px;font-size:10px;font-weight:700;color:'+color+';background:#f1f5f9;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;letter-spacing:.5px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none" onclick="togSkuGroup(event,\''+grpId+'\')"><span style="text-transform:uppercase">'+label+'</span><span style="font-size:9px;opacity:.75">'+(allSel?'✓ deselect all':'+ select all')+'</span></div>';}
  var h=mkHdr("⚡ LT","#0ea5e9","LT",ltG)+mkItems(ltG)+mkHdr("🎯 LCC","#8b5cf6","LCC",lccG)+mkItems(lccG)+(othG.length?'<div style="padding:4px 10px 3px;font-size:10px;font-weight:700;color:#64748b;background:#f1f5f9;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px">Other</div>'+mkItems(othG):"");
  if(excl.length>0){h+='<div style="padding:5px 10px 3px;font-size:10px;color:#94a3b8;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">⚠ Excluded by default</div>';for(var i=0;i<excl.length;i++){var s=excl[i];var ck=selSku.has(s)?"checked":"";var esc=s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");h+='<div class="ms-item" data-p="'+esc+'" onclick="togSku(event,this)" style="opacity:0.65"><input type="checkbox" '+ck+' onclick="return false"><span style="color:#94a3b8">'+esc+"</span></div>";}}document.getElementById("msSkuItems").innerHTML=h;}
function togSku(ev,el){ev.stopPropagation();var s=el.getAttribute("data-p");if(selSku.has(s))selSku.delete(s);else selSku.add(s);updateMsSkuBtn();renderMsSkuItems();}
function skuAll(){var q=document.getElementById("msSkuQ").value.toLowerCase();D.FL.skus.filter(function(s){return!EXCLUDED_SKUS.has(s)&&s.toLowerCase().indexOf(q)>=0;}).forEach(function(s){selSku.add(s);});updateMsSkuBtn();renderMsSkuItems();}
function skuClear(){selSku.clear();updateMsSkuBtn();renderMsSkuItems();}
function togSkuGroup(ev,grp){ev.stopPropagation();var base=grp==="LT"?LT_SKUS:grp==="LCC"?LCC_SKUS:new Set();var vis=(D?D.FL.skus:[]).filter(function(s){return base.has(s)&&!EXCLUDED_SKUS.has(s);});var allSel=vis.length>0&&vis.every(function(s){return selSku.has(s);});vis.forEach(function(s){if(allSel)selSku.delete(s);else selSku.add(s);});updateMsSkuBtn();renderMsSkuItems();}
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


function getEffectiveSkus(){
  // Compute effective SKU set combining division filter + manual SKU filter
  var divSet=fDiv?(DIV_SKUS[fDiv]||new Set()):null;
  if(divSet&&selSku.size>0){
    var inter=new Set();selSku.forEach(function(s){if(divSet.has(s))inter.add(s);});return inter.size>0?inter:divSet;
  }
  if(divSet)return divSet;
  if(selSku.size>0)return selSku;
  return null;
}
function getTimeSeries(){
  var r=getRange(),byM={};
  var e12=function(){return[0,0,0,0,0,0,0,0,0,0,0,0];};
  var effSkus=getEffectiveSkus();
  var skus=effSkus?Array.from(effSkus):null;
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
  var effSkus=getEffectiveSkus();
  var skus=effSkus?Array.from(effSkus):null;
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
function applyFilters(){
  ["msDrop","msSkuDrop","msPcatDrop"].forEach(function(id){document.getElementById(id).classList.remove("open");});
  fDiv=document.getElementById("fDiv")?document.getElementById("fDiv").value:"";
  render();
  var cp=document.getElementById("cohort-panel");if(cp&&cp.style.display!=="none")renderCohortPanel();
}
function todayStr(){var t=new Date();return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");}
function resetFilters(){
  document.getElementById("df").value="2022-01-01";
  document.getElementById("dt").value=todayStr();
  ["fAct","fCncl"].forEach(function(id){document.getElementById(id).value="";});
  var fd=document.getElementById("fDiv");if(fd)fd.value="";
  fDiv="";
  selP.clear();updateMsBtn();selSku.clear();updateMsSkuBtn();selPcat.clear();updateMsPcatBtn();render();
  var cp=document.getElementById("cohort-panel");if(cp&&cp.style.display!=="none")renderCohortPanel();
}


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

// row: [id,contactid,date(2),active,cncl,inv_total,refunds,pcat,partner,...,division(15),heaven_date(16),invoice_actual(17)]
function getSkuDetailRows(sku){
  var r=getRange();
  var fAct=document.getElementById("fAct").value;
  var fCncl=document.getElementById("fCncl").value;
  var allRows=(D.order_rows&&D.order_rows[sku])||[];
  return allRows.filter(function(row){
    // row[16]=HEAVEN_DATE (effective date for filter); row[2]=original DATE (fallback)
    var dateM=(row[16]||row[2]).slice(0,7);
    if(dateM<r.df||dateM>r.dt)return false;
    if(fAct&&row[3]!==fAct)return false;
    if(fCncl&&row[4]!==fCncl)return false;
    if(selPcat.size>0&&!selPcat.has(row[7]))return false;
    if(selP.size>0&&!selP.has(row[8]))return false;
    if(fDiv&&row[15]!==fDiv)return false;
    return true;
  });
}

function downloadSkuDetailCsv(){
  var skuBkts=getSkuBuckets();
  var csvRows=[["SKU","Order ID","Contact ID","Heaven Date","Purchase Date","Product Name","Status","Cancel Status","Refund Days","Invoice Total","Net Invoice","Lost Revenue","Partner Category","Referral Partner"]];
  Object.keys(skuBkts).sort().forEach(function(sku){
    getSkuDetailRows(sku).forEach(function(row){
      csvRows.push([sku,row[0],row[1],row[16]||"",row[2],row[9]||"",row[3],row[4],row[11]||"",row[5],row[17]||0,row[10]||0,row[7],row[8]]);
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

// Count cancellations by refund/credit date falling in the selected range.
// Iterates all order_rows (any purchase date) and checks if purchase_date + rd_days lands in range.
function getCncByRefundDate(){
  var r=getRange();
  var effSkus=getEffectiveSkus();
  var pcats=selPcat.size>0?Array.from(selPcat):null;
  var count=0,lostRev=0;
  Object.keys(D.order_rows||{}).forEach(function(sku){
    if(EXCLUDED_SKUS.has(sku))return;
    if(effSkus&&!effSkus.has(sku))return;
    (D.order_rows[sku]||[]).forEach(function(row){
      if(row[4]!=="Cancelled")return;
      if(pcats&&pcats.indexOf(row[7])<0)return;
      if(selP.size>0&&!selP.has(row[8]))return;
      if(fDiv&&row[15]!==fDiv)return;
      var rdDays=row[12];
      if(rdDays<0)return;
      var refDate=new Date(row[2]);
      refDate.setDate(refDate.getDate()+rdDays);
      var refM=refDate.getFullYear()+"-"+String(refDate.getMonth()+1).padStart(2,"0");
      if(refM<r.df||refM>r.dt)return;
      count++;
      lostRev+=(row[10]||0);
    });
  });
  return{count:count,lostRev:Math.round(lostRev)};
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
  var cncByRef=getCncByRefundDate();
  document.getElementById("rcLbl").textContent=T.toLocaleString()+" records "+(selP.size>0?selP.size+" partner(s)":pcat||"all data");

  document.getElementById("kpiRow").innerHTML=
    '<div class="kpi-top-row">'+
      '<div class="kpi k1"><div class="kl">Total Units</div><div class="kv">'+net.toLocaleString()+'</div><div class="ks muted">excl. entry error, pend, no pmt</div></div>'+
      '<div class="kpi k2"><div class="kl">Active</div><div class="kv" style="color:#2563eb">'+AC.toLocaleString()+'</div><div class="ks muted">'+(net>0?(AC/net*100).toFixed(1):0)+'% of units</div></div>'+
      '<div class="kpi k4"><div class="kl">Cancelled</div><div class="kv" style="color:#ef4444">'+C.toLocaleString()+'</div><div class="ks red">'+(net>0?(C/net*100).toFixed(1):0)+'% of units · by purchase date</div><div style="margin-top:6px;padding-top:6px;border-top:1px solid #fee2e2"><div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px">Refunds in Period</div><div style="font-size:20px;font-weight:700;color:#ef4444">'+cncByRef.count.toLocaleString()+'</div><div style="font-size:10px;color:#64748b">cancelled in range · any purchase date</div></div></div>'+
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
  renderRefundSkuTable();
}

// ── Refunds in Period SKU Table ────────────────────────────
function getRefundPeriodSkuData(){
  var r=getRange();
  var effSkus=getEffectiveSkus();
  var pcats=selPcat.size>0?Array.from(selPcat):null;
  var bySkuRows={};
  Object.keys(D.order_rows||{}).forEach(function(sku){
    if(EXCLUDED_SKUS.has(sku))return;
    if(effSkus&&!effSkus.has(sku))return;
    (D.order_rows[sku]||[]).forEach(function(row){
      if(row[4]!=="Cancelled")return;
      if(pcats&&pcats.indexOf(row[7])<0)return;
      if(selP.size>0&&!selP.has(row[8]))return;
      if(fDiv&&row[15]!==fDiv)return;
      var rdDays=row[12];
      if(rdDays<0)return;
      var refDate=new Date(row[2]);
      refDate.setDate(refDate.getDate()+rdDays);
      var refM=refDate.getFullYear()+"-"+String(refDate.getMonth()+1).padStart(2,"0");
      if(refM<r.df||refM>r.dt)return;
      var refDateStr=refDate.getFullYear()+"-"+String(refDate.getMonth()+1).padStart(2,"0")+"-"+String(refDate.getDate()).padStart(2,"0");
      if(!bySkuRows[sku])bySkuRows[sku]=[];
      bySkuRows[sku].push({row:row,refDateStr:refDateStr,rdDays:rdDays});
    });
  });
  return bySkuRows;
}

function downloadRefundSkuCsv(){
  var bySkuRows=getRefundPeriodSkuData();
  var csvRows=[["SKU","Order ID","Contact ID","Purchase Date","Refund Date","Refund Days","Product Name","Cancel Status","Invoice Total","Lost Revenue","Partner Category","Referral Partner"]];
  Object.keys(bySkuRows).sort().forEach(function(sku){
    bySkuRows[sku].forEach(function(item){
      var row=item.row;
      csvRows.push([sku,row[0],row[1],row[2],item.refDateStr,item.rdDays,row[9]||"",row[4],row[5]||0,row[10]||0,row[7],row[8]]);
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
  a.download="refunds_in_period_"+rng.df+"_"+rng.dt+".csv";
  a.click();
}

function renderRefundSkuTable(){
  var sec=document.getElementById("refundSkuSection");
  if(!sec||!D)return;
  var bySkuRows=getRefundPeriodSkuData();
  var skus=Object.keys(bySkuRows).sort();
  var totalCount=0,totalLR=0;
  skus.forEach(function(sku){bySkuRows[sku].forEach(function(item){totalCount++;totalLR+=(item.row[10]||0);});});
  if(totalCount===0){sec.innerHTML="";return;}
  var html='<div class="card full" style="margin-top:0">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  html+='<div><div class="ct">Refunds in Period — SKU Summary</div><div class="cs">Cancellations where refund/credit date falls in the selected range · any purchase date</div></div>';
  html+='<div style="font-size:11px;color:#8b949e">'+skus.length+' SKUs &nbsp;'+totalCount.toLocaleString()+' refunds &nbsp;';
  html+='<button onclick="downloadRefundSkuCsv()" style="margin-left:6px;color:#2563eb;border:1px solid #2563eb44;background:transparent;padding:3px 10px;border-radius:16px;font-size:11px;cursor:pointer">&#11015; Download CSV</button></div>';
  html+='</div>';
  html+='<div class="tbl-wrap"><table><thead><tr>';
  ['SKU','Count','Avg Refund Days','Lost Revenue'].forEach(function(h){
    html+='<th>'+h+'</th>';
  });
  html+='</tr></thead><tbody>';
  skus.forEach(function(sku,idx){
    var items=bySkuRows[sku];
    var count=items.length;
    var lr=items.reduce(function(s,i){return s+(i.row[10]||0);},0);
    var avgRd=count>0?Math.round(items.reduce(function(s,i){return s+i.rdDays;},0)/count):0;
    var safeId="rsku_"+sku.replace(/[^a-zA-Z0-9]/g,"_");
    html+='<tr style="cursor:pointer" onclick="toggleSkuReasons(\''+safeId+'\')">';
    html+='<td><span style="font-size:10px;color:#2563eb;margin-right:4px" id="icon_'+safeId+'">&#9654;</span><span class="pill">'+sku+'</span></td>';
    html+='<td class="num" style="color:#ef4444">'+count.toLocaleString()+'</td>';
    html+='<td class="num">'+avgRd+'d</td>';
    html+='<td class="num" style="color:#ef4444">$'+Math.round(lr).toLocaleString()+'</td>';
    html+='</tr>';
    // Detail rows
    html+='<tr id="reasons_'+safeId+'" style="display:none"><td colspan="4" style="padding:0;background:#f8fafc;border-top:1px solid #dde3ea">';
    html+='<div style="padding:10px 16px 12px 24px">';
    html+='<div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">'+sku+' — '+count.toLocaleString()+' refunds in period</div>';
    html+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
    html+='<thead><tr style="background:#f1f5f9">';
    ['Order ID','Contact ID','Purchase Date','Refund Date','Refund Days','Product Name','Invoice Total','Lost Revenue','Partner Category'].forEach(function(h){
      html+='<th style="padding:6px 10px;text-align:left;font-weight:600;color:#374151;border-bottom:1px solid #dde3ea;white-space:nowrap">'+h+'</th>';
    });
    html+='</tr></thead><tbody>';
    items.forEach(function(item,di){
      var row=item.row;
      var bg=di%2===0?"#ffffff":"#f8fafc";
      html+='<tr style="background:'+bg+'">';
      html+='<td style="padding:5px 10px;color:#2563eb;font-family:monospace;font-size:11px">'+row[0]+'</td>';
      html+='<td style="padding:5px 10px;color:#64748b;font-family:monospace;font-size:11px">'+row[1]+'</td>';
      html+='<td style="padding:5px 10px;color:#374151;white-space:nowrap">'+row[2]+'</td>';
      html+='<td style="padding:5px 10px;color:#ef4444;font-weight:600;white-space:nowrap">'+item.refDateStr+'</td>';
      html+='<td style="padding:5px 10px;color:#2563eb;font-weight:600;text-align:right">'+item.rdDays+'d</td>';
      html+='<td style="padding:5px 10px;color:#374151;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(row[9]||'')+'">'+( row[9]||'—')+'</td>';
      html+='<td style="padding:5px 10px;text-align:right;color:#374151">$'+(row[5]||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>';
      var lr2=row[10]||0;
      html+='<td style="padding:5px 10px;text-align:right;color:'+(lr2>0?"#ef4444":"#94a3b8")+'">'+(lr2>0?'$'+lr2.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):'—')+'</td>';
      html+='<td style="padding:5px 10px;color:#64748b">'+( row[7]||'—')+'</td>';
      html+='</tr>';
    });
    html+='</tbody></table></div></div></td></tr>';
  });
  // Footer
  html+='<tr class="tfoot"><td>Total</td><td class="num" style="color:#ff7b72">'+totalCount.toLocaleString()+'</td><td class="num">—</td><td class="num" style="color:#ff7b72">$'+Math.round(totalLR).toLocaleString()+'</td></tr>';
  html+='</tbody></table></div></div>';
  sec.innerHTML=html;
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


// ── Cohort Cancel Rate ─────────────────────────────────────
function getCohortRows(){
  var r=getRange();
  var fAct=document.getElementById("fAct").value;
  var fCncl=document.getElementById("fCncl").value;
  var result=[];
  Object.keys(D.order_rows||{}).forEach(function(sku){
    if(EXCLUDED_SKUS.has(sku))return;
    if(selSku.size>0&&!selSku.has(sku))return;
    (D.order_rows[sku]||[]).forEach(function(row){
      // Cohort is defined by PURCHASE DATE (row[2]) — "orders bought in this range"
      // Top section uses effective/cancellation date (row[16]) via pre-aggregated maps
      var dateM=row[2].slice(0,7);
      if(dateM<r.df||dateM>r.dt)return;
      // Exclude same statuses as top KPI "Net Units" (Entry Error, Pend, No Pmt)
      if(row[4]==="Entry Error"||row[4]==="Pend"||row[4]==="No Pmt")return;
      if(fAct&&row[3]!==fAct)return;
      if(fCncl&&row[4]!==fCncl)return;
      if(selPcat.size>0&&!selPcat.has(row[7]))return;
      if(selP.size>0&&!selP.has(row[8]))return;
      if(fDiv&&row[15]!==fDiv)return;
      result.push({sku:sku,row:row});
    });
  });
  return result;
}

function getRangeEndMs(){
  // Returns last day of the selected date range (end of the dt month) as timestamp
  var r=getRange();
  var dt=r.dt; // YYYY-MM
  var y=parseInt(dt.slice(0,4)),m=parseInt(dt.slice(5,7));
  return new Date(y,m,0).getTime(); // day 0 of next month = last day of this month
}
function formatCutoffDate(ms){
  if(!ms&&ms!==0)return"";
  var d=new Date(ms);
  var mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return mo[d.getMonth()]+" "+d.getDate()+", "+d.getFullYear();
}
function isInCohortWindow(row,win,rangeEndMs){
  if(row[4]!=="Cancelled")return false;
  if(win<0)return true; // All time: include all cancelled
  var rdD=(row[12]!==undefined)?row[12]:-1;
  if(rdD<0)return false; // No refund date recorded
  var purchaseMs=new Date(row[2]).getTime();
  var cancelMs=purchaseMs+rdD*86400000;
  // Cutoff = date range end + X days (applies to every order equally)
  // Early purchases: judged against range end + window days
  // Late purchases (near end of range): also get range end + window days = their full window
  var cutoff=rangeEndMs+win*86400000;
  return cancelMs<=cutoff;
}

function renderCohort(){
  var sec=document.getElementById("cohortSection");
  if(!sec||!D)return;
  if(charts.cohortBucket){charts.cohortBucket.destroy();charts.cohortBucket=null;}
  if(charts.cohortUpgrade){charts.cohortUpgrade.destroy();charts.cohortUpgrade=null;}
  if(charts.cohortSku){charts.cohortSku.destroy();charts.cohortSku=null;}

  var win=cohortWindow;
  var cutoffMs=getRangeEndMs();
  var allRows=getCohortRows();

  var cohortPurchases=allRows.length;
  var cancelledInWindow=0,ldpInCohort=0,ldpCancelledInWindow=0;
  var ldpNetInv=0,fpNetInv=0;
  allRows.forEach(function(item){
    var row=item.row;
    var inWin=isInCohortWindow(row,win,cutoffMs);
    if(inWin)cancelledInWindow++;
    var ni=(row[17]!==undefined&&row[17]>0)?row[17]:0;
    if(isLdpRow(row)){
      ldpInCohort++;
      ldpNetInv+=ni;
      if(inWin)ldpCancelledInWindow++;
    } else {
      fpNetInv+=ni;
    }
  });
  var cohortRate=cohortPurchases>0?(cancelledInWindow/cohortPurchases*100):0;
  // LDP cancel rate = LDP cancelled ÷ LDP in cohort
  var ldpRate=ldpInCohort>0?(ldpCancelledInWindow/ldpInCohort*100):0;
  var ldpPct=cohortPurchases>0?(ldpInCohort/cohortPurchases*100):0;
  // Full Pay (non-LDP)
  var fullPayInCohort=cohortPurchases-ldpInCohort;
  var fullPayCancelled=cancelledInWindow-ldpCancelledInWindow;
  var fullPayRate=fullPayInCohort>0?(fullPayCancelled/fullPayInCohort*100):0;
  var fullPayPct=cohortPurchases>0?(fullPayInCohort/cohortPurchases*100):0;
  // Upgrades & Downgrades — split by LDP vs Full Pay
  var upgradeCount=0,downgradeCount=0,ldpUpgrades=0,ldpDowngrades=0,fpUpgrades=0,fpDowngrades=0;
  allRows.forEach(function(item){
    var c=item.row[4];
    var isLdp=isLdpRow(item.row);
    if(c==="Upgrade"){upgradeCount++;if(isLdp)ldpUpgrades++;else fpUpgrades++;}
    else if(c==="Downgrade"){downgradeCount++;if(isLdp)ldpDowngrades++;else fpDowngrades++;}
  });
  var upgradeRate=cohortPurchases>0?(upgradeCount/cohortPurchases*100):0;
  var downgradeRate=cohortPurchases>0?(downgradeCount/cohortPurchases*100):0;
  var ldpUpgradeRate=ldpInCohort>0?(ldpUpgrades/ldpInCohort*100):0;
  var ldpDowngradeRate=ldpInCohort>0?(ldpDowngrades/ldpInCohort*100):0;
  var fpUpgradeRate=fullPayInCohort>0?(fpUpgrades/fullPayInCohort*100):0;
  var fpDowngradeRate=fullPayInCohort>0?(fpDowngrades/fullPayInCohort*100):0;

  // Collect orders with no refund date (cancelled but rd_days = -1)
  var naOrders=[];
  allRows.forEach(function(item){
    var row=item.row;
    if(row[4]==="Cancelled"&&((row[12]===undefined)||row[12]<0)){
      naOrders.push({sku:item.sku,row:row});
    }
  });

  // Days-to-cancel buckets (counts ALL cancelled orders regardless of window)
  var bktLabels=["0–30d","31–60d","61–90d","91–180d","181–365d","365+d","N/A"];
  var bktCounts=[0,0,0,0,0,0,0];
  allRows.forEach(function(item){
    var row=item.row;
    if(row[4]!=="Cancelled")return;
    var d=(row[12]!==undefined)?row[12]:-1;
    if(d<0)bktCounts[6]++;
    else if(d<=30)bktCounts[0]++;
    else if(d<=60)bktCounts[1]++;
    else if(d<=90)bktCounts[2]++;
    else if(d<=180)bktCounts[3]++;
    else if(d<=365)bktCounts[4]++;
    else bktCounts[5]++;
  });
  var totalCancelled=bktCounts.reduce(function(a,b){return a+b;},0);
  // Cumulative % denominator excludes N/A (only orders with a known refund date)
  var totalWithDate=totalCancelled-bktCounts[6];
  var cumPct=[],running=0;
  bktCounts.forEach(function(c,i){
    if(i<6){running+=c;cumPct.push(totalWithDate>0?parseFloat((running/totalWithDate*100).toFixed(1)):0);}
    else cumPct.push(null);
  });

  // SKU breakdown
  var skuMap={};
  var totalNetInv=0;
  allRows.forEach(function(item){
    var sku=item.sku,row=item.row;
    if(!skuMap[sku])skuMap[sku]={total:0,cancelled:0,ldp:0,ldpCancelled:0,sumDays:0,countDays:0,netInv:0};
    skuMap[sku].total++;
    var inWin=isInCohortWindow(row,win,cutoffMs);
    if(inWin)skuMap[sku].cancelled++;
    if(isLdpRow(row)){
      skuMap[sku].ldp++;
      if(inWin)skuMap[sku].ldpCancelled++;
    }
    var rdD=(row[12]!==undefined)?row[12]:-1;
    if(row[4]==="Cancelled"&&rdD>=0){skuMap[sku].sumDays+=rdD;skuMap[sku].countDays++;}
    var ni=(row[17]!==undefined&&row[17]>0)?row[17]:0;
    skuMap[sku].netInv+=ni;totalNetInv+=ni;
  });
  var skuArr=Object.entries(skuMap).sort(function(a,b){return b[1].total-a[1].total;});

  // Filter pills
  var r2=getRange();
  var pills='<span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-right:4px">'+r2.df+' → '+r2.dt+'</span>';
  if(selSku.size>0)pills+='<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-right:4px">'+selSku.size+' SKU'+(selSku.size>1?'s':'')+'</span>';
  if(selPcat.size>0)pills+='<span style="background:#fdf4ff;color:#6b21a8;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-right:4px">'+selPcat.size+' category(s)</span>';
  if(selP.size>0)pills+='<span style="background:#fff7ed;color:#9a3412;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-right:4px">'+selP.size+' partner(s)</span>';
  var fAct2=document.getElementById("fAct").value;
  var fCncl2=document.getElementById("fCncl").value;
  if(fAct2)pills+='<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-right:4px">'+fAct2+'</span>';
  if(fCncl2)pills+='<span style="background:#fef2f2;color:#991b1b;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin-right:4px">'+fCncl2+'</span>';

  var winLabel=win<0?"All time":win+" days";
  var rangeEndLabel=formatCutoffDate(cutoffMs); // cutoffMs = range end here
  var hardCutoffMs=win<0?cutoffMs:cutoffMs+win*86400000;
  var hardCutoffLabel=formatCutoffDate(hardCutoffMs);
  var windowNote=win<0?"all cancelled orders":"cancelled on or before "+hardCutoffLabel+" ("+rangeEndLabel+" + "+winLabel+")";

  // SKU table rows
  var tRows='';
  skuArr.forEach(function(e){
    var s=e[0],d=e[1];
    var rate=d.total>0?(d.cancelled/d.total*100):0;
    var ldpR=d.ldp>0?(d.ldpCancelled/d.ldp*100):0;
    var barW=Math.min(100,Math.round(rate));
    var sEsc=s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    var safeId=s.replace(/[^a-zA-Z0-9]/g,"_");
    var niDisp=d.netInv>0?'$'+Math.round(d.netInv).toLocaleString():'—';
    tRows+='<tr class="cohort-sku-row" style="cursor:pointer" onclick="toggleCohortSkuDetail(event,\''+s.replace(/\\/g,"\\\\").replace(/'/g,"\\'")+'\')">'
      +'<td style="text-align:left"><span class="cohort-arrow-'+safeId+'" style="font-size:11px;color:#94a3b8;margin-right:6px">▶</span>'+sEsc+'</td>'
      +'<td style="text-align:center">'+d.total.toLocaleString()+'</td>'
      +'<td style="text-align:center">'+d.cancelled.toLocaleString()+'</td>'
      +'<td style="text-align:center">'+d.ldp.toLocaleString()+'</td>'
      +'<td style="text-align:center">'+d.ldpCancelled.toLocaleString()+'</td>'
      +'<td style="text-align:center">'+rate.toFixed(1)+'%</td>'
      +'<td style="text-align:center"><div style="display:flex;align-items:center;justify-content:center;gap:6px"><div style="width:60px;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden"><div style="width:'+barW+'%;height:100%;background:#f85149;border-radius:3px"></div></div><span style="font-size:10px;color:#64748b">'+rate.toFixed(1)+'%</span></div></td>'
      +'<td style="text-align:center;color:#7c3aed;font-weight:600">'+niDisp+'</td>'
      +'</tr>'
      +'<tr id="cohort-detail-'+safeId+'" style="display:none"><td colspan="8" style="padding:0"></td></tr>';
  });
  var totBarW=Math.min(100,Math.round(cohortRate));
  var totalNIDisp=totalNetInv>0?'$'+Math.round(totalNetInv).toLocaleString():'—';
  var tFoot='<tr class="tfoot">'
    +'<td style="text-align:left">TOTAL</td>'
    +'<td style="text-align:center">'+cohortPurchases.toLocaleString()+'</td>'
    +'<td style="text-align:center">'+cancelledInWindow.toLocaleString()+'</td>'
    +'<td style="text-align:center">'+ldpInCohort.toLocaleString()+'</td>'
    +'<td style="text-align:center">'+ldpCancelledInWindow.toLocaleString()+'</td>'
    +'<td style="text-align:center">'+cohortRate.toFixed(1)+'%</td>'
    +'<td style="text-align:center"><div style="display:flex;align-items:center;justify-content:center;gap:6px"><div style="width:60px;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden"><div style="width:'+totBarW+'%;height:100%;background:#f85149;border-radius:3px"></div></div><span style="font-size:10px;color:#64748b">'+cohortRate.toFixed(1)+'%</span></div></td>'
    +'<td style="text-align:center;color:#7c3aed;font-weight:600">'+totalNIDisp+'</td>'
    +'</tr>';

  sec.innerHTML=
    '<div class="card full" style="margin-top:16px">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'
    +'<div><div class="ct">Cohort Cancel Rate</div>'
    +'<div class="cs">Of orders purchased in the date range — '+windowNote+'</div></div>'
    +'<div style="display:flex;align-items:center;gap:8px">'
    +'<label style="font-size:11px;color:#64748b;font-weight:600">Cancel Window</label>'
    +'<select id="cohortWindowSel" style="font-size:12px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;color:#1e293b;background:#fff" onchange="cohortWindow=parseInt(this.value);renderCohort()">'
    +'<option value="30"'+(win===30?' selected':'')+'>30 days</option>'
    +'<option value="60"'+(win===60?' selected':'')+'>60 days</option>'
    +'<option value="90"'+(win===90?' selected':'')+'>90 days</option>'
    +'<option value="180"'+(win===180?' selected':'')+'>180 days</option>'
    +'<option value="365"'+(win===365?' selected':'')+'>365 days</option>'
    +'<option value="-1"'+(win===-1?' selected':'')+'>All time</option>'
    +'</select>'
    +'<button onclick="downloadCohortCsv()" style="font-size:11px;padding:4px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;color:#1e293b;cursor:pointer">⬇ Export CSV</button>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:6px;margin-top:6px">'
    +'<label style="font-size:11px;color:#7c3aed;font-weight:600;white-space:nowrap">💳 LDP Window</label>'
    +['Same day','+1 day','+2 days','+3 days'].map(function(lbl,i){var act=cohortLdpWin===i;return'<button id="coh-dw'+i+'" onclick="setCohortLdpWin('+i+')" style="padding:3px 10px;border-radius:20px;border:1px solid '+(act?"#7c3aed":"#e2e8f0")+';background:'+(act?"#7c3aed":"#f8fafc")+';color:'+(act?"#fff":"#475569")+';font-size:11px;font-weight:'+(act?"700":"400")+';cursor:pointer">'+lbl+'</button>';}).join("")
    +'</div></div>'
    +'<div style="margin-bottom:14px;font-size:11px;color:#64748b">Inherited filters: '+pills+'</div>'
    // KPI row 1 — two group cards
    +'<div style="display:grid;grid-template-columns:3fr 2fr;gap:10px;margin-bottom:10px">'
    // Cancel metrics group
    +'<div style="border-radius:8px;padding:14px 16px;border:1px solid #ef444455;background:#fff8f8">'
    +'<div style="display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#991b1b;margin-bottom:12px">🚫 COHORT CANCEL METRICS</div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #f1f5f9;box-shadow:0 1px 2px rgba(0,0,0,.04)"><div class="kl">Cohort Purchases</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px">'+cohortPurchases.toLocaleString()+'</div><div class="ks muted">orders in date range</div></div>'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #f1f5f9;box-shadow:0 1px 2px rgba(0,0,0,.04)"><div class="kl">Cancelled in Window</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px;color:#ef4444">'+cancelledInWindow.toLocaleString()+'</div><div class="ks red">'+(win<0?"all time":"on or before "+hardCutoffLabel)+'</div></div>'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #f1f5f9;box-shadow:0 1px 2px rgba(0,0,0,.04)"><div class="kl">Cohort Cancel Rate</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px;color:#ef4444">'+cohortRate.toFixed(1)+'%</div><div class="ks red">cancelled ÷ purchases</div></div>'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #f1f5f9;box-shadow:0 1px 2px rgba(0,0,0,.04);border-top:3px solid #7c3aed"><div class="kl">Net Invoice</div><div class="kv" style="font-size:20px;letter-spacing:-0.5px;color:#7c3aed">'+(totalNetInv>0?'$'+Math.round(totalNetInv).toLocaleString():'—')+'</div><div class="ks" style="color:#7c3aed">sum of INVOICE_ACTUAL</div></div>'
    +'</div></div>'
    // Upgrades & Downgrades group
    +'<div style="border-radius:8px;padding:14px 16px;border:1px solid #16a34a44;background:#f0fdf4">'
    +'<div style="display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#166534;margin-bottom:12px">📈 UPGRADES &amp; DOWNGRADES</div>'
    +'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #f1f5f9;box-shadow:0 1px 2px rgba(0,0,0,.04)"><div class="kl">Upgrades</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px;color:#16a34a">'+upgradeCount.toLocaleString()+'</div><div class="ks green">'+upgradeRate.toFixed(1)+'% of cohort units</div></div>'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #f1f5f9;box-shadow:0 1px 2px rgba(0,0,0,.04)"><div class="kl">Downgrades</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px;color:#7c3aed">'+downgradeCount.toLocaleString()+'</div><div class="ks purple">'+downgradeRate.toFixed(1)+'% of cohort units</div></div>'
    +'</div></div>'
    +'</div>'
    // KPI row 2 — two groups: LDP + Full Pay
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">'
    // LDP group (blue)
    +'<div style="border:1px solid #bfdbfe;background:#f0f7ff;border-radius:10px;padding:12px 14px">'
    +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#1d4ed8;margin-bottom:10px">💳 Less Down Payment (LDP)</div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:7px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,.04);position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#2563eb"></div><div class="kl">LDP in Cohort</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px;color:#1d4ed8">'+ldpInCohort.toLocaleString()+'</div><div class="ks blue">'+ldpPct.toFixed(1)+'% of purchases</div></div>'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:7px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,.04);position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#ef4444"></div><div class="kl">LDP Cancelled</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px;color:#ef4444">'+ldpCancelledInWindow.toLocaleString()+'</div><div class="ks red">cancelled in window</div></div>'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:7px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,.04);position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#1d4ed8"></div><div class="kl">LDP Cancel Rate</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px;color:#1d4ed8">'+ldpRate.toFixed(1)+'%</div><div class="ks blue">LDP cancelled ÷ LDP units</div></div>'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:7px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,.04);position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#7c3aed"></div><div class="kl">Net Invoice</div><div class="kv" style="font-size:18px;letter-spacing:-0.5px;color:#7c3aed">'+(ldpNetInv>0?'$'+Math.round(ldpNetInv).toLocaleString():'—')+'</div><div class="ks" style="color:#7c3aed">LDP net invoice total</div></div>'
    +'</div>'
    +'<div style="margin-top:8px;display:flex;gap:8px">'
    +'<div style="flex:1;display:flex;align-items:center;gap:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;padding:8px 12px">'
    +'<div style="font-size:20px;font-weight:700;color:#16a34a;letter-spacing:-0.5px">'+ldpUpgrades.toLocaleString()+'</div>'
    +'<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#166534">Upgrades</div><div style="font-size:10px;color:#16a34a">'+ldpUpgradeRate.toFixed(1)+'% of LDP</div></div>'
    +'</div>'
    +'<div style="flex:1;display:flex;align-items:center;gap:10px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:7px;padding:8px 12px">'
    +'<div style="font-size:20px;font-weight:700;color:#7c3aed;letter-spacing:-0.5px">'+ldpDowngrades.toLocaleString()+'</div>'
    +'<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b21a8">Downgrades</div><div style="font-size:10px;color:#7c3aed">'+ldpDowngradeRate.toFixed(1)+'% of LDP</div></div>'
    +'</div>'
    +'</div></div>'
    // Full Pay group (green)
    +'<div style="border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;padding:12px 14px">'
    +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#166534;margin-bottom:10px">✅ Full Down Payment</div>'
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:7px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,.04);position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#16a34a"></div><div class="kl">Full Pay in Cohort</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px;color:#166534">'+fullPayInCohort.toLocaleString()+'</div><div class="ks green">'+fullPayPct.toFixed(1)+'% of purchases</div></div>'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:7px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,.04);position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#ef4444"></div><div class="kl">Full Pay Cancelled</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px;color:#ef4444">'+fullPayCancelled.toLocaleString()+'</div><div class="ks red">cancelled in window</div></div>'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:7px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,.04);position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#166534"></div><div class="kl">Full Pay Cancel Rate</div><div class="kv" style="font-size:22px;letter-spacing:-0.5px;color:#166534">'+fullPayRate.toFixed(1)+'%</div><div class="ks green">FP cancelled ÷ FP units</div></div>'
    +'<div class="kpi" style="padding:10px 12px;background:#fff;border-radius:7px;border:1px solid #e2e8f0;box-shadow:0 1px 2px rgba(0,0,0,.04);position:relative;overflow:hidden"><div style="position:absolute;top:0;left:0;right:0;height:3px;background:#7c3aed"></div><div class="kl">Net Invoice</div><div class="kv" style="font-size:18px;letter-spacing:-0.5px;color:#7c3aed">'+(fpNetInv>0?'$'+Math.round(fpNetInv).toLocaleString():'—')+'</div><div class="ks" style="color:#7c3aed">FP net invoice total</div></div>'
    +'</div>'
    +'<div style="margin-top:8px;display:flex;gap:8px">'
    +'<div style="flex:1;display:flex;align-items:center;gap:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;padding:8px 12px">'
    +'<div style="font-size:20px;font-weight:700;color:#16a34a;letter-spacing:-0.5px">'+fpUpgrades.toLocaleString()+'</div>'
    +'<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#166534">Upgrades</div><div style="font-size:10px;color:#16a34a">'+fpUpgradeRate.toFixed(1)+'% of FDP</div></div>'
    +'</div>'
    +'<div style="flex:1;display:flex;align-items:center;gap:10px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:7px;padding:8px 12px">'
    +'<div style="font-size:20px;font-weight:700;color:#7c3aed;letter-spacing:-0.5px">'+fpDowngrades.toLocaleString()+'</div>'
    +'<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b21a8">Downgrades</div><div style="font-size:10px;color:#7c3aed">'+fpDowngradeRate.toFixed(1)+'% of FDP</div></div>'
    +'</div>'
    +'</div></div>'
    +'</div>'
    // Charts
    +'<div class="grid2" style="margin-bottom:16px">'
    +'<div class="card"><div class="ct">Days to Cancel</div><div class="cs">Count of cancelled orders by days-to-cancel bucket with cumulative % line</div><div style="height:230px;position:relative"><canvas id="cohortBucketChart"></canvas></div></div>'
    +'<div class="card"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px"><div><div class="ct">Upgrades &amp; Downgrades</div><div class="cs">Unit counts (bars) · Rate % of cohort (line, right axis)</div></div><div class="legend"><div class="li"><div class="ld" style="background:#16a34a"></div>Upgrades</div><div class="li"><div class="ld" style="background:#7c3aed"></div>Downgrades</div><div class="li"><div class="ld" style="background:#64748b;width:18px;height:2px;border-radius:0"></div>Rate %</div></div></div><div style="height:200px;position:relative"><canvas id="cohortUpgradeChart"></canvas></div></div>'
    +'</div>'
    // N/A orders warning panel
    +(naOrders.length>0
      ?'<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">'
        +'<div style="display:flex;align-items:center;gap:10px">'
        +'<span style="font-size:16px">⚠️</span>'
        +'<div><div style="font-size:12px;font-weight:600;color:#92400e">'+naOrders.length.toLocaleString()+' cancelled order'+(naOrders.length>1?'s have':' has')+' no refund date on record</div>'
        +'<div style="font-size:11px;color:#b45309;margin-top:2px">These are excluded from the Days to Cancel chart and the Cancelled in Window count. Review to determine if they should be included.</div></div>'
        +'</div>'
        +'<button onclick="toggleCohortNaOrders()" id="cohortNaBtn" style="font-size:11px;padding:4px 12px;border:1px solid #f59e0b;border-radius:6px;background:#fef3c7;color:#92400e;cursor:pointer;white-space:nowrap">View orders ▶</button>'
        +'</div>'
        +'<div id="cohortNaPanel" style="display:none;margin-bottom:16px"></div>'
      :'')
    // SKU comparison chart
    +'<div class="card" style="margin-bottom:16px">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">'
    +'<div><div class="ct">SKU Comparison</div><div class="cs">Cancel rate % &amp; LDP cancel rate % (bars) · Avg days to cancel (line) — top 15 SKUs by volume</div></div>'
    +'<div class="legend"><div class="li"><div class="ld" style="background:#f85149"></div>Cancel Rate %</div><div class="li"><div class="ld" style="background:#3b82f6"></div>LDP Cancel Rate %</div><div class="li"><div class="ld" style="background:#f59e0b;width:18px;height:2px;border-radius:0"></div>Avg Days to Cancel</div></div>'
    +'</div>'
    +'<div style="height:300px;position:relative"><canvas id="cohortSkuChart"></canvas></div>'
    +'</div>'
    // Table
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    +'<div class="ct" style="margin-bottom:0">SKU Cohort Summary</div>'
    +'<div style="font-size:11px;color:#8b949e">Click a row to see individual orders</div>'
    +'</div>'
    +'<div class="tbl-wrap"><table><thead><tr>'
    +'<th style="text-align:left">SKU</th>'
    +'<th style="text-align:center">Purchases</th>'
    +'<th style="text-align:center">Cancelled in Window</th>'
    +'<th style="text-align:center">LDP Orders</th>'
    +'<th style="text-align:center">LDP Cancelled</th>'
    +'<th style="text-align:center">Cancel Rate %</th>'
    +'<th style="text-align:center">Cancel Rate</th>'
    +'<th style="text-align:center;color:#7c3aed">Net Invoice</th>'
    +'</tr></thead><tbody>'+tRows+'</tbody>'
    +'<tfoot>'+tFoot+'</tfoot></table></div>'
    +'</div>';

  // Render bucket chart
  var bktEl=document.getElementById("cohortBucketChart");
  if(bktEl){
    charts.cohortBucket=new Chart(bktEl.getContext("2d"),{
      type:"bar",
      data:{
        labels:bktLabels,
        datasets:[
          {label:"Cancelled",data:bktCounts,backgroundColor:bktCounts.map(function(_,i){return i===6?"#cbd5e1":"#f85149";}),borderRadius:4,yAxisID:"y",order:2},
          {label:"Cumulative %",data:cumPct,type:"line",borderColor:"#388bfd",backgroundColor:"transparent",borderWidth:2,pointRadius:4,pointBackgroundColor:"#388bfd",yAxisID:"y2",order:1,spanGaps:false}
        ]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{position:"top",labels:{color:"#64748b",font:{size:11},boxWidth:12,padding:10}},
          tooltip:{callbacks:{label:function(ctx){return ctx.datasetIndex===1?"Cumulative: "+(ctx.raw!=null?ctx.raw.toFixed(1)+"%":"N/A"):"Count: "+ctx.raw;}}}
        },
        scales:{
          x:{ticks:{color:"#64748b",font:{size:10}},grid:{display:false}},
          y:{beginAtZero:true,ticks:{color:"#64748b",font:{size:10}},grid:{color:"#f1f5f9"},title:{display:true,text:"Count",color:"#94a3b8",font:{size:10}}},
          y2:{beginAtZero:true,max:100,position:"right",ticks:{color:"#64748b",font:{size:10},callback:function(v){return v+"%";}},grid:{display:false}}
        }
      }
    });
  }

  // Render upgrades & downgrades chart
  var upgradeEl=document.getElementById("cohortUpgradeChart");
  if(upgradeEl){
    var maxUDRate=Math.max(upgradeRate,downgradeRate);
    charts.cohortUpgrade=new Chart(upgradeEl.getContext("2d"),{
      type:"bar",
      data:{
        labels:["Upgrades","Downgrades"],
        datasets:[
          {label:"Units",data:[upgradeCount,downgradeCount],backgroundColor:["#16a34a88","#7c3aed88"],borderColor:["#16a34a","#7c3aed"],borderWidth:1,borderRadius:6,maxBarThickness:90,yAxisID:"y",order:2},
          {label:"Rate %",data:[parseFloat(upgradeRate.toFixed(1)),parseFloat(downgradeRate.toFixed(1))],type:"line",borderColor:"#64748b",backgroundColor:"transparent",borderWidth:2,pointRadius:8,pointBackgroundColor:["#16a34a","#7c3aed"],pointBorderColor:"#fff",pointBorderWidth:2,yAxisID:"y2",order:1}
        ]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:function(ctx){return ctx.datasetIndex===0?"Units: "+ctx.raw:ctx.raw.toFixed(1)+"% of cohort";}}}
        },
        scales:{
          x:{ticks:{color:"#64748b",font:{size:12,weight:"600"}},grid:{display:false}},
          y:{beginAtZero:true,ticks:{color:"#64748b",font:{size:10}},grid:{color:"#f1f5f9"},title:{display:true,text:"Units",color:"#94a3b8",font:{size:10}}},
          y2:{beginAtZero:true,max:Math.max(maxUDRate*1.5,5),position:"right",ticks:{color:"#64748b",font:{size:10},callback:function(v){return v+"%";}},grid:{display:false},title:{display:true,text:"% of cohort",color:"#94a3b8",font:{size:10}}}
        }
      }
    });
  }

  // Render SKU comparison chart
  var skuEl=document.getElementById("cohortSkuChart");
  if(skuEl){
    var top15=skuArr.slice(0,15);
    var skuLabels=top15.map(function(e){var s=e[0];return s.length>20?s.slice(0,18)+"…":s;});
    var skuCancelRates=top15.map(function(e){var d=e[1];return d.total>0?parseFloat((d.cancelled/d.total*100).toFixed(1)):0;});
    var skuLdpRates=top15.map(function(e){var d=e[1];return d.total>0?parseFloat((d.ldpCancelled/d.total*100).toFixed(1)):null;});
    var skuAvgDays=top15.map(function(e){var d=e[1];return d.countDays>0?parseFloat((d.sumDays/d.countDays).toFixed(1)):null;});
    charts.cohortSku=new Chart(skuEl.getContext("2d"),{
      type:"bar",
      data:{
        labels:skuLabels,
        datasets:[
          {label:"Cancel Rate %",data:skuCancelRates,backgroundColor:"#f8514988",borderColor:"#f85149",borderWidth:1,borderRadius:3,yAxisID:"y",order:2},
          {label:"LDP Cancel Rate %",data:skuLdpRates,backgroundColor:"#3b82f688",borderColor:"#3b82f6",borderWidth:1,borderRadius:3,yAxisID:"y",order:3},
          {label:"Avg Days to Cancel",data:skuAvgDays,type:"line",borderColor:"#f59e0b",backgroundColor:"transparent",borderWidth:2,pointRadius:4,pointBackgroundColor:"#f59e0b",yAxisID:"y2",order:1,spanGaps:false}
        ]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:function(ctx){
            if(ctx.datasetIndex===2)return "Avg Days: "+(ctx.raw!=null?ctx.raw.toFixed(1)+"d":"N/A");
            return ctx.dataset.label+": "+(ctx.raw!=null?ctx.raw.toFixed(1)+"%":"N/A");
          }}}
        },
        scales:{
          x:{ticks:{color:"#64748b",font:{size:10},maxRotation:40,minRotation:30},grid:{display:false}},
          y:{beginAtZero:true,ticks:{color:"#64748b",font:{size:10},callback:function(v){return v+"%";}},grid:{color:"#f1f5f9"},title:{display:true,text:"Cancel Rate %",color:"#94a3b8",font:{size:10}}},
          y2:{beginAtZero:true,position:"right",ticks:{color:"#f59e0b",font:{size:10},callback:function(v){return v+"d";}},grid:{display:false},title:{display:true,text:"Avg Days",color:"#f59e0b",font:{size:10}}}
        }
      }
    });
  }
}

function toggleCohortSkuDetail(e,sku){
  var safeId=sku.replace(/[^a-zA-Z0-9]/g,"_");
  var detailRow=document.getElementById("cohort-detail-"+safeId);
  if(!detailRow)return;
  var isOpen=detailRow.style.display!=="none";
  var arrows=document.querySelectorAll(".cohort-arrow-"+safeId);
  if(isOpen){
    detailRow.style.display="none";
    arrows.forEach(function(a){a.textContent="▶";});
    return;
  }
  var win=cohortWindow;
  var cutoffMs=getRangeEndMs();
  var r2=getRange();
  var fAct=document.getElementById("fAct").value;
  var fCncl=document.getElementById("fCncl").value;
  var rows=(D.order_rows[sku]||[]).filter(function(row){
    // Use HEAVEN_DATE (row[16]) for date filter; fall back to DATE (row[2])
    var dateM=(row[16]||row[2]).slice(0,7);
    if(dateM<r2.df||dateM>r2.dt)return false;
    if(fAct&&row[3]!==fAct)return false;
    if(fCncl&&row[4]!==fCncl)return false;
    if(selPcat.size>0&&!selPcat.has(row[7]))return false;
    if(selP.size>0&&!selP.has(row[8]))return false;
    return true;
  });
  var h='<td colspan="8" style="padding:0 0 6px 28px">'
    +'<table style="width:100%;font-size:11px;border-collapse:collapse">'
    +'<thead><tr style="background:#f8fafc">'
    +'<th style="padding:5px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Order ID</th>'
    +'<th style="padding:5px 8px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Contact ID</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#0d9488;font-weight:600;border-bottom:1px solid #e2e8f0">Heaven Date</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Purchase Date</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Active Status</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Cancel Status</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Invoice Total</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#7c3aed;font-weight:600;border-bottom:1px solid #e2e8f0">Net Invoice</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Refunds</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">Days to Cancel</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">LDP</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#1d4ed8;font-weight:600;border-bottom:1px solid #e2e8f0">LDP Deposit</th>'
    +'<th style="padding:5px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0">In Window</th>'
    +'</tr></thead><tbody>';
  rows.forEach(function(row){
    var inWin=isInCohortWindow(row,win,cutoffMs);
    var rdD=(row[12]!==undefined)?row[12]:-1;
    var rdDisp=rdD>=0?rdD+"d":"N/A";
    var isLdp=isLdpRow(row);
    var ldpDep=getDepByWin(row);
    var ldpDepDisp=isLdp&&ldpDep>0?'$'+ldpDep.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0}):'—';
    var heavenDate=row[16]||"";
    var netInv=row[17]||0;
    var netInvDisp=netInv>0?'$'+netInv.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0}):'—';
    h+='<tr style="border-top:1px solid #f1f5f9">'
      +'<td style="padding:4px 8px;font-family:monospace;font-size:10px;color:#0ea5e9">'+(row[0]||"")+'</td>'
      +'<td style="padding:4px 8px;font-family:monospace;font-size:10px;color:#64748b">'+(row[1]||"")+'</td>'
      +'<td style="padding:4px 8px;text-align:center;color:#0d9488;font-weight:600">'+heavenDate+'</td>'
      +'<td style="padding:4px 8px;text-align:center;color:#94a3b8">'+(row[2]||"")+'</td>'
      +'<td style="padding:4px 8px;text-align:center"><span style="padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600;background:'+(row[3]==="Active"?"#dcfce7":"#fee2e2")+';color:'+(row[3]==="Active"?"#166534":"#991b1b")+'">'+(row[3]||"")+'</span></td>'
      +'<td style="padding:4px 8px;text-align:center;color:#64748b">'+(row[4]||"")+'</td>'
      +'<td style="padding:4px 8px;text-align:center;color:#1e293b">$'+((row[5]||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0}))+'</td>'
      +'<td style="padding:4px 8px;text-align:center;color:#7c3aed;font-weight:600">'+netInvDisp+'</td>'
      +'<td style="padding:4px 8px;text-align:center;color:#64748b">$'+((row[6]||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0}))+'</td>'
      +'<td style="padding:4px 8px;text-align:center;color:#64748b">'+rdDisp+'</td>'
      +'<td style="padding:4px 8px;text-align:center"><span style="padding:1px 6px;border-radius:10px;font-size:10px;background:'+(isLdp?"#dbeafe":"#f1f5f9")+';color:'+(isLdp?"#1d4ed8":"#64748b")+'">'+(isLdp?"Yes":"No")+'</span></td>'
      +'<td style="padding:4px 8px;text-align:center;color:#1d4ed8;font-weight:600">'+ldpDepDisp+'</td>'
      +'<td style="padding:4px 8px;text-align:center"><span style="padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600;background:'+(inWin?"#dcfce7":"#f1f5f9")+';color:'+(inWin?"#166534":"#64748b")+'">'+(inWin?"✓ Yes":"No")+'</span></td>'
      +'</tr>';
  });
  h+='</tbody></table></td>';
  detailRow.innerHTML=h;
  detailRow.style.display="";
  arrows.forEach(function(a){a.textContent="▼";});
}

function toggleCohortNaOrders(){
  var panel=document.getElementById("cohortNaPanel");
  var btn=document.getElementById("cohortNaBtn");
  if(!panel)return;
  if(panel.style.display!=="none"){panel.style.display="none";if(btn)btn.textContent="View orders ▶";return;}
  // Build N/A orders from current cohort rows
  var win=cohortWindow;
  var r2=getRange();
  var fAct=document.getElementById("fAct").value;
  var fCncl=document.getElementById("fCncl").value;
  var naList=[];
  Object.keys(D.order_rows||{}).forEach(function(sku){
    if(EXCLUDED_SKUS.has(sku))return;
    if(selSku.size>0&&!selSku.has(sku))return;
    (D.order_rows[sku]||[]).forEach(function(row){
      var dateM=(row[16]||row[2]).slice(0,7);
      if(dateM<r2.df||dateM>r2.dt)return;
      if(row[4]==="Entry Error"||row[4]==="Pend"||row[4]==="No Pmt")return;
      if(fAct&&row[3]!==fAct)return;
      if(selPcat.size>0&&!selPcat.has(row[7]))return;
      if(selP.size>0&&!selP.has(row[8]))return;
      if(row[4]==="Cancelled"&&((row[12]===undefined)||row[12]<0)){
        naList.push({sku:sku,row:row});
      }
    });
  });
  if(naList.length===0){panel.innerHTML='<div style="padding:12px;color:#64748b;font-size:12px">No N/A orders found.</div>';panel.style.display="";return;}
  var h='<div class="card" style="border-color:#fcd34d">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    +'<div><div class="ct" style="color:#92400e">Cancelled — No Refund Date ('+naList.length+')</div>'
    +'<div class="cs">These orders are cancelled but have no refund/credit date in Snowflake. Excluded from Days to Cancel chart and window counts.</div></div>'
    +'<button onclick="downloadNaCsv()" style="font-size:11px;padding:4px 10px;border:1px solid #f59e0b;border-radius:6px;background:#fef3c7;color:#92400e;cursor:pointer">⬇ Export CSV</button>'
    +'</div>'
    +'<div class="tbl-wrap"><table><thead><tr>'
    +'<th style="text-align:left">Order ID</th>'
    +'<th style="text-align:left">Contact ID</th>'
    +'<th style="text-align:center">Date</th>'
    +'<th style="text-align:left">SKU</th>'
    +'<th style="text-align:left">Product</th>'
    +'<th style="text-align:center">Invoice Total</th>'
    +'<th style="text-align:center">Refunds</th>'
    +'<th style="text-align:center">LDP</th>'
    +'<th style="text-align:left">Partner Category</th>'
    +'<th style="text-align:left">Partner</th>'
    +'</tr></thead><tbody>';
  naList.forEach(function(item){
    var row=item.row,sku=item.sku;
    var isLdp=isLdpRow(row);
    h+='<tr>'
      +'<td style="font-family:monospace;font-size:10px;color:#0ea5e9">'+(row[0]||"")+'</td>'
      +'<td style="font-family:monospace;font-size:10px;color:#64748b">'+(row[1]||"")+'</td>'
      +'<td style="text-align:center">'+(row[2]||"")+'</td>'
      +'<td style="font-weight:500">'+(sku||"")+'</td>'
      +'<td style="color:#64748b;font-size:11px">'+(row[9]||"")+'</td>'
      +'<td style="text-align:center">$'+((row[5]||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0}))+'</td>'
      +'<td style="text-align:center;color:#64748b">$'+((row[6]||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0}))+'</td>'
      +'<td style="text-align:center"><span style="padding:1px 6px;border-radius:10px;font-size:10px;background:'+(isLdp?"#dbeafe":"#f1f5f9")+';color:'+(isLdp?"#1d4ed8":"#64748b")+'">'+(isLdp?"Yes":"No")+'</span></td>'
      +'<td>'+(row[7]||"")+'</td>'
      +'<td style="color:#64748b">'+(row[8]||"")+'</td>'
      +'</tr>';
  });
  h+='</tbody></table></div></div>';
  panel.innerHTML=h;
  panel.style.display="";
  if(btn)btn.textContent="Hide orders ▼";
}

function downloadNaCsv(){
  var r2=getRange();
  var fAct=document.getElementById("fAct").value;
  var naList=[];
  Object.keys(D.order_rows||{}).forEach(function(sku){
    if(EXCLUDED_SKUS.has(sku))return;
    if(selSku.size>0&&!selSku.has(sku))return;
    (D.order_rows[sku]||[]).forEach(function(row){
      var dateM=row[2].slice(0,7);
      if(dateM<r2.df||dateM>r2.dt)return;
      if(row[4]==="Entry Error"||row[4]==="Pend"||row[4]==="No Pmt")return;
      if(fAct&&row[3]!==fAct)return;
      if(selPcat.size>0&&!selPcat.has(row[7]))return;
      if(selP.size>0&&!selP.has(row[8]))return;
      if(row[4]==="Cancelled"&&((row[12]===undefined)||row[12]<0))naList.push({sku:sku,row:row});
    });
  });
  var csvRows=[["Order ID","Contact ID","Date","SKU","Product","Invoice Total","Refunds","LDP","Partner Category","Partner"]];
  naList.forEach(function(item){
    var row=item.row,sku=item.sku;
    csvRows.push([row[0]||"",row[1]||"",row[2]||"",sku,row[9]||"",row[5]||0,row[6]||0,(isLdpRow(row)?"Yes":"No"),row[7]||"",row[8]||""]);
  });
  var csv=csvRows.map(function(r){return r.map(function(v){var s=String(v==null?"":v);return s.indexOf(",")>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;}).join(",");}).join("\n");
  var blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download="cancelled_no_refund_date_"+r2.df+"_"+r2.dt+".csv";a.click();
}

function downloadCohortCsv(){
  var win=cohortWindow;
  var cutoffMs=getRangeEndMs();
  var winLabel=win<0?"AllTime":win+"d";
  var r2=getRange();
  var allRows=getCohortRows();
  var cutoffStr=cutoffMs?"by "+formatCutoffDate(cutoffMs):"All time";
  var csvRows=[["SKU","Order ID","Contact ID","Heaven Date","Purchase Date","Active Status","Cancel Status","Invoice Total","Net Invoice","Refunds","Days to Cancel","LDP","Cancelled ("+cutoffStr+")","Partner Category","Partner","Product"]];
  allRows.forEach(function(item){
    var sku=item.sku,row=item.row;
    var inWin=isInCohortWindow(row,win,cutoffMs);
    var rdD=(row[12]!==undefined)?row[12]:-1;
    var isLdp=isLdpRow(row);
    csvRows.push([
      sku,row[0]||"",row[1]||"",row[16]||"",row[2]||"",row[3]||"",row[4]||"",
      row[5]||0,row[17]||0,row[6]||0,rdD>=0?rdD:"N/A",
      isLdp?"Yes":"No",inWin?"Yes":"No",
      row[7]||"",row[8]||"",row[9]||""
    ]);
  });
  var csv=csvRows.map(function(r){return r.map(function(v){
    var s=String(v==null?"":v);
    return s.indexOf(",")>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;
  }).join(",");}).join("\n");
  var blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="cohort_cancel_"+r2.df+"_"+r2.dt+"_"+winLabel+".csv";
  a.click();
}

// ── Cohort Panel (separate tab) ───────────────────────────
function renderCohortYearTrend(){
  if(charts.cohortYearTrend){charts.cohortYearTrend.destroy();charts.cohortYearTrend=null;}
  var canvas=document.getElementById("cohortYearTrendChart");
  if(!canvas||!D)return;
  var fDivV=typeof fDiv!=="undefined"?fDiv:"";
  var yearMonths={};
  Object.keys(D.order_rows||{}).forEach(function(sku){
    if(EXCLUDED_SKUS.has(sku))return;
    if(selSku.size>0&&!selSku.has(sku))return;
    (D.order_rows[sku]||[]).forEach(function(row){
      var st=row[4];
      if(st==="Entry Error"||st==="Pend"||st==="No Pmt")return;
      if(selPcat.size>0&&!selPcat.has(row[7]))return;
      if(selP.size>0&&!selP.has(row[8]))return;
      if(fDivV&&row[15]!==fDivV)return;
      var d=row[2];if(!d||d.length<7)return;
      var yr=d.slice(0,4),mo=parseInt(d.slice(5,7),10)-1;
      if(!yearMonths[yr])yearMonths[yr]={};
      if(!yearMonths[yr][mo])yearMonths[yr][mo]={total:0,cancelled:0};
      yearMonths[yr][mo].total++;
      if(st==="Cancelled")yearMonths[yr][mo].cancelled++;
    });
  });
  var years=Object.keys(yearMonths).sort();
  var moLabels=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var palette={"2022":"#94a3b8","2023":"#3b82f6","2024":"#f59e0b","2025":"#10b981","2026":"#ef4444","2027":"#a855f7"};
  var fallback=["#64748b","#3b82f6","#f59e0b","#10b981","#ef4444","#a855f7"];
  var datasets=years.map(function(yr,i){
    var color=palette[yr]||fallback[i%fallback.length];
    var data=moLabels.map(function(_,mi){
      var m=yearMonths[yr][mi];
      return(m&&m.total>0)?parseFloat((m.cancelled/m.total*100).toFixed(2)):null;
    });
    return{label:yr,data:data,borderColor:color,backgroundColor:"transparent",fill:false,
      tension:0.35,pointRadius:3,pointBackgroundColor:color,borderWidth:2.5,spanGaps:false};
  });
  charts.cohortYearTrend=new Chart(canvas,{type:"line",data:{labels:moLabels,datasets:datasets},options:{
    responsive:true,maintainAspectRatio:false,
    interaction:{mode:"index",intersect:false},
    plugins:{
      legend:{display:true,position:"top",labels:{font:{size:11},color:"#475569",boxWidth:14,padding:14}},
      tooltip:{callbacks:{label:function(ctx){return" "+ctx.dataset.label+": "+(ctx.parsed.y!=null?ctx.parsed.y.toFixed(1)+"% cancel rate":"—");}}}
    },
    scales:{
      x:{ticks:{color:"#64748b",font:{size:11}},grid:{display:false}},
      y:{beginAtZero:true,ticks:{color:"#64748b",font:{size:10},callback:function(v){return v+"%";}},grid:{color:"#f1f5f9"}}
    }
  }});
}

function renderCohortPanel(){
  renderCohortYearTrend();
  renderCohort();
}

function initDashboard(){
  document.getElementById("dt").value=todayStr();
  document.getElementById("mainContent").innerHTML='<div class="main"><div class="kpi-row" id="kpiRow"></div><div class="card full"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px"><div><div class="ct">Cancel % rate by month</div><div class="cs" style="margin-bottom:0">Stacked by status with cancel rate line</div></div><div class="legend" style="margin-bottom:0"><div class="li"><div class="ld" style="background:#f85149"></div>Cancelled</div><div class="li"><div class="ld" style="background:#e3b341"></div>Entry Error</div><div class="li"><div class="ld" style="background:#3fb950"></div>Upgrade</div><div class="li"><div class="ld" style="background:#bc8cff"></div>Downgrade</div><div class="li"><div class="ld" style="background:#0d9488"></div>Switch</div><div class="li"><div class="ld" style="background:#fbbf24"></div>Pend</div><div class="li"><div class="ld" style="background:#64748b"></div>No Pmt</div><div class="li"><div class="ld" style="background:#388bfd;width:18px;height:2px;border-radius:0"></div>Cancel %</div></div></div><div style="height:260px;position:relative"><canvas id="trendChart"></canvas></div></div><div class="grid2"><div class="card"><div class="ct">Cancel % by SKU</div><div class="cs">Top 15</div><div id="skuBarWrap" style="height:320px;position:relative"><canvas id="skuBarChart"></canvas></div></div><div class="card"><div class="ct">Volume by SKU</div><div class="cs">Cancelled - Entry Error - Upgrade - Downgrade</div><div id="skuGrpWrap" style="height:320px;position:relative"><canvas id="skuGrpChart"></canvas></div></div></div><div class="grid2"><div class="card"><div class="ct">By partner category</div><div class="cs">Share of cancellations</div><div style="height:200px;position:relative"><canvas id="pcatChart"></canvas></div></div><div class="card"><div class="ct">Cancel Window</div><div class="cs">Refund timing &amp; cancel rate by window — all cancelled orders including N/A (no refund date on record)</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px"><div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Days to Refund — count</div><div style="height:180px;position:relative"><canvas id="rdChart"></canvas></div></div><div><div style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Cancel Rate % by Window</div><div style="height:180px;position:relative"><canvas id="rdRateChart"></canvas></div></div></div></div></div><div class="card full"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><div class="ct">SKU summary</div><div style="font-size:11px;color:#8b949e" id="tblInfo"></div></div><div class="tbl-wrap"><table><thead><tr><th>SKU</th><th>Net Units</th><th>Active</th><th>Inactive</th><th>Sale</th><th>Cancelled</th><th>Entry Error</th><th>Upgrade</th><th>Downgrade</th><th>Switch</th><th>Pend</th><th>No Pmt</th><th>Refund Days</th><th>Cancel %</th><th>Lost Revenue</th></tr></thead><tbody id="skuTbody"></tbody><tfoot><tr class="tfoot" id="skuTfoot"></tr></tfoot></table></div></div><div class="card full"><div class="ct">FY Cancel Rate by Quarter</div><div class="cs">Cancellations ÷ (Total − Entry Errors) · Calendar year · Q1=Jan–Mar, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Oct–Dec</div><div style="height:300px;position:relative"><canvas id="qfyChart"></canvas></div></div><div id="refundSkuSection"></div></div>';
  renderMsItems();renderMsSkuItems();render();
}

fetch("data.json?v=1780000017").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(function(data){D=data;buildExcludedAndMappings();initDashboard();}).catch(function(err){document.getElementById("mainContent").innerHTML='<div class="loading"><div style="color:#f85149">Failed to load data.json: '+err.message+"</div></div>";});
