// ── AR v2 — ANALYTICS.MART.DIM_AR_ALL_INVOICES ─────────────────────────────
if(typeof EXCLUDED_SKUS==="undefined")var EXCLUDED_SKUS=new Set([]);
var AR2 = null;
var ar2SelSku = new Set();
var ar2Charts = {};
var ar2KpiRows = [];

// ── Filter readers ────────────────────────────────────────────────────────────
function ar2Pcat()   { return document.getElementById("ar2-pcat").value; }
function ar2Div()    { return document.getElementById("ar2-div").value; }
function ar2Status() { return document.getElementById("ar2-status").value; }
function ar2Bucket() { return document.getElementById("ar2-bucket").value; }
function ar2Pdi()    { return document.getElementById("ar2-pdi").value; }
function ar2Range()  { return {df: document.getElementById("ar2-df").value.slice(0,10),
                                dt: document.getElementById("ar2-dt").value.slice(0,10)}; }

function ar2Apply()  { ar2Render(); }
function ar2Reset()  {
  document.getElementById("ar2-df").value     = "2022-01-01";
  document.getElementById("ar2-dt").value     = new Date().toISOString().slice(0,10);
  document.getElementById("ar2-pcat").value   = "";
  document.getElementById("ar2-div").value    = "";
  document.getElementById("ar2-status").value = "";
  document.getElementById("ar2-bucket").value = "";
  document.getElementById("ar2-pdi").value    = "";
  ar2SelSku.clear(); ar2UpdateSkuBtn();
  ar2Render();
}

