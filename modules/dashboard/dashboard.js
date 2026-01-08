/* Dashboard - Dinamita POS v0 */
(function(){
  const $ = (sel)=>document.querySelector(sel);

  function money(n){
    const v = Number(n||0);
    return v.toLocaleString("es-MX",{ style:"currency", currency:"MXN" });
  }
  const PALETTE = [
    "rgba(185, 28, 28, 0.85)",
    "rgba(220, 38, 38, 0.75)",
    "rgba(244, 63, 94, 0.70)",
    "rgba(234, 88, 12, 0.70)",
    "rgba(245, 158, 11, 0.70)",
    "rgba(34, 197, 94, 0.70)",
    "rgba(59, 130, 246, 0.70)",
    "rgba(168, 85, 247, 0.70)",
  ];

  function ymd(d){
    return d.toISOString().slice(0,10);
  }
  function parseISODate(dateStr){
    // dateStr: YYYY-MM-DD or full ISO
    if(!dateStr) return null;
    if(dateStr.length>=10){
      const s = dateStr.slice(0,10);
      const [y,m,dd] = s.split("-").map(Number);
      return new Date(y, (m||1)-1, dd||1);
    }
    return null;
  }
  function daysBetween(a,b){
    const ms = 24*60*60*1000;
    return Math.floor((b - a)/ms);
  }

  function getStateSafe(){
    try{ return dpGetState(); }catch(e){ console.warn(e); return null; }
  }

  function rangeDays(n){
    const out=[];
    const now=new Date();
    for(let i=n-1;i>=0;i--){
      const d=new Date(now);
      d.setDate(d.getDate()-i);
      out.push(ymd(d));
    }
    return out;
  }

  function summarizeSales(st, fromISO, toISO){
    const from = fromISO ? new Date(fromISO+"T00:00:00") : null;
    const to = toISO ? new Date(toISO+"T23:59:59") : null;
    const sales = (st.sales||[]).filter(s=>{
      const at = new Date(s.at);
      if(from && at<from) return false;
      if(to && at>to) return false;
      return true;
    });

    const totalsByDay = {};
    const payTotals = {};
    const qtyByProduct = {};

    for(const s of sales){
      const day = (s.at||"").slice(0,10);
      totalsByDay[day] = (totalsByDay[day]||0) + Number(s.total||0);

      const pm = (s.paymentMethod || "efectivo").toLowerCase();
      payTotals[pm] = (payTotals[pm]||0) + Number(s.total||0);

      // items can be product lines or service concept
      for(const it of (s.items||[])){
        const pid = it.productId || "SERV";
        const qty = Number(it.qty||0);
        qtyByProduct[pid] = (qtyByProduct[pid]||0) + qty;
      }
    }

    return { sales, totalsByDay, payTotals, qtyByProduct };
  }

  function membershipStats(st){
    const today = new Date();
    const list = (st.memberships||[]).map(m=>{
      const end = parseISODate(m.end);
      const diff = end ? daysBetween(today, end) : 9999;
      let status="active";
      if(diff < 0) status="expired";
      else if(diff <= 5) status="soon";
      return { ...m, _diff: diff, _status: status };
    });

    const active = list.filter(x=>x._status==="active").length;
    const soon = list.filter(x=>x._status==="soon").length;
    const expired = list.filter(x=>x._status==="expired").length;

    const soonList = list
      .filter(x=>x._status!=="expired")
      .sort((a,b)=>a._diff-b._diff)
      .slice(0,8);

    return { active, soon, expired, soonList };
  }

  function lowStock(st, threshold=5){
    const th = Number(threshold||5);
    return (st.products||[]).filter(p => Number(p.stock||0) <= th);
  }

  /* --- Charts (Canvas, simple) --- */
  function clearCanvas(ctx, w, h){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,w,h);
  }

  function drawBarChart(canvas, labels, values){
    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.getAttribute("height") ? Number(canvas.getAttribute("height")) * devicePixelRatio : 220*devicePixelRatio;
    clearCanvas(ctx,w,h);

    const pad = 28*devicePixelRatio;
    const maxV = Math.max(1, ...values);
    const chartW = w - pad*2;
    const chartH = h - pad*2;

    // axes
    ctx.strokeStyle = "rgba(0,0,0,.12)";
    ctx.lineWidth = 1*devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, pad+chartH);
    ctx.lineTo(pad+chartW, pad+chartH);
    ctx.stroke();

    const barW = chartW / values.length;
    for(let i=0;i<values.length;i++){
      const v = values[i];
      const bh = (v/maxV) * (chartH-10*devicePixelRatio);
      const x = pad + i*barW + barW*0.2;
      const y = pad + chartH - bh;
      const bw = barW*0.6;

      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fillRect(x,y,bw,bh);

      // labels (tiny)
      ctx.fillStyle = "rgba(0,0,0,.65)";
      ctx.font = `${11*devicePixelRatio}px ui-sans-serif`;
      const lab = labels[i].slice(5); // MM-DD
      ctx.fillText(lab, x, pad+chartH+16*devicePixelRatio);
    }
  }

  function drawDonut(canvas, entries){
    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = (canvas.getAttribute("height") ? Number(canvas.getAttribute("height")) : 220) * devicePixelRatio;
    clearCanvas(ctx,w,h);

    const total = entries.reduce((a,b)=>a+b.value,0) || 1;
    const cx = w/2, cy = h/2;
    const r = Math.min(w,h)*0.32;
    const r2 = r*0.62;

    let ang = -Math.PI/2;
    entries.forEach((e, idx)=>{
      const frac = e.value/total;
      const a2 = ang + frac*2*Math.PI;
      // simple palette using alpha only (no hard-coded different colors)
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.fillStyle = PALETTE[idx % PALETTE.length];
      ctx.arc(cx,cy,r,ang,a2);
      ctx.closePath();
      ctx.fill();
      ang = a2;
    });

    // hole
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.arc(cx,cy,r2,0,2*Math.PI);
    ctx.fill();

    // total text
    ctx.fillStyle = "rgba(0,0,0,.80)";
    ctx.font = `${14*devicePixelRatio}px ui-sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Total", cx, cy-4*devicePixelRatio);
    ctx.font = `${16*devicePixelRatio}px ui-sans-serif`;
    ctx.fillText(money(total), cx, cy+18*devicePixelRatio);
    ctx.textAlign = "start";
  }

  function renderLegend(el, entries){
    el.innerHTML = "";
    entries.forEach((e, idx)=>{
      const div = document.createElement("div");
      div.className = "dp-legendItem";
      div.innerHTML = `<span class="dp-dot" style="background: rgba(185,28,28,${0.25 + (idx%5)*0.12})"></span>${e.label}: ${money(e.value)}`;
      el.appendChild(div);
    });
  }

  function renderRows(el, rows){
    el.innerHTML = "";
    if(!rows.length){
      el.innerHTML = `<div class="dp-row"><div class="dp-row__l"><div class="dp-row__t">Sin datos</div><div class="dp-row__s">—</div></div><div class="dp-row__r">—</div></div>`;
      return;
    }
    for(const r of rows){
      const row = document.createElement("div");
      row.className = "dp-row";
      row.innerHTML = `
        <div class="dp-row__l">
          <div class="dp-row__t">${r.title}</div>
          <div class="dp-row__s">${r.sub}</div>
        </div>
        <div class="dp-row__r">${r.right}</div>
      `;
      el.appendChild(row);
    }
  }

  function getClientName(st, id){
    const c = (st.clients||[]).find(x=>x.id===id);
    return c ? c.name : "Mostrador";
  }
  function getProductName(st, pid){
    const p = (st.products||[]).find(x=>x.id===pid);
    return p ? p.name : (pid==="SERV" ? "Servicio" : pid);
  }

  function refresh(){
    const st = getStateSafe();
    if(!st) return;

    // ranges
    const todayISO = new Date().toISOString().slice(0,10);
    const days7 = rangeDays(7);
    const from7 = days7[0];
    const to7 = days7[6];

    // month
    const now = new Date();
    const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTo = new Date(now.getFullYear(), now.getMonth()+1, 0);
    const fromM = ymd(monthFrom);
    const toM = ymd(monthTo);

    const sumToday = summarizeSales(st, todayISO, todayISO);
    const sum7 = summarizeSales(st, from7, to7);
    const sumM = summarizeSales(st, fromM, toM);

    // KPIs
    const totalToday = sumToday.sales.reduce((a,b)=>a+Number(b.total||0),0);
    const total7 = sum7.sales.reduce((a,b)=>a+Number(b.total||0),0);
    const totalM = sumM.sales.reduce((a,b)=>a+Number(b.total||0),0);

    $("#dp-kpi-sales-today").textContent = money(totalToday);
    $("#dp-kpi-sales-today-hint").textContent = `Rango: ${todayISO}`;
    $("#dp-kpi-sales-7").textContent = money(total7);
    $("#dp-kpi-sales-month").textContent = money(totalM);
    $("#dp-kpi-sales-month-hint").textContent = `Mes: ${fromM.slice(0,7)}`;

    const low = lowStock(st, 5);
    $("#dp-kpi-lowstock").textContent = String(low.length);
    $("#dp-kpi-lowstock-th").textContent = "5";

    // Chart 7d
    const vals7 = days7.map(d => Number(sum7.totalsByDay[d]||0));
    drawBarChart($("#dp-chart-7d"), days7, vals7);

    // Payment donut + legend
    const pmEntries = Object.entries(sum7.payTotals)
      .map(([k,v])=>({ label: (k||"efectivo").toUpperCase(), value: Number(v||0) }))
      .sort((a,b)=>b.value-a.value);
    drawDonut($("#dp-chart-pay"), pmEntries.length?pmEntries:[{label:"EFECTIVO", value:0}]);
    renderLegend($("#dp-legend-pay"), pmEntries.length?pmEntries:[{label:"EFECTIVO", value:0}]);

    // Membership stats
    const ms = membershipStats(st);
    $("#dp-m-active").textContent = String(ms.active);
    $("#dp-m-soon").textContent = String(ms.soon);
    $("#dp-m-expired").textContent = String(ms.expired);

    const mRows = ms.soonList.map(m=>{
      const cn = getClientName(st, m.clientId);
      const right = `${m.end}`;
      const sub = `${m.planName || "Membresía"} · Inicia: ${m.start} · ${Math.max(0,m._diff)} día(s)`;
      return { title: cn, sub, right };
    });
    renderRows($("#dp-m-list"), mRows);

    // Top products 7d by qty (exclude SERV)
    const top = Object.entries(sum7.qtyByProduct)
      .filter(([pid])=>pid!=="SERV")
      .map(([pid,qty])=>({ pid, qty:Number(qty||0) }))
      .sort((a,b)=>b.qty-a.qty)
      .slice(0,10);

    const topRows = top.map(t=>{
      const p = (st.products||[]).find(x=>x.id===t.pid);
      const cat = p?.category ? ` · ${p.category}` : "";
      return {
        title: getProductName(st, t.pid),
        sub: `Piezas: ${t.qty}${cat}`,
        right: ""
      };
    });
    renderRows($("#dp-top-products"), topRows);
  }

  // init
  const btn = $("#dp-dash-refresh");
  if(btn) btn.addEventListener("click", refresh);

  // Re-render charts on window resize (debounced to avoid loops)
  let _rz;
  window.addEventListener("resize", ()=>{
    clearTimeout(_rz);
    _rz = setTimeout(()=>{ try{ refresh(); }catch(e){ console.warn(e); } }, 120);
  });

  refresh();
})();
