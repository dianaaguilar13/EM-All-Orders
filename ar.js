// ── AR (Arrears) Dashboard ─────────────────────────────────────────────────
var AR = null;
var arSelSku  = new Set();
var arSelPcat = "";
var arSelEm   = "";
var arSelStatus = "";
var arSelBucket = "";

function arPcat(){ return document.getElementById("ar-pcat").value; }
function arActFilter(){ return document.getElementById("ar-status").value; }
function arBucketFilter(){ return document.getElementById("ar-bucket").value; }
function arRange(){ return {df: document.getElementById("ar-df").value.slice(0,10), dt: document.getElementById("ar-dt").value.slice(0,10)}; }

function arApply(){ arRender(); }
function arReset(){
  document.getElementById("ar-df").value = "2022-01-01";
  document.getElementById("ar-dt").value = new Date().toISOString().slice(0,10);
  document.getElementById("ar-pcat").value = "";
  document.getElementById("ar-status").value = "";
  document.getElementById("ar-bucket").value = "";
  arSelSku.clear(); arUpdateSkuBtn();
  arRender();
}

function arToggleSku(sku){ if(arSelSku.has(sku)){arSelSku.delete(sku);}else{arSelSku.add(sku);} arUpdateSkuBtn(); }
function arUpdateSkuBtn(){
  var btn = document.getElementById("ar-sku-btn");
  btn.textContent = arSelSku.size > 0 ? arSelSku.size + " SKU" + (arSelSku.size>1?"s":"") + " ▾" : "All SKUs ▾";
  btn.style.borderColor = arSelSku.size > 0 ? "#2563eb" : "#dde3ea";
}
function arSkuAll(){ arSelSku.clear(); arUpdateSkuBtn(); arRender(); }
function arSkuClear(){ arSelSku.clear(); arUpdateSkuBtn(); }
function arToggleSkuMenu(){
  var m = document.getElementById("ar-sku-menu");
  m.style.display = m.style.display === "block" ? "none" : "block";
}

function arGetFiltered(){
  var r = arRange(), pcat = arPcat(), status = arActFilter(), bucket = arBucketFilter();
  return AR.rows.filter(function(row){
    if(row.date < r.df || row.date > r.dt) return false;
    if(arSelSku.size > 0 && !arSelSku.has(row.sku)) return false;
    if(pcat && row.pcat !== pcat) return false;
    if(status && row.status !== status) return false;
    if(bucket && row.bucket !== bucket) return false;
    return true;
  });
}

function fmtDollar(n){ return "$" + Math.round(n).toLocaleString(); }
function fmtPct(n){ return n.toFixed(1) + "%"; }

function arRender(){
  if(!AR) return;
  var rows = arGetFiltered();

  // KPIs
  var total_orders = rows.length;
  var total_inv    = rows.reduce(function(s,r){return s+r.inv;},0);
  var total_paid   = rows.reduce(function(s,r){return s+r.paid;},0);
  var total_bal    = rows.reduce(function(s,r){return s+r.bal;},0);
  var active       = rows.filter(function(r){return r.status==="Active";});
  var cancelled    = rows.filter(function(r){return r.status==="Cancelled";});
  var cncl_bal     = cancelled.reduce(function(s,r){return s+r.bal;},0);
  var collect_pct  = total_inv > 0 ? total_paid/total_inv*100 : 0;

  document.getElementById("ar-rc-lbl").textContent = total_orders.toLocaleString() + " orders";

  document.getElementById("ar-kpis").innerHTML =
    '<div class="kpi k1"><div class="kl">Total Orders</div><div class="kv">'+total_orders.toLocaleString()+'</div><div class="ks muted">with balance</div></div>'+
    '<div class="kpi k9"><div class="kl">Total Gross</div><div class="kv" style="font-size:20px">'+fmtDollar(total_inv)+'</div><div class="ks muted">invoice value</div></div>'+
    '<div class="kpi k6"><div class="kl">Total Collected</div><div class="kv" style="color:#16a34a;font-size:20px">'+fmtDollar(total_paid)+'</div><div class="ks green">'+fmtPct(collect_pct)+' collected</div></div>'+
    '<div class="kpi k5"><div class="kl">Balance Remaining</div><div class="kv" style="color:#f59e0b;font-size:20px">'+fmtDollar(total_bal)+'</div><div class="ks muted">total owed</div></div>'+
    '<div class="kpi k4"><div class="kl">Cancelled Balance</div><div class="kv" style="color:#ef4444;font-size:20px">'+fmtDollar(cncl_bal)+'</div><div class="ks red">'+cancelled.length+' cancelled orders</div></div>'+
    '<div class="kpi k7"><div class="kl">Active PP</div><div class="kv" style="color:#7c3aed">'+active.length.toLocaleString()+'</div><div class="ks muted">'+fmtDollar(active.reduce(function(s,r){return s+r.bal;},0))+' owed</div></div>';

  // AR Overdue Trend chart
  arRenderTrendChart();

  // FY Quarterly Cancel Rate chart
  arRenderQfyChart();

  // Aging chart
  arRenderAgingChart(rows);

  // SKU table
  arRenderSkuTable(rows);

  // Detail table
  arRenderDetailTable(rows);

  document.getElementById("ar-loading").style.display = "none";
  document.getElementById("ar-main").style.display = "block";
}

