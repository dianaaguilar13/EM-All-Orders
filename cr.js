var CR=null,crCharts={};

function crFmtM(m){var p=m.split("-");return new Date(parseInt(p[0]),parseInt(p[1])-1).toLocaleString("default",{month:"short",year:"2-digit"});}
function crFmt$(v){return"$"+(v||0).toLocaleString(undefined,{maximumFractionDigits:0});}

function crDestroyCharts(){Object.values(crCharts).forEach(function(c){try{c.destroy();}catch(e){}});crCharts={};}

function crGetRange(){return{df:document.getElementById("cr-df").value.slice(0,7),dt:document.getElementById("cr-dt").value.slice(0,7)};}
function crGetStatus(){return document.getElementById("cr-status").value;}
function crGetReqType(){return document.getElementById("cr-reqtype").value;}
function crGetAssignee(){return document.getElementById("cr-assignee").value;}

function crApply(){crRender();}
function crReset(){
  document.getElementById("cr-df").value="2022-01-01";
  document.getElementById("cr-dt").value="2026-04-29";
  ["cr-status","cr-reqtype","cr-assignee"].forEach(function(id){document.getElementById(id).value="";});
  crRender();
}

function crGetFilteredMonths(){
  var r=crGetRange(),st=crGetStatus(),rt=crGetReqType(),as=crGetAssignee();
  // If no extra filters just use pre-aggregated M
  if(!st&&!rt&&!as){
    return Object.keys(CR.M).filter(function(m){return m>=r.df&&m<=r.dt;}).sort()
      .map(function(m){return{m:m,b:CR.M[m]};});
  }
  // Otherwise filter rows
  var byM={};
  CR.rows.forEach(function(row){
    if(row.month<r.df||row.month>r.dt)return;
    if(st&&row.status!==st)return;
    if(rt&&row.request_type!==rt)return;
    if(as&&row.assignee!==as)return;
    var m=row.month;
    if(!byM[m])byM[m]={total:0,saved:0,lost:0,rev_saved:0,rev_loss:0,refund:0};
    byM[m].total++;
    if(row.saved_by)byM[m].saved++;else byM[m].lost++;
    byM[m].rev_saved+=row.rev_saved||0;
    byM[m].rev_loss+=row.rev_loss||0;
    byM[m].refund+=row.refund_amt||0;
  });
  return Object.keys(byM).sort().map(function(m){return{m:m,b:byM[m]};});
}