// ── SKU multi-select ──────────────────────────────────────────────────────────
function ar2RenderSkuMenu(){
  if(!AR2||!AR2.FL)return;
  var menu=document.getElementById("ar2-sku-menu");if(!menu)return;
  var html="<div style='padding:7px 10px;border-bottom:1px solid #dde3ea;display:flex;gap:8px'>"+
    "<button onclick='ar2SkuAll()' style='font-size:11px;padding:2px 8px;border:1px solid #dde3ea;border-radius:4px;background:#fff;cursor:pointer'>All</button>"+
    "<button onclick='ar2SkuClear()' style='font-size:11px;padding:2px 8px;border:1px solid #dde3ea;border-radius:4px;background:#fff;cursor:pointer'>Clear</button></div>";
  AR2.FL.skus.filter(function(s){return!EXCLUDED_SKUS.has(s);}).forEach(function(s){
    var ck=ar2SelSku.has(s)?"checked":"";
    html+="<div class='ms-item' style='padding:6px 12px;font-size:12px;cursor:pointer;color:#1a2332' onclick='ar2ToggleSku(event,\""+s.replace(/"/g,"&quot;")+"\")'>"+
      "<input type='checkbox' "+ck+" onclick='return false' style='margin-right:6px;accent-color:#0d9488'>"+s+"</div>";
  });
  var exclSkus=AR2.FL.skus.filter(function(s){return EXCLUDED_SKUS.has(s);});
  if(exclSkus.length>0){
    html+="<div style='padding:5px 10px 3px;font-size:10px;color:#94a3b8;background:#f8fafc;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:.5px;margin-top:2px'>⚠ Excluded by default</div>";
    exclSkus.forEach(function(s){
      var ck=ar2SelSku.has(s)?"checked":"";
      html+="<div class='ms-item' style='padding:6px 12px;font-size:12px;cursor:pointer;color:#94a3b8;opacity:0.65' onclick='ar2ToggleSku(event,\""+s.replace(/"/g,"&quot;")+"\")'>"+
        "<input type='checkbox' "+ck+" onclick='return false' style='margin-right:6px;accent-color:#0d9488'>"+s+"</div>";
    });
  }
  menu.innerHTML=html;
}
function ar2ToggleSku(ev,sku){
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  ar2SelSku.has(sku)?ar2SelSku.delete(sku):ar2SelSku.add(sku);
  ar2UpdateSkuBtn();
  ar2RenderSkuMenu();
}
function ar2UpdateSkuBtn(){
  var btn = document.getElementById("ar2-sku-btn");
  btn.textContent = ar2SelSku.size > 0
    ? ar2SelSku.size + " SKU" + (ar2SelSku.size>1?"s":"") + " ▾"
    : "All SKUs ▾";
  btn.style.borderColor = ar2SelSku.size > 0 ? "#0d9488" : "#dde3ea";
}
function ar2SkuAll()  { ar2SelSku.clear(); ar2UpdateSkuBtn(); ar2RenderSkuMenu(); ar2Render(); }
function ar2SkuClear(){ ar2SelSku.clear(); ar2UpdateSkuBtn(); ar2RenderSkuMenu(); }
function ar2ToggleSkuMenu(){
  var m = document.getElementById("ar2-sku-menu");
  m.style.display = m.style.display === "block" ? "none" : "block";
}

// ── Filtered data ─────────────────────────────────────────────────────────────
function ar2GetFiltered(){
  var r = ar2Range(), pcat = ar2Pcat(), div_ = ar2Div(),
      status = ar2Status(), bucket = ar2Bucket(), pdi = ar2Pdi();
  return AR2.rows.filter(function(row){
    if(row.date && (row.date < r.df || row.date > r.dt)) return false;
    if(EXCLUDED_SKUS.has(row.sku)) return false;
    if(ar2SelSku.size > 0 && !ar2SelSku.has(row.sku)) return false;
    if(pcat   && row.pcat   !== pcat)   return false;
    if(div_   && row.div    !== div_)   return false;
    if(status && row.status !== status) return false;
    if(bucket && row.bucket !== bucket) return false;
    if(pdi === "yes" && !row.pdi)       return false;
    return true;
  });
}

// ── Formatters ────────────────────────────────────────────────────────────────
function ar2D(n){ return "$" + Math.round(n||0).toLocaleString(); }
function ar2Pct(n){ return (n||0).toFixed(1) + "%"; }

// ── Destroy all charts ────────────────────────────────────────────────────────
function ar2DestroyCharts(){
  Object.values(ar2Charts).forEach(function(c){ try{c.destroy();}catch(e){} });
  ar2Charts = {};
}

// ── Render ────────────────────────────────────────────────────────────────────
function ar2Render(){
  if(!AR2) return;
  ar2DestroyCharts();
  var rows = ar2GetFiltered();

  // ── KPIs ────────────────────────────────────────────────────────────────────
  var total_orders = rows.length;
  var total_inv    = rows.reduce(function(s,r){return s+r.inv;},0);
  var total_paid   = rows.reduce(function(s,r){return s+r.paid;},0);
  var total_bal    = rows.reduce(function(s,r){return s+r.bal;},0);
  var total_arr    = rows.reduce(function(s,r){return s+r.arr;},0);
  var total_cur    = rows.reduce(function(s,r){return s+r.cur;},0);
  var pdi_count    = rows.filter(function(r){return r.pdi;}).length;
  var collect_pct  = total_inv > 0 ? total_paid/total_inv*100 : 0;
  var arr_pct      = total_bal > 0 ? total_arr/total_bal*100  : 0;
  var active_ct    = rows.filter(function(r){return r.status==="Active";}).length;
  var cncl_bal     = rows.filter(function(r){return r.status==="Cancelled";}).reduce(function(s,r){return s+r.bal;},0);

  document.getElementById("ar2-rc-lbl").textContent = total_orders.toLocaleString() + " orders";

  document.getElementById("ar2-kpis").innerHTML =
    kpi2Card("k1","Total Orders",        total_orders.toLocaleString(), "invoices with balance")+
    kpi2Card("k9","Total Gross",          ar2D(total_inv),  "invoice value","font-size:18px")+
    kpi2Card("k6","Total Collected",      ar2D(total_paid), ar2Pct(collect_pct)+" collected","font-size:18px;color:#16a34a")+
    kpi2Card("k5","Balance Remaining",    ar2D(total_bal),  "source of truth","font-size:18px;color:#f59e0b")+
    kpi2Card("k4","Total Arrears",        ar2D(total_arr),  ar2Pct(arr_pct)+" of balance","font-size:18px;color:#ef4444")+
    kpi2Card("k7","Current (Not Overdue)",ar2D(total_cur),  "not yet past due","font-size:18px;color:#7c3aed")+
    kpi2Card("k3","Cancelled Balance",    ar2D(cncl_bal),   "on cancelled orders","font-size:18px;color:#ef4444")+
    kpi2Card("k8","Past Due Issues",      pdi_count.toLocaleString(), "flagged accounts");

  // Comparison banner
  ar2RenderComparison(total_bal);

  // Charts
  ar2RenderTrendChart();
  ar2RenderQfyChart();
  ar2RenderAgingChart(rows);
  ar2RenderArrearsDonut(rows);
  ar2RenderDivChart(rows);
  ar2RenderPcatChart(rows);
  ar2RenderAttemptsChart(rows);

  // Tables
  ar2RenderSkuTable(rows);
  ar2RenderDetailTable(rows);

  document.getElementById("ar2-loading").style.display = "none";
  document.getElementById("ar2-main").style.display    = "block";
}

function kpi2Card(cls, label, value, sub, vStyle){
  vStyle = vStyle || "";
  return '<div class="kpi '+cls+'">' +
    '<div class="kl">'+label+'</div>' +
    '<div class="kv" style="'+vStyle+'">'+value+'</div>' +
    '<div class="ks muted">'+sub+'</div></div>';
}

// ── Comparison banner ─────────────────────────────────────────────────────────
function ar2RenderComparison(v2Bal){
  var el = document.getElementById("ar2-compare-banner");
  if(!el) return;
  // V1 balance from already-loaded AR (v1) if available
  var v1Bal = (typeof AR !== "undefined" && AR && AR.summary) ? AR.summary.total_bal : null;
  if(v1Bal === null){
    el.style.display = "none"; return;
  }
  var diff = v2Bal - v1Bal;
  var diffColor = Math.abs(diff) < 5000 ? "#16a34a" : (diff > 0 ? "#f59e0b" : "#2563eb");
  var diffLabel = diff > 0 ? "V2 is +" : "V2 is ";
  el.style.display = "flex";
  el.innerHTML =
    '<span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-right:16px">V1 vs V2 Comparison</span>'+
    '<span style="margin-right:20px">V1 Balance (derived): <b>'+ar2D(v1Bal)+'</b></span>'+
    '<span style="margin-right:20px">V2 Balance (source of truth): <b style="color:#0d9488">'+ar2D(v2Bal)+'</b></span>'+
    '<span style="color:'+diffColor+'"><b>'+diffLabel+ar2D(Math.abs(diff))+'</b> difference</span>';
}

// ── AR Overdue Trend v2 — true arrears % from billing system history ──────────
function ar2RenderTrendChart(){
  if(ar2Charts.trend){ try{ar2Charts.trend.destroy();}catch(e){} }
  var noDataEl = document.getElementById("ar2-trend-nodata");
  var canvas   = document.getElementById("ar2-trend-chart");
  var trendWrap = document.getElementById("ar2-trend-table-wrap");

  var trendData = AR2 && AR2.trend_v2 && AR2.trend_v2.length ? AR2.trend_v2 : null;

  if(!trendData){
    if(noDataEl){ noDataEl.style.display="block";
      noDataEl.textContent="Run Run.bat to generate the AR Overdue Trend from Snowflake order & payment data."; }
    if(canvas) canvas.style.display="none";
    if(trendWrap) trendWrap.style.display="none";
    return;
  }
  if(noDataEl) noDataEl.style.display="none";
  if(canvas)   canvas.style.display="block";

  var r        = ar2Range();
  var filtered = trendData.filter(function(pt){ return pt.d >= r.df && pt.d <= r.dt; });
  if(!filtered.length){ if(trendWrap) trendWrap.style.display="none"; return; }

  var labels = filtered.map(function(pt){ return pt.d; });
  var pcts   = filtered.map(function(pt){ return pt.pct; });
  var avgs   = filtered.map(function(pt){ return pt.avg52 != null ? pt.avg52 : null; });

  var ctx = canvas.getContext("2d");
  ar2Charts.trend = new Chart(ctx, {
    type:"line",
    data:{labels:labels, datasets:[
      {label:"% AR Overdue (billing system)", data:pcts,
       borderColor:"#0d9488", backgroundColor:"rgba(13,148,136,0.08)",
       fill:true, pointRadius:0, borderWidth:1.5, tension:0.3},
      {label:"52-wk Running Avg", data:avgs,
       borderColor:"#ea4335", backgroundColor:"transparent",
       fill:false, pointRadius:0, borderWidth:2.5, tension:0.5}
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:"index", intersect:false},
      plugins:{
        legend:{display:true, position:"top",
          labels:{color:"#64748b", font:{size:11}, boxWidth:12, padding:12}},
        tooltip:{callbacks:{
          title:function(items){ return "Week ending " + items[0].label; },
          label:function(c){ return c.dataset.label+": "+(c.raw!=null?c.raw.toFixed(2)+"%":"N/A"); }
        }}
      },
      scales:{
        x:{ticks:{color:"#64748b", font:{size:10}, maxTicksLimit:24, maxRotation:45,
            callback:function(val,idx){
              var d=labels[idx];
              return d ? new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"}) : "";
            }},
           grid:{color:"#f1f5f9"}},
        y:{title:{display:true, text:"% Of AR Overdue", color:"#64748b", font:{size:11}},
           beginAtZero:true,
           ticks:{color:"#64748b", font:{size:10},
             callback:function(v){ return v.toFixed(1)+"%"; }},
           grid:{color:"#f1f5f9"}}
      }
    }
  });

  // Render the expandable data table below
  ar2RenderTrendTable(filtered);
  if(trendWrap) trendWrap.style.display="block";
}

// ── AR Overdue Trend — expandable data table ──────────────────────────────────
function ar2RenderTrendTable(data){
  var wrap = document.getElementById("ar2-trend-table-wrap");
  if(!wrap) return;
  var fmt$ = function(v){ return v ? "$"+Math.round(v).toLocaleString() : "—"; };
  var fmtP = function(v){ return v != null ? v.toFixed(2)+"%" : "—"; };
  var fmtD = function(s){ var p=s.split('-'); return p.length===3 ? (p[1].replace(/^0/,'')+'/'+p[2].replace(/^0/,'')+'/'+p[0]) : s; };

  var rows = data.slice().reverse(); // newest first

  // ── Current in-progress week row (gray) — only if not already in completed data ──
  var cwRow = "";
  var cw = AR2 && AR2.current_week;
  if(cw && cw.week_fri){
    var alreadyCompleted = rows.some(function(r){ return r.d === cw.week_fri; });
    if(!alreadyCompleted){
      var cwFri = fmtD(cw.week_fri);
      var cwThrough = fmtD(cw.data_through);
      var gs = "color:#94a3b8;font-style:italic;";
      var badge = "<span style='font-size:10px;background:#f1f5f9;color:#64748b;padding:1px 5px;border-radius:3px;border:1px solid #e2e8f0'>⏳ thru "+cwThrough+"</span>";
      var mo = parseInt((cw.week_fri||"").split("-")[1]||"1");
      var cwCells = [
        "<td style='white-space:nowrap;"+gs+"'>" + cwFri + " " + badge + "</td>",
        "<td style='text-align:right;"+gs+"'>" + (cw.live_tb ? fmt$(cw.live_tb)+" <span style='font-size:9px;color:#94a3b8'>live</span>" : "—") + "</td>",
        "<td style='text-align:right;"+gs+"'>" + (cw.live_ob ? fmt$(cw.live_ob) : "—") + "</td>",
        "<td style='text-align:right;font-weight:600;color:#94a3b8;font-style:italic'>" + (cw.live_pct != null ? cw.live_pct.toFixed(2)+"%" : "—") + "</td>",
        "<td style='text-align:right;"+gs+"'>—</td>",
        "<td style='text-align:right;"+gs+"'>—</td>",
        "<td style='text-align:right;"+gs+"'>" + fmt$(cw.sold) + "</td>",
        "<td style='text-align:right;"+gs+"'>" + fmt$(cw.pmts) + "</td>",
        "<td style='text-align:right;"+gs+"'>" + fmt$(cw.cncl) + "</td>",
        "<td style='text-align:right;"+gs+"'>" + fmt$(cw.disc) + "</td>",
        "<td style='text-align:center;"+gs+"'>Q" + Math.ceil(mo/3) + "</td>",
        "<td style='text-align:center;"+gs+"'>FY'" + String(cw.y||"").toString().slice(-2) + "</td>",
      ].join("");
      cwRow = "<tr style='background:#f8fafc;border-bottom:1px dashed #cbd5e1'>" + cwCells + "</tr>";
    }
  }

  var fmtChg = function(v){
    if(v == null) return "—";
    var s = "$"+Math.abs(Math.round(v)).toLocaleString();
    return v < 0 ? "<span style='color:#16a34a'>▼ "+s+"</span>" : v > 0 ? "<span style='color:#dc2626'>▲ "+s+"</span>" : s;
  };
  var tbody = rows.map(function(pt){
    return "<tr>" +
      "<td style='white-space:nowrap'>" + fmtD(pt.d) + "</td>" +
      "<td style='text-align:right'>" + fmt$(pt.tb) + "</td>" +
      "<td style='text-align:right'>" + fmt$(pt.ob) + "</td>" +
      "<td style='text-align:right;font-weight:600;color:#0d9488'>" + fmtP(pt.pct) + "</td>" +
      "<td style='text-align:right;color:#ea4335'>" + fmtP(pt.avg52) + "</td>" +
      "<td style='text-align:right;color:#6366f1'>" + fmtChg(pt.chg) + "</td>" +
      "<td style='text-align:right;color:#0369a1'>" + fmt$(pt.sold) + "</td>" +
      "<td style='text-align:right;color:#16a34a'>" + fmt$(pt.pmts) + "</td>" +
      "<td style='text-align:right;color:#dc2626'>" + fmt$(pt.cncl) + "</td>" +
      "<td style='text-align:right;color:#b45309'>" + fmt$(pt.disc) + "</td>" +
      "<td style='text-align:center'>" + (pt.q || "") + "</td>" +
      "<td style='text-align:center'>" + (pt.y ? "FY'" + String(pt.y).slice(-2) : "") + "</td>" +
    "</tr>";
  }).join("");

  ar2KpiRows = rows;
  var kpiWrap = document.getElementById("ar2-weekly-kpi-wrap");
  if(kpiWrap){ kpiWrap.style.display = "block"; kpiWrap.innerHTML = ar2BuildKpiHtml(rows, 0); }
  var th = function(label, align){ return "<th style='text-align:"+(align||"right")+";padding:6px 8px;border-bottom:1px solid #dde3ea;font-weight:600;color:#0d9488;white-space:nowrap'>"+label+"</th>"; };
  wrap.innerHTML =
    "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:8px'>" +
      "<span style='font-size:12px;font-weight:600;color:#0d9488;cursor:pointer' onclick='ar2ToggleTrendTable(this)'>▼ Weekly Data Table (" + rows.length + " weeks)</span>" +
      "<button onclick='ar2DownloadTrendCsv()' style='font-size:11px;padding:4px 10px;border:1px solid #0d9488;border-radius:4px;background:#fff;color:#0d9488;cursor:pointer'>⬇ Download CSV</button>" +
    "</div>" +
    "<div id='ar2-trend-tbl-body' style='overflow-x:auto'>" +
      "<table style='width:100%;border-collapse:collapse;font-size:12px;min-width:900px'>" +
        "<thead><tr style='background:#f1faf9;position:sticky;top:0'>" +
          th("Week (Friday)","left") +
          th("Total AR Balance") +
          th("Overdue Balance") +
          th("% Overdue") +
          th("52-wk Avg") +
          th("Overdue Chg") +
          th("Orders Sold") +
          th("Pmts Received") +
          th("Cancellations") +
          th("Discounts / Adj") +
          th("Quarter","center") +
          th("Fiscal Year","center") +
        "</tr></thead>" +
        "<tbody>" + cwRow + tbody + "</tbody>" +
      "</table>" +
    "</div>";
}

function ar2ToggleTrendTable(btn){
  var body = document.getElementById("ar2-trend-tbl-body");
  if(!body) return;
  if(body.style.display === "none"){
    body.style.display = "block";
    btn.textContent = btn.textContent.replace("▶","▼");
  } else {
    body.style.display = "none";
    btn.textContent = btn.textContent.replace("▼","▶");
  }
}

function ar2SelectKpiWeek(idx){
  var kpiWrap = document.getElementById("ar2-weekly-kpi-wrap");
  if(!kpiWrap || !ar2KpiRows.length) return;
  kpiWrap.innerHTML = ar2BuildKpiHtml(ar2KpiRows, parseInt(idx));
}

function ar2BuildKpiHtml(rows, idx){
  if(!rows || rows.length < 2) return "";
  idx = idx || 0;
  var cur  = rows[idx];
  var prev = rows[idx + 1] || {};
  var fmtD = function(s){ var p=(s||"").split("-"); return p.length===3 ? p[1].replace(/^0/,"")+"/"+p[2].replace(/^0/,"")+"/"+p[0] : (s||""); };
  var fmt$ = function(v){ return "$"+Math.round(Math.abs(v||0)).toLocaleString(); };
  var startBal = prev.tb || 0;
  var sold = cur.sold || 0;
  var pmts = cur.pmts || 0;
  var cncl = cur.cncl || 0;
  var disc = cur.disc || 0;
  var hasFlow = sold>0 || pmts>0 || cncl>0 || disc>0;
  var calcAr  = hasFlow ? startBal + sold - pmts - cncl - disc : 0;
  var actualAr = cur.tb || 0;
  var variance = hasFlow ? Math.abs(calcAr - actualAr) : 0;
  var varPct   = (hasFlow && calcAr>0) ? variance/calcAr*100 : 0;
  var current  = (cur.tb||0) - (cur.ob||0);
  var arrears  = cur.ob || 0;
  var wow      = (cur.tb||0) - (prev.tb||0);
  var weekLbl  = fmtD(cur.d);
  var prevLbl  = fmtD(prev.d);
  var noData   = "<div style='font-size:8px;color:#94a3b8;margin-top:2px'>run Run.bat</div>";
  var pickerOpts = rows.map(function(pt,i){ return "<option value='"+i+"'"+(i===idx?" selected":"")+">"+fmtD(pt.d)+"</option>"; }).join("");
  var fc = function(lbl,val,color,leftCol,note){
    return "<div style='background:#fff;border:0.5px solid #e2e8f0;border-radius:6px;padding:5px 7px;"+(leftCol?"border-left:2px solid "+leftCol+";":"")+"'>" +
      "<div style='font-size:9px;color:#64748b;margin-bottom:2px;line-height:1.2'>"+lbl+"</div>" +
      "<div style='font-size:12px;font-weight:500;color:"+color+";line-height:1'>"+val+"</div>"+(note||"")+"</div>";
  };
  var sc = function(lbl,val,color,sub,hl){
    return "<div style='background:"+(hl?"#fff;border:0.5px solid "+hl:"#f8fafc;border:0.5px solid #e2e8f0")+";border-radius:6px;padding:5px 7px'>" +
      "<div style='font-size:9px;color:#64748b;margin-bottom:2px'>"+lbl+"</div>" +
      "<div style='font-size:12px;font-weight:500;color:"+color+"'>"+val+"</div>"+(sub?"<div style='font-size:8px;color:#94a3b8;margin-top:1px'>"+sub+"</div>":"")+"</div>";
  };
  var wowColor = wow<=0 ? "#16a34a" : "#dc2626";
  var varColor = varPct < 2 ? "#b45309" : "#dc2626";
  return "<div style='display:flex;align-items:center;gap:8px;margin-bottom:6px'>" +
      "<span style='font-size:10px;font-weight:500;color:#64748b;text-transform:uppercase;letter-spacing:.4px'>Weekly reconciliation</span>" +
      "<span style='background:#e0f2fe;color:#0369a1;font-size:10px;padding:1px 6px;border-radius:3px'>Week ending "+weekLbl+"</span>" +
      "<select onchange='ar2SelectKpiWeek(this.value)' style='margin-left:auto;font-size:10px;padding:2px 5px;border:0.5px solid #e2e8f0;border-radius:4px;background:#f8fafc;color:#475569;cursor:pointer'>"+pickerOpts+"</select>" +
    "</div>" +
    "<div style='display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;margin-bottom:5px'>" +
      fc("AR start ("+prevLbl+")", fmt$(startBal), "#0369a1", "#0369a1") +
      fc("+ Orders sold", hasFlow ? "+"+fmt$(sold) : "—", "#16a34a", null, hasFlow?null:noData) +
      fc("− Payments",     hasFlow ? "−"+fmt$(pmts) : "—", "#dc2626", null, hasFlow?null:noData) +
      fc("− Cancellations",hasFlow ? "−"+fmt$(cncl) : "—", "#dc2626", null, hasFlow?null:noData) +
      fc("− Discounts / Adj",hasFlow ? "−"+fmt$(disc) : "—", "#dc2626", null, hasFlow?null:noData) +
      fc("= Calc AR", hasFlow ? fmt$(calcAr) : "—", "#0d9488", "#0d9488") +
    "</div>" +
    "<div style='display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin-bottom:8px'>" +
      sc("Actual AR ("+weekLbl+")", fmt$(actualAr), "#1a2332", "DIM_AR_ALL_INVOICES", "#0d9488") +
      sc("Variance", hasFlow ? fmt$(variance)+" · "+varPct.toFixed(2)+"%" : "—", varColor, "calc vs actual", "#f59e0b") +
      sc("Current (not overdue)", fmt$(current), "#16a34a", (actualAr>0?(current/actualAr*100).toFixed(1)+"% of balance":"")) +
      sc("Total arrears", fmt$(arrears), "#dc2626", cur.pct ? cur.pct.toFixed(2)+"% overdue" : "") +
      sc("Week-over-week", (wow<=0?"▼ ":"▲ ")+fmt$(wow), wowColor, "vs "+prevLbl) +
    "</div>";
}

function ar2DownloadTrendCsv(){
  if(!AR2 || !AR2.trend_v2 || !AR2.trend_v2.length) return;
  var header = ["Week (Friday)","Total AR Balance","Overdue Balance","% Of AR Overdue","52-wk Running Avg","Overdue Balance Chg","Orders Sold","Payments Received","Cancellations","Discounts / Adjustments","Quarter","Fiscal Year"];
  var lines  = [header.join(",")];
  AR2.trend_v2.forEach(function(pt){
    lines.push([
      pt.d,
      pt.tb != null ? pt.tb.toFixed(2) : "",
      pt.ob != null ? pt.ob.toFixed(2) : "",
      pt.pct != null ? pt.pct.toFixed(2) : "",
      pt.avg52 != null ? pt.avg52.toFixed(2) : "",
      pt.chg != null ? pt.chg.toFixed(2) : "",
      pt.sold != null ? pt.sold.toFixed(2) : "",
      pt.pmts != null ? pt.pmts.toFixed(2) : "",
      pt.cncl != null ? pt.cncl.toFixed(2) : "",
      pt.disc != null ? pt.disc.toFixed(2) : "",
      pt.q || "",
      pt.y ? "FY'" + String(pt.y).slice(-2) : ""
    ].join(","));
  });
  var blob = new Blob([lines.join("\n")], {type:"text/csv"});
  var a    = document.createElement("a");
  a.href   = URL.createObjectURL(blob);
  a.download = "AR_Overdue_Trend_v2.csv";
  a.click();
}

// ── FY Cancel Rate by Quarter (reuses AR v1 QFY/GMSKU/PCM/PCMSKU data) ───────
function ar2RenderQfyChart(){
  if(ar2Charts.qfy){try{ar2Charts.qfy.destroy();}catch(e){}}

  if(typeof AR === "undefined" || !AR || !AR.QFY){
    document.getElementById("ar2-qfy-wrap").style.display="none"; return;
  }
  document.getElementById("ar2-qfy-wrap").style.display="block";

  var skus = ar2SelSku.size > 0 ? Array.from(ar2SelSku) : null;
  var pcat = ar2Pcat();
  var QFY;

  if(!skus && !pcat){
    QFY = AR.QFY || {};
  } else {
    var monthMap = {};
    if(skus && pcat){
      var pcatMths = (AR.PCMSKU || {})[pcat] || {};
      Object.keys(pcatMths).forEach(function(m){
        skus.forEach(function(s){
          var b=(pcatMths[m]||{})[s]; if(!b)return;
          if(!monthMap[m])monthMap[m]=[0,0,0,0,0,0,0,0.0];
          for(var i=0;i<8;i++)monthMap[m][i]+=(b[i]||0);
        });
      });
    } else if(skus){
      var gmsku = AR.GMSKU || {};
      Object.keys(gmsku).forEach(function(m){
        skus.forEach(function(s){
          var b=(gmsku[m]||{})[s]; if(!b)return;
          if(!monthMap[m])monthMap[m]=[0,0,0,0,0,0,0,0.0];
          for(var i=0;i<8;i++)monthMap[m][i]+=(b[i]||0);
        });
      });
    } else {
      monthMap = (AR.PCM || {})[pcat] || {};
    }
    // aggregate into QFY
    QFY = {};
    Object.keys(monthMap).forEach(function(m){
      if(!m||m.length<7)return;
      var yr=parseInt(m.slice(0,4)),mo=parseInt(m.slice(5,7));
      var fy="FY'"+String(yr).slice(2), q="Q"+(Math.floor((mo-1)/3)+1);
      if(!QFY[fy])QFY[fy]={};
      if(!QFY[fy][q])QFY[fy][q]=[0,0,0,0,0,0,0,0.0];
      var b=monthMap[m];
      for(var i=0;i<8;i++)QFY[fy][q][i]+=(b[i]||0);
    });
  }

  var fys = Object.keys(QFY).filter(function(fy){return Object.keys(QFY[fy]).length>0;}).sort();
  if(!fys.length){document.getElementById("ar2-qfy-wrap").style.display="none"; return;}
  var quarters  = ["Q1","Q2","Q3","Q4"];
  var FY_COLORS = ["#4285f4","#ea4335","#fbbc04","#34a853","#a142f4","#00acc1","#ff6d00"];
  var ds = fys.map(function(fy,i){
    return{
      label:fy,
      data:quarters.map(function(q){
        var b=(QFY[fy]||{})[q]; if(!b)return null;
        var denom=b[0]-b[2]-(b[9]||0)-(b[10]||0); return denom>0?parseFloat((b[1]/denom*100).toFixed(1)):0;
      }),
      backgroundColor:FY_COLORS[i%FY_COLORS.length],
      borderRadius:4, borderSkipped:false
    };
  });
  var ctx = document.getElementById("ar2-qfy-chart").getContext("2d");
  var filterNote = (skus||pcat) ? " · "+(skus?skus.join(", ")+" ":"")+(pcat?"("+pcat+")":"") : "";
  ar2Charts.qfy = new Chart(ctx, {
    type:"bar",
    data:{labels:["Cancel Rate Q1","Cancel Rate Q2","Cancel Rate Q3","Cancel Rate Q4"], datasets:ds},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:"top", labels:{color:"#64748b", font:{size:11}, boxWidth:12, padding:12}},
        title:{display:!!(skus||pcat), text:"Filtered: "+filterNote.slice(3), color:"#64748b", font:{size:11}},
        tooltip:{callbacks:{label:function(c){return c.dataset.label+": "+(c.raw!=null?c.raw.toFixed(1)+"%":"N/A");}}}
      },
      scales:{
        x:{ticks:{color:"#64748b", font:{size:11}}, grid:{display:false}},
        y:{beginAtZero:true,
           ticks:{color:"#64748b", font:{size:10}, callback:function(v){return v+"%";}},
           grid:{color:"#f1f5f9"}}
      }
    }
  });
}