var arChart = null;
var arTrendChart = null;
var arQfyChart = null;

function arBuildQfyFromMonths(monthMap){
  var out={};
  Object.keys(monthMap).forEach(function(m){
    if(!m||m.length<7) return;
    var yr=parseInt(m.slice(0,4)),mo=parseInt(m.slice(5,7));
    var fy="FY'"+String(yr).slice(2), q="Q"+(Math.floor((mo-1)/3)+1);
    if(!out[fy])out[fy]={};
    if(!out[fy][q])out[fy][q]=[0,0,0,0,0,0,0,0.0];
    var b=monthMap[m];
    for(var i=0;i<8;i++)out[fy][q][i]+=(b[i]||0);
  });
  return out;
}

function arRenderQfyChart(){
  if(arQfyChart){try{arQfyChart.destroy();}catch(e){}}
  var skus=arSelSku.size>0?Array.from(arSelSku):null;
  var pcat=arPcat();
  var QFY;

  if(!skus&&!pcat){
    QFY=AR.QFY||{};
  } else {
    var monthMap={};
    if(skus&&pcat){
      var pcatMths=(AR.PCMSKU||{})[pcat]||{};
      Object.keys(pcatMths).forEach(function(m){
        skus.forEach(function(s){
          var b=(pcatMths[m]||{})[s]; if(!b)return;
          if(!monthMap[m])monthMap[m]=[0,0,0,0,0,0,0,0.0];
          for(var i=0;i<8;i++)monthMap[m][i]+=(b[i]||0);
        });
      });
    } else if(skus){
      var gmsku=AR.GMSKU||{};
      Object.keys(gmsku).forEach(function(m){
        skus.forEach(function(s){
          var b=(gmsku[m]||{})[s]; if(!b)return;
          if(!monthMap[m])monthMap[m]=[0,0,0,0,0,0,0,0.0];
          for(var i=0;i<8;i++)monthMap[m][i]+=(b[i]||0);
        });
      });
    } else {
      monthMap=(AR.PCM||{})[pcat]||{};
    }
    QFY=arBuildQfyFromMonths(monthMap);
  }

  var fys=Object.keys(QFY).filter(function(fy){return Object.keys(QFY[fy]).length>0;}).sort();
  if(!fys.length) return;
  var quarters=["Q1","Q2","Q3","Q4"];
  var FY_COLORS=["#4285f4","#ea4335","#fbbc04","#34a853","#a142f4","#00acc1","#ff6d00"];
  var ds=fys.map(function(fy,i){
    return{
      label:fy,
      data:quarters.map(function(q){
        var b=(QFY[fy]||{})[q]; if(!b)return null;
        var denom=b[0]-b[2];
        return denom>0?parseFloat((b[1]/denom*100).toFixed(1)):0;
      }),
      backgroundColor:FY_COLORS[i%FY_COLORS.length],
      borderRadius:4,borderSkipped:false
    };
  });
  var ctx=document.getElementById("ar-qfy-chart").getContext("2d");
  var filterNote=skus||pcat?" · "+(skus?skus.join(", ")+" ":"")+(pcat?"("+pcat+")":""):"";
  arQfyChart=new Chart(ctx,{
    type:"bar",
    data:{labels:["Cancel Rate Q1","Cancel Rate Q2","Cancel Rate Q3","Cancel Rate Q4"],datasets:ds},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{position:"top",labels:{color:"#64748b",font:{size:11},boxWidth:12,padding:12}},
        title:{display:!!(skus||pcat),text:"Filtered: "+filterNote.slice(3),color:"#64748b",font:{size:11}},
        tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+": "+(ctx.raw!=null?ctx.raw.toFixed(1)+"%":"N/A");}}}
      },
      scales:{
        x:{ticks:{color:"#64748b",font:{size:11}},grid:{display:false}},
        y:{beginAtZero:true,ticks:{color:"#64748b",font:{size:10},callback:function(v){return v+"%";}},grid:{color:"#f1f5f9"}}
      }
    }
  });
}