function crRender(){
  if(!CR)return;
  crDestroyCharts();
  var r=crGetRange(),st=crGetStatus(),rt=crGetReqType(),as=crGetAssignee();

  // Filter rows for detail metrics
  var rows=CR.rows.filter(function(row){
    if(row.month<r.df||row.month>r.dt)return false;
    if(st&&row.status!==st)return false;
    if(rt&&row.request_type!==rt)return false;
    if(as&&row.assignee!==as)return false;
    return true;
  });

  var total=rows.length;
  var saved=rows.filter(function(r){return r.saved_by;}).length;
  var saveRate=total>0?(saved/total*100):0;
  var revSaved=rows.reduce(function(s,r){return s+(r.rev_saved||0);},0);
  var revLoss=rows.reduce(function(s,r){return s+(r.rev_loss||0);},0);
  var refund=rows.reduce(function(s,r){return s+(r.refund_amt||0);},0);
  var netSave=revSaved-revLoss;

  document.getElementById("cr-rcLbl").textContent=total.toLocaleString()+" matched records";

  // KPIs
  document.getElementById("cr-kpis").innerHTML=
    '<div class="kpi k1"><div class="kl">Total Cases</div><div class="kv">'+total.toLocaleString()+'</div><div class="ks muted">matched to Snowflake</div></div>'+
    '<div class="kpi k6"><div class="kl">Saved</div><div class="kv" style="color:#3fb950">'+saved.toLocaleString()+'</div><div class="ks green">'+saveRate.toFixed(1)+'% save rate</div></div>'+
    '<div class="kpi k3"><div class="kl">Lost / Cancelled</div><div class="kv" style="color:#f85149">'+(total-saved).toLocaleString()+'</div><div class="ks red">'+(100-saveRate).toFixed(1)+'% not saved</div></div>'+
    '<div class="kpi k8"><div class="kl">Revenue Saved</div><div class="kv" style="color:#39d353;font-size:17px">'+crFmt$(revSaved)+'</div><div class="ks green">recovered revenue</div></div>'+
    '<div class="kpi k4"><div class="kl">Revenue Loss</div><div class="kv" style="color:#f85149;font-size:17px">'+crFmt$(revLoss)+'</div><div class="ks red">lost revenue</div></div>'+
    '<div class="kpi k5"><div class="kl">Total Refunded</div><div class="kv" style="color:#e3b341;font-size:17px">'+crFmt$(refund)+'</div><div class="ks amber">refund amount</div></div>'+
    '<div class="kpi k2"><div class="kl">Net Revenue Impact</div><div class="kv" style="color:'+(netSave>=0?"#3fb950":"#f85149")+';font-size:17px">'+crFmt$(netSave)+'</div><div class="ks '+(netSave>=0?"green":"red")+'">saved minus lost</div></div>';

  // Monthly trend
  var ts=crGetFilteredMonths();
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

  // Revenue trend
  crCharts.rev=new Chart(document.getElementById("cr-revChart"),{
    type:"bar",
    data:{labels:mLabels,datasets:[
      {label:"Revenue Saved",data:ts.map(function(x){return Math.round(x.b.rev_saved||0);}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3},
      {label:"Revenue Loss",data:ts.map(function(x){return Math.round(x.b.rev_loss||0);}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false,callbacks:{label:function(ctx){return ctx.dataset.label+": $"+ctx.parsed.y.toLocaleString();}}}},
      scales:{x:{ticks:{color:"#8b949e",font:{size:10},maxRotation:45,autoSkip:true,maxTicksLimit:24},grid:{color:"#21262d44"}},
              y:{ticks:{color:"#8b949e",font:{size:10},callback:function(v){return"$"+(v/1000).toFixed(0)+"k";}},grid:{color:"#21262d44"}}}}
  });

  // Request type bar
  var reqData=Object.entries(CR.REQ).filter(function(e){return e[1].total>10;})
    .map(function(e){return{rt:e[0],total:e[1].total,saved:e[1].saved,rate:e[1].total>0?(e[1].saved/e[1].total*100):0};})
    .sort(function(a,b){return b.total-a.total;}).slice(0,12);
  crCharts.req=new Chart(document.getElementById("cr-reqChart"),{
    type:"bar",
    data:{labels:reqData.map(function(x){return x.rt.length>30?x.rt.slice(0,30)+"…":x.rt;}),
          datasets:[
            {label:"Saved",data:reqData.map(function(x){return x.saved;}),backgroundColor:"rgba(63,185,80,0.8)",borderRadius:3,stack:"s"},
            {label:"Lost",data:reqData.map(function(x){return x.total-x.saved;}),backgroundColor:"rgba(248,81,73,0.8)",borderRadius:3,stack:"s"}
          ]},
    options:{indexAxis:"y",responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{mode:"index",intersect:false}},
      scales:{x:{stacked:true,ticks:{color:"#8b949e",font:{size:10}},grid:{color:"#21262d44"}},
              y:{ticks:{color:"#e6edf3",font:{size:9}},grid:{display:false}}}}
  });

  // Saved by donut
  var sbData=Object.entries(CR.SB).filter(function(e){return e[1]>0;}).sort(function(a,b){return b[1]-a[1];});
  crCharts.sb=new Chart(document.getElementById("cr-sbChart"),{
    type:"doughnut",
    data:{labels:sbData.map(function(x){return x[0]||"Not Saved";}),
          datasets:[{data:sbData.map(function(x){return x[1];}),
            backgroundColor:["#3fb950","#388bfd","#e3b341","#bc8cff","#f85149"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",
      plugins:{legend:{position:"right",labels:{color:"#8b949e",font:{size:11},boxWidth:10,padding:8}}}}
  });

  // Status donut
  var stData=Object.entries(CR.ST).filter(function(e){return e[1]>0;}).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
  crCharts.st=new Chart(document.getElementById("cr-stChart"),{
    type:"doughnut",
    data:{labels:stData.map(function(x){return x[0]||"Unknown";}),
          datasets:[{data:stData.map(function(x){return x[1];}),
            backgroundColor:["#388bfd","#3fb950","#e3b341","#f85149","#bc8cff","#58a6ff","#39d353","#8b949e"],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",
      plugins:{legend:{position:"right",labels:{color:"#8b949e",font:{size:11},boxWidth:10,padding:8}}}}
  });

  // SKU table
  var skuArr=Object.entries(CR.SKU).map(function(e){
    var v=e[1];var rate=v.total>0?(v.saved/v.total*100):0;
    return{sku:e[0],total:v.total,saved:v.saved,lost:v.total-v.saved,rate:rate,
      rev_saved:v.rev_saved,rev_loss:v.rev_loss};
  }).filter(function(s){return s.total>0;}).sort(function(a,b){return b.total-a.total;});

  var skuRows=skuArr.slice(0,30).map(function(s){
    var cl=s.rate>=50?"#3fb950":s.rate>=30?"#e3b341":"#f85149";
    var bg=s.rate>=50?"#3fb950":s.rate>=30?"#e3b341":"#f85149";
    return"<tr><td><span class='pill'>"+s.sku+"</span></td>"+
      "<td class='num'>"+s.total+"</td>"+
      "<td class='num' style='color:#3fb950'>"+s.saved+"</td>"+
      "<td class='num' style='color:#f85149'>"+s.lost+"</td>"+
      "<td><div class='bw'><div class='bb'><div class='bf' style='width:"+s.rate.toFixed(0)+"%;background:"+bg+"'></div></div>"+
      "<span class='num' style='min-width:40px;font-size:11px;color:"+cl+"'>"+s.rate.toFixed(1)+"%</span></div></td>"+
      "<td class='num' style='color:#3fb950'>"+crFmt$(s.rev_saved)+"</td>"+
      "<td class='num' style='color:#f85149'>"+crFmt$(s.rev_loss)+"</td></tr>";
  }).join("");
  document.getElementById("cr-skuTbody").innerHTML=skuRows;
  document.getElementById("cr-tblInfo").textContent=skuArr.length+" SKUs · "+total.toLocaleString()+" cases";

  // Cases table
  var caseRows=rows.slice(0,200).map(function(row){
    var saved=!!row.saved_by;
    return"<tr>"+
      "<td class='num' style='font-size:10px;color:#8b949e'>"+row.id+"</td>"+
      "<td><span class='pill'>"+row.sku+"</span></td>"+
      "<td style='font-size:10px;color:#8b949e'>"+row.date+"</td>"+
      "<td style='font-size:10px;color:#8b949e;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>"+row.request_type+"</td>"+
      "<td><span style='font-size:10px;font-weight:600;color:"+(saved?"#3fb950":"#f85149")+"'>"+(saved?"Saved":"Lost")+"</span></td>"+
      "<td style='font-size:10px;color:#388bfd'>"+row.saved_by+"</td>"+
      "<td style='font-size:10px;color:#8b949e'>"+row.status+"</td>"+
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

fetch("cr_data.json").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
  .then(function(data){
    CR=data;
    // Populate filters
    var stSel=document.getElementById("cr-status");
    CR.FL.statuses.forEach(function(s){var o=document.createElement("option");o.value=o.textContent=s;stSel.appendChild(o);});
    var rtSel=document.getElementById("cr-reqtype");
    CR.FL.req_types.forEach(function(s){var o=document.createElement("option");o.value=o.textContent=s;rtSel.appendChild(o);});
    var asSel=document.getElementById("cr-assignee");
    CR.FL.assignees.forEach(function(s){var o=document.createElement("option");o.value=o.textContent=s;asSel.appendChild(o);});
    crRender();
  })
  .catch(function(err){document.getElementById("cr-loading").innerHTML='<div style="color:#f85149">Failed to load cr_data.json: '+err.message+"</div>";});
