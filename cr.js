var CR=null,crCharts={},crSelReq=new Set();

// ── Helpers ────────────────────────────────────────────────
function crFmtM(m){var p=m.split("-");return new Date(parseInt(p[0]),parseInt(p[1])-1).toLocaleString("default",{month:"short",year:"2-digit"});}
function crFmt$(v){return"$"+(v||0).toLocaleString(undefined,{maximumFractionDigits:0});}
function crDestroyCharts(){Object.values(crCharts).forEach(function(c){try{c.destroy();}catch(e){}});crCharts={};}

// ── Request Type multi-select ──────────────────────────────
function crToggleReq(e){e.stopPropagation();var dr=document.getElementById("cr-reqDrop");dr.classList.toggle("open");if(dr.classList.contains("open")){document.getElementById("cr-reqQ").focus();crRenderReqItems();}}
function crRenderReqItems(){if(!CR)return;var q=document.getElementById("cr-reqQ").value.toLowerCase();var vis=CR.FL.req_types.filter(function(s){return s.toLowerCase().indexOf(q)>=0;});var h="";vis.forEach(function(s){var ck=crSelReq.has(s)?"checked":"";var e=s.replace(/&/g,"&amp;");h+='<div class="ms-item" data-s="'+e+'" onclick="crTogReqItem(this)"><input type="checkbox" '+ck+' onclick="return false"><span>'+e+"</span></div>";});document.getElementById("cr-reqItems").innerHTML=h;}
function crTogReqItem(el){var s=el.getAttribute("data-s");if(crSelReq.has(s))crSelReq.delete(s);else crSelReq.add(s);crUpdateReqBtn();crRenderReqItems();}
function crReqAll(){CR.FL.req_types.filter(function(s){return s.toLowerCase().indexOf(document.getElementById("cr-reqQ").value.toLowerCase())>=0;}).forEach(function(s){crSelReq.add(s);});crUpdateReqBtn();crRenderReqItems();}
function crReqClear(){crSelReq.clear();crUpdateReqBtn();crRenderReqItems();}
function crUpdateReqBtn(){var btn=document.getElementById("cr-reqBtn");var cnt=document.getElementById("cr-reqCnt");if(crSelReq.size===0){btn.textContent="All Request Types";cnt.style.display="none";}else{btn.textContent=crSelReq.size===1?Array.from(crSelReq)[0].slice(0,22):crSelReq.size+" types";cnt.textContent=crSelReq.size;cnt.style.display="inline";}}

document.addEventListener("click",function(e){
  var rw=document.getElementById("cr-reqWrap");if(rw&&!rw.contains(e.target)){var d=document.getElementById("cr-reqDrop");if(d)d.classList.remove("open");}
});

// ── Filters ────────────────────────────────────────────────
function crGetRange(){return{df:document.getElementById("cr-df").value.slice(0,7),dt:document.getElementById("cr-dt").value.slice(0,7)};}
function crGetStatus(){return document.getElementById("cr-status").value;}
function crGetAssignee(){return document.getElementById("cr-assignee").value;}

function crApply(){document.getElementById("cr-reqDrop").classList.remove("open");crRender();}
function crReset(){
  document.getElementById("cr-df").value="2022-01-01";
  document.getElementById("cr-dt").value="2026-04-29";
  ["cr-status","cr-assignee"].forEach(function(id){document.getElementById(id).value="";});
  crSelReq.clear();crUpdateReqBtn();crRender();
}

// ── Filter rows ────────────────────────────────────────────
function crFilterRows(){
  var r=crGetRange(),st=crGetStatus(),as=crGetAssignee();
  return CR.rows.filter(function(row){
    if(row.month&&(row.month<r.df||row.month>r.dt))return false;
    if(!row.month&&row.created_at&&(row.created_at.slice(0,7)<r.df||row.created_at.slice(0,7)>r.dt))return false;
    if(st&&row.status!==st)return false;
    if(crSelReq.size>0&&!crSelReq.has(row.request_type))return false;
    if(as&&row.assignee!==as)return false;
    return true;
  });
}