// ── Aging chart (pre-calculated $ buckets from Snowflake) ────────────────────
function ar2RenderAgingChart(rows){
  var buckets = ["Current","0-30d","31-60d","61-90d","91-180d","180d+","Cancelled"];
  var colors  = ["#16a34a","#84cc16","#f59e0b","#f97316","#ef4444","#dc2626","#6b7280"];
  // Use pre-calculated bucket columns for the "real" aging
  var curBal  = rows.reduce(function(s,r){return s+r.cur;},0);
  var b0      = rows.reduce(function(s,r){return s+r.b0;},0);
  var b31     = rows.reduce(function(s,r){return s+r.b31;},0);
  var b61     = rows.reduce(function(s,r){return s+r.b61;},0);
  // 91-180d and 180d+ approximated from b90 split by DAYSDELAY
  var b91_180 = rows.reduce(function(s,r){return s+(r.dd>90&&r.dd<=180?r.b90:0);},0);
  var b180p   = rows.reduce(function(s,r){return s+(r.dd>180?r.b90:0);},0);
  // For orders where b90 exists but no dd info, put in 91-180d
  var b90_unclassified = rows.reduce(function(s,r){return s+(r.b90>0&&r.dd<=90?r.b90:0);},0);
  b91_180 += b90_unclassified;
  var cnclBal = rows.filter(function(r){return r.status==="Cancelled";}).reduce(function(s,r){return s+r.bal;},0);
  var vals = [curBal, b0, b31, b61, b91_180, b180p, cnclBal];
  var counts = {};
  buckets.forEach(function(b){counts[b]=0;});
  rows.forEach(function(r){ if(counts[r.bucket]!==undefined) counts[r.bucket]++; });

  var ctx = document.getElementById("ar2-aging-chart").getContext("2d");
  ar2Charts.aging = new Chart(ctx, {
    type:"bar",
    data:{labels:buckets, datasets:[{label:"Balance ($)", data:vals.map(Math.round), backgroundColor:colors, borderRadius:6}]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:function(c){
          var b=buckets[c.dataIndex];
          return " "+ar2D(c.raw)+" ("+counts[b]+" orders)";
        }}}
      },
      scales:{
        y:{ticks:{callback:function(v){return "$"+Math.round(v/1000)+"K";}}, grid:{color:"#f1f5f9"}},
        x:{grid:{display:false}}
      }
    }
  });
}