function arRenderTrendChart(){
  var skus=arSelSku.size>0?Array.from(arSelSku):null;
  var pcat=arPcat();

  // Pick the right trend dataset based on filters
  var trendData=null;
  var trendLabel="%AR Overdue";
  var trendNote="";

  if(pcat&&AR.trend_by_pcat&&AR.trend_by_pcat[pcat]){
    trendData=AR.trend_by_pcat[pcat];
    trendLabel="%AR Overdue ("+pcat+")";
  } else if(pcat&&(!AR.trend_by_pcat||!AR.trend_by_pcat[pcat])){
    // Pcat requested but no per-pcat data yet
    trendNote="Pcat-filtered trend will be available after next Run.bat";
    trendData=AR.trend||[];
  } else {
    trendData=AR.trend||[];
  }
  if(skus&&!pcat) trendNote="SKU filter does not affect trend — showing all SKUs";

  if(!(trendData&&trendData.length)){
    document.getElementById("ar-trend-chart").style.display="none";
    var noDataEl=document.getElementById("ar-trend-nodata");
    if(noDataEl){noDataEl.style.display="block";noDataEl.textContent=trendNote||"Run Run.bat to generate the AR overdue trend from Snowflake payment history.";}
    return;
  }
  var noDataEl=document.getElementById("ar-trend-nodata");
  if(noDataEl)noDataEl.style.display="none";
  document.getElementById("ar-trend-chart").style.display="block";
  var r=arRange();
  var filtered=trendData.filter(function(pt){return pt[0]>=r.df&&pt[0]<=r.dt;});
  if(!filtered.length) return;
  var labels=filtered.map(function(pt){return pt[0];});
  var pcts=filtered.map(function(pt){return pt[1];});
  var avgs=filtered.map(function(pt){return pt.length>2?pt[2]:null;});
  var ctx=document.getElementById("ar-trend-chart").getContext("2d");
  if(arTrendChart){arTrendChart.destroy();}
  arTrendChart=new Chart(ctx,{
    type:"line",
    data:{labels:labels,datasets:[
      {label:trendLabel,data:pcts,borderColor:"#4285f4",backgroundColor:"rgba(66,133,244,0.07)",
       fill:true,pointRadius:0,borderWidth:1.5,tension:0.3},
      {label:"Running Average",data:avgs,borderColor:"#ea4335",backgroundColor:"transparent",
       fill:false,pointRadius:0,borderWidth:2.5,tension:0.5}
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:"index",intersect:false},
      plugins:{
        legend:{display:true,position:"top",labels:{color:"#64748b",font:{size:11},boxWidth:12,padding:12}},
        tooltip:{callbacks:{
          title:function(items){return items[0].label;},
          label:function(ctx){return ctx.dataset.label+": "+(ctx.raw!=null?ctx.raw.toFixed(2)+"%":"N/A");}
        }}
      },
      scales:{
        x:{
          ticks:{color:"#64748b",font:{size:10},maxTicksLimit:20,maxRotation:45,
            callback:function(val,idx){var d=labels[idx];return d?new Date(d).toLocaleDateString("en-US",{month:"short",year:"2-digit"}):""}},
          grid:{color:"#f1f5f9"}
        },
        y:{
          title:{display:true,text:"% Of AR",color:"#64748b",font:{size:11}},
          beginAtZero:true,
          ticks:{color:"#64748b",font:{size:10},callback:function(v){return v.toFixed(1)+"%";}},
          grid:{color:"#f1f5f9"}
        }
      }
    }
  });
}

