(function(){
  const $ = (id)=>document.getElementById(id);
  const money = (n)=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
  const isoToday = ()=> new Date().toISOString().slice(0,10);

  function st(){ return dpLoad() || dpDefaultState(); }
  function save(s){ dpSave(s); }

  function ensureArrays(s){
    s.expenses = Array.isArray(s.expenses) ? s.expenses : [];
    s.expenseCategories = Array.isArray(s.expenseCategories) && s.expenseCategories.length ? s.expenseCategories
      : ['servicios','renta','sueldos','insumos','mantenimiento','otros'];
    return s;
  }

  function openModal(){ $('g-catModal').setAttribute('aria-hidden','false'); renderCatChips(); $('g-newCat').value=''; $('g-newCat').focus(); }
  function closeModal(){ $('g-catModal').setAttribute('aria-hidden','true'); }

  function renderCategories(){
    const s = ensureArrays(st());
    const sel = $('g-categoria');
    sel.innerHTML = '';
    s.expenseCategories.forEach(c=>{
      const o=document.createElement('option');
      o.value=c; o.textContent=c;
      sel.appendChild(o);
    });
  }

  function renderCatChips(){
    const s = ensureArrays(st());
    const wrap = $('g-catChips');
    wrap.innerHTML = '';
    s.expenseCategories.forEach(c=>{
      const chip=document.createElement('div');
      chip.className='chip';
      chip.innerHTML = `${c} <button class="btn btn--ghost btn--mini" data-del="${c}" type="button">✕</button>`;
      wrap.appendChild(chip);
    });
    wrap.querySelectorAll('button[data-del]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const cat = btn.getAttribute('data-del');
        const s2 = ensureArrays(st());
        s2.expenseCategories = s2.expenseCategories.filter(x=>x!==cat);
        if(!s2.expenseCategories.length) s2.expenseCategories=['otros'];
        save(s2);
        renderCategories();
        renderCatChips();
      });
    });
  }

  function addCategory(){
    const name = ($('g-newCat').value||'').trim().toLowerCase();
    if(!name) return;
    const s = ensureArrays(st());
    if(!s.expenseCategories.includes(name)) s.expenseCategories.push(name);
    save(s);
    $('g-newCat').value='';
    renderCategories();
    renderCatChips();
  }

  function clearForm(){
    $('g-fecha').value = isoToday();
    $('g-categoria').value = $('g-categoria').options[0]?.value || 'otros';
    $('g-desc').value = '';
    $('g-monto').value = '';
    $('g-pago').value = 'efectivo';
    $('g-notas').value = '';
    $('g-desc').focus();
  }

  function saveExpense(){
    const fecha = $('g-fecha').value || isoToday();
    const categoria = $('g-categoria').value || 'otros';
    const desc = ($('g-desc').value||'').trim();
    const monto = Number($('g-monto').value||0);
    const pago = $('g-pago').value || 'efectivo';
    const notas = ($('g-notas').value||'').trim();

    if(!desc){ alert('Escribe una descripción.'); $('g-desc').focus(); return; }
    if(!(monto>0)){ alert('Ingresa un monto mayor a 0.'); $('g-monto').focus(); return; }

    const s = ensureArrays(st());
    s.expenses.unshift({
      id: dpId('G'),
      date: fecha,
      category: categoria,
      description: desc,
      amount: monto,
      payment: pago,
      notes: notas,
      createdAt: dpNowISO()
    });
    save(s);
    clearForm();
    renderTable();
    renderKPIs();
  }

  function inRange(d, desde, hasta){
    if(desde && d < desde) return false;
    if(hasta && d > hasta) return false;
    return true;
  }

  function pill(p){
    const cls = (p||'otro').toLowerCase();
    return `<span class="pillPay ${cls}">${cls}</span>`;
  }

  function renderTable(){
    const s = ensureArrays(st());
    const q = ($('g-q').value||'').trim().toLowerCase();
    const desde = $('g-desde').value || '';
    const hasta = $('g-hasta').value || '';

    const rows = s.expenses.filter(e=>{
      const hay = `${e.description||''} ${e.category||''} ${e.payment||''}`.toLowerCase();
      const qok = !q || hay.includes(q);
      const rok = inRange(e.date||'', desde, hasta);
      return qok && rok;
    });

    const tb = $('g-tbody');
    tb.innerHTML = '';
    let sum=0;

    rows.forEach(e=>{
      sum += Number(e.amount||0);
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td>${e.date||''}</td>
        <td>${e.category||''}</td>
        <td>${e.description||''}${e.notes?`<div class="muted" style="margin-top:4px;">${e.notes}</div>`:''}</td>
        <td>${pill(e.payment||'otro')}</td>
        <td class="right"><strong>${money(e.amount||0)}</strong></td>
        <td class="right"><button class="btn btn--ghost btn--mini" data-del="${e.id}" type="button">Borrar</button></td>
      `;
      tb.appendChild(tr);
    });

    $('g-count').textContent = `${rows.length} registro(s)`;
    $('g-sum').textContent = money(sum);

    tb.querySelectorAll('button[data-del]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id = btn.getAttribute('data-del');
        if(!confirm('¿Borrar este gasto?')) return;
        const s2 = ensureArrays(st());
        s2.expenses = s2.expenses.filter(x=>x.id!==id);
        save(s2);
        renderTable();
        renderKPIs();
      });
    });
  }

  function renderKPIs(){
    const s = ensureArrays(st());
    const today = isoToday();
    const month = today.slice(0,7); // YYYY-MM
    const hoy = s.expenses.filter(e=>String(e.date||'')===today).reduce((a,b)=>a+Number(b.amount||0),0);
    const mes = s.expenses.filter(e=>String(e.date||'').slice(0,7)===month).reduce((a,b)=>a+Number(b.amount||0),0);
    const total = s.expenses.reduce((a,b)=>a+Number(b.amount||0),0);
    $('g-kpi-hoy').textContent = money(hoy);
    $('g-kpi-mes').textContent = money(mes);
    $('g-kpi-total').textContent = money(total);
  }

  function setDefaultFilters(){
    const today = isoToday();
    $('g-fecha').value = today;
    $('g-desde').value = today.slice(0,7) + "-01";
    $('g-hasta').value = today;
  }



  function getFilteredRowsFromInputs(){
    const st0 = st();
    const q = ($('g-q').value || '').trim().toLowerCase();
    const desdeVal = $('g-desde').value;
    const hastaVal = $('g-hasta').value;
    const desde = desdeVal ? new Date(desdeVal + 'T00:00:00') : null;
    const hasta = hastaVal ? new Date(hastaVal + 'T23:59:59') : null;

    let rows = [...(st0.expenses || [])].sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    if(q){
      rows = rows.filter(r =>
        (r.category||'').toLowerCase().includes(q) ||
        (r.description||'').toLowerCase().includes(q) ||
        (r.payment||'').toLowerCase().includes(q) ||
        (r.notes||'').toLowerCase().includes(q)
      );
    }
    if(desde){
      rows = rows.filter(r => new Date((r.date||'') + 'T00:00:00') >= desde);
    }
    if(hasta){
      rows = rows.filter(r => new Date((r.date||'') + 'T00:00:00') <= hasta);
    }
    return rows;
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function exportExpensesCSV(){
    const rows = getFilteredRowsFromInputs();
    const esc = (v) => String(v ?? '').replace(/"/g, '""');
    const header = ['Fecha','Categoría','Descripción','Pago','Monto','Notas'];
    const lines = [header.map(h=>`"${esc(h)}"`).join(',')];
    for(const r of rows){
      const monto = Number(r.amount || 0);
      const row = [r.date||'', r.category||'', r.description||'', r.payment||'', monto, r.notes||''];
      lines.push(row.map(v=>`"${esc(v)}"`).join(','));
    }
    const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
    const desde = $('g-desde').value || 'inicio';
    const hasta = $('g-hasta').value || 'hoy';
    downloadBlob(blob, `gastos_${desde}_${hasta}.csv`);
  }

  function exportExpensesPDF(){
    const rows = getFilteredRowsFromInputs();
    const desde = $('g-desde').value || 'inicio';
    const hasta = $('g-hasta').value || 'hoy';
    const total = rows.reduce((s,r)=> s + Number(r.amount || 0), 0);

    const biz = st().business || {};
    const title = `${biz.name || 'Dinamita Gym'} — Gastos`;

    const tableRows = rows.map(r=>{
      const pago = (r.payment || '').toUpperCase();
      const monto = fmtMoney(Number(r.amount || 0));
      const desc = (r.description || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const cat = (r.category || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<tr><td>${r.date||''}</td><td>${cat}</td><td>${desc}</td><td>${pago}</td><td style="text-align:right">${monto}</td></tr>`;
    }).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"/>
      <title>${title}</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:18px;}
        h1{margin:0 0 6px;font-size:18px;}
        .meta{color:#555;font-size:12px;margin-bottom:12px;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th,td{border-bottom:1px solid #ddd;padding:6px 8px;vertical-align:top;}
        th{text-align:left;background:#f6f6f6;}
        .tot{margin-top:10px;font-weight:700;display:flex;justify-content:flex-end;gap:12px;}
        @media print{ body{padding:0} }
      </style>
    </head><body>
      <h1>${title}</h1>
      <div class="meta">Rango: <b>${desde}</b> a <b>${hasta}</b> · Registros: <b>${rows.length}</b></div>
      <table>
        <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Pago</th><th style="text-align:right">Monto</th></tr></thead>
        <tbody>${tableRows || '<tr><td colspan="5">Sin registros en el rango seleccionado.</td></tr>'}</tbody>
      </table>
      <div class="tot">Total: ${fmtMoney(total)}</div>
    </body></html>`;

    const w = window.open('', '_blank');
    if(!w){
      alert('No se pudo abrir la ventana de impresión. Revisa si tu navegador bloquea pop-ups.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(()=>{ w.print(); w.onafterprint = ()=> w.close(); }, 250);
  }
  function wire(){
    $('g-guardar').addEventListener('click', saveExpense);
    $('g-limpiar').addEventListener('click', clearForm);
    $('g-aplicar').addEventListener('click', renderTable);
    $('g-reset').addEventListener('click', ()=>{
      $('g-q').value='';
      setDefaultFilters();
      renderTable();
    });
    $('g-q').addEventListener('input', ()=>{ renderTable(); });

    $('g-catManage').addEventListener('click', openModal);
    $('g-addCat').addEventListener('click', addCategory);
    $('g-newCat').addEventListener('keydown', (e)=>{ if(e.key==='Enter') addCategory(); });

    $('g-catModal').addEventListener('click',(e)=>{
      const t=e.target;
      if(t?.getAttribute?.('data-close')==='1') closeModal();
    });
    window.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeModal(); });
  }

  // init
  const s0 = ensureArrays(st()); save(s0);
  renderCategories();
  setDefaultFilters();
  clearForm();
  renderTable();
  renderKPIs();
  wire();
})();