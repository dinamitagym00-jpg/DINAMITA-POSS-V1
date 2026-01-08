/* Dinamita POS v0 - Store (localStorage)
   Versión: v0.1.0
   Fecha: 2025-12-15
*/
const DP_STORE_KEY = "dp_v0_store";

/* === IndexedDB Local-First Store Layer (v0) =========================
   Objetivo: guardar TODO en el dispositivo (IndexedDB) y soportar 2+ dispositivos
   en el futuro (sincronización). Mantiene API existente dpGetState/dpSetState.
   Nota: localStorage solo se usa para:
     - migración desde versiones anteriores
     - estados ligeros (ej. menú) si aplica
===================================================================== */
const DP_IDB_DBNAME = "dp_v0_db";
const DP_IDB_VERSION = 1;
const DP_IDB_STORE = "kv";
const DP_IDB_STATE_KEY = "state";

// Cache en memoria para mantener API síncrona
let __dpStateCache = null;
let __dpIdb = null;

function dpIdbOpen(){
  if(__dpIdb) return Promise.resolve(__dpIdb);
  return new Promise((resolve, reject)=>{
    try{
      const req = indexedDB.open(DP_IDB_DBNAME, DP_IDB_VERSION);
      req.onupgradeneeded = (ev)=>{
        const db = req.result;
        if(!db.objectStoreNames.contains(DP_IDB_STORE)){
          db.createObjectStore(DP_IDB_STORE);
        }
      };
      req.onsuccess = ()=>{
        __dpIdb = req.result;
        resolve(__dpIdb);
      };
      req.onerror = ()=> reject(req.error || new Error("IndexedDB open error"));
    }catch(e){ reject(e); }
  });
}

function dpIdbGet(key){
  return dpIdbOpen().then(db=>new Promise((resolve, reject)=>{
    try{
      const tx = db.transaction(DP_IDB_STORE, "readonly");
      const st = tx.objectStore(DP_IDB_STORE);
      const req = st.get(key);
      req.onsuccess = ()=> resolve(req.result || null);
      req.onerror = ()=> reject(req.error || new Error("IndexedDB get error"));
    }catch(e){ reject(e); }
  }));
}

function dpIdbSet(key, value){
  return dpIdbOpen().then(db=>new Promise((resolve, reject)=>{
    try{
      const tx = db.transaction(DP_IDB_STORE, "readwrite");
      const st = tx.objectStore(DP_IDB_STORE);
      const req = st.put(value, key);
      req.onsuccess = ()=> resolve(true);
      req.onerror = ()=> reject(req.error || new Error("IndexedDB put error"));
    }catch(e){ reject(e); }
  }));
}

function dpIdbDel(key){
  return dpIdbOpen().then(db=>new Promise((resolve, reject)=>{
    try{
      const tx = db.transaction(DP_IDB_STORE, "readwrite");
      const st = tx.objectStore(DP_IDB_STORE);
      const req = st.delete(key);
      req.onsuccess = ()=> resolve(true);
      req.onerror = ()=> reject(req.error || new Error("IndexedDB delete error"));
    }catch(e){ reject(e); }
  }));
}

// Migración desde localStorage (v0 anteriores)
function dpMigrateFromLocalStorage(){
  try{
    const raw = localStorage.getItem(DP_STORE_KEY);
    if(!raw) return null;
    const st = JSON.parse(raw);
    return st && typeof st === "object" ? st : null;
  }catch(e){
    console.warn("dpMigrateFromLocalStorage parse error", e);
    return null;
  }
}

// Init async: carga cache desde IndexedDB (o migra desde localStorage si hace falta)
async function dpInitStore(){
  try{
    const fromIdb = await dpIdbGet(DP_IDB_STATE_KEY);
    if(fromIdb && typeof fromIdb === "object"){
      __dpStateCache = fromIdb;
      return true;
    }
    const legacy = dpMigrateFromLocalStorage();
    if(legacy){
      __dpStateCache = legacy;
      await dpIdbSet(DP_IDB_STATE_KEY, legacy);
      // Opcional: deja localStorage para fallback, pero ya no se usa como fuente principal
      return true;
    }
    // Si no hay nada, sembramos default
    __dpStateCache = dpDefaultState();
    await dpIdbSet(DP_IDB_STATE_KEY, __dpStateCache);
    return true;
  }catch(e){
    console.warn("dpInitStore error, fallback localStorage", e);
    // Fallback: no romper la app
    if(!__dpStateCache){
      const legacy = dpMigrateFromLocalStorage();
      __dpStateCache = legacy || dpDefaultState();
      try{ localStorage.setItem(DP_STORE_KEY, JSON.stringify(__dpStateCache)); }catch(_){}
    }
    return false;
  }
}

