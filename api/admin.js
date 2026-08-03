/**
 * API admin única: login + guardar productos → commit en GitHub.
 * POST { action: "login", password }
 * POST { action: "save", products, newImages } + Bearer session
 */
const crypto = require("crypto");

function env(name, fallback = "") {
  const v = process.env[name];
  if (v == null || String(v).trim() === "") return fallback;
  return String(v).trim();
}

function getConfig() {
  return {
    password: env("ADMIN_PASSWORD"),
    token: env("GITHUB_TOKEN"),
    owner: env("GITHUB_OWNER") || env("VERCEL_GIT_REPO_OWNER") || "isabelasring",
    repo: env("GITHUB_REPO") || env("VERCEL_GIT_REPO_SLUG") || "paginaYuli",
    branch: env("GITHUB_BRANCH") || env("VERCEL_GIT_COMMIT_REF") || "main",
    secret: env("ADMIN_SECRET") || env("ADMIN_PASSWORD") || "change-me",
  };
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON inválido (foto muy pesada; usa una más liviana)"));
      }
    });
    req.on("error", reject);
  });
}

function makeSessionToken(cfg) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `ys.${exp}`;
  const sig = crypto.createHmac("sha256", cfg.secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifySessionToken(cfg, token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const sig = parts[2];
  const expected = crypto.createHmac("sha256", cfg.secret).update(payload).digest("hex");
  try {
    if (sig.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const exp = Number(parts[1]);
  return Number.isFinite(exp) && Date.now() <= exp;
}

function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function github(path, { method = "GET", body, token, owner, repo, branch } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "paginaYuli-admin",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    let msg = data?.message || `GitHub ${res.status}`;
    if (res.status === 404 || /not found/i.test(msg)) {
      msg =
        `GitHub no encontró el repositorio o la rama (${owner}/${repo} · rama ${branch}). ` +
        `Revisa GITHUB_OWNER=isabelasring, GITHUB_REPO=paginaYuli, GITHUB_BRANCH=main y token con permiso "repo".`;
    } else if (res.status === 401 || res.status === 403) {
      msg =
        "GitHub rechazó el token. Genera otro classic con permiso repo y actualiza GITHUB_TOKEN + Redeploy.";
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function commitFiles({ owner, repo, branch, token, message, files }) {
  await github(`/repos/${owner}/${repo}`, { token, owner, repo, branch });

  let ref;
  try {
    ref = await github(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, {
      token,
      owner,
      repo,
      branch,
    });
  } catch (e) {
    if (e.status === 404 || /no encontró|Not Found/i.test(e.message)) {
      throw new Error(
        `No existe la rama "${branch}" en ${owner}/${repo}. Pon GITHUB_BRANCH=main en Vercel.`
      );
    }
    throw e;
  }

  const latestCommitSha = ref.object.sha;
  const commit = await github(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, {
    token,
    owner,
    repo,
    branch,
  });
  const baseTree = commit.tree.sha;
  const treeItems = [];

  for (const file of files) {
    const blob = await github(`/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      token,
      owner,
      repo,
      branch,
      body: { content: file.content, encoding: file.encoding || "base64" },
    });
    treeItems.push({
      path: file.path.replace(/\\/g, "/"),
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const tree = await github(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    token,
    owner,
    repo,
    branch,
    body: { base_tree: baseTree, tree: treeItems },
  });

  const newCommit = await github(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    token,
    owner,
    repo,
    branch,
    body: {
      message,
      tree: tree.sha,
      parents: [latestCommitSha],
    },
  });

  await github(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    token,
    owner,
    repo,
    branch,
    body: { sha: newCommit.sha },
  });

  return newCommit.sha;
}

function slugify(text) {
  return (
    String(text || "producto")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "producto"
  );
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
      price: Math.round(price * 100) / 100,
      priceOld: priceOld == null ? null : Math.round(priceOld * 100) / 100,
      badge: String(raw.badge || "").trim(),
      imageUrl: String(raw.imageUrl || "").trim(),
      benefits,
      order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : i + 1,
    };
  });
}

async function handleLogin(req, res, cfg, body) {
  if (!cfg.password) {
    return json(res, 503, {
      error: "Falta ADMIN_PASSWORD en Vercel (Environment Variables).",
    });
  }
  if (String(body.password || "") !== cfg.password) {
    return json(res, 401, { error: "Contraseña incorrecta" });
  }
  if (!cfg.token) {
    return json(res, 503, {
      error: "Falta GITHUB_TOKEN en Vercel. Sin eso no se puede guardar.",
    });
  }
  return json(res, 200, {
    ok: true,
    token: makeSessionToken(cfg),
    repo: `${cfg.owner}/${cfg.repo}`,
    branch: cfg.branch,
  });
}

async function handleSave(req, res, cfg, body) {
  if (!cfg.password || !cfg.token) {
    return json(res, 503, {
      error: "Configura ADMIN_PASSWORD y GITHUB_TOKEN en Vercel.",
    });
  }
  if (!verifySessionToken(cfg, getBearer(req))) {
    return json(res, 401, { error: "Sesión inválida o expirada. Vuelve a entrar." });
  }

  let products;
  try {
    products = normalizeList(body.products);
  } catch (e) {
    return json(res, 400, { error: e.message });
  }

  const newImages = Array.isArray(body.newImages) ? body.newImages : [];
  const files = [];

  for (const img of newImages) {
    const id = slugify(img.id || img.fileName || "foto");
    const ext = String(img.fileName || "foto.webp").split(".").pop()?.toLowerCase() || "webp";
    const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "webp";
    const path = `assets/productos/${id}-${Date.now()}.${safeExt}`;
    const base64 = String(img.base64 || "").replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    if (!base64 || base64.length < 32) {
      return json(res, 400, { error: "La foto no se leyó bien. Prueba JPG/PNG más liviano." });
    }
    if (base64.length > 4_000_000) {
      return json(res, 400, { error: "La foto es demasiado pesada (usa menos de 2 MB)." });
    }
    files.push({ path, content: base64, encoding: "base64" });
    const product = products.find((p) => p.id === img.id);
    if (product) product.imageUrl = path;
  }

  for (const p of products) {
    if (!p.imageUrl) {
      return json(res, 400, { error: `Falta foto en: ${p.name}` });
    }
  }

  files.push({
    path: "data/products.json",
    content: Buffer.from(`${JSON.stringify(products, null, 2)}\n`, "utf8").toString("base64"),
    encoding: "base64",
  });

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
      note: "Guardado en GitHub. En 1–2 min se ve en la web.",
      repo: `${cfg.owner}/${cfg.repo}`,
      branch: cfg.branch,
    });
  } catch (e) {
    console.error(e);
    return json(res, e.status && e.status < 600 ? e.status : 500, {
      error: e.message || "No se pudo guardar en GitHub",
      repo: `${cfg.owner}/${cfg.repo}`,
      branch: cfg.branch,
    });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method === "GET") {
    const cfg = getConfig();
    return json(res, 200, {
      ok: true,
      hasPassword: Boolean(cfg.password),
      hasToken: Boolean(cfg.token),
      repo: `${cfg.owner}/${cfg.repo}`,
      branch: cfg.branch,
    });
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Método no permitido" });
  }

  const cfg = getConfig();
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return json(res, 400, { error: e.message || "JSON inválido" });
  }

  const action = body.action || (body.password && !body.products ? "login" : "save");
  if (action === "login") return handleLogin(req, res, cfg, body);
  if (action === "save") return handleSave(req, res, cfg, body);
  return json(res, 400, { error: 'Usa action: "login" o "save"' });
};
