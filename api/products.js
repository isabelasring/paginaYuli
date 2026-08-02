const {
  getConfig,
  json,
  readBody,
  verifySessionToken,
  getBearer,
  commitFiles,
} = require("../lib/admin-github");

function slugify(text) {
  return String(text || "producto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "producto";
}

function normalizeList(list) {
  if (!Array.isArray(list)) throw new Error("products debe ser un array");
  return list.map((raw, i) => {
    const id =
      String(raw.id || "")
        .trim()
        .replace(/[^\w-]+/g, "") || `prod-${Date.now()}-${i}`;
    const benefits = Array.isArray(raw.benefits)
      ? raw.benefits.map((b) => String(b).trim()).filter(Boolean)
      : String(raw.benefits || "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

    const price = Number(raw.price);
    if (!String(raw.name || "").trim()) throw new Error("Cada producto necesita nombre");
    if (!Number.isFinite(price)) throw new Error(`Precio inválido en: ${raw.name}`);

    let priceOld = raw.priceOld;
    if (priceOld === "" || priceOld == null) priceOld = null;
    else {
      priceOld = Number(priceOld);
      if (!Number.isFinite(priceOld)) priceOld = null;
    }

    return {
      id,
      name: String(raw.name).trim(),
      brand: String(raw.brand || "Eau Thermale Avène").trim(),
      category: String(raw.category || "tratamiento").trim(),
      price: Math.round(price),
      priceOld: priceOld == null ? null : Math.round(priceOld),
      badge: String(raw.badge || "").trim(),
      imageUrl: String(raw.imageUrl || "").trim(),
      benefits,
      order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : i + 1,
    };
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Método no permitido" });
  }

  const cfg = getConfig();
  if (!cfg.password || !cfg.token) {
    return json(res, 503, {
      error: "Configura ADMIN_PASSWORD y GITHUB_TOKEN en Vercel antes de guardar.",
    });
  }

  const token = getBearer(req);
  if (!verifySessionToken(cfg, token)) {
    return json(res, 401, { error: "Sesión inválida o expirada. Vuelve a entrar." });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "JSON inválido" });
  }

  let products;
  try {
    products = normalizeList(body.products);
  } catch (e) {
    return json(res, 400, { error: e.message });
  }

  // Imágenes nuevas: { id, fileName, base64, contentType }
  const newImages = Array.isArray(body.newImages) ? body.newImages : [];
  const files = [];
  const jsonPretty = `${JSON.stringify(products, null, 2)}\n`;

  files.push({
    path: "data/products.json",
    content: Buffer.from(jsonPretty, "utf8").toString("base64"),
    encoding: "base64",
  });

  for (const img of newImages) {
    const id = slugify(img.id || img.fileName || "foto");
    const ext = String(img.fileName || "foto.webp").split(".").pop()?.toLowerCase() || "webp";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "webp";
    const path = `assets/productos/${id}-${Date.now()}.${safeExt}`;
    const base64 = String(img.base64 || "").replace(/^data:image\/\w+;base64,/, "");
    if (!base64) continue;
    // límite práctico ~4.5MB en serverless body; el cliente debe comprimir un poco
    files.push({ path, content: base64, encoding: "base64" });
    const product = products.find((p) => p.id === img.id);
    if (product) product.imageUrl = path;
  }

  // reescribir json por si se actualizaron imageUrl
  files[0] = {
    path: "data/products.json",
    content: Buffer.from(`${JSON.stringify(products, null, 2)}\n`, "utf8").toString("base64"),
    encoding: "base64",
  };

  try {
    const sha = await commitFiles({
      owner: cfg.owner,
      repo: cfg.repo,
      branch: cfg.branch,
      token: cfg.token,
      message: `Admin: actualiza catálogo de productos (${products.length})`,
      files,
    });
    return json(res, 200, {
      ok: true,
      commit: sha,
      products,
      note: "Guardado en GitHub. En 1–2 min Vercel lo publica en la web.",
    });
  } catch (e) {
    console.error(e);
    return json(res, e.status || 500, {
      error: e.message || "No se pudo guardar en GitHub",
      details: e.data || null,
    });
  }
};