// ── Arrears vs Current donut ──────────────────────────────────────────────────
function ar2RenderArrearsDonut(rows){
  var arrears = rows.reduce(function(s,r){return s+r.arr;},0);
  var current = rows.reduce(function(s,r){return s+r.cur;},0);
  var cnclBal = rows.filter(function(r){return r.status==="Cancelled";}).reduce(function(s,r){return s+r.bal;},0);
  if(arrears + current + cnclBal < 1) return;
  var ctx = document.getElementById("ar2-donut-chart").getContext("2d");
  ar2Charts.donut = new Chart(ctx, {
    type:"doughnut",
    data:{
      labels:["Arrears (Past Due)","Current (Not Overdue)","Cancelled Balance"],
      datasets:[{
        data:[Math.round(arrears), Math.round(current), Math.round(cnclBal)],
        backgroundColor:["#ef4444","#16a34a","#6b7280"],
        borderWidth:0, hoverOffset:4
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:"62%",
      plugins:{
        legend:{position:"bottom", labels:{color:"#64748b", font:{size:11}, boxWidth:10, padding:8}},
        tooltip:{callbacks:{label:function(c){return " "+ar2D(c.raw)+" ("+c.parsed.toFixed(1)+"%)"; }}}
      }
    }
  });
}

// ── Balance by Division ───────────────────────────────────────────────────────
function ar2RenderDivChart(rows){
  var map = {};
  rows.forEach(function(r){ map[r.div]=(map[r.div]||0)+r.bal; });
  var sorted = Object.entries(map).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
  if(!sorted.length) return;
  var ctx = document.getElementById("ar2-div-chart").getContext("2d");
  ar2Charts.div = new Chart(ctx, {
    type:"bar",
    data:{labels:sorted.map(function(x){return x[0];}),
          datasets:[{data:sorted.map(function(x){return Math.round(x[1]);}),
                     backgroundColor:"#0d9488", borderRadius:4}]},
    options:{
      indexAxis:"y", responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){return " "+ar2D(c.raw);}}}},
      scales:{x:{ticks:{callback:function(v){return "$"+Math.round(v/1000)+"K";}}, grid:{color:"#f1f5f9"}},
              y:{ticks:{color:"#334155",font:{size:10}}, grid:{display:false}}}
    }
  });
}

