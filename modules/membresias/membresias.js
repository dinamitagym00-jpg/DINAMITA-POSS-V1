/* Membresías - Dinamita POS v0 (restructurado)
   - Catálogo editable: nombre, días, precio
   - Cliente con súper buscador (picker)
   - Cobro = venta tipo servicio (sin inventario) + registro de membresía ligado a ticket
*/
(function(){
  const $ = (id)=>document.getElementById(id);

  // Catalog
  const mcToggle = $("mc-toggle");
  const mcCard = $("mc-card");
  const mcForm = $("mc-form");
  const mcId = $("mc-id");
  const mcName = $("mc-name");
  const mcDays = $("mc-days");
  const mcPrice = $("mc-price");
  const mcClear = $("mc-clear");
  const mcStatus = $("mc-status");
  const mcList = $("mc-list");

  // Enrollment
  const mClientSearch = $("m-clientSearch");
  const mClientPick = $("m-clientPick");
  const mClientId = $("m-clientId");
  const mClientPicked = $("m-clientPicked");

  const mPlan = $("m-plan");
  const mOpenCatalog = $("m-openCatalog");
  const mPlanHint = $("m-planHint");
  const mDays = $("m-days");
  const mStart = $("m-start");
  const mEnd = $("m-end");
  const mPrice = $("m-price");
  const mNotes = $("m-notes");
  const mStatus = $("m-status");

  const mClear = $("m-clear");
  const mSave = $("m-save");
  const mCharge = $("m-charge");

  const mMakeTicket = $("m-makeTicket");
  const mPrint = $("m-print");
  const mTicketPreview = $("m-ticketPreview");

  // List
  const mSearch = $("m-search");
  const mFrom = $("m-from");
  const mTo = $("m-to");
  const mExportCsv = $("m-exportCsv");
  const mExportPdf = $("m-exportPdf");
  const mList = $("m-list");
  const mEmpty = $("m-empty");

  let lastTicketHtml = "";
  let lastTicketTitle = "Ticket";

  function state(){ return dpGetState(); }
  function fmtMoney(n){ return dpFmtMoney ? dpFmtMoney(n) : ("$"+Number(n||0).toFixed(2)); }
  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  // ---------- Catalog ----------
  function toggleCatalog(show=null){
    const isOpen = mcCard.style.display !== "none";
    const next = show===null ? !isOpen : !!show;
    mcCard.style.display = next ? "block" : "none";
  }

  function resetCatalogForm(){
    mcId.value = "";
    mcName.value = "";
    mcDays.value = 30;
    mcPrice.value = 0;
    mcStatus.textContent = "";
  }

  function renderCatalog(){
    const list = dpGetMembershipCatalog();
    mcList.innerHTML = "";
    list.slice(0, 500).forEach(p=>{
      const div = document.createElement("div");
      div.className = "citem";
      div.innerHTML = `
        <div class="cleft">
          <div class="ctitle">${escapeHtml(p.name || "")}</div>
          <div class="cmeta">
            <span class="pill">${Number(p.days||0)} días</span>
            <span class="pill">${fmtMoney(p.price||0)}</span>
            <span class="pill">ID: ${p.id}</span>
          </div>
        </div>
        <div class="cactions"></div>
      `;
      const actions = div.querySelector(".cactions");

      const edit = document.createElement("button");
      edit.className = "btn btn--ghost";
      edit.textContent = "Editar";
      edit.onclick = ()=>{
        mcId.value = p.id;
        mcName.value = p.name || "";
        mcDays.value = Number(p.days||0) || 1;
        mcPrice.value = Number(p.price||0) || 0;
        mcStatus.textContent = "Editando: " + p.id;
        window.scrollTo({top:0, behavior:"smooth"});
      };

      const del = document.createElement("button");
      del.className = "btn";
      del.textContent = "Borrar";
      del.onclick = ()=>{
        if(!confirm(`¿Borrar tipo "${p.name}"?`)) return;
        dpDeleteMembershipPlan(p.id);
        renderCatalog();
        loadPlans();
      };

      actions.appendChild(edit);
      actions.appendChild(del);
      mcList.appendChild(div);
    });
  }

  function saveCatalog(e){
    e.preventDefault();
    const name = (mcName.value||"").trim();
    const days = Number(mcDays.value||0);
    const price = Number(mcPrice.value||0);
    if(!name){ mcStatus.textContent = "Nombre requerido."; return; }
    if(!Number.isFinite(days) || days<=0){ mcStatus.textContent = "Días inválidos."; return; }
    if(!Number.isFinite(price) || price<0){ mcStatus.textContent = "Precio inválido."; return; }

    if(mcId.value){
      dpUpdateMembershipPlan(mcId.value, { name, days, price });
      mcStatus.textContent = "Tipo actualizado.";
    }else{
      dpAddMembershipPlan({ name, days, price });
      mcStatus.textContent = "Tipo agregado.";
    }
    renderCatalog();
    loadPlans();
    resetCatalogForm();
  }

  // ---------- Client search ----------
  function getClients(){
    const st = state();
    const base = (st.clients && st.clients.length) ? st.clients : [{id:"GEN", name:"Cliente General", phone:""}];
    return base.map(c=>({
      ...c,
      _search: `${(c.name||"").toLowerCase()} ${(c.phone||"").toLowerCase()} ${(c.id||"").toLowerCase()}`
    }));
  }

  function showClientPicker(list){
    if(!list || list.length===0){
      mClientPick.style.display = "none";
      mClientPick.innerHTML = "";
      return;
    }
    mClientPick.style.display = "block";
    mClientPick.innerHTML = "";
    list.slice(0, 8).forEach(c=>{
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `
        <div><strong>${escapeHtml(c.name||"")}</strong></div>
        <div class="sub">
          <span>ID: ${escapeHtml(c.id||"")}</span>
          <span>${escapeHtml(c.phone||"")}</span>
        </div>
      `;
      btn.onclick = ()=>pickClient(c.id);
      mClientPick.appendChild(btn);
    });
  }

  function pickClient(id){
    const c = getClients().find(x=>x.id===id);
    if(!c) return;
    mClientId.value = c.id;
    mClientSearch.value = c.name || c.id;
    mClientPicked.textContent = `Seleccionado: ${c.name || c.id} ${c.phone ? " | "+c.phone : ""}`;
    showClientPicker([]);
  }

  function onClientSearch(){
    const q = (mClientSearch.value||"").trim().toLowerCase();
    mClientId.value = "";
    mClientPicked.textContent = "";
    if(!q){ showClientPicker([]); return; }
    const list = getClients().filter(c=>c._search.includes(q));
    showClientPicker(list);
  }

  // ---------- Plans selection ----------
  function loadPlans(){
    const list = dpGetMembershipCatalog();
    mPlan.innerHTML = "";
    list.forEach(p=>{
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.days} días) - ${fmtMoney(p.price)}`;
      mPlan.appendChild(opt);
    });
    if(list.length){
      mPlan.value = list[0].id;
      syncPlanFields();
    }else{
      mDays.value = "";
      mPrice.value = "";
      mPlanHint.textContent = "No hay tipos. Agrega uno en Catálogo.";
    }
  }

  function syncPlanFields(){
    const plan = dpFindMembershipPlanById(mPlan.value);
    if(!plan){
      mPlanHint.textContent = "Plan no encontrado.";
      return;
    }
    mDays.value = String(Number(plan.days||0));
    mPrice.value = String(Number(plan.price||0));
    mPlanHint.textContent = `Duración: ${plan.days} días | Precio: ${fmtMoney(plan.price)}`;
    recalcEnd();
  }

  function recalcEnd(){
    if(!mStart.value) return;
    const s = new Date(mStart.value);
    if(isNaN(s.getTime())) return;
    s.setDate(s.getDate() + Number(mDays.value||0));
    mEnd.value = s.toISOString().slice(0,10);
  }

  // ---------- Ticket helpers ----------
  function getConfig(){
    const st = state();
    const cfg = st.config || {};
    const biz = cfg.business || {};
    const ticket = cfg.ticket || {};
    return {
      name: biz.name || "DINÁMITA GYM",
      address: biz.address || "",
      phone: biz.phone || "",
      message: ticket.message || "Gracias por tu compra en Dinamita Gym 💥",
      ivaLabel: ticket.ivaLabel || "IVA: 0%"
    };
  }

  function getClientName(clientId){
    const st = state();
    const c = (st.clients||[]).find(x=>x.id===clientId);
    if(c) return c.name;
    if(clientId === "GEN") return "Cliente General";
    return clientId || "Cliente";
  }

  function buildTicketHtmlFromSale(sale){
    const cfg = getConfig();
    const clientName = getClientName(sale.clientId);
    const item = sale.items?.[0];
    const concept = item?.name || "Servicio";
    const price = item?.price ?? sale.total;

    
    const ms = (sale.meta && sale.meta.kind==="membership") ? (sale.meta.startDate || "") : "";
    const me = (sale.meta && sale.meta.kind==="membership") ? (sale.meta.endDate || "") : "";
const lines = [
      cfg.name,
      cfg.address,
      cfg.phone ? ("Tel: " + cfg.phone) : "",
      "------------------------------",
      "TICKET: " + sale.id,
      "Fecha: " + (sale.at || "").replace("T"," ").slice(0,19),
      "Cliente: " + clientName,
      "------------------------------",
      concept,
      (ms ? ("Inicio: " + ms) : ""),
      (me ? ("Fin: " + me) : ""),
      "Total: " + fmtMoney(price),
      cfg.ivaLabel,
      "------------------------------",
      cfg.message
    ].filter(Boolean);

    const pre = lines.join("\n");
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${sale.id}</title>
<style>
  body{ font-family: ui-monospace, Menlo, Consolas, monospace; padding:12px; }
  .ticket{ max-width:320px; }
  pre{ white-space:pre-wrap; font-size:12px; line-height:1.25; margin:0; }
  @media print{ body{ padding:0; } }
</style>
</head>
<body>
<div class="ticket"><pre>${escapeHtml(pre)}</pre></div>
<script>window.focus();</script>
</body>
</html>`;

    return { pre, html, title: sale.id };
  }

  function openPrintWindow(html, title){
    const w = window.open("", "_blank", "width=400,height=650");
    if(!w){ alert("Tu navegador bloqueó la ventana emergente."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = title || "Ticket";
    w.focus();
    w.print();
  }

  // ---------- Actions ----------
  function resetForm(){
    mClientSearch.value = "";
    mClientId.value = "";
    mClientPicked.textContent = "";
    showClientPicker([]);

    mStart.value = new Date().toISOString().slice(0,10);
    syncPlanFields();
    mNotes.value = "";
    mStatus.textContent = "";
    mTicketPreview.textContent = "Sin ticket.";
    lastTicketHtml = "";
    mPrint.disabled = true;
  }

  function ensureClientSelected(){
    if(mClientId.value) return true;
    const typed = (mClientSearch.value||"").trim();
    if(!typed){
      alert("Selecciona un cliente.");
      return false;
    }
    if(typed.toLowerCase().includes("general") || typed.toLowerCase()==="gen"){
      mClientId.value = "GEN";
      return true;
    }
    alert("Selecciona el cliente desde el buscador (picker).");
    return false;
  }

  function saveOnly(){
    if(!ensureClientSelected()) return;
    const plan = dpFindMembershipPlanById(mPlan.value);
    if(!plan){ alert("Selecciona un tipo de membresía."); return; }

    dpCreateMembership({
      clientId: mClientId.value,
      planId: plan.id,
      planName: plan.name,
      days: Number(plan.days||0),
      startDate: mStart.value,
      notes: (mNotes.value||"").trim(),
      price: Number(plan.price||0),
      saleTicketId: ""
    });
    mStatus.textContent = "Membresía guardada (sin cobro).";
    renderList();
  }

  function charge(){
    if(!ensureClientSelected()) return;
    const plan = dpFindMembershipPlanById(mPlan.value);
    if(!plan){ alert("Selecciona un tipo de membresía."); return; }

    const ticketId = dpChargeMembership({
      clientId: mClientId.value,
      planId: plan.id,
      startDate: mStart.value,
      notes: (mNotes.value||"").trim()
    });

    mStatus.textContent = "Membresía cobrada. Ticket: " + (ticketId||"");
    renderList();

    if(mMakeTicket.checked && ticketId){
      const sale = (state().sales||[]).find(s=>s.id===ticketId);
      if(sale){
        const t = buildTicketHtmlFromSale(sale);
        mTicketPreview.textContent = t.pre;
        lastTicketHtml = t.html;
        lastTicketTitle = t.title;
        mPrint.disabled = false;
      }
    }else{
      mTicketPreview.textContent = "Sin ticket.";
      lastTicketHtml = "";
      mPrint.disabled = true;
    }
  }

  function pillClass(endISO){
    const now = new Date();
    const e = new Date(endISO);
    const diffDays = (e - now) / 86400000;
    if(diffDays < 0) return "red";
    if(diffDays <= 5) return "orange";
    return "green";
  }

  function renderList(){
    const st = state();
    const q = (mSearch.value||"").trim().toLowerCase();
    const from = mFrom.value ? new Date(mFrom.value) : null;
    const to = mTo.value ? new Date(mTo.value) : null;

    let list = st.memberships || [];

    if(q){
      list = list.filter(m=>{
        const name = getClientName(m.clientId).toLowerCase();
        return (m.id||"").toLowerCase().includes(q) ||
               (m.clientId||"").toLowerCase().includes(q) ||
               name.includes(q) ||
               (m.saleTicketId||"").toLowerCase().includes(q) ||
               (m.planName||"").toLowerCase().includes(q);
      });
    }
    if(from){
      list = list.filter(m=> new Date(m.start) >= from);
    }
    if(to){
      const t = new Date(to);
      t.setHours(23,59,59,999);
      list = list.filter(m=> new Date(m.start) <= t);
    }

    mList.innerHTML = "";
    if(!list.length){
      mEmpty.style.display = "block";
      return;
    }
    mEmpty.style.display = "none";

    list.slice(0, 400).forEach(m=>{
      const div = document.createElement("div");
      div.className = "mcard";

      const left = document.createElement("div");
      left.className = "mleft";
      const cls = pillClass(m.end);
      left.innerHTML = `
        <div class="mtitle">${escapeHtml(getClientName(m.clientId))}</div>
        <div class="msub">
          <span class="pill ${cls}">${escapeHtml(m.planName || "Membresía")}</span>
          <span class="pill">Inicio: ${m.start}</span>
          <span class="pill">Fin: ${m.end}</span>
          <span class="pill">${m.days} días</span>
          <span class="pill">${fmtMoney(m.price||0)}</span>
          ${m.saleTicketId ? `<span class="pill">Ticket: ${m.saleTicketId}</span>` : `<span class="pill">Sin cobro</span>`}
          <span class="pill">ID: ${m.id}</span>
        </div>
        ${m.notes ? `<div class="msub"><span class="pill">Nota: ${escapeHtml(m.notes)}</span></div>` : ""}
      `;

      const actions = document.createElement("div");
      actions.className = "mactions";

      const reprint = document.createElement("button");
      reprint.className = "btn btn--ghost";
      reprint.textContent = "Reimprimir ticket";
      reprint.disabled = !m.saleTicketId;
      reprint.onclick = ()=>{
        const sale = (state().sales||[]).find(s=>s.id===m.saleTicketId);
        if(!sale){ alert("No se encontró la venta ligada."); return; }
        const t = buildTicketHtmlFromSale(sale);
        openPrintWindow(t.html, t.title);
      };

      const del = document.createElement("button");
      del.className = "btn";
      del.textContent = "Borrar membresía";
      del.onclick = ()=>{
        if(!confirm(`¿Borrar membresía ${m.id}? (No borra la venta ligada)`)) return;
        dpDeleteMembership(m.id);
        renderList();
      };

      actions.appendChild(reprint);
      actions.appendChild(del);

      div.appendChild(left);
      div.appendChild(actions);
      mList.appendChild(div);
    });
  }

  function exportCsv(){
    const st = state();
    const rows = [["id","clientId","clientName","planId","planName","days","start","end","price","saleTicketId","notes"]];
    (st.memberships||[]).forEach(m=>{
      rows.push([
        m.id,
        m.clientId,
        getClientName(m.clientId),
        m.planId,
        m.planName,
        m.days,
        m.start,
        m.end,
        m.price,
        m.saleTicketId,
        (m.notes||"").replaceAll("\n"," ")
      ]);
    });
    const csv = rows.map(r=>r.map(x=>`"${String(x??"").replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `membresias_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportPdf(){
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Membresías</title>
<style>
  body{ font-family: Arial, sans-serif; padding:16px; }
  h1{ margin:0 0 10px 0; }
  .item{ border:1px solid #ddd; border-radius:10px; padding:10px; margin-bottom:10px; }
  .pill{ border:1px solid #ddd; border-radius:999px; padding:2px 8px; }
</style>
</head>
<body>
<h1>Membresías</h1>
${Array.from(mList.children).map(n=>`<div class="item">${n.querySelector(".mleft")?.innerHTML || ""}</div>`).join("")}
<script>window.focus();</script>
</body>
</html>`;
    const w = window.open("", "_blank");
    if(!w){ alert("Tu navegador bloqueó la ventana emergente."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  // --- Events ---
  mcToggle.addEventListener("click", ()=>toggleCatalog());
  mOpenCatalog.addEventListener("click", ()=>toggleCatalog(true));
  mcClear.addEventListener("click", resetCatalogForm);
  mcForm.addEventListener("submit", saveCatalog);

  mClientSearch.addEventListener("input", onClientSearch);

  mPlan.addEventListener("change", syncPlanFields);
  mStart.addEventListener("change", recalcEnd);

  mClear.addEventListener("click", ()=>{ resetForm(); renderList(); });
  mSave.addEventListener("click", saveOnly);
  mCharge.addEventListener("click", charge);

  mPrint.addEventListener("click", ()=>{
    if(!lastTicketHtml) return;
    openPrintWindow(lastTicketHtml, lastTicketTitle);
  });

  mSearch.addEventListener("input", renderList);
  mFrom.addEventListener("change", renderList);
  mTo.addEventListener("change", renderList);
  mExportCsv.addEventListener("click", exportCsv);
  mExportPdf.addEventListener("click", exportPdf);

  // Init
  if(typeof dpEnsureSeedData === "function"){ try{ dpEnsureSeedData(); }catch(e){} }
  renderCatalog();
  loadPlans();
  mStart.value = new Date().toISOString().slice(0,10);
  syncPlanFields();
  resetForm();
  // Prefill desde módulo Acceso (si aplica)
  try{
    const preId = sessionStorage.getItem("dp_prefill_client_id");
    if(preId){
      mClientSearch.value = preId;
      pickClient(preId);
      sessionStorage.removeItem("dp_prefill_client_id");
    }
  }catch(e){}
  renderList();
})();