function arRenderAgingChart(rows){
  var buckets = ['0-30d','31-60d','61-90d','91-180d','180d+','Cancelled'];
  var labels  = ['0-30 days','31-60 days','61-90 days','91-180 days','180+ days','Cancelled'];
  var colors  = ['#16a34a','#84cc16','#f59e0b','#f97316','#ef4444','#6b7280'];
  var counts  = {}, bals = {};
  buckets.forEach(function(b){counts[b]=0; bals[b]=0;});
  rows.forEach(function(r){
    if(counts[r.bucket]!==undefined){ counts[r.bucket]++; bals[r.bucket]+=r.bal; }
  });

  var ctx = document.getElementById("ar-aging-chart").getContext("2d");
  if(arChart){ arChart.destroy(); }
  arChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Balance ($)",
        data: buckets.map(function(b){return Math.round(bals[b]);}),
        backgroundColor: colors,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {display:false},
        tooltip: {
          callbacks: {
            label: function(ctx){
              var b = buckets[ctx.dataIndex];
              return " $"+Math.round(ctx.raw).toLocaleString()+" ("+counts[b]+" orders)";
            }
          }
        }
      },
      scales: {
        y: { ticks: { callback: function(v){ return "$"+Math.round(v/1000)+"K"; }}, grid: {color:"#f1f5f9"} },
        x: { grid: {display:false} }
      }
    }
  });
}

function arRenderSkuTable(rows){
  var skuMap = {};
  rows.forEach(function(r){
    if(!skuMap[r.sku]) skuMap[r.sku] = {sku:r.sku, cat:r.sku_cat, count:0, inv:0, paid:0, bal:0, active:0, cancelled:0};
    var s = skuMap[r.sku];
    s.count++; s.inv+=r.inv; s.paid+=r.paid; s.bal+=r.bal;
    if(r.status==="Active") s.active++; else s.cancelled++;
  });

  var sorted = Object.values(skuMap).sort(function(a,b){return b.bal-a.bal;});
  var maxBal = sorted.length ? sorted[0].bal : 1;

  var html = "<table style='width:100%;border-collapse:collapse;font-size:13px'>"+
    "<thead><tr style='background:#f8fafc;border-bottom:2px solid #dde3ea'>"+
    "<th style='padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase'>SKU</th>"+
    "<th style='padding:10px 12px;text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase'>Category</th>"+
    "<th style='padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase'>Orders</th>"+
    "<th style='padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase'>Gross</th>"+
    "<th style='padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase'>Collected</th>"+
    "<th style='padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase'>Balance</th>"+
    "<th style='padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase'>Collected %</th>"+
    "<th style='padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase'>Active</th>"+
    "<th style='padding:10px 12px;text-align:right;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase'>Cancelled</th>"+
    "</tr></thead><tbody>";

  sorted.forEach(function(s, i){
    var pct = s.inv > 0 ? s.paid/s.inv*100 : 0;
    var barW = s.bal/maxBal*100;
    var bg = i%2===0?"#ffffff":"#fafafa";
    html += "<tr style='border-bottom:1px solid #f1f5f9;background:"+bg+"'>"+
      "<td style='padding:10px 12px;font-weight:600;color:#2563eb'>"+s.sku+"</td>"+
      "<td style='padding:10px 12px;color:#64748b;font-size:12px'>"+s.cat+"</td>"+
      "<td style='padding:10px 12px;text-align:right;color:#1a2332'>"+s.count+"</td>"+
      "<td style='padding:10px 12px;text-align:right;color:#1a2332'>"+fmtDollar(s.inv)+"</td>"+
      "<td style='padding:10px 12px;text-align:right;color:#16a34a'>"+fmtDollar(s.paid)+"</td>"+
      "<td style='padding:10px 12px;text-align:right;color:#f59e0b;font-weight:600'>"+fmtDollar(s.bal)+
        "<div style='background:#fef3c7;border-radius:2px;height:3px;margin-top:3px;width:100%'>"+
        "<div style='background:#f59e0b;border-radius:2px;height:3px;width:"+barW.toFixed(1)+"%'></div></div></td>"+
      "<td style='padding:10px 12px;text-align:right'>"+
        "<span style='color:"+(pct>=70?"#16a34a":pct>=40?"#f59e0b":"#ef4444")+"'>"+fmtPct(pct)+"</span></td>"+
      "<td style='padding:10px 12px;text-align:right;color:#7c3aed'>"+s.active+"</td>"+
      "<td style='padding:10px 12px;text-align:right;color:#ef4444'>"+s.cancelled+"</td>"+
      "</tr>";
  });
  html += "</tbody></table>";
  document.getElementById("ar-sku-table").innerHTML = html;
}