// ── Balance by Partner Category ───────────────────────────────────────────────
function ar2RenderPcatChart(rows){
  var map = {};
  rows.forEach(function(r){ map[r.pcat]=(map[r.pcat]||0)+r.bal; });
  var sorted = Object.entries(map).sort(function(a,b){return b[1]-a[1];});
  if(!sorted.length) return;
  var ctx = document.getElementById("ar2-pcat-chart").getContext("2d");
  ar2Charts.pcat = new Chart(ctx, {
    type:"doughnut",
    data:{labels:sorted.map(function(x){return x[0];}),
          datasets:[{data:sorted.map(function(x){return Math.round(x[1]);}),
                     backgroundColor:["#4285f4","#ea4335","#fbbc04","#34a853","#a142f4","#00acc1"],
                     borderWidth:0, hoverOffset:4}]},
    options:{
      responsive:true, maintainAspectRatio:false, cutout:"55%",
      plugins:{
        legend:{position:"right", labels:{color:"#64748b", font:{size:11}, boxWidth:10, padding:6}},
        tooltip:{callbacks:{label:function(c){return " "+ar2D(c.raw);}}}
      }
    }
  });
}

// ── Collection Attempts chart ─────────────────────────────────────────────────
function ar2RenderAttemptsChart(rows){
  var none=0, att1=0, att2=0, att3=0;
  rows.forEach(function(r){
    if(r.a3)      att3++;
    else if(r.a2) att2++;
    else if(r.a1) att1++;
    else          none++;
  });
  if(att1+att2+att3 < 1){ document.getElementById("ar2-attempts-wrap").style.display="none"; return; }
  document.getElementById("ar2-attempts-wrap").style.display="block";
  var ctx = document.getElementById("ar2-attempts-chart").getContext("2d");
  ar2Charts.attempts = new Chart(ctx, {
    type:"bar",
    data:{
      labels:["No Attempt","1st Attempt","2nd Attempt","3rd Attempt"],
      datasets:[{data:[none,att1,att2,att3],
                 backgroundColor:["#cbd5e1","#fbbf24","#f97316","#ef4444"],
                 borderRadius:6}]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(c){return " "+c.raw.toLocaleString()+" accounts";}}}},
      scales:{y:{ticks:{stepSize:1}, grid:{color:"#f1f5f9"}}, x:{grid:{display:false}}}
    }
  });
}

