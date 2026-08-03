/**
 * Catálogo en vivo desde GitHub (sin esperar redeploy de Vercel).
 * GET /api/catalog
 */
function env(name, fallback = "") {
  const v = process.env[name];
  if (v == null || String(v).trim() === "") return fallback;
  return String(v).trim();
}

function getRepo() {
  return {
    token: env("GITHUB_TOKEN"),
    owner: "isabelasring",
    repo: "paginaYuli",
    branch: env("GITHUB_BRANCH") || "main",
  };
}

function json(res, status, body, cache = "no-store") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

function liveImageUrl(imageUrl, version) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith("/api/")) return imageUrl;
  const path = String(imageUrl).replace(/^\.?\/+/, "");
  const v = version ? `&v=${encodeURIComponent(version)}` : "";
  return `/api/media?path=${encodeURIComponent(path)}${v}`;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    return json(res, 405, { error: "Método no permitido" });
  }

  const { token, owner, repo, branch } = getRepo();
  if (!token) {
    return json(res, 503, {
      error: "Falta GITHUB_TOKEN en Vercel para el catálogo en vivo.",
    });
  }

  try {
    const gh = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/data/products.json?ref=${encodeURIComponent(branch)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "paginaYuli-catalog",
        },
      }
    );
    const data = await gh.json().catch(() => ({}));
    if (!gh.ok) {
      return json(res, gh.status || 502, {
        error: data.message || "No se pudo leer el catálogo de GitHub",
      });
    }

    const raw = Buffer.from(data.content, "base64").toString("utf8");
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) {
      return json(res, 500, { error: "Catálogo inválido" });
    }

    const version = data.sha || String(Date.now());
    const products = list.map((p) => ({
      ...p,
      imageUrl: liveImageUrl(p.imageUrl, version),
      // ruta original por si hace falta
      imagePath: p.imageUrl || "",
    }));

    // Caché muy corta: casi inmediato tras guardar; baja la carga a GitHub
    return json(
      res,
      200,
      { products, source: "live", version, updatedAt: new Date().toISOString() },
      "public, s-maxage=5, stale-while-revalidate=30"
    );
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || "Error al cargar catálogo" });
  }
};
