(function(){
  const $ = (id)=>document.getElementById(id);

  const elLogo = $("cfg-logo");
  const elLogoPreview = $("cfg-logoPreview");
  const elLogoClear = $("cfg-logoClear");

  const elName = $("cfg-name");
  const elAddress = $("cfg-address");
  const elPhone = $("cfg-phone");
  const elEmail = $("cfg-email");
  const elSocial = $("cfg-social");

  const elBg = $("cfg-bg");
  const elPanel = $("cfg-panel");
  const elPrimary = $("cfg-primary");
  const elText = $("cfg-text");

  const elIva = $("cfg-iva");
  const elMessage = $("cfg-message");

  function cfg(){ return dpGetConfig(); }

  function setLogoPreview(dataUrl){
    if(dataUrl){
      elLogoPreview.src = dataUrl;
      elLogoPreview.style.display = "block";
    }else{
      elLogoPreview.src = "";
      elLogoPreview.style.display = "none";
    }
  }

  function fill(){
    const c = cfg();
    const b = c.business || {};
    const a = c.appearance || {};
    const t = c.ticket || {};

    elName.value = b.name || "";
    elAddress.value = b.address || "";
    elPhone.value = b.phone || "";
    elEmail.value = b.email || "";
    elSocial.value = b.social || "";
    setLogoPreview(b.logoDataUrl || "");

    elBg.value = a.bg || "#ffffff";
    elPanel.value = a.panel || "#ffffff";
    elPrimary.value = a.primary || "#c00000";
    elText.value = a.text || "#111111";

    elIva.value = Number(t.ivaDefault ?? 0);
    elMessage.value = t.message || "Gracias por tu compra en Dinamita Gym 💥";
  }

  // Business save/reset
  $("cfg-saveBusiness").addEventListener("click", ()=>{
    const c = cfg();
    dpSetConfig({
      business: {
        ...c.business,
        name: elName.value.trim() || "Dinamita Gym",
        address: elAddress.value.trim(),
        phone: elPhone.value.trim(),
        email: elEmail.value.trim(),
        social: elSocial.value.trim(),
      }
    });
    alert("Guardado ✅");
  });

  $("cfg-resetBusiness").addEventListener("click", ()=>{
    dpSetConfig({
      business: { logoDataUrl:"", name:"Dinamita Gym", address:"", phone:"", email:"", social:"" }
    });
    fill();
    alert("Restablecido ✅");
  });

  // Logo upload
  elLogo.addEventListener("change", async ()=>{
    const file = elLogo.files && elLogo.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const dataUrl = String(reader.result || "");
      dpSetConfig({ business: { logoDataUrl: dataUrl } });
      setLogoPreview(dataUrl);
      alert("Logo guardado ✅");
    };
    reader.readAsDataURL(file);
  });

  elLogoClear.addEventListener("click", ()=>{
    dpSetConfig({ business: { logoDataUrl:"" } });
    setLogoPreview("");
  });

  // Appearance save/reset
  $("cfg-saveAppearance").addEventListener("click", ()=>{
    dpSetConfig({
      appearance: {
        bg: elBg.value,
        panel: elPanel.value,
        primary: elPrimary.value,
        text: elText.value
      }
    });
    try{ dpApplyTheme(); }catch(e){}
    alert("Apariencia guardada ✅");
  });

  $("cfg-resetAppearance").addEventListener("click", ()=>{
    dpSetConfig({
      appearance: { bg:"#ffffff", panel:"#ffffff", primary:"#c00000", text:"#111111" }
    });
    fill();
    try{ dpApplyTheme(); }catch(e){}
    alert("Apariencia restablecida ✅");
  });

  document.querySelectorAll("[data-palette]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const name = btn.getAttribute("data-palette");
      const palettes = {
        dinamita: { bg:"#ffffff", panel:"#ffffff", primary:"#c00000", text:"#111111" },
        claro:    { bg:"#ffffff", panel:"#ffffff", primary:"#d50000", text:"#111111" },
        oscuro:   { bg:"#141414", panel:"#1f1f1f", primary:"#c00000", text:"#ffffff" },
      };
      const p = palettes[name] || palettes.dinamita;
      elBg.value = p.bg; elPanel.value = p.panel; elPrimary.value = p.primary; elText.value = p.text;
      dpSetConfig({ appearance: p });
      try{ dpApplyTheme(); }catch(e){}
    });
  });

  // Ticket save/reset
  $("cfg-saveTicket").addEventListener("click", ()=>{
    dpSetConfig({
      ticket: {
        ivaDefault: Number(elIva.value||0),
        message: elMessage.value.trim() || "Gracias por tu compra en Dinamita Gym 💥"
      }
    });
    alert("Ticket guardado ✅");
  });

  $("cfg-resetTicket").addEventListener("click", ()=>{
    dpSetConfig({ ticket: { ivaDefault:0, message:"Gracias por tu compra en Dinamita Gym 💥" } });
    fill();
    alert("Restablecido ✅");
  });


  // Respaldo (Exportar / Importar)
  const elExportBackup = $("cfg-exportBackup");
  const elImportBackup = $("cfg-importBackup");
  const elImportFile   = $("cfg-importFile");
  const elBackupStatus = $("cfg-backupStatus");

  function setBackupStatus(msg){
    if(!elBackupStatus) return;
    elBackupStatus.textContent = msg || "";
  }

  function downloadTextFile(filename, text, mime="application/json"){
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 800);
  }

  if(elExportBackup){
    elExportBackup.addEventListener("click", ()=>{
      try{
        const st = dpGetState();
        const d = new Date();
        const pad = (n)=>String(n).padStart(2,"0");
        const ts = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
        const filename = `dinamita_pos_respaldo_${ts}.json`;
        downloadTextFile(filename, JSON.stringify(st, null, 2));
        setBackupStatus("Respaldo exportado ✅");
      }catch(err){
        console.error(err);
        setBackupStatus("Error al exportar respaldo ❌");
        alert("No se pudo exportar el respaldo.");
      }
    });
  }

  if(elImportBackup && elImportFile){
    elImportBackup.addEventListener("click", ()=>{
      elImportFile.value = "";
      elImportFile.click();
    });

    elImportFile.addEventListener("change", async ()=>{
      const file = elImportFile.files && elImportFile.files[0];
      if(!file) return;

      try{
        setBackupStatus("Importando respaldo...");
        const text = await file.text();
        const data = JSON.parse(text);

        // Validación básica
        if(!data || typeof data !== "object" || !("products" in data) || !("sales" in data) || !("clients" in data)){
          alert("Este archivo no parece un respaldo válido de Dinamita POS.");
          setBackupStatus("Archivo inválido ❌");
          return;
        }

        dpSetState(()=>data);
        setBackupStatus("Respaldo importado ✅ Reiniciando...");
        // Recargar para que todos los módulos tomen el nuevo estado
        setTimeout(()=>window.location.reload(), 450);
      }catch(err){
        console.error(err);
        setBackupStatus("Error al importar ❌");
        alert("No se pudo importar el respaldo. Verifica que sea un JSON válido.");
      }
    });
  }


  // Init
  try{ dpApplyTheme(); }catch(e){}
  fill();
})();