// ── Resolution bar helper ──────────────────────────────────
function crResBar(avg,target){
  var pct=Math.min(avg/target,2)*50;
  var color=avg<=target?"#3fb950":avg<=target*2?"#e3b341":"#f85149";
  var label=avg<=target?("✓ "+avg+"d avg"):("✗ "+avg+"d avg");
  return'<div style="display:flex;align-items:center;gap:8px;margin-top:4px">'+
    '<div style="flex:1;height:6px;background:#21262d;border-radius:3px;overflow:hidden">'+
    '<div style="height:100%;width:'+pct.toFixed(0)+'%;background:'+color+';border-radius:3px;transition:width .4s"></div></div>'+
    '<span style="font-size:11px;color:'+color+';white-space:nowrap;font-weight:600">'+label+'</span></div>';
}

// ── Main render ────────────────────────────────────────────
function crRender(){
  if(!CR)return;
  crDestroyCharts();
  var r=crGetRange(),st=crGetStatus(),as=crGetAssignee();
  var rows=crFilterRows();

  var total=rows.length;
  var saved=rows.filter(function(r){return r.saved_by;}).length;
  var saveRate=total>0?(saved/total*100):0;
  var revSaved=rows.reduce(function(s,r){return s+(r.rev_saved||0);},0);
  var revLoss=rows.reduce(function(s,r){return s+(r.rev_loss||0);},0);
  var refund=rows.reduce(function(s,r){return s+(r.refund_amt||0);},0);
  var netSave=revSaved-revLoss;

  document.getElementById("cr-rcLbl").textContent=total.toLocaleString()+" matched records";

  // ── Resolution time insight panel ────────────────────────
  var res=CR.resolution||{};
  var ov=res.overall||{};
  var TARGET=7;

  // Filter resolution data by req type if selected
  var resByReq=res.by_req||{};
  var resBySku=res.by_sku||{};

  // KPI cards
  document.getElementById("cr-kpis").innerHTML=
    '<div class="kpi k1"><div class="kl">Total Cases</div><div class="kv">'+total.toLocaleString()+'</div><div class="ks muted">matched to orders</div></div>'+
    '<div class="kpi k6"><div class="kl">Saved</div><div class="kv" style="color:#3fb950">'+saved.toLocaleString()+'</div><div class="ks green">'+saveRate.toFixed(1)+'% save rate</div></div>'+
    '<div class="kpi k3"><div class="kl">Lost</div><div class="kv" style="color:#f85149">'+(total-saved).toLocaleString()+'</div><div class="ks red">'+(100-saveRate).toFixed(1)+'% not saved</div></div>'+
    '<div class="kpi k8"><div class="kl">Revenue Saved</div><div class="kv" style="color:#39d353;font-size:17px">'+crFmt$(revSaved)+'</div><div class="ks green">recovered</div></div>'+
    '<div class="kpi k4"><div class="kl">Revenue Loss</div><div class="kv" style="color:#f85149;font-size:17px">'+crFmt$(revLoss)+'</div><div class="ks red">lost</div></div>'+
    '<div class="kpi k5"><div class="kl">Total Refunded</div><div class="kv" style="color:#e3b341;font-size:17px">'+crFmt$(refund)+'</div><div class="ks amber">refunds</div></div>'+
    '<div class="kpi k2"><div class="kl">Net Impact</div><div class="kv" style="color:'+(netSave>=0?"#3fb950":"#f85149")+';font-size:17px">'+crFmt$(netSave)+'</div><div class="ks '+(netSave>=0?"green":"red")+'">saved minus lost</div></div>';

  // ── Resolution Insights Panel ──────────────────────────────
  var avgAll=ov.avg||0,pct7=ov.pct7||0,nComp=ov.n||0;
  var resColor=avgAll<=TARGET?"#3fb950":avgAll<=TARGET*2?"#e3b341":"#f85149";
  var resIcon=avgAll<=TARGET?"✓":"⚠";

  // Top 10 slowest and fastest SKUs
  var skuRes=Object.entries(resBySku).filter(function(e){return e[1].n>=3;});
  var slowest=skuRes.slice().sort(function(a,b){return b[1].avg-a[1].avg;}).slice(0,8);
  var fastest=skuRes.slice().sort(function(a,b){return a[1].avg-b[1].avg;}).slice(0,8);

  var skuRowsHTML=skuRes.sort(function(a,b){return b[1].n-a[1].n;}).slice(0,20).map(function(e){
    var s=e[0],v=e[1];
    var c=v.avg<=TARGET?"#3fb950":v.avg<=TARGET*2?"#e3b341":"#f85149";
    var w=Math.min(v.avg/(TARGET*3)*100,100);
    return'<tr>'+
      '<td><span class="pill">'+s+'</span></td>'+
      '<td class="num">'+v.n+'</td>'+
      '<td><div style="display:flex;align-items:center;gap:6px">'+
        '<div style="width:80px;height:5px;background:#21262d;border-radius:2px"><div style="height:100%;width:'+w.toFixed(0)+'%;background:'+c+'"></div></div>'+
        '<span style="font-size:12px;font-weight:700;color:'+c+'">'+v.avg+'d</span></div></td>'+
      '<td class="num" style="color:#3fb950">'+v.within7+'</td>'+
      '<td><span style="font-size:11px;color:'+c+';font-weight:600">'+v.pct7+'%</span></td>'+
      '</tr>';
  }).join("");

  document.getElementById("cr-resPanel").innerHTML=
    // Top summary row
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">'+
      '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px 16px">'+
        '<div style="font-size:11px;color:#8b949e;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Avg Resolution Time</div>'+
        '<div style="font-size:32px;font-weight:700;color:'+resColor+';letter-spacing:-1px">'+avgAll+'<span style="font-size:16px">d</span></div>'+
        '<div style="font-size:11px;color:#8b949e;margin-top:2px">target: <span style="color:#388bfd;font-weight:600">7 days</span> · '+nComp+' resolved</div>'+
        '<div style="height:5px;background:#21262d;border-radius:3px;margin-top:8px;overflow:hidden">'+
          '<div style="height:100%;width:'+Math.min(TARGET/avgAll*100,100).toFixed(0)+'%;background:'+resColor+';border-radius:3px"></div></div></div>'+
      '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px 16px">'+
        '<div style="font-size:11px;color:#8b949e;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Within 7 Days</div>'+
        '<div style="font-size:32px;font-weight:700;color:'+(pct7>=50?"#3fb950":pct7>=25?"#e3b341":"#f85149")+';letter-spacing:-1px">'+pct7+'<span style="font-size:16px">%</span></div>'+
        '<div style="font-size:11px;color:#8b949e;margin-top:2px">'+(ov.within7||0)+' of '+nComp+' cases</div>'+
        '<div style="height:5px;background:#21262d;border-radius:3px;margin-top:8px;overflow:hidden">'+
          '<div style="height:100%;width:'+pct7.toFixed(0)+'%;background:'+(pct7>=50?"#3fb950":pct7>=25?"#e3b341":"#f85149")+';border-radius:3px"></div></div></div>'+
      '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px 16px">'+
        '<div style="font-size:11px;color:#8b949e;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Fastest SKU</div>'+
        (fastest.length?'<div style="font-size:18px;font-weight:700;color:#3fb950">'+fastest[0][0]+'</div><div style="font-size:12px;color:#3fb950;margin-top:2px">'+fastest[0][1].avg+'d avg · '+fastest[0][1].n+' cases</div>':'<div style="color:#8b949e">No data</div>')+
        '</div>'+
      '<div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px 16px">'+
        '<div style="font-size:11px;color:#8b949e;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Slowest SKU</div>'+
        (slowest.length?'<div style="font-size:18px;font-weight:700;color:#f85149">'+slowest[0][0]+'</div><div style="font-size:12px;color:#f85149;margin-top:2px">'+slowest[0][1].avg+'d avg · '+slowest[0][1].n+' cases</div>':'<div style="color:#8b949e">No data</div>')+
        '</div>'+
    '</div>'+
    // Dist bar chart
    '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:16px">'+
      '<div style="font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:.5px;writing-mode:vertical-rl;transform:rotate(180deg);padding-right:4px">Cases</div>'+
      (function(){
        var dist=ov.dist||{};if(!Object.keys(dist).length)return'<div style="color:#8b949e">No dist data</div>';
        var labels={"0":"Same day","1_3":"1-3d","4_7":"4-7d","8_14":"8-14d","15_30":"15-30d","31p":"31+ d"};
        var colors={"0":"#3fb950","1_3":"#39d353","4_7":"#58a6ff","8_14":"#e3b341","15_30":"#f0883e","31p":"#f85149"};
        var maxV=Math.max.apply(null,Object.values(dist).concat([1]));
        return Object.keys(labels).map(function(k){
          var v=dist[k]||0,h=Math.round(v/maxV*80);
          return'<div style="display:flex;flex-direction:column;align-items:center;gap:4px">'+
            '<div style="font-size:10px;color:'+colors[k]+';font-weight:600">'+v+'</div>'+
            '<div style="width:36px;height:'+h+'px;background:'+colors[k]+';border-radius:3px 3px 0 0;min-height:2px"></div>'+
            '<div style="font-size:9px;color:#8b949e;text-align:center">'+labels[k]+'</div></div>';
        }).join("")+'<div style="margin-left:8px;display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:18px"><div style="width:1px;height:80px;background:#388bfd;position:relative"><div style="position:absolute;left:4px;top:0;font-size:9px;color:#388bfd;white-space:nowrap">7d target</div></div></div>';
      })()+
    '</div>'+
    // SKU table
    '<div class="tbl-wrap" style="max-height:280px">'+
    '<table><thead><tr><th>SKU</th><th>Resolved</th><th>Avg Days</th><th>Within 7d</th><th>% On Time</th></tr></thead>'+
    '<tbody>'+skuRowsHTML+'</tbody></table></div>';

  // ── Monthly trend ──────────────────────────────────────
  var ts=Object.keys(CR.M).filter(function(m){return m>=r.df&&m<=r.dt;}).sort()
    .map(function(m){return{m:m,b:CR.M[m]};});
  // Apply req filter
  if(crSelReq.size>0||st||as){
    var byM2={};
    rows.forEach(function(row){
      var m=row.month||row.created_at.slice(0,7);if(!m)return;
      if(!byM2[m])byM2[m]={total:0,saved:0,lost:0,rev_saved:0,rev_loss:0,refund:0};
      byM2[m].total++;
      if(row.saved_by)byM2[m].saved++;else byM2[m].lost++;
      byM2[m].rev_saved+=row.rev_saved||0;byM2[m].rev_loss+=row.rev_loss||0;byM2[m].refund+=row.refund_amt||0;
    });
    ts=Object.keys(byM2).sort().map(function(m){return{m:m,b:byM2[m]};});
  }

  var mLabels=ts.map(function(x){return crFmtM(x.m);});
  crCharts.trend=new Chart(document.getElementById("cr-trendChart"),{
    type:"bar",
    data:{labels:mLabels,datasets:[
      {label:"Saved",data:ts.map(function(x){return x.b.saved||0;}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
      {label:"Lost",data:ts.map(function(x){return x.b.lost||0;}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3,stack:"s"},
      {label:"Save %",data:ts.map(function(x){var t=x.b.total||0,s=x.b.saved||0;return t>0?+(s/t*100).toFixed(1):0;}),
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

  // ── Resolution trend ──────────────────────────────────
  var resByM=CR.resolution.by_month||{};
  var resMonths=Object.keys(resByM).filter(function(m){return m>=r.df&&m<=r.dt;}).sort();
  if(resMonths.length>0){
    crCharts.resTrend=new Chart(document.getElementById("cr-resTrendChart"),{
      type:"bar",
      data:{labels:resMonths.map(crFmtM),datasets:[
        {label:"Avg Days",data:resMonths.map(function(m){return resByM[m].avg||0;}),
          backgroundColor:resMonths.map(function(m){var a=resByM[m].avg||0;return a<=7?"rgba(63,185,80,0.8)":a<=14?"rgba(227,179,65,0.8)":"rgba(248,81,73,0.8)";}),
          borderRadius:3},
        {label:"7d target",data:resMonths.map(function(){return 7;}),
          type:"line",borderColor:"#388bfd",borderDash:[4,4],pointRadius:0,borderWidth:1.5,backgroundColor:"transparent"}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+": "+ctx.parsed.y+"d";}}}},
        scales:{x:{ticks:{color:"#8b949e",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#21262d44"}},
                y:{ticks:{color:"#8b949e",font:{size:10},callback:function(v){return v+"d";}},grid:{color:"#21262d44"}}}}
    });
  }

  // ── Revenue trend ─────────────────────────────────────
  crCharts.rev=new Chart(document.getElementById("cr-revChart"),{
    type:"bar",
    data:{labels:mLabels,datasets:[
      {label:"Revenue Saved",data:ts.map(function(x){return Math.round(x.b.rev_saved||0);}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3},
      {label:"Revenue Loss",data:ts.map(function(x){return Math.round(x.b.rev_loss||0);}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false,callbacks:{label:function(ctx){return ctx.dataset.label+": $"+ctx.parsed.y.toLocaleString();}}}},
      scales:{x:{ticks:{color:"#8b949e",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#21262d44"}},
              y:{ticks:{color:"#8b949e",font:{size:10},callback:function(v){return"$"+(v>=1000?(v/1000).toFixed(0)+"k":v);}},grid:{color:"#21262d44"}}}}
  });

  // ── Request type chart ────────────────────────────────
  var reqData=Object.entries(CR.REQ).filter(function(e){
    if(crSelReq.size>0&&!crSelReq.has(e[0]))return false;
    return e[1].total>5;
  }).map(function(e){return{rt:e[0],total:e[1].total,saved:e[1].saved,rate:e[1].total>0?(e[1].saved/e[1].total*100):0};})
  .sort(function(a,b){return b.total-a.total;}).slice(0,12);

  crCharts.req=new Chart(document.getElementById("cr-reqChart"),{
    type:"bar",
    data:{labels:reqData.map(function(x){return x.rt.length>35?x.rt.slice(0,35)+"…":x.rt;}),
          datasets:[
            {label:"Saved",data:reqData.map(function(x){return x.saved;}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
            {label:"Lost",data:reqData.map(function(x){return x.total-x.saved;}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3,stack:"s"}
          ]},
    options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},
      scales:{x:{stacked:true,ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},
              y:{stacked:false,ticks:{color:"#e6edf3",font:{size:9}},grid:{display:false}}}}
  });

  // ── Donuts ────────────────────────────────────────────
  var sbData=Object.entries(CR.SB).filter(function(e){return e[1]>0;}).sort(function(a,b){return b[1]-a[1];}).slice(0,6);
  crCharts.sb=new Chart(document.getElementById("cr-sbChart"),{
    type:"doughnut",
    data:{labels:sbData.map(function(x){return x[0]||"Not Saved";}),
          datasets:[{data:sbData.map(function(x){return x[1];}),
            backgroundColor:["#3fb950","#388bfd","#e3b341","#bc8cff","#f85149","#58a6ff"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",
      plugins:{legend:{position:"right",labels:{color:"#8b949e",font:{size:10},boxWidth:10,padding:8}}}}
  });

  var stData=Object.entries(CR.ST).filter(function(e){return e[1]>0;}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
  crCharts.st=new Chart(document.getElementById("cr-stChart"),{
    type:"doughnut",
    data:{labels:stData.map(function(x){return x[0]||"Unknown";}),
          datasets:[{data:stData.map(function(x){return x[1];}),
            backgroundColor:["#388bfd","#3fb950","#e3b341","#f85149","#bc8cff","#58a6ff","#39d353","#8b949e"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",
      plugins:{legend:{position:"right",labels:{color:"#8b949e",font:{size:10},boxWidth:10,padding:8}}}}
  });

  // ── SKU breakdown table ───────────────────────────────
  var skuArr=Object.entries(CR.SKU).map(function(e){
    var v=e[1],rate=v.total>0?(v.saved/v.total*100):0;
    var res=CR.resolution.by_sku[e[0]];
    return{sku:e[0],total:v.total,saved:v.saved,lost:v.total-v.saved,rate:rate,
      rev_saved:v.rev_saved,rev_loss:v.rev_loss,
      avg_days:res?res.avg:null,pct7:res?res.pct7:null};
  }).filter(function(s){return s.total>0;}).sort(function(a,b){return b.total-a.total;});

  var skuRows=skuArr.slice(0,30).map(function(s){
    var cl=s.rate>=50?"#3fb950":s.rate>=30?"#e3b341":"#f85149";
    var bg=s.rate>=50?"#3fb950":s.rate>=30?"#e3b341":"#f85149";
    var resCell=s.avg_days!=null?
      '<span style="font-weight:700;color:'+(s.avg_days<=7?"#3fb950":s.avg_days<=14?"#e3b341":"#f85149")+'">'+s.avg_days+'d</span>'+
      '<span style="font-size:10px;color:#8b949e;margin-left:4px">('+s.pct7+'% ≤7d)</span>':
      '<span style="color:#8b949e">-</span>';
    return"<tr><td><span class='pill'>"+s.sku+"</span></td>"+
      "<td class='num'>"+s.total+"</td>"+
      "<td class='num' style='color:#3fb950'>"+s.saved+"</td>"+
      "<td class='num' style='color:#f85149'>"+s.lost+"</td>"+
      "<td><div class='bw'><div class='bb'><div class='bf' style='width:"+s.rate.toFixed(0)+"%;background:"+bg+"'></div></div>"+
      "<span class='num' style='min-width:40px;font-size:11px;color:"+cl+"'>"+s.rate.toFixed(1)+"%</span></div></td>"+
      "<td>"+resCell+"</td>"+
      "<td class='num' style='color:#3fb950'>"+crFmt$(s.rev_saved)+"</td>"+
      "<td class='num' style='color:#f85149'>"+crFmt$(s.rev_loss)+"</td></tr>";
  }).join("");
  document.getElementById("cr-skuTbody").innerHTML=skuRows;
  document.getElementById("cr-tblInfo").textContent=skuArr.length+" SKUs · "+total.toLocaleString()+" cases";

  // ── Case detail table ─────────────────────────────────
  var caseRows=rows.slice(0,200).map(function(row){
    var saved=!!row.saved_by;
    return"<tr>"+
      "<td class='num' style='font-size:10px;color:#8b949e'>"+row.id+"</td>"+
      "<td><span class='pill'>"+(row.sku||"?")+"</span></td>"+
      "<td style='font-size:10px;color:#8b949e'>"+(row.requested_date||row.created_at||"")+"</td>"+
      "<td style='font-size:10px;color:#8b949e;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>"+row.request_type+"</td>"+
      "<td><span style='font-size:10px;font-weight:600;color:"+(saved?"#3fb950":"#f85149")+"'>"+(saved?"Saved":"Lost")+"</span></td>"+
      "<td style='font-size:10px;color:#388bfd'>"+row.saved_by+"</td>"+
      "<td style='font-size:10px;color:#8b949e'>"+row.status+"</td>"+
      "<td style='font-size:10px;color:#8b949e'>"+row.procedure+"</td>"+
      (row.res_days!=null?"<td class='num' style='font-size:11px;font-weight:700;color:"+(row.res_days<=7?"#3fb950":row.res_days<=14?"#e3b341":"#f85149")+"'>"+row.res_days+"d</td>":"<td style='color:#8b949e'>-</td>")+
      "<td class='num' style='color:#f85149'>"+crFmt$(row.rev_loss)+"</td>"+
      "<td class='num' style='color:#3fb950'>"+crFmt$(row.rev_saved)+"</td>"+
      "<td style='font-size:10px;color:#8b949e'>"+row.assignee+"</td>"+
      "</tr>";
  }).join("");
  document.getElementById("cr-casesTbody").innerHTML=caseRows;
  document.getElementById("cr-casesInfo").textContent="Showing "+Math.min(200,rows.length)+" of "+rows.length+" cases";

  document.getElementById("cr-loading").style.display="none";
  document.getElementById("cr-main").style.display="block";
}

// ── Load ───────────────────────────────────────────────────
fetch("cr_data.json").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
  .then(function(data){
    CR=data;
    var stSel=document.getElementById("cr-status");
    CR.FL.statuses.forEach(function(s){var o=document.createElement("option");o.value=o.textContent=s;stSel.appendChild(o);});
    var asSel=document.getElementById("cr-assignee");
    CR.FL.assignees.forEach(function(s){var o=document.createElement("option");o.value=o.textContent=s;asSel.appendChild(o);});
    crRenderReqItems();
    crRender();
  })
  .catch(function(err){document.getElementById("cr-loading").innerHTML='<div style="color:#f85149">Failed to load cr_data.json: '+err.message+"</div>";});