// ── SKU Summary Table ─────────────────────────────────────────────────────────
function ar2RenderSkuTable(rows){
  var map = {};
  rows.forEach(function(r){
    if(!map[r.sku]) map[r.sku]={sku:r.sku, n:0, inv:0, paid:0, bal:0, arr:0, cur:0, active:0, cancelled:0, dd_sum:0, dd_n:0};
    var s=map[r.sku];
    s.n++; s.inv+=r.inv; s.paid+=r.paid; s.bal+=r.bal; s.arr+=r.arr; s.cur+=r.cur;
    if(r.status==="Active") s.active++; else s.cancelled++;
    if(r.dd>0){s.dd_sum+=r.dd; s.dd_n++;}
  });
  var sorted = Object.values(map).sort(function(a,b){return b.bal-a.bal;});
  var maxBal = sorted.length ? sorted[0].bal : 1;
  var html = "<table style='width:100%;border-collapse:collapse;font-size:12px'>"+
    "<thead><tr style='background:#f0fdfa;border-bottom:2px solid #99f6e4'>"+
    ["Program","Orders","Gross","Paid","Balance","Arrears","Current","Collected %","Avg Days Delay","Active","Cancelled"].map(function(h){
      return "<th style='padding:9px 10px;text-align:"+(["Orders","Gross","Paid","Balance","Arrears","Current","Collected %","Avg Days Delay","Active","Cancelled"].includes(h)?"right":"left")+";color:#0f766e;font-weight:600;font-size:10px;text-transform:uppercase;white-space:nowrap'>"+h+"</th>";
    }).join("")+
    "</tr></thead><tbody>";
  sorted.forEach(function(s,i){
    var pct = s.inv > 0 ? s.paid/s.inv*100 : 0;
    var arrPct = s.bal > 0 ? s.arr/s.bal*100 : 0;
    var avgDd = s.dd_n > 0 ? Math.round(s.dd_sum/s.dd_n) : 0;
    var bg = i%2===0?"#ffffff":"#f0fdfa";
    html += "<tr style='border-bottom:1px solid #f1f5f9;background:"+bg+"'>"+
      "<td style='padding:9px 10px;font-weight:600;color:#0d9488'>"+s.sku+"</td>"+
      "<td style='padding:9px 10px;text-align:right'>"+s.n+"</td>"+
      "<td style='padding:9px 10px;text-align:right'>"+ar2D(s.inv)+"</td>"+
      "<td style='padding:9px 10px;text-align:right;color:#16a34a'>"+ar2D(s.paid)+"</td>"+
      "<td style='padding:9px 10px;text-align:right;font-weight:600;color:#f59e0b'>"+ar2D(s.bal)+
        "<div style='background:#fef3c7;border-radius:2px;height:3px;margin-top:3px'>"+
        "<div style='background:#f59e0b;border-radius:2px;height:3px;width:"+(maxBal>0?s.bal/maxBal*100:0).toFixed(0)+"%'></div></div></td>"+
      "<td style='padding:9px 10px;text-align:right;color:#ef4444'>"+ar2D(s.arr)+
        "<div style='font-size:10px;color:#94a3b8'>"+arrPct.toFixed(0)+"% of bal</div></td>"+
      "<td style='padding:9px 10px;text-align:right;color:#16a34a'>"+ar2D(s.cur)+"</td>"+
      "<td style='padding:9px 10px;text-align:right'><span style='color:"+(pct>=70?"#16a34a":pct>=40?"#f59e0b":"#ef4444")+"'>"+ar2Pct(pct)+"</span></td>"+
      "<td style='padding:9px 10px;text-align:right;color:"+(avgDd>90?"#ef4444":avgDd>30?"#f59e0b":"#64748b")+"'>"+
        (avgDd>0?avgDd+"d":"—")+"</td>"+
      "<td style='padding:9px 10px;text-align:right;color:#7c3aed'>"+s.active+"</td>"+
      "<td style='padding:9px 10px;text-align:right;color:#ef4444'>"+s.cancelled+"</td>"+
      "</tr>";
  });
  html += "</tbody></table>";
  document.getElementById("ar2-sku-table").innerHTML = html;
}