function arRenderDetailTable(rows){
  var sorted = rows.slice().sort(function(a,b){return b.bal-a.bal;});
  var shown = sorted.slice(0,200);

  var html = "<table style='width:100%;border-collapse:collapse;font-size:12px'>"+
    "<thead><tr style='background:#f8fafc;border-bottom:2px solid #dde3ea'>"+
    ["Order ID","Contact ID","SKU","Purchase Date","Gross","Paid","Balance","Collected %","Aging","Status","Last Payment","EM"].map(function(h){
      return "<th style='padding:8px 10px;text-align:"+(["Gross","Paid","Balance","Collected %"].includes(h)?"right":"left")+";color:#64748b;font-weight:600;font-size:10px;text-transform:uppercase;white-space:nowrap'>"+h+"</th>";
    }).join("")+
    "</tr></thead><tbody>";

  var bucketColors = {'0-30d':'#16a34a','31-60d':'#f59e0b','61-90d':'#f97316','91-180d':'#ef4444','180d+':'#dc2626','Cancelled':'#6b7280'};

  shown.forEach(function(r, i){
    var bg = i%2===0?"#ffffff":"#fafafa";
    var sc = r.status==="Active"?"#16a34a":"#ef4444";
    var bc = bucketColors[r.bucket]||"#64748b";
    html += "<tr style='border-bottom:1px solid #f1f5f9;background:"+bg+"'>"+
      "<td style='padding:7px 10px;color:#2563eb;font-weight:500'>"+r.oid+"</td>"+
      "<td style='padding:7px 10px;color:#64748b'>"+r.cid+"</td>"+
      "<td style='padding:7px 10px;font-weight:600;color:#1a2332'>"+r.sku+"</td>"+
      "<td style='padding:7px 10px;color:#64748b'>"+r.date+"</td>"+
      "<td style='padding:7px 10px;text-align:right;color:#1a2332'>"+fmtDollar(r.inv)+"</td>"+
      "<td style='padding:7px 10px;text-align:right;color:#16a34a'>"+fmtDollar(r.paid)+"</td>"+
      "<td style='padding:7px 10px;text-align:right;font-weight:600;color:#f59e0b'>"+fmtDollar(r.bal)+"</td>"+
      "<td style='padding:7px 10px;text-align:right;color:"+(r.collected_pct>=70?"#16a34a":r.collected_pct>=40?"#f59e0b":"#ef4444")+"'>"+fmtPct(r.collected_pct)+"</td>"+
      "<td style='padding:7px 10px'><span style='background:"+bc+"22;color:"+bc+";padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600'>"+r.bucket+"</span></td>"+
      "<td style='padding:7px 10px'><span style='color:"+sc+";font-weight:600;font-size:11px'>"+r.status+"</span></td>"+
      "<td style='padding:7px 10px;color:#64748b'>"+r.last_pmt+"</td>"+
      "<td style='padding:7px 10px;color:#64748b;font-size:11px'>"+r.em+"</td>"+
      "</tr>";
  });
  html += "</tbody></table>";
  if(sorted.length > 200) html += "<div style='padding:10px 12px;color:#64748b;font-size:12px'>Showing top 200 of "+sorted.length+" records — use filters to narrow down or download CSV for full data</div>";
  document.getElementById("ar-detail-table").innerHTML = html;
  document.getElementById("ar-detail-lbl").textContent = shown.length+" of "+sorted.length+" orders";
}

