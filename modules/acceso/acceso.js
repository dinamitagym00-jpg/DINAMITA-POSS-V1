/* Acceso - Dinamita POS v0 (IndexedDB local) */
(function(){
  const $ = (id)=>document.getElementById(id);
  const scan = $("a-scan");
  const status = $("a-status");
  const lastBox = $("a-last");
  const btnCheck = $("a-check");
  const btnRenew = $("a-renew");
  const btnPrint = $("a-print");
  const btnClear = $("a-clear");
  const apm = $("a-apm");
  const filter = $("a-filter");
  const btnExport = $("a-export");
  const tbody = $("a-table").querySelector("tbody");
  const btnMode = $("a-toggleMode");

  // --- helpers ---
  const fmtMoney = (n)=>"$" + (Number(n||0)).toFixed(2);

  // IMPORTANTE: NO usar toISOString() para accesos porque eso guarda en UTC.
  // Queremos que el registro quede con la hora LOCAL del dispositivo.
  const pad2 = (n)=> String(n).padStart(2,'0');
  const localDateISO = (d)=> `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const localTime = (d)=> `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  const todayISO = ()=> localDateISO(new Date());

  function state(){ return dpGetState(); }

  function getAccessSettings(){
    const st = state();
    st.meta = st.meta || {};
    st.meta.accessSettings = st.meta.accessSettings || { antiPassbackMinutes: 10 };
    return st.meta.accessSettings;
  }

  function setAccessSettings(patch){
    dpSetState(st=>{
      st.meta = st.meta || {};
      st.meta.accessSettings = st.meta.accessSettings || { antiPassbackMinutes: 10 };
      Object.assign(st.meta.accessSettings, patch||{});
      return st;
    });
  }

  function ensureAccessArrays(){
    dpSetState(st=>{
      if(!Array.isArray(st.accessLogs)) st.accessLogs = [];
      st.meta = st.meta || {};
      st.meta.accessSettings = st.meta.accessSettings || { antiPassbackMinutes: 10 };
      return st;
    });
  }

  function findClientByToken(token){
    const st = state();
    const t = String(token||"").trim();
    if(!t) return null;
    // 1) ID exacto (C001)
    const byId = (st.clients||[]).find(c=>String(c.id||"").toLowerCase()===t.toLowerCase());
    if(byId) return byId;

    // 2) si el QR trae prefijo, ej "DINAMITA:C001"
    const m = t.match(/(C\d{3})/i);
    if(m){
      const id = m[1].toUpperCase();
      const c = (st.clients||[]).find(x=>x.id===id);
      if(c) return c;
    }

    // 3) por nombre / teléfono
    const lower = t.toLowerCase();
    return (st.clients||[]).find(c=>
      String(c.name||"").toLowerCase().includes(lower) ||
      String(c.phone||"").replace(/\D/g,'').includes(lower.replace(/\D/g,''))
    ) || null;
  }

  function getMembershipStatus(clientId){
    const st = state();
    const list = (st.memberships||[]).filter(m=>m && m.clientId===clientId);
    if(list.length===0) return { status:"none", label:"Sin membresía", detail:"", color:"red" };

    const t = todayISO();
    // buscar una membresía activa hoy (start<=hoy<=end) con end más lejano
    const active = list
      .filter(m=> (m.start||"")<=t && (m.end||"")>=t)
      .sort((a,b)=> String(b.end||"").localeCompare(String(a.end||"")));
    const m = active[0] || list[0];

    const end = m.end || "";
    const start = m.start || "";
    if(end < t){
      return { status:"expired", label:"Vencida", detail:`Venció: ${end}`, color:"red", membership:m };
    }
    // days left
    const dEnd = new Date(end);
    const dNow = new Date(t);
    const diff = Math.ceil((dEnd - dNow)/(1000*60*60*24));
    if(diff <= 5){
      return { status:"warning", label:"Por vencer", detail:`Vence: ${end} (${diff} día(s))`, color:"orange", membership:m };
    }
    return { status:"active", label:"Activa", detail:`Vence: ${end}`, color:"green", membership:m };
  }

  function getLastAllowedAccess(clientId){
    const st = state();
    const logs = (st.accessLogs||[]).filter(x=>x && x.clientId===clientId && x.result==="allowed");
    if(logs.length===0) return null;
    return logs[0]; // unshift (más reciente)
  }

  function logAccess({clientId, clientName, result, detail, method="qr"}){
    dpSetState(st=>{
      st.accessLogs = st.accessLogs || [];
      // Guardar con hora LOCAL (no UTC)
      const d = new Date();
      const date = localDateISO(d);
      const time = localTime(d);
      const at = `${date}T${time}`;
      st.accessLogs.unshift({
        id: dpId("A"),
        atMs: d.getTime(),
        at,
        date,
        time,
        clientId: clientId || "",
        clientName: clientName || "",
        result,
        detail: detail || "",
        method
      });
      // recortar para evitar crecer infinito
      if(st.accessLogs.length > 5000) st.accessLogs.length = 5000;
      return st;
    });
  }

  function setStatus(kind, title, meta){
    status.classList.remove("dp-accessIdle","dp-accessOk","dp-accessWarn","dp-accessBad");
    if(kind==="ok") status.classList.add("dp-accessOk");
    else if(kind==="warn") status.classList.add("dp-accessWarn");
    else if(kind==="bad") status.classList.add("dp-accessBad");
    else status.classList.add("dp-accessIdle");
    status.querySelector(".dp-accessTitle")?.remove();
    status.querySelector(".dp-accessMeta")?.remove();
    const t = document.createElement("div");
    t.className="dp-accessTitle";
    t.textContent = title || "";
    const m = document.createElement("div");
    m.className="dp-accessMeta";
    m.textContent = meta || "";
    status.appendChild(t);
    status.appendChild(m);
  }

  function renderLast(info){
    const rows = [];
    const add = (k,v)=>rows.push(`<div class="dp-kvRow"><div class="dp-kvK">${k}</div><div class="dp-kvV">${v||""}</div></div>`);
    if(!info){ lastBox.innerHTML = '<div class="dp-hint">Aún no hay accesos.</div>'; return; }
    add("Cliente", `<b>${info.clientName}</b> (${info.clientId})`);
    add("Resultado", `<b>${info.result.toUpperCase()}</b>`);
    add("Detalle", info.detail || "");
    add("Fecha/Hora", `${info.date} ${info.time}`);
    lastBox.innerHTML = rows.join("");
  }

  function renderTable(){
    const st = state();
    const q = String(filter.value||"").trim().toLowerCase();
    const logs = (st.accessLogs||[]);
    const view = q ? logs.filter(x=>
      (x.clientName||"").toLowerCase().includes(q) ||
      (x.clientId||"").toLowerCase().includes(q) ||
      (x.result||"").toLowerCase().includes(q) ||
      (x.detail||"").toLowerCase().includes(q)
    ) : logs;

    tbody.innerHTML = view.slice(0,200).map(x=>{
      const badge = x.result==="allowed" ? "dp-badgeOk" : (x.result==="warning" ? "dp-badgeWarn" : "dp-badgeBad");
      const label = x.result==="allowed" ? "PERMITIDO" : (x.result==="warning" ? "AVISO" : "DENEGADO");
      return `<tr>
        <td>${x.date||""}</td>
        <td>${x.time||""}</td>
        <td><b>${escapeHtml(x.clientName||"")}</b><div class="dp-hint">${escapeHtml(x.clientId||"")}</div></td>
        <td><span class="dp-badge ${badge}">${label}</span></td>
        <td>${escapeHtml(x.detail||"")}</td>
      </tr>`;
    }).join("");
  }

  function escapeHtml(s){
    return String(s||"").replace(/[&<>"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }

  function exportCSV(){
    const st = state();
    const rows = [["Fecha","Hora","Cliente","ID","Resultado","Detalle"]];
    (st.accessLogs||[]).forEach(x=>{
      rows.push([x.date||"", x.time||"", x.clientName||"", x.clientId||"", x.result||"", x.detail||""]);
    });
    const csv = rows.map(r=>r.map(v=>{
      const s = String(v??"");
      return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
    }).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `accesos_${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }

  function validate(){
    const token = String(scan.value||"").trim();
    if(!token){ setStatus("bad","Sin dato","Escanea un código o escribe un nombre/ID."); return; }

    const client = findClientByToken(token);
    if(!client){
      setStatus("bad","No encontrado","No existe cliente con ese dato.");
      btnRenew.disabled = true;
      btnPrint.disabled = true;
      logAccess({ clientId:"", clientName:"", result:"denied", detail:`No encontrado (${token})` });
      renderAfterLog();
      return;
    }

    const settings = getAccessSettings();
    const mins = Number(settings.antiPassbackMinutes||0);
    const lastAllowed = getLastAllowedAccess(client.id);
    if(mins>0 && lastAllowed){
      const lastAt = new Date(lastAllowed.at);
      const now = new Date();
      const diffMin = (now - lastAt) / (1000*60);
      if(diffMin < mins){
        const left = Math.ceil(mins - diffMin);
        setStatus("bad","Anti-passback","Entrada repetida. Espera " + left + " min.");
        btnRenew.disabled = false; // puede renovar aunque sea passback
        btnPrint.disabled = false;
        logAccess({ clientId: client.id, clientName: client.name, result:"denied", detail:`Anti-passback (${Math.round(diffMin)} min)` });
        renderAfterLog();
        return;
      }
    }

    const ms = getMembershipStatus(client.id);
    if(ms.status==="active"){
      setStatus("ok","Acceso permitido", `${client.name} • ${ms.detail}`);
      logAccess({ clientId: client.id, clientName: client.name, result:"allowed", detail:`${ms.label} • ${ms.detail}` });
      btnRenew.disabled = false;
      btnPrint.disabled = false;
    }else if(ms.status==="warning"){
      setStatus("warn","Acceso permitido (por vencer)", `${client.name} • ${ms.detail}`);
      logAccess({ clientId: client.id, clientName: client.name, result:"warning", detail:`${ms.label} • ${ms.detail}` });
      btnRenew.disabled = false;
      btnPrint.disabled = false;
    }else{
      setStatus("bad","Acceso denegado", `${client.name} • ${ms.detail || ms.label}`);
      logAccess({ clientId: client.id, clientName: client.name, result:"denied", detail:`${ms.label} • ${ms.detail}` });
      btnRenew.disabled = false;
      btnPrint.disabled = false;
    }

    // Guardar para renovar/credencial
    sessionStorage.setItem("dp_prefill_client_id", client.id);
    renderAfterLog();

    // UX: después de validar (escáner o manual) dejar listo para el siguiente pase.
    // Mantener el input enfocado y vacío para que el lector (que funciona como teclado)
    // pueda mandar el siguiente código sin tocar nada.
    setTimeout(()=>{
      scan.value = "";
      scan.focus();
    }, 20);
  }

  function renderAfterLog(){
    const st = state();
    const last = (st.accessLogs||[])[0] || null;
    renderLast(last);
    renderTable();
  }

  // --- modo acceso (bloqueo de navegación) ---
  function isAccessMode(){
    return sessionStorage.getItem("dp_access_mode")==="1";
  }
  function setAccessMode(on){
    sessionStorage.setItem("dp_access_mode", on ? "1":"0");
    document.body.classList.toggle("dp-accessMode", !!on);
    btnMode.textContent = on ? "Modo Acceso: ON" : "Modo Acceso: OFF";
  }

  function requirePin(){
    // Reutiliza PIN de configuración si existe, sino "1234"
    const st = state();
    const pin = String(st.meta?.securityPin || "1234");
    const input = prompt("PIN para salir/entrar a Modo Acceso:");
    return input === pin;
  }

  function init(){
    ensureAccessArrays();

    const s = getAccessSettings();
    apm.value = String(Number(s.antiPassbackMinutes ?? 10));

    // Focus listo para lector
    setTimeout(()=>scan.focus(), 150);

    // Enter dispara
    scan.addEventListener("keydown", (e)=>{
      if(e.key==="Enter"){
        e.preventDefault();
        validate();
      }
    });

    btnCheck.addEventListener("click", validate);

    btnClear.addEventListener("click", ()=>{
      scan.value="";
      scan.focus();
      btnRenew.disabled = true;
      btnPrint.disabled = true;
      setStatus("idle","Listo para escanear","Escanea un código o escribe un nombre/ID.");
    });

    apm.addEventListener("change", ()=>{
      const v = Math.max(0, Math.floor(Number(apm.value||0)));
      apm.value = String(v);
      setAccessSettings({ antiPassbackMinutes: v });
    });

    filter.addEventListener("input", renderTable);
    btnExport.addEventListener("click", exportCSV);

    btnRenew.addEventListener("click", ()=>{
      const id = sessionStorage.getItem("dp_prefill_client_id") || "";
      if(!id) return;
      // Navega a Membresías y precarga cliente (requiere pequeño hook en módulo membresías)
      try{ sessionStorage.setItem("dp_prefill_client_id", id); }catch(e){}
      const btn = document.querySelector('#menu button[data-module="membresias"]');
      if(btn) btn.click();
    });

    btnPrint.addEventListener("click", ()=>{
      const id = sessionStorage.getItem("dp_prefill_client_id") || "";
      if(!id) return;
      printCredential(id);
    });

    btnMode.addEventListener("click", ()=>{
      const on = isAccessMode();
      if(!on){
        if(requirePin()) setAccessMode(true);
      }else{
        if(requirePin()) setAccessMode(false);
      }
    });

    // aplicar modo acceso si ya estaba
    setAccessMode(isAccessMode());

    // Render inicial
    renderAfterLog();
  }

  function printCredential(clientId){
    const st = state();
    const c = (st.clients||[]).find(x=>x.id===clientId);
    if(!c) return;

    const cfg = (st.meta||{}).business || {};
    const name = cfg.name || "Dinamita Gym";
    const qrText = (c.id || "").trim();

    // Credencial térmica 58mm: nombre + ID + QR (sin WhatsApp por privacidad)
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Credencial</title>
      <style>
        body{font-family:system-ui,Arial;margin:0;padding:8px;font-weight:800}
        .card{border:2px solid #000;border-radius:12px;padding:10px;max-width:360px}
        .brand{display:flex;align-items:center;gap:10px;margin-bottom:10px}
        .logo{width:44px;height:44px;border-radius:10px;object-fit:cover;border:1px solid #000}
        h1{font-size:16px;margin:0}
        .sub{font-size:12px;opacity:.85;font-weight:900}
        .row{margin-top:10px}
        .lbl{font-size:12px;opacity:.9;font-weight:900}
        .val{font-size:18px;font-weight:900}
        .qr{margin-top:10px;border:2px dashed #000;border-radius:12px;padding:10px;text-align:center}
        #barcode{display:inline-block;margin:6px auto 0 auto;padding:8px 6px;border:2px solid #000;border-radius:12px}
        .bar{display:inline-block;height:64px;vertical-align:bottom}
        .gap{display:inline-block;height:64px}
        .qr .code{font-size:20px;font-weight:900;letter-spacing:1px;margin-top:6px}
        @media print{
          @page{ size:58mm auto; margin:0; }
          body{padding:0}
          .card{border:none;border-radius:0;max-width:58mm}
        }
      </style>
    </head><body>
      <div class="card">
        <div class="brand">
          ${(cfg.logoData ? `<img class="logo" src="${cfg.logoData}" />` : `<div class="logo" style="display:flex;align-items:center;justify-content:center;font-weight:900;">DG</div>`)}
          <div>
            <h1>${escapeHtml(name)}</h1>
            <div class="sub">Credencial de socio</div>
          </div>
        </div>

        <div class="row"><div class="lbl">Nombre</div><div class="val">${escapeHtml(c.name||"")}</div></div>
        <div class="row"><div class="lbl">ID</div><div class="val">${escapeHtml(c.id||"")}</div></div>

        <div class="qr">
          <div class="lbl">Escanea tu ID</div>
          <div id="barcode"></div>
          <div class="code">${escapeHtml(c.id||"")}</div>
        </div>
      </div>
      <script>
        // Code39 generator (print-friendly)
        (function(){
          const patterns = {
            "0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw",
            "5":"wnnwwnnnn","6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnnwnn",
            "A":"wnnnnwnnw","B":"nnwnnwnnw","C":"wnwnnwnnn","D":"nnnnwwnnw","E":"wnnnwwnnn",
            "F":"nnwnwwnnn","G":"nnnnnwwnw","H":"wnnnnwwnn","I":"nnwnnwwnn","J":"nnnnwwwnn",
            "K":"wnnnnnnww","L":"nnwnnnnww","M":"wnwnnnnwn","N":"nnnnwnnww","O":"wnnnwnnwn",
            "P":"nnwnwnnwn","Q":"nnnnnnwww","R":"wnnnnnwwn","S":"nnwnnnwwn","T":"nnnnwnwwn",
            "U":"wwnnnnnnw","V":"nwwnnnnnw","W":"wwwnnnnnn","X":"nwnnwnnnw","Y":"wwnnwnnnn",
            "Z":"nwwnwnnnn","-":"nwnnnnwnw",".":"wwnnnnwnn"," ":"nwwnnnwnn","$":"nwnwnwnnn",
            "/":"nwnwnnnwn","+":"nwnnnwnwn","%":"nnnwnwnwn","*":"nwnnwnwnn"
          };
          const narrow = 2;   // px
          const wide = 5;     // px
          const height = 64;  // px

          const raw = ${JSON.stringify(qrText)}; // only ID
          const data = String(raw||"").toUpperCase().trim();
          if(!data){ return; }

          const value = "*" + data + "*";
          const el = document.getElementById("barcode");
          if(!el) return;
          el.innerHTML = "";

          // Render as SVG so it prints even when "background graphics" is disabled.
          // (Las barras por CSS background suelen salir en blanco en el ticket.)
          let x = 10; // quiet zone left
          const rects = [];

          for(let i=0;i<value.length;i++){
            const ch = value[i];
            const pat = patterns[ch];
            if(!pat){ continue; }
            // pattern alternates bar/space, starting with bar
            for(let j=0;j<pat.length;j++){
              const w = (pat[j]==="w") ? wide : narrow;
              const isBar = (j % 2 === 0);
              if(isBar){
                rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="#000"/>`);
              }
              x += w;
            }
            // inter-character gap (narrow space)
            x += narrow;
          }

          x += 10; // quiet zone right
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" viewBox="0 0 ${x} ${height}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
          el.innerHTML = svg;

          // Disparar impresión automáticamente.
          // Nota: se ejecuta dentro de la ventana de impresión para que NO se quede
          // solo en previsualización en PWA.
          window.onafterprint = () => { try{ window.close(); }catch(e){} };
          // Espera 2 frames para que el SVG renderice antes de imprimir
          const go = () => { try{ window.focus(); window.print(); }catch(e){ console.error(e); } };
          const waitReady = () => {
            const svg = document.querySelector('#barcode svg');
            if(svg){
              try{
                const bb = svg.getBBox();
                if(bb && bb.width>10 && bb.height>10){
                  return requestAnimationFrame(() => requestAnimationFrame(go));
                }
              }catch(e){}
              const r = svg.getBoundingClientRect();
              if(r && r.width>10 && r.height>10){
                return requestAnimationFrame(() => requestAnimationFrame(go));
              }
            }
            setTimeout(waitReady, 120);
          };
          setTimeout(waitReady, 80);
        })();
      </script>
    </body></html>`;

    // imprime en ventana aparte (credencial normalmente se imprime en PC)
    const w = window.open("", "_blank");
    if(!w){ alert("Permite ventanas emergentes para imprimir credencial."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  init();
})();