// Exponemos un “ready” para que app.js espere antes de cargar módulos
window.dpStoreReady = dpInitStore();


function dpNowISO(){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function dpId(prefix="T"){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rnd = Math.random().toString(16).slice(2,6).toUpperCase();
  return `${prefix}${stamp}${rnd}`;
}

function dpLoad(){
  // Fuente principal: cache en memoria (cargada desde IndexedDB)
  if(__dpStateCache) return __dpStateCache;
  // Si todavía no cargó (muy temprano), intentamos leer legacy localStorage como bootstrap
  const legacy = dpMigrateFromLocalStorage();
  if(legacy){
    __dpStateCache = legacy;
    // Persistimos a IDB en segundo plano
    try{ window.dpStoreReady = dpInitStore(); }catch(e){}
    return legacy;
  }
  return null;
}


function dpSave(state){
  __dpStateCache = state;
  // Persistencia principal: IndexedDB (async, sin bloquear UI)
  try{
    dpIdbSet(DP_IDB_STATE_KEY, state).catch(e=>console.warn("dpSave IndexedDB error", e));
  }catch(e){
    console.warn("dpSave IndexedDB exception", e);
  }
  // Fallback opcional para recuperación rápida (puede fallar si crece mucho)
  try{
    localStorage.setItem(DP_STORE_KEY, JSON.stringify(state));
  }catch(e){
    // Si ya no cabe en localStorage, lo ignoramos; la fuente real es IndexedDB
  }
}


function dpDefaultState(){
  return {
    meta: {
      categories: ['suplemento','agua','accesorio'],
      version: "v0.1.0",
      createdAt: dpNowISO(),
      business: {
        name: "Dinamita Gym",
        address: "",
        phone: "",
        email: "",
        redes: "",
        logoDataUrl: "",
        ivaDefault: 0,
        ticketMessage: "Gracias por tu compra en Dinamita Gym 💥",
        appearance: {
          bg: "#f5f6f8",
          panel: "#ffffff",
          primary: "#b3001b",
          text: "#111111"
        },
        // Catálogo editable de membresías
        membershipCatalog: [
          { id: "MP001", name: "Anualidad", days: 365, price: 2400 },
          { id: "MP002", name: "Medio año", days: 182, price: 1500 },
          { id: "MP003", name: "Mes normal", days: 30, price: 350 },
          { id: "MP004", name: "Mes socio", days: 30, price: 300 },
          { id: "MP005", name: "Mes VIP", days: 30, price: 250 },
          { id: "MP006", name: "Semana normal", days: 7, price: 150 },
          { id: "MP007", name: "Semana socio", days: 7, price: 130 },
          { id: "MP008", name: "Semana VIP", days: 7, price: 100 },
          { id: "MP009", name: "Visita normal", days: 1, price: 40 },
          { id: "MP010", name: "Visita socio", days: 1, price: 30 },
          { id: "MP011", name: "Visita VIP", days: 1, price: 25 }
        ]
      }
    },
    products: [
      { id:"P001", sku:"SKU-0001", barcode:"750000000001", name:"Agua 1L", category:"agua", price:14, cost:8, stock:50, image:"", updatedAt:dpNowISO() },
      { id:"P002", sku:"SKU-0002", barcode:"750000000002", name:"Proteína 2lb", category:"suplemento", price:650, cost:450, stock:12, image:"", updatedAt:dpNowISO() },
      { id:"P003", sku:"SKU-0003", barcode:"750000000003", name:"Creatina 300g", category:"suplemento", price:520, cost:360, stock:18, image:"", updatedAt:dpNowISO() },
      { id:"P004", sku:"SKU-0004", barcode:"750000000004", name:"Shaker Dinamita", category:"accesorio", price:120, cost:60, stock:25, image:"", updatedAt:dpNowISO() }
    ],
    clients: [
      { id:"C000", name:"Mostrador", phone:"", address:"", photo:"", createdAt:dpNowISO() }
    ],
    sales: [],
    memberships: [],
    warehouse: { movements: [], stock: {} },
    analytics: {
      mostSold: {},
      recentSearches: [],
      recentProducts: []
    },
    expenses: [],
    expenseCategories: ['servicios','renta','sueldos','insumos','mantenimiento','otros']

  };
}

function dpGetState(){
  let st = dpLoad();
  if(!st){
    st = dpDefaultState();
    dpSave(st);
  }
  return st;
}


function dpSetState(mutatorFn){
  const st = dpGetState();
  const next = mutatorFn(JSON.parse(JSON.stringify(st))) || st;
  dpSave(next);
  return next;
}


function dpFmtMoney(n){
  const x = Number(n || 0);
  return x.toLocaleString("es-MX", { style:"currency", currency:"MXN" });
}

function dpFindProductByQuery(st, q){
  const qq = (q||"").trim().toLowerCase();
  if(!qq) return [];
  return st.products.filter(p => {
    return (p.name||"").toLowerCase().includes(qq) ||
           (p.sku||"").toLowerCase().includes(qq) ||
           (p.barcode||"").toLowerCase().includes(qq);
  });
}

function dpBumpMostSold(st, productId, qty){
  if(!st.analytics.mostSold) st.analytics.mostSold = {};
  st.analytics.mostSold[productId] = (st.analytics.mostSold[productId] || 0) + qty;
}

function dpPushUnique(arr, val, maxLen=24){
  const next = (arr||[]).filter(x => x !== val);
  next.unshift(val);
  return next.slice(0, maxLen);
}

function dpRecordSearch(st, q){
  if(!q) return;
  if(!st.analytics.recentSearches) st.analytics.recentSearches = [];
  st.analytics.recentSearches.unshift({ q:String(q).slice(0,80), at:dpNowISO() });
  st.analytics.recentSearches = st.analytics.recentSearches.slice(0, 25);
}

function dpRecordProductViewed(st, productId){
  st.analytics.recentProducts = dpPushUnique(st.analytics.recentProducts || [], productId, 20);
}

function dpCreateSale({clientId, cartItems, note, iva=0, paymentMethod="efectivo"}){
  return dpSetState(st => {
    const ticket = dpId("T");
    const at = dpNowISO();
    const items = cartItems.map(i => ({
      productId: i.productId,
      qty: i.qty,
      price: i.price,
      total: i.qty * i.price
    }));
    const subtotal = items.reduce((a,b)=>a+b.total,0);
    const ivaRate = Number(iva||0);
    const ivaAmount = subtotal * (ivaRate/100);
    const total = subtotal + ivaAmount;

    for(const it of items){
      const p = st.products.find(x=>x.id===it.productId);
      if(p){
        p.stock = Math.max(0, Number(p.stock||0) - Number(it.qty||0));
        p.updatedAt = at;
        dpBumpMostSold(st, p.id, Number(it.qty||0));
      }
    }

    st.sales.unshift({
      id: ticket,
      type: "venta",
      paymentMethod: paymentMethod || "efectivo",
      at,
      clientId: clientId || "C000",
      note: note || "",
      ivaRate,
      subtotal,
      ivaAmount,
      total,
      items
    });

    return st;
  });
}



function dpCreateWarehouseEntry({productId, qty, unitCost, supplier, date, notes, imageDataUrl}){
  return dpSetState(st=>{
    const id = dpId("B");
    const at = dpNowISO();
    const entryDate = date || at.slice(0,10);
    const movement = {
      id,
      at,
      date: entryDate,
      productId,
      qty: Number(qty||0),
      unitCost: Number(unitCost||0),
      supplier: supplier || "",
      notes: notes || "",
      image: imageDataUrl || ""
    };

    st.warehouse = st.warehouse || { movements: [] };
    st.warehouse.movements = st.warehouse.movements || [];
    st.warehouse.movements.unshift(movement);

    // Affect inventory stock
    const p = (st.products||[]).find(x=>x.id===productId);
    if(p){
      p.stock = Number(p.stock||0) + Number(qty||0);
      if(Number(unitCost||0) > 0) p.cost = Number(unitCost||0);
      p.updatedAt = at;
      if(!p.image && imageDataUrl) p.image = imageDataUrl;
    }

    return st;
  });
}

function dpUpdateWarehouseEntry(entryId, updates){
  return dpSetState(st=>{
    const mv = st.warehouse?.movements?.find(x=>x.id===entryId);
    if(!mv) return st;

    const oldQty = Number(mv.qty||0);
    const newQty = updates.qty !== undefined ? Number(updates.qty||0) : oldQty;
    const diff = newQty - oldQty;

    Object.assign(mv, updates);
    mv.qty = newQty;
    mv.unitCost = updates.unitCost !== undefined ? Number(updates.unitCost||0) : Number(mv.unitCost||0);

    const p = (st.products||[]).find(x=>x.id===mv.productId);
    if(p){
      p.stock = Number(p.stock||0) + diff;
      if(Number(mv.unitCost||0) > 0) p.cost = Number(mv.unitCost||0);
      if(!p.image && mv.image) p.image = mv.image;
      p.updatedAt = dpNowISO();
    }

    return st;
  });
}

function dpDeleteWarehouseEntry(entryId){
  return dpSetState(st=>{
    const mvs = st.warehouse?.movements || [];
    const mv = mvs.find(x=>x.id===entryId);
    if(!mv) return st;

    const p = (st.products||[]).find(x=>x.id===mv.productId);
    if(p){
      p.stock = Math.max(0, Number(p.stock||0) - Number(mv.qty||0));
      p.updatedAt = dpNowISO();
    }

    st.warehouse.movements = mvs.filter(x=>x.id!==entryId);
    return st;
  });
}


function dpEnsureSeedData(){
  return dpSetState(st=>{
    // Repair common corruption cases (partial localStorage writes / schema changes)
    st.meta = st.meta || {};
    if(!Array.isArray(st.products)) st.products = [];
    if(!Array.isArray(st.clients)) st.clients = [];
    if(!Array.isArray(st.sales)) st.sales = [];
    if(!Array.isArray(st.memberships)) st.memberships = [];
    if(!Array.isArray(st.expenses)) st.expenses = [];
    if(!Array.isArray(st.expenseCategories)) st.expenseCategories = [];
    if(!Array.isArray(st.accessLogs)) st.accessLogs = [];

    st.meta = st.meta || {};
    st.meta.accessSettings = st.meta.accessSettings || { antiPassbackMinutes: 10 };
    st.meta.securityPin = st.meta.securityPin || "1234";

    // If products exist but are unusable (missing name/sku), reseed demo products.
    const hasValidProduct = (st.products||[]).some(p=>p && (p.name || p.sku || p.barcode));

    st.meta = st.meta || {};
    st.meta.membershipCatalog = st.meta.membershipCatalog || [];
    if(st.meta.membershipCatalog.length===0){ st.meta.membershipCatalog = [{"id": "MP001", "name": "Anualidad", "days": 365, "price": 2400}, {"id": "MP002", "name": "Medio año", "days": 182, "price": 1500}, {"id": "MP003", "name": "Mes normal", "days": 30, "price": 350}, {"id": "MP004", "name": "Mes socio", "days": 30, "price": 300}, {"id": "MP005", "name": "Mes VIP", "days": 30, "price": 250}, {"id": "MP006", "name": "Semana normal", "days": 7, "price": 150}, {"id": "MP007", "name": "Semana socio", "days": 7, "price": 130}, {"id": "MP008", "name": "Semana VIP", "days": 7, "price": 100}, {"id": "MP009", "name": "Visita normal", "days": 1, "price": 40}, {"id": "MP010", "name": "Visita socio", "days": 1, "price": 30}, {"id": "MP011", "name": "Visita VIP", "days": 1, "price": 25}]; }

    st.meta.categories = st.meta.categories || ['suplemento','agua','accesorio'];
    st.products = st.products || [];
    if(st.products.length === 0 || !hasValidProduct){
      const now = dpNowISO();
      st.products = [{"id": "P100001", "sku": "DM-WATER-1L", "barcode": "750000000001", "name": "Agua Bonafont 1L", "category": "agua", "price": 14, "cost": 6, "stock": 20, "expiry": "", "lot": "", "image": "", "createdAt": "", "updatedAt": ""}, {"id": "P100002", "sku": "DM-WHEY-2LB", "barcode": "750000000002", "name": "Proteína Whey 2 lb (Demo)", "category": "suplemento", "price": 699, "cost": 480, "stock": 5, "expiry": "", "lot": "", "image": "", "createdAt": "", "updatedAt": ""}, {"id": "P100003", "sku": "DM-CREAT-300", "barcode": "750000000003", "name": "Creatina 300g (Demo)", "category": "suplemento", "price": 499, "cost": 320, "stock": 8, "expiry": "", "lot": "", "image": "", "createdAt": "", "updatedAt": ""}, {"id": "P100004", "sku": "DM-SHAKER", "barcode": "750000000004", "name": "Shaker Dinamita (Demo)", "category": "accesorio", "price": 120, "cost": 60, "stock": 12, "expiry": "", "lot": "", "image": "", "createdAt": "", "updatedAt": ""}].map(p=>({
        ...p,
        createdAt: p.createdAt || now,
        updatedAt: p.updatedAt || now
      }));
    }
    // Ensure warehouse structure exists
    st.warehouse = st.warehouse || { movements: [], stock: {} };
    st.warehouse.movements = st.warehouse.movements || [];
    st.warehouse.stock = st.warehouse.stock || {};
    return st;
  });
}


/* --- Bodega v0 (Opción A): stock separado + traspaso a inventario --- */
function dpWarehouseQty(st, productId){
  st.warehouse = st.warehouse || { movements: [], stock: {} };
  st.warehouse.stock = st.warehouse.stock || {};
  return Number(st.warehouse.stock[productId] || 0);
}

function dpCreateWarehouseEntry({productId, qty, unitCost, supplier, date, notes, imageDataUrl}){
  return dpSetState(st=>{
    const id = dpId("B");
    const at = dpNowISO();
    const entryDate = date || at.slice(0,10);

    st.warehouse = st.warehouse || { movements: [], stock: {} };
    st.warehouse.movements = st.warehouse.movements || [];
    st.warehouse.stock = st.warehouse.stock || {};

    const movement = {
      id,
      type: "in",
      at,
      date: entryDate,
      productId,
      qty: Number(qty||0),
      unitCost: Number(unitCost||0),
      supplier: supplier || "",
      notes: notes || "",
      image: imageDataUrl || ""
    };
    st.warehouse.movements.unshift(movement);

    // SOLO bodega
    st.warehouse.stock[productId] = dpWarehouseQty(st, productId) + Number(qty||0);

    // actualizar costo/imagen del producto (sin mover stock)
    const p = (st.products||[]).find(x=>x.id===productId);
    if(p){
      if(Number(unitCost||0) > 0) p.cost = Number(unitCost||0);
      if(!p.image && imageDataUrl) p.image = imageDataUrl;
      p.updatedAt = at;
    }

    return st;
  });
}

function dpUpdateWarehouseEntry(entryId, updates){
  return dpSetState(st=>{
    st.warehouse = st.warehouse || { movements: [], stock: {} };
    st.warehouse.movements = st.warehouse.movements || [];
    st.warehouse.stock = st.warehouse.stock || {};

    const mv = st.warehouse.movements.find(x=>x.id===entryId);
    if(!mv || mv.type !== "in") return st;

    const oldQty = Number(mv.qty||0);
    const newQty = updates.qty !== undefined ? Number(updates.qty||0) : oldQty;
    const diff = newQty - oldQty;

    Object.assign(mv, updates);
    mv.qty = newQty;
    if(updates.unitCost !== undefined) mv.unitCost = Number(updates.unitCost||0);

    st.warehouse.stock[mv.productId] = Math.max(0, dpWarehouseQty(st, mv.productId) + diff);

    const p = (st.products||[]).find(x=>x.id===mv.productId);
    if(p){
      if(Number(mv.unitCost||0) > 0) p.cost = Number(mv.unitCost||0);
      if(!p.image && mv.image) p.image = mv.image;
      p.updatedAt = dpNowISO();
    }
    return st;
  });
}

function dpDeleteWarehouseEntry(entryId){
  return dpSetState(st=>{
    st.warehouse = st.warehouse || { movements: [], stock: {} };
    st.warehouse.movements = st.warehouse.movements || [];
    st.warehouse.stock = st.warehouse.stock || {};

    const mv = st.warehouse.movements.find(x=>x.id===entryId);
    if(!mv || mv.type !== "in") return st;

    st.warehouse.stock[mv.productId] = Math.max(0, dpWarehouseQty(st, mv.productId) - Number(mv.qty||0));
    st.warehouse.movements = st.warehouse.movements.filter(x=>x.id!==entryId);
    return st;
  });
}

function dpTransferFromWarehouse({productId, qty, notes}){
  return dpSetState(st=>{
    st.warehouse = st.warehouse || { movements: [], stock: {} };
    st.warehouse.movements = st.warehouse.movements || [];
    st.warehouse.stock = st.warehouse.stock || {};

    const available = dpWarehouseQty(st, productId);
    const q = Number(qty||0);
    if(!Number.isFinite(q) || q<=0) return st;
    if(q > available) return st;

    st.warehouse.stock[productId] = available - q;

    const p = (st.products||[]).find(x=>x.id===productId);
    if(p){
      p.stock = Number(p.stock||0) + q;
      p.updatedAt = dpNowISO();
    }

    st.warehouse.movements.unshift({
      id: dpId("T"),
      type: "transfer",
      at: dpNowISO(),
      date: dpNowISO().slice(0,10),
      productId,
      qty: q,
      notes: notes || ""
    });

    return st;
  });
}


/* --- Ventas de Servicios (no afectan inventario) --- */
function dpCreateServiceSale({clientId, concept, price, note="", iva=0, meta={}}){
  return dpSetState(st => {
    const ticket = dpId("T");
    const at = dpNowISO();
    const qty = 1;
    const p = Number(price||0);
    const subtotal = qty * p;
    const ivaRate = Number(iva||0);
    const ivaAmount = subtotal * (ivaRate/100);
    const total = subtotal + ivaAmount;

    st.sales = st.sales || [];
    st.sales.unshift({
      id: ticket,
      type: "servicio",
      subtype: meta.subtype || "",
      at,
      clientId: clientId || "C000",
      note: note || "",
      ivaRate,
      subtotal,
      ivaAmount,
      total,
      items: [{
        productId: meta.productId || "SERV",
        name: concept || "Servicio",
        qty,
        price: p,
        total: subtotal
      }],
      meta
    });
    return st;
  });
}

/* --- Membresías --- */
function dpCalcEndDate(startISO, days){
  const d = new Date(startISO);
  d.setDate(d.getDate() + Number(days||0));
  return d.toISOString().slice(0,10);
}

function dpCreateMembership({clientId, planId, planName, days, startDate, notes, price, saleTicketId=""}){
  return dpSetState(st=>{
    st.memberships = st.memberships || [];
    const id = dpId("M");
    const start = startDate || new Date().toISOString().slice(0,10);
    const end = dpCalcEndDate(start, Number(days||0));
    st.memberships.unshift({
      id,
      clientId: clientId || "C000",
      planId: planId || "",
      planName: planName || "",
      days: Number(days||0),
      start,
      end,
      notes: notes || "",
      price: Number(price||0),
      saleTicketId: saleTicketId || "",
      createdAt: dpNowISO()
    });
    return st;
  });
}

function dpChargeMembership({clientId, planId, startDate, notes, printTag=""}){
  const plan = dpFindMembershipPlanById(planId);
  const name = plan ? plan.name : "Membresía";
  const days = plan ? Number(plan.days||0) : 0;
  const price = plan ? Number(plan.price||0) : 0;

  const concept = `${name} - ${days} días`;
  dpCreateServiceSale({
    clientId,
    concept,
    price,
    note: notes || "",
    iva: 0,
    meta: { kind:"membership", planId, planName: name, days, startDate, printTag , endDate: dpCalcEndDate(startDate, days) }
  });

  const st = dpGetState();
  const sale = (st.sales||[])[0];
  const ticketId = sale ? sale.id : "";

  dpCreateMembership({
    clientId,
    planId,
    planName: name,
    days,
    startDate,
    notes,
    price,
    saleTicketId: ticketId
  });

  return ticketId;
}

function dpDeleteMembership(id){
  return dpSetState(st=>{
    st.memberships = st.memberships || [];
    st.memberships = st.memberships.filter(m=>m.id !== id);
    return st;
  });
}


/* --- Catálogo de Membresías --- */
function dpGetMembershipCatalog(){
  const st = dpGetState();
  st.meta = st.meta || {};
  st.meta.membershipCatalog = st.meta.membershipCatalog || [];
  return st.meta.membershipCatalog;
}

function dpAddMembershipPlan({name, days, price}){
  return dpSetState(st=>{
    st.meta = st.meta || {};
    st.meta.membershipCatalog = st.meta.membershipCatalog || [];
    const id = dpId("MP");
    st.meta.membershipCatalog.unshift({
      id,
      name: String(name||"").trim(),
      days: Number(days||0),
      price: Number(price||0),
      createdAt: dpNowISO()
    });
    return st;
  });
}

function dpUpdateMembershipPlan(id, updates){
  return dpSetState(st=>{
    st.meta = st.meta || {};
    st.meta.membershipCatalog = st.meta.membershipCatalog || [];
    const p = st.meta.membershipCatalog.find(x=>x.id===id);
    if(!p) return st;
    if(updates.name !== undefined) p.name = String(updates.name||"").trim();
    if(updates.days !== undefined) p.days = Number(updates.days||0);
    if(updates.price !== undefined) p.price = Number(updates.price||0);
    p.updatedAt = dpNowISO();
    return st;
  });
}

function dpDeleteMembershipPlan(id){
  return dpSetState(st=>{
    st.meta = st.meta || {};
    st.meta.membershipCatalog = st.meta.membershipCatalog || [];
    st.meta.membershipCatalog = st.meta.membershipCatalog.filter(x=>x.id!==id);
    return st;
  });
}

function dpFindMembershipPlanById(id){
  const st = dpGetState();
  const list = st.meta?.membershipCatalog || [];
  return list.find(x=>x.id===id) || null;
}


/* --- Clientes CRUD --- */
function dpNextClientId(){
  const st = dpGetState();
  const ids = (st.clients||[]).map(c=>c.id||"").filter(id=>/^C\d{3}$/.test(id));
  let max = -1;
  ids.forEach(id=>{ const n = parseInt(id.slice(1),10); if(!isNaN(n)) max = Math.max(max,n); });
  const next = max+1;
  return "C" + String(next).padStart(3,"0");
}

function dpAddClient({name, phone="", address="", notes="", photo=""}){
  return dpSetState(st=>{
    st.clients = st.clients || [];
    const id = dpNextClientId();
    st.clients.unshift({
      id,
      name: String(name||"").trim(),
      phone: String(phone||"").trim(),
      address: String(address||"").trim(),
      notes: String(notes||"").trim(),
      photo: photo || "",
      createdAt: dpNowISO(),
      updatedAt: dpNowISO()
    });
    return st;
  });
}

function dpUpdateClient(id, updates){
  return dpSetState(st=>{
    st.clients = st.clients || [];
    const c = st.clients.find(x=>x.id===id);
    if(!c) return st;
    if(updates.name !== undefined) c.name = String(updates.name||"").trim();
    if(updates.phone !== undefined) c.phone = String(updates.phone||"").trim();
    if(updates.address !== undefined) c.address = String(updates.address||"").trim();
    if(updates.notes !== undefined) c.notes = String(updates.notes||"").trim();
    if(updates.photo !== undefined) c.photo = updates.photo || "";
    c.updatedAt = dpNowISO();
    return st;
  });
}

function dpCanDeleteClient(id){
  const st = dpGetState();
  if(id==="C000") return { ok:false, reason:"No se puede borrar 'Mostrador'." };
  const hasSale = (st.sales||[]).some(s=>s.clientId===id);
  if(hasSale) return { ok:false, reason:"Este cliente tiene ventas ligadas." };
  const hasMem = (st.memberships||[]).some(m=>m.clientId===id);
  if(hasMem) return { ok:false, reason:"Este cliente tiene membresías ligadas." };
  return { ok:true, reason:"" };
}

function dpDeleteClient(id){
  const check = dpCanDeleteClient(id);
  if(!check.ok) return check;
  dpSetState(st=>{
    st.clients = (st.clients||[]).filter(c=>c.id!==id);
    return st;
  });
  return { ok:true, reason:"" };
}

function dpGetClientById(id){
  const st = dpGetState();
  return (st.clients||[]).find(c=>c.id===id) || null;
}


function dpDeleteSale(ticketId){
  return dpSetState(st=>{
    st.sales = st.sales || [];
    const idx = st.sales.findIndex(s=>s.id===ticketId);
    if(idx===-1) return st;
    const sale = st.sales[idx];

    // Restore inventory ONLY for product sales
    if(sale.type === "venta"){
      for(const it of (sale.items||[])){
        const p = (st.products||[]).find(x=>x.id===it.productId);
        if(p){
          p.stock = Number(p.stock||0) + Number(it.qty||0);
          p.updatedAt = dpNowISO();
        }
      }
    }

    // If it's a membership service, delete the linked membership record(s)
    if(sale.meta && sale.meta.kind === "membership"){
      st.memberships = (st.memberships||[]).filter(m=>m.saleTicketId !== ticketId);
    }

    // Remove the sale
    st.sales.splice(idx,1);
    return st;
  });
}
function dpGetSalesRows({from="", to=""}={}){
  const st = dpGetState();
  const rows = [];
  const inRange = (iso)=>{
    if(!from && !to) return true;
    const d = new Date(iso);
    if(isNaN(d.getTime())) return true;
    if(from){
      const f = new Date(from);
      if(d < f) return false;
    }
    if(to){
      const t = new Date(to);
      t.setHours(23,59,59,999);
      if(d > t) return false;
    }
    return true;
  };

  for(const s of (st.sales||[])){
    if(!inRange(s.at)) continue;
    if(s.type === "venta"){
      for(const it of (s.items||[])){
        rows.push({
          kind: "venta",
          date: (s.at||"").slice(0,10),
          at: s.at,
          ticket: s.id,
          clientId: s.clientId || "",
          paymentMethod: (s.paymentMethod||""),
          productId: it.productId || "",
          product: (st.products||[]).find(x=>x.id===it.productId)?.name || it.productId || "",
          category: (st.products||[]).find(x=>x.id===it.productId)?.category || "",
          unitPrice: Number(it.price||0),
          qty: Number(it.qty||0),
          total: Number(it.total|| (Number(it.price||0)*Number(it.qty||0))),
        });
      }
    }else{
      const item = (s.items||[])[0] || {};
      const concept = item.name || "Servicio";
      const price = Number(item.price ?? s.total ?? 0);
      rows.push({
        kind: (s.meta && s.meta.kind==="membership") ? "membresia" : "servicio",
        date: (s.at||"").slice(0,10),
        at: s.at,
        ticket: s.id,
        clientId: s.clientId || "",
          paymentMethod: (s.paymentMethod||""),
        productId: "",
        product: concept,
        category: (s.meta && s.meta.kind==="membership") ? "Membresías" : "Servicios",
        unitPrice: price,
        qty: 1,
        total: Number(s.total ?? price),
        meta: s.meta || {}
      });
    }
  }
  return rows;
}
function dpGetConfig(){
  const st = dpGetState();
  st.config = st.config || {};
  st.config.business = st.config.business || { 
    logoDataUrl: "", name: (st.business?.name || "Dinamita Gym"), address:"", phone:"", email:"", social:""
  };
  st.config.appearance = st.config.appearance || {
    bg: "#ffffff",
    panel: "#ffffff",
    primary: "#c00000",
    text: "#111111"
  };
  st.config.ticket = st.config.ticket || {
    ivaDefault: 0,
    message: "Gracias por tu compra en Dinamita Gym 💥"
  };
  return st.config;
}

function dpSetConfig(partial){
  return dpSetState(st=>{
    st.config = st.config || {};
    const cur = dpGetConfig(); // ensures defaults
    st.config = {
      business: { ...cur.business, ...(partial.business||{}) },
      appearance: { ...cur.appearance, ...(partial.appearance||{}) },
      ticket: { ...cur.ticket, ...(partial.ticket||{}) }
    };
    return st;
  });
}

function dpApplyTheme(){
  const cfg = dpGetConfig();
  const a = cfg.appearance || {};
  const root = document.documentElement;
  if(a.primary) root.style.setProperty("--dp-red", a.primary);
  if(a.bg) root.style.setProperty("--dp-bg", a.bg);
  if(a.panel) root.style.setProperty("--dp-panel", a.panel);
  if(a.text) root.style.setProperty("--dp-text", a.text);
}
function dpGetBizInfo(){
  const st = dpGetState();
  const cfg = (st.config && st.config.business) ? st.config.business : {};
  const legacy = st.meta?.business || {};
  return {
    logoDataUrl: cfg.logoDataUrl || legacy.logoDataUrl || "",
    name: cfg.name || legacy.name || "Dinamita Gym",
    address: cfg.address || legacy.address || "",
    phone: cfg.phone || legacy.phone || "",
    email: cfg.email || legacy.email || "",
    social: cfg.social || legacy.social || ""
  };
}

function dpGetTicketCfg(){
  const st = dpGetState();
  const cfg = st.config?.ticket || {};
  return {
    ivaDefault: Number(cfg.ivaDefault ?? 0),
    message: cfg.message || "Gracias por tu compra en Dinamita Gym 💥"
  };
}

function dpRenderBranding(){
  const biz = dpGetBizInfo();
  const img = document.getElementById("dp-menuLogo");
  const nameEl = document.getElementById("dp-menuName");
  const fb = document.getElementById("dp-menuLogoFallback");
  if(nameEl) nameEl.textContent = biz.name || "Dinamita POS";

  if(img){
    if(biz.logoDataUrl){
      img.src = biz.logoDataUrl;
      img.style.display = "block";
      if(fb) fb.style.display = "none";
    }else{
      img.removeAttribute("src");
      img.style.display = "none";
      if(fb) fb.style.display = "flex";
    }
  }
}