// ── Detail Table ──────────────────────────────────────────────────────────────
function ar2RenderDetailTable(rows){
  var sorted = rows.slice().sort(function(a,b){return b.bal-a.bal;});
  var shown  = sorted.slice(0, 250);
  var bucketColors = {
    "Current":"#16a34a","0-30d":"#84cc16","31-60d":"#f59e0b",
    "61-90d":"#f97316","91-180d":"#ef4444","180d+":"#dc2626","Cancelled":"#6b7280"
  };
  var headers = ["Order ID","Name","Program","Date","Div","Partner Cat",
                 "Gross","Paid","Balance","Arrears","Current","Collected %",
                 "Days Delay","Aging","Status","CRS","PDI","Last Pmt","Next Sched","Attempts"];
  var rightAlign = ["Gross","Paid","Balance","Arrears","Current","Collected %","Days Delay"];

  var html = "<table style='width:100%;border-collapse:collapse;font-size:11px'>"+
    "<thead><tr style='background:#f0fdfa;border-bottom:2px solid #99f6e4'>"+
    headers.map(function(h){
      return "<th style='padding:7px 9px;text-align:"+(rightAlign.includes(h)?"right":"left")+";color:#0f766e;font-weight:600;font-size:10px;text-transform:uppercase;white-space:nowrap'>"+h+"</th>";
    }).join("")+
    "</tr></thead><tbody>";

  shown.forEach(function(r,i){
    var bg  = i%2===0?"#ffffff":"#f0fdfa88";
    var sc  = r.status==="Active"?"#16a34a":"#ef4444";
    var bc  = bucketColors[r.bucket]||"#64748b";
    var dc  = r.dd>90?"#ef4444":r.dd>30?"#f59e0b":"#64748b";
    var crs = r.crs ? '<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:8px;font-size:9px">'+r.crs+'</span>' : '—';
    var pdi = r.pdi ? '<span style="background:#fee2e2;color:#ef4444;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:600">⚠</span>' : '—';
    var atts = [r.a1?'1st':'', r.a2?'2nd':'', r.a3?'3rd':''].filter(Boolean);
    var attStr = atts.length ? '<span style="color:#f97316;font-weight:600">'+atts.join('→')+'</span>' : '—';
    html += "<tr style='border-bottom:1px solid #f1f5f9;background:"+bg+"'>"+
      "<td style='padding:6px 9px;color:#0d9488;font-weight:500;white-space:nowrap'>"+r.oid+"</td>"+
      "<td style='padding:6px 9px;color:#1a2332;white-space:nowrap'>"+r.name+"</td>"+
      "<td style='padding:6px 9px;font-weight:600;color:#1a2332'>"+r.sku+"</td>"+
      "<td style='padding:6px 9px;color:#64748b;white-space:nowrap'>"+r.date+"</td>"+
      "<td style='padding:6px 9px;color:#64748b'>"+r.div+"</td>"+
      "<td style='padding:6px 9px;color:#64748b;font-size:10px'>"+r.pcat+"</td>"+
      "<td style='padding:6px 9px;text-align:right'>"+ar2D(r.inv)+"</td>"+
      "<td style='padding:6px 9px;text-align:right;color:#16a34a'>"+ar2D(r.paid)+"</td>"+
      "<td style='padding:6px 9px;text-align:right;font-weight:600;color:#f59e0b'>"+ar2D(r.bal)+"</td>"+
      "<td style='padding:6px 9px;text-align:right;color:#ef4444'>"+ar2D(r.arr)+"</td>"+
      "<td style='padding:6px 9px;text-align:right;color:#16a34a'>"+ar2D(r.cur)+"</td>"+
      "<td style='padding:6px 9px;text-align:right'><span style='color:"+(r.cpct>=70?"#16a34a":r.cpct>=40?"#f59e0b":"#ef4444")+"'>"+ar2Pct(r.cpct)+"</span></td>"+
      "<td style='padding:6px 9px;text-align:right;color:"+dc+"'>"+(r.dd>0?r.dd+"d":"—")+"</td>"+
      "<td style='padding:6px 9px;white-space:nowrap'><span style='background:"+bc+"22;color:"+bc+";padding:2px 6px;border-radius:8px;font-size:9px;font-weight:600'>"+r.bucket+"</span></td>"+
      "<td style='padding:6px 9px'><span style='color:"+sc+";font-weight:600;font-size:10px'>"+r.status+"</span></td>"+
      "<td style='padding:6px 9px'>"+crs+"</td>"+
      "<td style='padding:6px 9px;text-align:center'>"+pdi+"</td>"+
      "<td style='padding:6px 9px;color:#64748b;white-space:nowrap;font-size:10px'>"+r.lpd+"</td>"+
      "<td style='padding:6px 9px;color:#64748b;white-space:nowrap;font-size:10px'>"+r.lspd+"</td>"+
      "<td style='padding:6px 9px'>"+attStr+"</td>"+
      "</tr>";
  });
  html += "</tbody></table>";
  if(sorted.length > 250){
    html += "<div style='padding:10px 12px;color:#64748b;font-size:11px'>Showing top 250 of "+
             sorted.length+" records — download CSV for full list</div>";
  }
  document.getElementById("ar2-detail-table").innerHTML = html;
  document.getElementById("ar2-detail-lbl").textContent = shown.length+" of "+sorted.length+" orders";
}

