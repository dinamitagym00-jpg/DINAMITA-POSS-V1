/* Inventario - Dinamita POS v0
   Versión: v0.1.0
   Fecha: 2025-12-15
   Incluye miniaturas (dataURL) para control visual.
*/
(function(){
  const $ = (id)=>document.getElementById(id);

  const elForm = $("i-form");
  const elMode = $("i-formMode");
  const elId = $("i-id");
  const elSku = $("i-sku");
  const elBarcode = $("i-barcode");
  const elName = $("i-name");
  const elCategory = $("i-category");
  const elStock = $("i-stock");
  const elPrice = $("i-price");
  const elCost = $("i-cost");
  const elExp = $("i-exp");
  const elLot = $("i-lot");
  const elImageFile = $("i-imageFile");
  const elThumb = $("i-thumb");

  const elReset = $("i-reset");
  const elStatus = $("i-status");

  const elSearch = $("i-search");
  const elList = $("i-list");
  const elEmpty = $("i-empty");

  const elExportCsv = $("i-exportCsv");
  const elExportPdf = $("i-exportPdf");

  // Categories modal
  const elCatModal = $("i-catModal");
  const elCatBackdrop = $("i-catBackdrop");
  const elCatClose = $("i-catClose");
  const elCatNew = $("i-catNew");
  const elCatAdd = $("i-catAdd");
  const elCatList = $("i-catList");
  const elManageCats = $("i-manageCats");

  let currentImageDataUrl = "";

  function state(){ return dpGetState(); }

  function categoriesFromState(st){
    const set = new Set();
    (st.meta?.categories||[]).forEach(x=>set.add(String(x)));
    (st.products||[]).forEach(p => { if(p.category) set.add(String(p.category)); });
    if(set.size === 0){
      ["suplemento","agua","accesorio"].forEach(x=>set.add(x));
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }

  function refreshCategorySelect(selected){
    const st = state();
    const cats = categoriesFromState(st);
    elCategory.innerHTML = "";
    cats.forEach(c=>{
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      if(selected && selected === c) opt.selected = true;
      elCategory.appendChild(opt);
    });
  }

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
    elSku.value = "";
    elBarcode.value = "";
    elName.value = "";
    elStock.value = 0;
    elPrice.value = 0;
    elCost.value = 0;
    elExp.value = "";
    elLot.value = "";
    elImageFile.value = "";
    setThumb("");
    refreshCategorySelect();
    elMode.textContent = "Modo: Alta";
    elStatus.textContent = "";
  }

  function fillForm(p){
    elId.value = p.id || "";
    elSku.value = p.sku || "";
    elBarcode.value = p.barcode || "";
    elName.value = p.name || "";
    refreshCategorySelect(p.category || "");
    elStock.value = Number(p.stock||0);
    elPrice.value = Number(p.price||0);
    elCost.value = Number(p.cost||0);
    elExp.value = p.expiry || "";
    elLot.value = p.lot || "";
    setThumb(p.image || "");
    elMode.textContent = "Modo: Edición";
    elStatus.textContent = `Editando: ${p.name}`;
  }

  function saveProduct(){
    const sku = (elSku.value||"").trim();
    const name = (elName.value||"").trim();
    if(!sku || !name){
      elStatus.textContent = "SKU y Nombre son obligatorios.";
      return;
    }

    const payload = {
      sku,
      barcode: (elBarcode.value||"").trim(),
      name,
      category: elCategory.value || "",
      stock: Number(elStock.value||0),
      price: Number(elPrice.value||0),
      cost: Number(elCost.value||0),
      expiry: elExp.value || "",
      lot: (elLot.value||"").trim(),
      image: currentImageDataUrl || ""
    };

    const id = (elId.value||"").trim();

    dpSetState(st=>{
      const now = dpNowISO();
      st.products = st.products || [];
      if(id){
        const p = st.products.find(x=>x.id===id);
        if(p){
          Object.assign(p, payload);
          p.updatedAt = now;
        }
      }else{
        const newId = "P" + String(Date.now()).slice(-6);
        st.products.unshift({
          id: newId,
          ...payload,
          createdAt: now,
          updatedAt: now
        });
      }
      return st;
    });

    elStatus.textContent = id ? "Producto actualizado." : "Producto agregado.";
    resetForm();
    renderList();
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
      <div class="name">${p.name || "Producto"}</div>
      <div class="sub">
        <span>${p.sku || "—"}</span>
        <span>Stock: ${p.stock ?? 0}</span>
        <span>${p.category || "sin categoría"}</span>
      </div>
      <div class="sub">
        <span>${dpFmtMoney(p.price||0)}</span>
        <span>Cost: ${dpFmtMoney(p.cost||0)}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "pactions";

    const edit = document.createElement("button");
    edit.className = "btn btn--ghost btn--mini";
    edit.textContent = "Editar";
    edit.onclick = ()=>fillForm(p);

    const addStock = document.createElement("button");
    addStock.className = "btn btn--ghost btn--mini";
    addStock.textContent = "Agregar stock";
    addStock.onclick = ()=>{
      const v = prompt("¿Cuánto stock agregar?", "1");
      if(v === null) return;
      const n = Number(v);
      if(!Number.isFinite(n) || n <= 0){ alert("Cantidad inválida"); return; }
      dpSetState(st=>{
        const prod = (st.products||[]).find(x=>x.id===p.id);
        if(prod){
          prod.stock = Number(prod.stock||0) + n;
          prod.updatedAt = dpNowISO();
        }
        return st;
      });
      renderList();
    };

    const del = document.createElement("button");
    del.className = "btn btn--mini";
    del.textContent = "Borrar";
    del.onclick = ()=>{
      if(!confirm(`¿Borrar "${p.name}"?`)) return;
      dpSetState(st=>{
        st.products = (st.products||[]).filter(x=>x.id!==p.id);
        return st;
      });
      renderList();
      resetForm();
    };

    actions.appendChild(edit);
    actions.appendChild(addStock);
    actions.appendChild(del);

    div.appendChild(img);
    div.appendChild(meta);
    div.appendChild(actions);

    return div;
  }

  function renderList(){
    const st = state();
    const q = (elSearch.value||"").trim();
    let list = st.products || [];
    if(q){
      list = dpFindProductByQuery(st, q);
    }
    elList.innerHTML = "";
    if(!list || list.length === 0){
      elEmpty.style.display = "block";
      return;
    }
    elEmpty.style.display = "none";
    list.slice(0, 200).forEach(p => elList.appendChild(productCard(p)));
  }

  function download(filename, text){
    const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 500);
  }

  function exportCsv(){
    const st = state();
    const rows = [["id","sku","barcode","name","category","price","cost","stock","expiry","lot"]];
    (st.products||[]).forEach(p=>{
      rows.push([
        p.id||"", p.sku||"", p.barcode||"", p.name||"", p.category||"",
        Number(p.price||0), Number(p.cost||0), Number(p.stock||0),
        p.expiry||"", p.lot||""
      ]);
    });
    const csv = rows.map(r => r.map(v => {
      const s = String(v ?? "");
      const esc = s.replace(/"/g,'""');
      return `"${esc}"`;
    }).join(",")).join("\n");
    download(`inventario_${new Date().toISOString().slice(0,10)}.csv`, csv);
  }

  function exportPdf(){
    const st = state();
    const html = `
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Inventario</title>
          <style>
            body{ font-family: Arial, sans-serif; padding:18px; }
            h1{ margin:0 0 10px 0; }
            .muted{ color:#777; }
            table{ width:100%; border-collapse:collapse; margin-top:12px; }
            th, td{ border:1px solid #ddd; padding:8px; font-size:12px; vertical-align:top; }
            th{ background:#f5f5f5; text-align:left; }
            .img{ width:34px; height:34px; border-radius:8px; border:1px solid #eee; object-fit:cover; }
            @media print{ body{ padding:0; } }
          </style>
        </head>
        <body>
          <h1>Inventario</h1>
          <div class="muted">Generado: ${new Date().toLocaleString("es-MX")}</div>
          <table>
            <thead>
              <tr>
                <th>IMG</th><th>Nombre</th><th>SKU</th><th>Categoría</th><th>Stock</th><th>Precio</th><th>Costo</th><th>Caducidad</th><th>Lote</th>
              </tr>
            </thead>
            <tbody>
              ${(st.products||[]).map(p => `
                <tr>
                  <td>${p.image ? `<img class="img" src="${p.image}">` : ""}</td>
                  <td>${p.name||""}</td>
                  <td>${p.sku||""}</td>
                  <td>${p.category||""}</td>
                  <td>${Number(p.stock||0)}</td>
                  <td>${dpFmtMoney(p.price||0)}</td>
                  <td>${dpFmtMoney(p.cost||0)}</td>
                  <td>${p.expiry||""}</td>
                  <td>${p.lot||""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <script>
            window.onload = () => { window.print(); };
          <\/script>
        </body>
      </html>
    `;
    const w = window.open("", "_blank");
    if(!w){ alert("Bloqueo de pop-ups: habilita ventanas emergentes para exportar PDF."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  function openCatModal(){
    renderCatList();
    elCatModal.setAttribute("aria-hidden","false");
  }
  function closeCatModal(){
    elCatModal.setAttribute("aria-hidden","true");
    elCatNew.value = "";
    refreshCategorySelect(elCategory.value);
  }

  function renderCatList(){
    const st = state();
    const cats = categoriesFromState(st);
    elCatList.innerHTML = "";
    cats.forEach(c => {
      const used = (st.products||[]).some(p => String(p.category||"") === c);
      const row = document.createElement("div");
      row.className = "catRow";
      row.innerHTML = `<div><strong>${c}</strong> ${used ? '<span class="muted small">(en uso)</span>' : ''}</div>`;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn--mini btn--ghost";
      del.textContent = "Borrar";
      del.disabled = used;
      del.onclick = ()=>{
        if(used) return;
        dpSetState(st2=>{
          st2.meta = st2.meta || {};
          st2.meta.categories = (st2.meta.categories||[]).filter(x => String(x) !== c);
          return st2;
        });
        renderCatList();
        refreshCategorySelect();
      };
      row.appendChild(del);
      elCatList.appendChild(row);
    });
  }

  function addCategory(){
    const name = (elCatNew.value||"").trim().toLowerCase();
    if(!name) return;
    dpSetState(st=>{
      st.meta = st.meta || {};
      st.meta.categories = st.meta.categories || [];
      if(!st.meta.categories.includes(name)) st.meta.categories.push(name);
      return st;
    });
    elCatNew.value = "";
    refreshCategorySelect(name);
    renderCatList();
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

  elForm.addEventListener("submit", (e)=>{ e.preventDefault(); saveProduct(); });
  elReset.addEventListener("click", resetForm);
  elSearch.addEventListener("input", renderList);
  elExportCsv.addEventListener("click", exportCsv);
  elExportPdf.addEventListener("click", exportPdf);

  elManageCats.addEventListener("click", openCatModal);
  elCatBackdrop.addEventListener("click", closeCatModal);
  elCatClose.addEventListener("click", closeCatModal);
  elCatAdd.addEventListener("click", addCategory);
  elCatNew.addEventListener("keydown", (e)=>{ if(e.key==="Enter"){ e.preventDefault(); addCategory(); } });

  refreshCategorySelect();
  resetForm();
  renderList();
})();
