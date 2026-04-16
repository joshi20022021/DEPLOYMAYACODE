#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function parseArgs(argv) {
  const args = {
    url: "http://localhost:8069",
    db: "Fase1",
    user: "admin",
    password: "1234",
    products: "./products.js",
    mode: "upsert",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];

    if (key === "--url" && next) args.url = next;
    if (key === "--db" && next) args.db = next;
    if (key === "--user" && next) args.user = next;
    if (key === "--password" && next) args.password = next;
    if (key === "--products" && next) args.products = next;
    if (key === "--mode" && next) args.mode = next;
  }

  return args;
}

function resolveProductsData(productsFilePath) {
  const absolutePath = path.resolve(productsFilePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const sandbox = {};

  vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.__ODATA__ = { PRODUCTS, CATEGORIES };`, sandbox);

  if (!sandbox.__ODATA__ || !Array.isArray(sandbox.__ODATA__.PRODUCTS)) {
    throw new Error("No se pudo leer PRODUCTS desde products.js");
  }

  return {
    products: sandbox.__ODATA__.PRODUCTS,
    categories: Array.isArray(sandbox.__ODATA__.CATEGORIES) ? sandbox.__ODATA__.CATEGORIES : [],
  };
}

function makeSku(productId) {
  return `MAYA-${String(productId).padStart(4, "0")}`;
}

async function loadImageAsBase64(imageValue, baseDir) {
  if (!imageValue || typeof imageValue !== "string") return null;

  const trimmed = imageValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    const base64Part = trimmed.split(",")[1];
    return base64Part || null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`No se pudo descargar imagen (HTTP ${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString("base64");
  }

  const candidatePath = path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(baseDir, trimmed);

  if (!fs.existsSync(candidatePath)) {
    throw new Error(`Archivo de imagen no encontrado: ${candidatePath}`);
  }

  return fs.readFileSync(candidatePath).toString("base64");
}

async function jsonRpc(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${url}`);
  }

  const data = await response.json();
  if (data.error) {
    const message = data.error?.data?.message || data.error?.message || "Error desconocido";
    throw new Error(message);
  }

  return data.result;
}

function makeOdooClient({ url, db, user, password }) {
  const rpcUrl = `${url.replace(/\/$/, "")}/jsonrpc`;

  return {
    async login() {
      const uid = await jsonRpc(rpcUrl, {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "login",
          args: [db, user, password],
        },
        id: Date.now(),
      });

      if (!uid) {
        throw new Error("No se pudo autenticar en Odoo");
      }

      this.uid = uid;
      return uid;
    },

    async executeKw(model, method, args = [], kwargs = {}) {
      return jsonRpc(rpcUrl, {
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [db, this.uid, password, model, method, args, kwargs],
        },
        id: Date.now(),
      });
    },
  };
}

async function ensureProductCategory(client, categoryName) {
  const ids = await client.executeKw(
    "product.category",
    "search",
    [[["name", "=", categoryName]]],
    { limit: 1 }
  );

  if (ids.length > 0) return ids[0];

  return client.executeKw("product.category", "create", [{ name: categoryName }]);
}

async function findExistingProductTemplate(client, sku, name) {
  const bySku = await client.executeKw(
    "product.template",
    "search",
    [[["default_code", "=", sku]]],
    { limit: 1 }
  );

  if (bySku.length > 0) return bySku[0];

  const byName = await client.executeKw(
    "product.template",
    "search",
    [[["name", "=", name]]],
    { limit: 1 }
  );

  return byName.length > 0 ? byName[0] : null;
}

async function modelExists(client, modelName) {
  const count = await client.executeKw("ir.model", "search_count", [[["model", "=", modelName]]]);
  return Number(count) > 0;
}

async function getModelFields(client, modelName) {
  return client.executeKw(modelName, "fields_get", [], {
    attributes: ["type", "string", "selection"],
  });
}

async function getDefaultInternalLocationId(client) {
  const ids = await client.executeKw(
    "stock.location",
    "search",
    [[["usage", "=", "internal"]]],
    { limit: 1 }
  );
  return ids.length > 0 ? ids[0] : null;
}

async function getVariantIdByTemplate(client, templateId) {
  const ids = await client.executeKw(
    "product.product",
    "search",
    [[["product_tmpl_id", "=", templateId]]],
    { limit: 1 }
  );
  return ids.length > 0 ? ids[0] : null;
}

async function syncStockQty(client, variantId, locationId, qty) {
  const quantIds = await client.executeKw(
    "stock.quant",
    "search",
    [[["product_id", "=", variantId], ["location_id", "=", locationId]]],
    { limit: 1 }
  );

  if (quantIds.length > 0) {
    await client.executeKw("stock.quant", "write", [[quantIds[0]], { inventory_quantity: qty }]);
    await client.executeKw("stock.quant", "action_apply_inventory", [[quantIds[0]]]);
    return;
  }

  const quantId = await client.executeKw("stock.quant", "create", [{
    product_id: variantId,
    location_id: locationId,
    inventory_quantity: qty,
  }]);
  await client.executeKw("stock.quant", "action_apply_inventory", [[quantId]]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { products, categories } = resolveProductsData(args.products);
  const productsBaseDir = path.dirname(path.resolve(args.products));

  const categoryById = new Map(categories.map((c) => [c.id, c.label || c.id]));
  const client = makeOdooClient(args);
  const uid = await client.login();

  const hasProductTemplate = await modelExists(client, "product.template");
  const hasProductCategory = await modelExists(client, "product.category");
  const hasProductVariant = await modelExists(client, "product.product");
  const hasStockQuant = await modelExists(client, "stock.quant");
  const hasStockLocation = await modelExists(client, "stock.location");

  if (!hasProductTemplate) {
    throw new Error(
      "Tu BD no tiene el modelo product.template. Instala la app Ventas o Inventario en Odoo y vuelve a ejecutar el script."
    );
  }

  const productFields = await getModelFields(client, "product.template");
  const stockQuantFields = hasStockQuant ? await getModelFields(client, "stock.quant") : {};
  const productTypeField = Object.prototype.hasOwnProperty.call(productFields, "detailed_type")
    ? "detailed_type"
    : Object.prototype.hasOwnProperty.call(productFields, "type")
      ? "type"
      : null;

  const productTypeSelection = productTypeField
    ? (productFields[productTypeField]?.selection || []).map((item) => item[0])
    : [];
  const productImageField = Object.prototype.hasOwnProperty.call(productFields, "image_1920")
    ? "image_1920"
    : Object.prototype.hasOwnProperty.call(productFields, "image_1024")
      ? "image_1024"
      : null;
  const productTypeValue = productTypeSelection.includes("product")
    ? "product"
    : productTypeSelection.includes("consu")
      ? "consu"
      : null;

  const canSyncStock = hasProductVariant
    && hasStockQuant
    && hasStockLocation
    && Object.prototype.hasOwnProperty.call(stockQuantFields, "inventory_quantity")
    && productTypeValue === "product";

  const defaultLocationId = canSyncStock ? await getDefaultInternalLocationId(client) : null;

  if (!canSyncStock) {
    console.log("Aviso: esta configuración de Odoo no permite ajustar stock automático desde este script. Se sincronizan datos comerciales del producto.");
  }

  const stats = {
    total: products.length,
    created: 0,
    updated: 0,
    failed: 0,
  };

  console.log(`Conectado a Odoo. uid=${uid}, db=${args.db}`);
  console.log(`Procesando ${products.length} productos...`);

  for (const p of products) {
    try {
      const sku = makeSku(p.id);
      const categoryName = categoryById.get(p.category) || p.category || "General";
      const categId = hasProductCategory ? await ensureProductCategory(client, categoryName) : null;

      const vals = {
        name: p.name,
        default_code: sku,
        list_price: Number(p.price) || 0,
        description_sale: p.fullDescription || p.description || "",
        description: p.description || "",
        sale_ok: true,
        purchase_ok: true,
        ...(categId ? { categ_id: categId } : {}),
      };

      if (productTypeField && productTypeValue) {
        vals[productTypeField] = productTypeValue;
      }

      if (productImageField && p.image) {
        try {
          const imageBase64 = await loadImageAsBase64(p.image, productsBaseDir);
          if (imageBase64) {
            vals[productImageField] = imageBase64;
          }
        } catch (imageError) {
          console.warn(`Aviso imagen ${p.name}: ${imageError.message}`);
        }
      }

      const existingId = await findExistingProductTemplate(client, sku, p.name);
      let templateId = existingId;

      if (existingId && args.mode === "upsert") {
        await client.executeKw("product.template", "write", [[existingId], vals]);
        stats.updated += 1;
        console.log(`Actualizado: ${p.name} (${sku})`);
      } else if (!existingId) {
        templateId = await client.executeKw("product.template", "create", [vals]);
        stats.created += 1;
        console.log(`Creado: ${p.name} (${sku})`);
      } else {
        console.log(`Saltado: ${p.name} (${sku})`);
      }

      if (canSyncStock && defaultLocationId && templateId) {
        try {
          const variantId = await getVariantIdByTemplate(client, templateId);
          if (variantId) {
            await syncStockQty(client, variantId, defaultLocationId, Number(p.stock) || 0);
          }
        } catch (stockError) {
          console.warn(`Aviso stock ${p.name}: ${stockError.message}`);
        }
      }
    } catch (error) {
      stats.failed += 1;
      console.error(`Error en producto ID ${p.id} (${p.name}): ${error.message}`);
    }
  }

  console.log("\nResumen:");
  console.log(`Total: ${stats.total}`);
  console.log(`Creados: ${stats.created}`);
  console.log(`Actualizados: ${stats.updated}`);
  console.log(`Fallidos: ${stats.failed}`);

  if (stats.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fallo general:", error.message);
  process.exit(1);
});