// ── CSV Download ──────────────────────────────────────────────────────────────
function ar2DownloadCsv(){
  var rows = ar2GetFiltered();
  var headers = ["Order ID","Name","Program","Date","Division","Partner Category","Partner",
                 "Gross","Paid","Balance","Arrears","Current","B0-30","B31-60","B61-90","B90+",
                 "Collected %","Days Delay","Aging Bucket","Status","CRS Status","Past Due Issue",
                 "Last Pmt Date","Last Pmt Amt","Last Pmt Type","Last Sched Pmt",
                 "1st Attempt","1st Att Date","2nd Attempt","2nd Att Date","3rd Attempt","3rd Att Date"];
  function esc(v){var s=String(v==null?"":v);return s.includes(",")||s.includes('"')?'"'+s.replace(/"/g,'""')+'"':s;}
  var lines = [headers.join(",")];
  rows.forEach(function(r){
    lines.push([
      r.oid,r.name,r.sku,r.date,r.div,r.pcat,r.part,
      r.inv.toFixed(2),r.paid.toFixed(2),r.bal.toFixed(2),r.arr.toFixed(2),r.cur.toFixed(2),
      r.b0.toFixed(2),r.b31.toFixed(2),r.b61.toFixed(2),r.b90.toFixed(2),
      r.cpct.toFixed(1),r.dd,r.bucket,r.status,r.crs,r.pdi?"Yes":"No",
      r.lpd,r.lpa.toFixed(2),r.lpt,r.lspd,
      r.a1,r.a1d,r.a2,r.a2d,r.a3,r.a3d
    ].map(esc).join(","));
  });
  var blob = new Blob([lines.join("\n")],{type:"text/csv"});
  var a = document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download = "AR_v2_"+new Date().toISOString().slice(0,10)+".csv"; a.click();
}

// ── Populate filter dropdowns ─────────────────────────────────────────────────
function ar2RenderFilters(){
  if(!AR2 || !AR2.FL) return;

  // SKU multi-select menu
  ar2RenderSkuMenu();

  // Partner Category
  var pc = document.getElementById("ar2-pcat");
  AR2.FL.pcats.forEach(function(p){ pc.innerHTML += "<option value='"+p+"'>"+p+"</option>"; });

  // Division
  var dv = document.getElementById("ar2-div");
  AR2.FL.divs.forEach(function(d){ dv.innerHTML += "<option value='"+d+"'>"+d+"</option>"; });
}

// ── Load data ─────────────────────────────────────────────────────────────────
// Load ar2_data.json (invoice snapshot) + ar2_trend.json (weekly history) in parallel.
// ar2_trend.json is always authoritative for trend_v2 — it updates on every Run.bat
// independently of the full data rebuild.
Promise.all([
  fetch("ar2_data.json").then(function(r){ return r.json(); }),
  fetch("ar2_trend.json?v=" + Date.now()).then(function(r){ return r.json(); }).catch(function(){ return null; })
]).then(function(results){
  AR2 = results[0];
  if(results[1] && results[1].length) AR2.trend_v2 = results[1];
  ar2RenderFilters();
  if(document.getElementById("ar2-panel").style.display !== "none") ar2Render();
}).catch(function(err){
  document.getElementById("ar2-loading").innerHTML =
    '<div style="color:#ef4444;padding:20px">Failed to load ar2_data.json — run Run.bat to generate: '+err+'</div>';
});

document.addEventListener("click", function(e){
  var menu = document.getElementById("ar2-sku-menu");
  var btn  = document.getElementById("ar2-sku-btn");
  if(menu && btn && !menu.contains(e.target) && !btn.contains(e.target)){
    menu.style.display = "none";
  }
});