function arDownloadCsv(){
  var rows = arGetFiltered();
  var headers = ["Order ID","Contact ID","SKU","Category","Purchase Date","Partner Category","Referral Partner","EM","Gross","Paid","Balance","Collected %","Aging Bucket","Status","Last Payment","Days Since Last Payment","Credit Status"];
  function esc(v){var s=String(v==null?"":v);return s.includes(",")||s.includes('"')?'"'+s.replace(/"/g,'""')+'"':s;}
  var lines = [headers.join(",")];
  rows.forEach(function(r){
    lines.push([r.oid,r.cid,r.sku,r.sku_cat,r.date,r.pcat,r.partner,r.em,
      r.inv.toFixed(2),r.paid.toFixed(2),r.bal.toFixed(2),r.collected_pct.toFixed(1),
      r.bucket,r.status,r.last_pmt,r.days_since,r.cs].map(esc).join(","));
  });
  var blob = new Blob([lines.join("\n")],{type:"text/csv"});
  var a = document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download = "AR_Report_"+new Date().toISOString().slice(0,10)+".csv"; a.click();
}

// ── Populate filters ────────────────────────────────────────────────────────
function arRenderFilters(){
  if(!AR) return;
  // SKU menu
  var menu = document.getElementById("ar-sku-menu");
  var html = "<div style='padding:8px 12px;border-bottom:1px solid #dde3ea;display:flex;gap:8px'>"+
    "<button onclick='arSkuAll()' style='font-size:11px;padding:2px 8px;border:1px solid #dde3ea;border-radius:4px;background:#fff;cursor:pointer'>All</button>"+
    "<button onclick='arSkuClear()' style='font-size:11px;padding:2px 8px;border:1px solid #dde3ea;border-radius:4px;background:#fff;cursor:pointer'>Clear</button></div>";
  AR.filters.skus.forEach(function(s){
    html += "<div onclick='arToggleSku(\""+s.replace(/"/g,"&quot;")+"\");arUpdateSkuBtn()' "+
      "style='padding:7px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f8fafc;display:flex;align-items:center;gap:8px'>"+
      "<span id='ar-sku-chk-"+s.replace(/[^a-zA-Z0-9]/g,"_")+"' style='color:"+(arSelSku.has(s)?"#2563eb":"#dde3ea")+"'>■</span>"+s+"</div>";
  });
  menu.innerHTML = html;

  // Pcat
  var pc = document.getElementById("ar-pcat");
  pc.innerHTML = "<option value=''>All Partner Categories</option>";
  AR.filters.pcats.forEach(function(p){ pc.innerHTML += "<option value='"+p+"'>"+p+"</option>"; });
}

// ── Load ────────────────────────────────────────────────────────────────────
fetch("ar_data.json").then(function(r){return r.json();})
  .then(function(data){
    AR = data;
    arRenderFilters();
    arRender();
  })
  .catch(function(err){
    document.getElementById("ar-loading").innerHTML = '<div style="color:#ef4444;padding:20px">Failed to load ar_data.json: '+err+'</div>';
  });

document.addEventListener("click", function(e){
  var menu = document.getElementById("ar-sku-menu");
  var btn  = document.getElementById("ar-sku-btn");
  if(menu && btn && !menu.contains(e.target) && !btn.contains(e.target)){
    menu.style.display = "none";
  }
});
