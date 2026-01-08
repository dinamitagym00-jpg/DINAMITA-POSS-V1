/* Bodega - Dinamita POS v0
   Versión: v0.1.0
   Fecha: 2025-12-15
   - Entradas registradas como movimientos.
   - Afecta stock en Inventario.
*/
(function(){
  const $ = (id)=>document.getElementById(id);

  const elForm = $("b-form");
  const elMode = $("b-mode");
  const elId = $("b-id");

  const elImageFile = $("b-imageFile");
  const elThumb = $("b-thumb");

  const elProductSearch = $("b-productSearch");
  const elPick = $("b-pick");
  const elProductId = $("b-productId");
  const elPickedLabel = $("b-pickedLabel");

  const elQty = $("b-qty");
  const elUnitCost = $("b-unitCost");
  const elSupplier = $("b-supplier");
  const elDate = $("b-date");
  const elNotes = $("b-notes");

  const elReset = $("b-reset");
  const elStatus = $("b-status");

  const elSearch = $("b-search");
  const elList = $("b-list");
  const elEmpty = $("b-empty");

  let currentImageDataUrl = "";

  function state(){ return dpGetState(); }

  function setThumb(dataUrl){
    currentImageDataUrl = dataUrl || "";
    elThumb.innerHTML = "";
    if(currentImageDataUrl){
      const img = document.createElement("img");
      img.src = currentImageDataUrl;
      elThumb.appendChild(img);
    }else{
      elThumb.textContent = "IMG";
    }
  }

  function resetForm(){
    elId.value = "";
    elMode.textContent = "Modo: Alta";
    elImageFile.value = "";
    setThumb("");

    elProductSearch.value = "";
    elProductId.value = "";
    elPick.style.display = "none";
    elPick.innerHTML = "";
    elPickedLabel.textContent = "";

    elQty.value = 1;
    elUnitCost.value = 0;
    elSupplier.value = "";
    elDate.value = new Date().toISOString().slice(0,10);
    elNotes.value = "";
    elStatus.textContent = "";
  }

  function showPicker(list){
    if(!list || list.length === 0){
      elPick.style.display = "none";
      elPick.innerHTML = "";
      return;
    }
    elPick.style.display = "block";
    elPick.innerHTML = "";
    list.slice(0, 8).forEach(p=>{
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `
        <div><strong>${p.name}</strong></div>
        <div class="sub">
          <span>${p.sku || "—"}</span>
          <span>Stock: ${p.stock ?? 0}</span>
          <span>${p.category || "sin categoría"}</span>
        </div>
      `;
      btn.onclick = ()=>pickProduct(p.id);
      elPick.appendChild(btn);
    });
  }

  function pickProduct(productId){
    const st = state();
    const p = (st.products||[]).find(x=>x.id===productId);
    if(!p) return;
    elProductId.value = p.id;
    elProductSearch.value = `${p.name} (${p.sku || p.id})`;
    elPickedLabel.textContent = `Seleccionado: ${p.name} | Piso: ${p.stock ?? 0} | Bodega: ${Number(state().warehouse?.stock?.[p.id] || 0)}`;
    elPick.style.display = "none";
    elPick.innerHTML = "";
  }

  function handleProductSearch(){
    const q = (elProductSearch.value||"").trim();
    elProductId.value = "";
    elPickedLabel.textContent = "";
    if(!q){ showPicker([]); return; }
    const st = state();
    const list = dpFindProductByQuery(st, q);
    showPicker(list);
  }

  function saveEntry(){
    const productId = (elProductId.value||"").trim();
    if(!productId){
      elStatus.textContent = "Selecciona un producto de la lista (picker).";
      return;
    }
    const qty = Number(elQty.value||0);
    if(!Number.isFinite(qty) || qty <= 0){
      elStatus.textContent = "Cantidad inválida.";
      return;
    }

    const payload = {
      productId,
      qty,
      unitCost: Number(elUnitCost.value||0),
      supplier: (elSupplier.value||"").trim(),
      date: elDate.value || new Date().toISOString().slice(0,10),
      notes: (elNotes.value||"").trim(),
      imageDataUrl: currentImageDataUrl || ""
    };

    const id = (elId.value||"").trim();
    if(id){
      dpUpdateWarehouseEntry(id, {
        qty: payload.qty,
        unitCost: payload.unitCost,
        supplier: payload.supplier,
        date: payload.date,
        notes: payload.notes,
        image: payload.imageDataUrl
      });
      elStatus.textContent = "Movimiento actualizado.";
    }else{
      dpCreateWarehouseEntry(payload);
      elStatus.textContent = "Entrada registrada en bodega (no suma a inventario).";
    }

    renderList();
    resetForm();
  }

  function movementCard(mv){
    const st = state();
    const p = (st.products||[]).find(x=>x.id===mv.productId);
    const name = p?.name || mv.productId;
    const sku = p?.sku || "—";
    const imgUrl = mv.image || p?.image || "";

    const div = document.createElement("div");
    div.className = "mcard";

    const img = document.createElement("div");
    img.className = "mimg";
    if(imgUrl){
      const im = document.createElement("img");
      im.src = imgUrl;
      img.appendChild(im);
    }else{
      img.textContent = "IMG";
    }

    const meta = document.createElement("div");
    meta.className = "mmeta";
    meta.innerHTML = `
      <div class="title">${name}</div>
      <div class="sub">
        <span>Folio: ${mv.id}</span>
        <span>${mv.date || ""}</span>
        <span>+${Number(mv.qty||0)} pzs</span>
      </div>
      <div class="sub">
        <span>${sku}</span>
        ${mv.supplier ? `<span>Prov: ${mv.supplier}</span>` : ""}
        ${Number(mv.unitCost||0) ? `<span>Cost: ${dpFmtMoney(mv.unitCost||0)}</span>` : ""}
      </div>
      ${mv.notes ? `<div class="sub"><span>Nota: ${mv.notes}</span></div>` : ""}
    `;

    const actions = document.createElement("div");
    actions.className = "mactions";

    const edit = document.createElement("button");
    edit.className = "btn btn--ghost btn--mini";
    edit.textContent = "Editar";
    edit.onclick = ()=>{
      elId.value = mv.id;
      elMode.textContent = "Modo: Edición";
      elQty.value = Number(mv.qty||1);
      elUnitCost.value = Number(mv.unitCost||0);
      elSupplier.value = mv.supplier || "";
      elDate.value = mv.date || new Date().toISOString().slice(0,10);
      elNotes.value = mv.notes || "";
      setThumb(mv.image || "");

      const p2 = (st.products||[]).find(x=>x.id===mv.productId);
      if(p2){
        elProductId.value = p2.id;
        elProductSearch.value = `${p2.name} (${p2.sku || p2.id})`;
        elPickedLabel.textContent = `Seleccionado: ${p2.name} | Stock actual: ${p2.stock ?? 0}`;
      }else{
        elProductId.value = mv.productId;
        elProductSearch.value = mv.productId;
      }
      elPick.style.display = "none";
      elPick.innerHTML = "";
      window.scrollTo({top:0, behavior:"smooth"});
    };

    const add = document.createElement("button");
    add.className = "btn btn--ghost btn--mini";
    add.textContent = "Agregar";
    add.onclick = ()=>{
      const v = prompt("¿Cuánta mercancía agregar?", "1");
      if(v === null) return;
      const n = Number(v);
      if(!Number.isFinite(n) || n <= 0){ alert("Cantidad inválida"); return; }
      dpCreateWarehouseEntry({
        productId: mv.productId,
        qty: n,
        unitCost: Number(mv.unitCost||0),
        supplier: mv.supplier || "",
        date: new Date().toISOString().slice(0,10),
        notes: "",
        imageDataUrl: mv.image || ""
      });
      renderList();
    };

    const transfer = document.createElement("button");
    transfer.className = "btn btn--ghost btn--mini";
    transfer.textContent = "Enviar a Inventario";
    transfer.onclick = ()=>{
      const st2 = state();
      const available = Number(st2.warehouse?.stock?.[mv.productId] || 0);
      if(available <= 0){ alert("No hay stock en bodega para transferir."); return; }
      const v = prompt(`¿Cuántas piezas enviar a Inventario? (Disponible en bodega: ${available})`, String(Math.min(available, Number(mv.qty||1))));
      if(v === null) return;
      const n = Number(v);
      if(!Number.isFinite(n) || n <= 0){ alert("Cantidad inválida"); return; }
      if(n > available){ alert("No puedes transferir más de lo que hay en bodega."); return; }
      dpTransferFromWarehouse({ productId: mv.productId, qty: n, notes: "" });
      renderList();
      alert("Traspaso realizado: Bodega → Inventario.");
    };

    const del = document.createElement("button");
    del.className = "btn btn--mini";
    del.textContent = "Borrar";
    del.onclick = ()=>{
      if(!confirm(`¿Borrar movimiento ${mv.id}? Esto restará el stock en bodega (no afecta inventario).`)) return;
      dpDeleteWarehouseEntry(mv.id);
      renderList();
      resetForm();
    };

    actions.appendChild(edit);
    actions.appendChild(add);
    actions.appendChild(transfer);
    actions.appendChild(del);

    div.appendChild(img);
    div.appendChild(meta);
    div.appendChild(actions);

    return div;
  }

  function renderList(){
    const st = state();
    const q = (elSearch.value||"").trim().toLowerCase();
    let list = st.warehouse?.movements || [];

    if(q){
      list = list.filter(mv=>{
        const p = (st.products||[]).find(x=>x.id===mv.productId);
        const name = (p?.name||"").toLowerCase();
        const sku = (p?.sku||"").toLowerCase();
        return (mv.id||"").toLowerCase().includes(q) ||
               (mv.supplier||"").toLowerCase().includes(q) ||
               name.includes(q) || sku.includes(q);
      });
    }

    elList.innerHTML = "";
    if(!list || list.length === 0){
      elEmpty.style.display = "block";
      return;
    }
    elEmpty.style.display = "none";
    list.slice(0, 200).forEach(mv=> elList.appendChild(movementCard(mv)));
  }

  elImageFile.addEventListener("change", (e)=>{
    const file = e.target.files?.[0];
    if(!file){ setThumb(currentImageDataUrl); return; }
    if(!file.type.startsWith("image/")){
      alert("Archivo no es imagen.");
      elImageFile.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = ()=> setThumb(String(reader.result||""));
    reader.readAsDataURL(file);
  });

  elProductSearch.addEventListener("input", handleProductSearch);
  elForm.addEventListener("submit", (e)=>{ e.preventDefault(); saveEntry(); });
  elReset.addEventListener("click", resetForm);
  elSearch.addEventListener("input", renderList);

  resetForm();
  renderList();
})();
