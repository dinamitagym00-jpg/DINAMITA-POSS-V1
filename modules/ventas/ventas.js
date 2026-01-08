/* Ventas - Dinamita POS v0
   Versión: v0.1.1
   Fecha: 2025-12-15
   Cambios:
   - Previsualización de ticket.
   - Botón para imprimir cuando se requiera.
   - Venta puede registrarse SIN imprimir ticket.
*/
(function(){
  const $ = (id)=>document.getElementById(id);

  const elSearch = $("v-search");
  const elView = $("v-view");
  const elCatalog = $("v-catalog");
  const elEmpty = $("v-empty");

  const elClient = $("v-client");
  const elPayMethod = $("v-payMethod");
  const elIVA = $("v-iva");
  const elNote = $("v-note");

  const elCart = $("v-cart");
  const elSubtotal = $("v-subtotal");
  const elIvaAmount = $("v-ivaAmount");
  const elTotal = $("v-total");

  const elSell = $("v-sell");
  const elClear = $("v-clear");
  const elStatus = $("v-status");

  const elRequireTicket = $("v-requireTicket");
  const elPreviewBtn = $("v-previewBtn");
  const elPrintBtn = $("v-printBtn");
  const elTicketPreview = $("v-ticketPreview");

  let cart = []; // [{productId, qty, price}]
  let lastSaleId = null;

  function state(){ return dpGetState(); }

  function renderClients(){
    const st = state();
    elClient.innerHTML = "";

    // Mostrador / default option
    const gen = (st.clients||[]).find(c=>c.id==="GEN");
    const optGen = document.createElement("option");
    optGen.value = "GEN";
    optGen.textContent = gen?.name || "Mostrador";
    elClient.appendChild(optGen);

    // Other clients
    (st.clients||[]).filter(c=>c.id!=="GEN").forEach(c=>{
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name || "Cliente";
      elClient.appendChild(opt);
    });

    elClient.value = "GEN";
  }

  function productCard(p){
    const div = document.createElement("div");
    div.className = "pcard";

    const img = document.createElement("div");
    img.className = "pimg";
    if(p.image){
      const im = document.createElement("img");
      im.src = p.image;
      img.appendChild(im);
    }else{
      img.textContent = "IMG";
    }

    const meta = document.createElement("div");
    meta.className = "pmeta";
    meta.innerHTML = `
      <div class="name">${p.name}</div>
      <div class="sub">
        <span>${p.sku || "—"}</span>
        <span>Stock: ${p.stock ?? 0}</span>
        <span>${p.category || "sin categoría"}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "pactions";

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = dpFmtMoney(p.price);

    const add = document.createElement("button");
    add.className = "btn btn--mini";
    add.textContent = "Agregar";
    add.onclick = ()=>addToCart(p.id);

    actions.appendChild(price);
    actions.appendChild(add);

    div.appendChild(img);
    div.appendChild(meta);
    div.appendChild(actions);

    return div;
  }

  function getMostSoldList(st){
    const ms = st.analytics?.mostSold || {};
    const pairs = Object.entries(ms).sort((a,b)=>b[1]-a[1]).slice(0, 12);
    const ids = pairs.map(([id])=>id);
    const list = ids.map(id=>st.products.find(p=>p.id===id)).filter(Boolean);
    if(list.length === 0) return (st.products||[]).slice(0, 12);
    return list;
  }

  function getRecentList(st){
    const ids = st.analytics?.recentProducts || [];
    const list = ids.map(id=>st.products.find(p=>p.id===id)).filter(Boolean);
    if(list.length === 0) return (st.products||[]).slice(0, 12);
    return list.slice(0, 12);
  }

  function renderCatalog(){
    const st = state();
    const q = (elSearch.value||"").trim();
    let list = [];

    if(q){
      list = dpFindProductByQuery(st, q);
    }else{
      if(elView.value === "top") list = getMostSoldList(st);
      else if(elView.value === "recent") list = getRecentList(st);
      else list = (st.products||[]).slice(0, 50);
    }

    elCatalog.innerHTML = "";
    if(list.length === 0){
      elEmpty.style.display = "block";
    }else{
      elEmpty.style.display = "none";
      list.forEach(p => elCatalog.appendChild(productCard(p)));
    }
  }

  function findCartItem(productId){
    return cart.find(i=>i.productId === productId);
  }

  function addToCart(productId){
    const st = state();
    const p = st.products.find(x=>x.id===productId);
    if(!p) return;

    dpSetState(s=>{ dpRecordProductViewed(s, productId); return s; });

    const it = findCartItem(productId);
    if(it) it.qty += 1;
    else cart.push({ productId, qty:1, price:Number(p.price||0) });

    renderCart();
    renderTotals();

    // Barcode behavior: clear search after add
    elSearch.value = "";
    renderCatalog();
  }

  function removeFromCart(productId){
    cart = cart.filter(i=>i.productId !== productId);
    renderCart();
    renderTotals();
  }

  function changeQty(productId, delta){
    const it = findCartItem(productId);
    if(!it) return;
    it.qty += delta;
    if(it.qty <= 0) removeFromCart(it.productId);
    renderCart();
    renderTotals();
  }

  function renderCart(){
    const st = state();
    elCart.innerHTML = "";
    if(cart.length === 0){
      const div = document.createElement("div");
      div.className = "muted";
      div.textContent = "Carrito vacío.";
      elCart.appendChild(div);
      return;
    }

    cart.forEach(it=>{
      const p = st.products.find(x=>x.id===it.productId);
      const name = p?.name || it.productId;
      const sku = p?.sku || "—";
      const stock = p?.stock ?? 0;

      const row = document.createElement("div");
      row.className = "citem";

      const left = document.createElement("div");
      left.className = "cleft";
      left.innerHTML = `
        <div class="ctitle">${name}</div>
        <div class="csub">
          <span>${sku}</span>
          <span>Inv: ${stock}</span>
          <span>${dpFmtMoney(it.price)}</span>
        </div>
      `;

      const right = document.createElement("div");

      const qty = document.createElement("div");
      qty.className = "qty";

      const minus = document.createElement("button");
      minus.className = "qbtn";
      minus.textContent = "−";
      minus.onclick = ()=>changeQty(it.productId, -1);

      const num = document.createElement("div");
      num.className = "qnum";
      num.textContent = it.qty;

      const plus = document.createElement("button");
      plus.className = "qbtn";
      plus.textContent = "+";
      plus.onclick = ()=>changeQty(it.productId, +1);

      const del = document.createElement("button");
      del.className = "btn btn--mini btn--ghost";
      del.textContent = "Quitar";
      del.onclick = ()=>removeFromCart(it.productId);

      qty.appendChild(minus);
      qty.appendChild(num);
      qty.appendChild(plus);

      right.appendChild(qty);
      right.appendChild(del);

      row.appendChild(left);
      row.appendChild(right);

      elCart.appendChild(row);
    });
  }

  function calcTotals(){
    const subtotal = cart.reduce((a,b)=>a + (b.qty*b.price), 0);
    const ivaRate = Number(elIVA.value || 0);
    const ivaAmount = subtotal * (ivaRate/100);
    const total = subtotal + ivaAmount;
    return { subtotal, ivaAmount, total, ivaRate };
  }

  function renderTotals(){
    const t = calcTotals();
    elSubtotal.textContent = dpFmtMoney(t.subtotal);
    elIvaAmount.textContent = dpFmtMoney(t.ivaAmount);
    elTotal.textContent = dpFmtMoney(t.total);
  }

  function clearCart(){
    cart = [];
    elNote.value = "";
    elIVA.value = 0;
    renderCart();
    renderTotals();
    elStatus.textContent = "";
    if(elClient) elClient.value = "GEN";
    if(elPayMethod) elPayMethod.value = "efectivo";
    if(elRequireTicket) elRequireTicket.checked = false;
  }

  function canSell(){
    if(cart.length === 0) return { ok:false, msg:"Carrito vacío." };
    const st = state();
    for(const it of cart){
      const p = st.products.find(x=>x.id===it.productId);
      if(!p) return { ok:false, msg:"Producto no encontrado." };
      if(Number(p.stock||0) < Number(it.qty||0)){
        return { ok:false, msg:`Stock insuficiente: ${p.name} (stock ${p.stock})` };
      }
    }
    return { ok:true, msg:"" };
  }

  function getClientName(st, clientId){
    const c = (st.clients||[]).find(x=>x.id===clientId);
    return c?.name || "Mostrador";
  }

  function makeTicketFromSale(sale){
    const st = state();
    const biz = (typeof dpGetBizInfo==="function") ? dpGetBizInfo() : (st.meta?.business || { name:"Dinamita Gym" });
    const tcfg = (typeof dpGetTicketCfg==="function") ? dpGetTicketCfg() : { message:"${tcfg.message}" };
    const clientName = getClientName(st, sale.clientId);

    const itemsHtml = (sale.items||[]).map(it=>{
      const p = (st.products||[]).find(x=>x.id===it.productId);
      const name = (p?.name || it.productId);
      const line = `${it.qty} x ${dpFmtMoney(it.price)}`;
      return `<div class="t-item"><div class="l">${name}</div><div class="r">${line}</div></div>`;
    }).join("");

    return `
      <div class="ticket">
        <div class="t-title">${biz.name || "Dinamita Gym"}</div>
        ${biz.logoDataUrl ? `<div class="t-center"><img class="t-logo" src="${biz.logoDataUrl}" alt="logo"></div>` : ""}
        ${biz.address ? `<div class="t-center">${biz.address}</div>` : ""}
        ${biz.phone ? `<div class="t-center">${biz.phone}</div>` : ""}
        ${biz.email ? `<div class="t-center">${biz.email}</div>` : ""}
        ${biz.social ? `<div class="t-center">${biz.social}</div>` : ""}
        <div class="t-center">Ticket: <strong>${sale.id}</strong></div>
        <div class="t-center">${sale.at}</div>
        <div class="t-hr"></div>
        <div class="t-row"><span>Cliente</span><strong>${clientName}</strong></div>
        <div class="t-row"><span>Pago</span><strong>${sale.paymentMethod || "efectivo"}</strong></div>
        ${sale.note ? `<div class="t-row"><span>Nota</span><strong>${sale.note}</strong></div>` : ""}
        <div class="t-hr"></div>
        <div class="t-items">${itemsHtml}</div>
        <div class="t-hr"></div>
        <div class="t-row"><span>Subtotal</span><strong>${dpFmtMoney(sale.subtotal)}</strong></div>
        <div class="t-row"><span>IVA</span><strong>${dpFmtMoney(sale.ivaAmount)}</strong></div>
        <div class="t-row t-big"><span>Total</span><strong>${dpFmtMoney(sale.total)}</strong></div>
        <div class="t-hr"></div>
        <div class="t-center">${tcfg.message}</div>
      </div>
    `;
  }

  function previewTicketFromCart(){
    if(cart.length === 0){
      elTicketPreview.innerHTML = `<div class="muted small">Carrito vacío. Agrega productos para previsualizar.</div>`;
      elPrintBtn.disabled = true;
      return;
    }
    const st = state();
    const clientId = elClient.value || "GEN";
    const note = (elNote.value||"").trim();
    const { subtotal, ivaAmount, total, ivaRate } = calcTotals();

    const fakeSale = {
      id: "PREVIEW",
      at: new Date().toLocaleString("es-MX"),
      clientId,
      note,
      subtotal,
      ivaRate,
      ivaAmount,
      total,
      items: cart.map(i=>({ productId:i.productId, qty:i.qty, price:i.price, total:i.qty*i.price }))
    };

    elTicketPreview.innerHTML = makeTicketFromSale(fakeSale);
    elPrintBtn.disabled = false;
  }

  function printTicketBySaleId(saleId){
    const st = state();
    const sale = (st.sales||[]).find(s=>s.id===saleId);
    if(!sale){
      elStatus.textContent = "No se encontró el ticket para imprimir.";
      return;
    }

    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Ticket ${sale.id}</title>
          <style>
            body{ margin:0; padding:12px; }
            .ticket{
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
              font-size:14px; font-weight:800; color:#111; line-height:1.35;
              width: 280px;
            }
            .ticket *{ font-weight:800; }
            .t-title{ font-weight:900; text-align:center; font-size:15px; }
            .t-center{ text-align:center; }
            .t-row{ display:flex; justify-content:space-between; gap:10px; }
            .t-hr{ border-top:1px dashed #999; margin:8px 0; }
            .t-items{ display:flex; flex-direction:column; gap:4px; }
            .t-item{ display:flex; justify-content:space-between; gap:10px; }
            .t-item .l{ flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .t-item .r{ flex:0 0 auto; font-weight:800; }
            .t-big{ font-size:16px; font-weight:900; }
            @media print{
              body{ padding:0; }
            }
          </style>
        </head>
        <body>
          ${makeTicketFromSale(sale)}
          <script>
            window.onload = () => { window.print(); window.onafterprint = () => window.close(); };
          <\/script>
        </body>
      </html>
    `;

    dpPrintHTML(html);
}

  function doSell(){
    const v = canSell();
    if(!v.ok){
      elStatus.textContent = v.msg;
      return;
    }

    const clientId = elClient.value || "GEN";
    const note = (elNote.value||"").trim();
    const { ivaRate } = calcTotals();

    dpCreateSale({ clientId, cartItems: cart, note, iva: ivaRate, paymentMethod: (elPayMethod?.value||"efectivo") });

    const after = state();
    const ticket = after.sales?.[0]?.id || null;
    lastSaleId = ticket;

    // Always show preview after selling (so you can decide to print or not)
    if(ticket){
      const sale = after.sales[0];
      elTicketPreview.innerHTML = makeTicketFromSale(sale);
      elPrintBtn.disabled = false;
    }

    clearCart();
    renderCatalog();

    // If user wants immediate print, print; else just leave preview ready
    if(ticket && elRequireTicket.checked){
      printTicketBySaleId(ticket);
      elStatus.textContent = `Venta realizada e impresa: ${ticket}`;
    }else{
      elStatus.textContent = ticket ? `Venta registrada (sin imprimir): ${ticket}` : "Venta registrada.";
    }
  }

  function handleSearchInput(){
    const q = (elSearch.value||"").trim();
    const st = state();
    const exact = st.products.find(p => String(p.barcode||"") === q);
    if(exact){
      addToCart(exact.id);
      return;
    }
    renderCatalog();
  }

  function handlePrint(){
    // Print last sale if exists, else print preview (requires cart preview already)
    const st = state();
    if(lastSaleId){
      printTicketBySaleId(lastSaleId);
      return;
    }
    // if no last sale, try preview
    previewTicketFromCart();
    // printing preview uses the PREVIEW ticket, but we print the HTML in preview area
    // We'll open window with the current preview HTML
    const previewHtml = elTicketPreview.innerHTML;
    dpPrintHTML(html);
}

  // Init
  renderClients();
  if(elView) elView.value = "all";
  if(elClient) elClient.value = "GEN";
  if(elPayMethod) elPayMethod.value = "efectivo";
  if(elRequireTicket) elRequireTicket.checked = false;
  renderCatalog();
  // Defaults on enter
  if(elClient){ elClient.value = (Array.from(elClient.options).some(o=>o.value==="GEN") ? "GEN" : (elClient.options[0]?.value||"")); }
  if(elPayMethod){ elPayMethod.value = "efectivo"; }
  if(elRequireTicket){ elRequireTicket.checked = false; }
  renderCatalog();
  renderCart();
  renderTotals();

  elSearch.addEventListener("input", handleSearchInput);
  elView.addEventListener("change", renderCatalog);
  elIVA.addEventListener("input", renderTotals);
  elClear.addEventListener("click", clearCart);
  elSell.addEventListener("click", doSell);

  elPreviewBtn.addEventListener("click", previewTicketFromCart);
  elPrintBtn.addEventListener("click", handlePrint);
    // Defaults
    if(elClient){ elClient.value = (Array.from(elClient.options).some(o=>o.value==="GEN") ? "GEN" : (elClient.options[0]?.value||"")); }
    if(elPayMethod){ elPayMethod.value = "efectivo"; }
    if(elRequireTicket){ elRequireTicket.checked = false; }
  })();
// === Print helper (works better on Android/Tablet) ===
function dpPrintHTML(html){
  // Remove any previous print frame
  const prev = document.getElementById("dp-print-frame");
  if(prev) prev.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "dp-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  // Keep it in DOM but off-screen (Android Chrome prints blank if iframe is display:none)
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const tryPrint = () => {
    try{
      iframe.contentWindow.focus();
      // Some Android devices need a tiny delay after focus
      setTimeout(()=>iframe.contentWindow.print(), 50);
    }catch(err){
      console.warn("Print error", err);
    }
    // Cleanup (onafterprint is unreliable on mobile)
    setTimeout(()=>{ try{ iframe.remove(); }catch(e){} }, 2000);
  };

  // Wait a bit to ensure layout is ready
  iframe.onload = () => setTimeout(tryPrint, 200);
  setTimeout(tryPrint, 450);
}


