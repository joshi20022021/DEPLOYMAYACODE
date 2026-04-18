#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

function serveStatic(req, res) {
  let filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath).toLowerCase();
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, "index.html");
  }
  const mime = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  fs.createReadStream(filePath).pipe(res);
}

const CONFIG = {
  port: Number(process.env.BRIDGE_PORT || 8088),
  odooUrl: (process.env.ODOO_URL || "http://localhost:8069").replace(/\/$/, ""),
  db: process.env.ODOO_DB || "Fase1",
  user: process.env.ODOO_USER || "admin",
  password: process.env.ODOO_PASSWORD || "1234",
};

const STATE = {
  uid: null,
  modelCache: new Map(),
};

function makeSku(productId) {
  return `MAYA-${String(productId).padStart(4, "0")}`;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error("Payload demasiado grande"));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

async function jsonRpc(params) {
  const response = await fetch(`${CONFIG.odooUrl}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params,
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Odoo respondió HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    const msg = data.error?.data?.message || data.error?.message || "Error Odoo";
    throw new Error(msg);
  }

  return data.result;
}

async function login() {
  if (STATE.uid) return STATE.uid;

  const uid = await jsonRpc({
    service: "common",
    method: "login",
    args: [CONFIG.db, CONFIG.user, CONFIG.password],
  });

  if (!uid) {
    throw new Error("No se pudo autenticar en Odoo");
  }

  STATE.uid = uid;
  return uid;
}

async function executeKw(model, method, args = [], kwargs = {}) {
  const uid = await login();
  return jsonRpc({
    service: "object",
    method: "execute_kw",
    args: [CONFIG.db, uid, CONFIG.password, model, method, args, kwargs],
  });
}

async function modelExists(model) {
  if (STATE.modelCache.has(model)) return STATE.modelCache.get(model);
  const count = await executeKw("ir.model", "search_count", [[["model", "=", model]]]);
  const exists = Number(count) > 0;
  STATE.modelCache.set(model, exists);
  return exists;
}

async function ensurePartner(data) {
  const email = (data.email || "").trim().toLowerCase();
  if (!email) {
    throw new Error("El email del cliente es obligatorio");
  }

  const ids = await executeKw("res.partner", "search", [[["email", "=", email]]], { limit: 1 });

  const vals = {
    name: data.name || email,
    email,
    phone: data.phone || "",
    street: data.address || "",
    city: data.departamento || "Guatemala",
    customer_rank: 1,
  };

  if (ids.length > 0) {
    await executeKw("res.partner", "write", [[ids[0]], vals]);
    return ids[0];
  }

  return executeKw("res.partner", "create", [vals]);
}

async function findProductVariant(item) {
  const sku = makeSku(item.id);

  const bySku = await executeKw("product.product", "search", [[["default_code", "=", sku]]], { limit: 1 });
  if (bySku.length > 0) return bySku[0];

  const byName = await executeKw("product.product", "search", [[["name", "=", item.name]]], { limit: 1 });
  if (byName.length > 0) return byName[0];

  return null;
}

const FALLBACK_IMAGES = {
  "laptops":      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop",
  "monitores":    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop",
  "teclados":     "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop",
  "mouse":        "https://images.unsplash.com/photo-1527814050087-3793815479db?w=600&auto=format&fit=crop",
  "auriculares":  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop",
  "webcams":      "https://images.unsplash.com/photo-1622957461168-6cee4ad13571?w=600&auto=format&fit=crop",
  "hubs-cables":  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&auto=format&fit=crop",
  "ssd-externos": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&auto=format&fit=crop",
  "memorias-ram": "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&auto=format&fit=crop",
  "impresoras":   "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&auto=format&fit=crop",
  "tablets":      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop",
  "redes":        "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop",
  "perifericos":  "https://images.unsplash.com/photo-1527814050087-3793815479db?w=600&auto=format&fit=crop",
  "accesorios":   "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop",
};

const CATEGORY_MAP = {
  "laptops":        "laptops",
  "monitores":      "monitores",
  "teclados":       "teclados",
  "mouse":          "mouse",
  "auriculares":    "auriculares",
  "webcams":        "webcams",
  "hubs":           "hubs-cables",
  "cables":         "hubs-cables",
  "almacenamiento": "ssd-externos",
  "ssd":            "ssd-externos",
  "memorias":       "memorias-ram",
  "ram":            "memorias-ram",
  "impresoras":     "impresoras",
  "tablets":        "tablets",
  "redes":          "redes",
  "perifericos":    "perifericos",
  "accesorios":     "accesorios",
};

function mapCategory(odooCategory) {
  if (!odooCategory) return "accesorios";
  const lower = odooCategory.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return lower.replace(/\s+/g, "-");
}

async function getProducts() {
  const fields = ["id", "name", "list_price", "categ_id", "description_sale", "default_code", "image_128"];
  const records = await executeKw(
    "product.template",
    "search_read",
    [[["active", "=", true], ["sale_ok", "=", true]]],
    { fields, order: "categ_id asc, name asc", limit: 200 }
  );

  return records.map((r, idx) => {
    const category = mapCategory(r.categ_id?.[1] || "");
    const hasImage = r.image_128 && r.image_128 !== false;
    const image = hasImage
      ? `${CONFIG.odooUrl}/web/image/product.template/${r.id}/image_512`
      : (FALLBACK_IMAGES[category] || FALLBACK_IMAGES["accesorios"]);

    return {
      id: r.id,
      name: r.name,
      sku: r.default_code || `MAYA-${String(r.id).padStart(4, "0")}`,
      category,
      price: r.list_price || 0,
      oldPrice: null,
      stock: 10,
      badge: idx < 8 ? "Nuevo" : null,
      rating: 4.5,
      reviews: 0,
      description: r.description_sale || r.name,
      fullDescription: r.description_sale || r.name,
      specs: [],
      image,
    };
  });
}

async function handleGetProducts(res) {
  const products = await getProducts();
  sendJson(res, 200, { ok: true, products });
}

function paymentLabel(payment) {
  if (payment === "transfer") return "Transferencia bancaria";
  if (payment === "delivery") return "Pago contra entrega";
  if (payment === "card") return "Tarjeta";
  return "No especificado";
}

async function createSaleOrder(payload) {
  const partnerId = await ensurePartner({
    ...payload.shipping,
    name: payload.shipping?.name || payload.user?.name,
    email: payload.shipping?.email || payload.user?.email,
  });

  const orderLines = [];
  for (const item of payload.items || []) {
    const productId = await findProductVariant(item);
    if (!productId) {
      orderLines.push([0, 0, {
        name: `${item.name} (sin SKU en Odoo)`,
        product_uom_qty: Number(item.qty) || 1,
        price_unit: Number(item.price) || 0,
      }]);
      continue;
    }

    orderLines.push([0, 0, {
      product_id: productId,
      name: item.name,
      product_uom_qty: Number(item.qty) || 1,
      price_unit: Number(item.price) || 0,
    }]);
  }

  const shippingText = payload.shipping
    ? `${payload.shipping.address || ""}, ${payload.shipping.departamento || ""}`.trim()
    : "";

  const orderVals = {
    partner_id: partnerId,
    origin: payload.localOrderId || "Web MayaCode",
    client_order_ref: payload.localOrderId || "",
    note: [
      `Canal: E-commerce MayaCode`,
      `Pago: ${paymentLabel(payload.payment)}`,
      shippingText ? `Envío: ${shippingText}` : "",
      payload.shipping?.notes ? `Notas: ${payload.shipping.notes}` : "",
    ].filter(Boolean).join("\n"),
    order_line: orderLines,
  };

  const saleOrderId = await executeKw("sale.order", "create", [orderVals]);

  try {
    await executeKw("sale.order", "action_confirm", [[saleOrderId]]);
  } catch {
    // En algunas configuraciones se mantiene como cotización borrador.
  }

  const orderData = await executeKw(
    "sale.order",
    "read",
    [[saleOrderId], ["name", "state", "amount_total"]]
  );

  const saleOrder = orderData?.[0] || { id: saleOrderId, name: String(saleOrderId), state: "draft" };

  return { partnerId, saleOrder: { id: saleOrderId, ...saleOrder } };
}

async function createCrmLeadFromOrder(payload, partnerId, saleOrderName) {
  const hasCrm = await modelExists("crm.lead");
  if (!hasCrm) return null;

  const leadVals = {
    name: `Compra Web ${saleOrderName || payload.localOrderId || "MayaCode"}`,
    contact_name: payload.shipping?.name || payload.user?.name || "Cliente Web",
    email_from: payload.shipping?.email || payload.user?.email || "",
    phone: payload.shipping?.phone || "",
    partner_id: partnerId,
    description: [
      `Pedido local: ${payload.localOrderId || "N/A"}`,
      `Pago: ${paymentLabel(payload.payment)}`,
    ].join("\n"),
    type: "opportunity",
  };

  const id = await executeKw("crm.lead", "create", [leadVals]);
  const data = await executeKw("crm.lead", "read", [[id], ["name"]]);
  return { id, name: data?.[0]?.name || `CRM-${id}` };
}

async function createCrmLeadFromQuote(payload) {
  const hasCrm = await modelExists("crm.lead");
  if (!hasCrm) {
    throw new Error("El módulo CRM no está disponible en Odoo");
  }

  const partnerId = await ensurePartner({
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    address: "",
    departamento: "Guatemala",
  });

  const leadVals = {
    name: `Cotización Web - ${payload.productName || "Producto"}`,
    contact_name: payload.name,
    email_from: payload.email,
    phone: payload.phone,
    partner_id: partnerId,
    type: "lead",
    description: [
      payload.company ? `Empresa: ${payload.company}` : "",
      payload.productName ? `Producto: ${payload.productName}` : "",
      payload.qty ? `Cantidad: ${payload.qty}` : "",
      payload.usage ? `Uso: ${payload.usage}` : "",
      payload.message ? `Mensaje: ${payload.message}` : "",
    ].filter(Boolean).join("\n"),
  };

  const leadId = await executeKw("crm.lead", "create", [leadVals]);
  const leadData = await executeKw("crm.lead", "read", [[leadId], ["name"]]);

  return {
    partner: { id: partnerId, email: payload.email },
    lead: { id: leadId, name: leadData?.[0]?.name || `CRM-${leadId}` },
  };
}

async function handleCheckout(req, res) {
  const payload = await readJsonBody(req);

  if (!(await modelExists("sale.order"))) {
    throw new Error("El módulo de Ventas no está disponible en Odoo");
  }

  const { partnerId, saleOrder } = await createSaleOrder(payload);
  const crmLead = await createCrmLeadFromOrder(payload, partnerId, saleOrder?.name);

  sendJson(res, 200, {
    ok: true,
    saleOrder,
    partner: { id: partnerId },
    crmLead,
  });
}

async function handleQuote(req, res) {
  const payload = await readJsonBody(req);
  const result = await createCrmLeadFromQuote(payload);
  sendJson(res, 200, { ok: true, ...result });
}

async function handleHealth(res) {
  const uid = await login();
  sendJson(res, 200, {
    ok: true,
    db: CONFIG.db,
    user: CONFIG.user,
    uid,
    odooUrl: CONFIG.odooUrl,
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      await handleHealth(res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/products") {
      await handleGetProducts(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/checkout") {
      await handleCheckout(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/quote") {
      await handleQuote(req, res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 404, { ok: false, error: "Ruta no encontrada" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Error interno" });
  }
});

server.listen(CONFIG.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[Odoo Bridge] activo en http://localhost:${CONFIG.port}`);
  // eslint-disable-next-line no-console
  console.log(`[Odoo Bridge] Odoo: ${CONFIG.odooUrl} | DB: ${CONFIG.db} | User: ${CONFIG.user}`);
});
