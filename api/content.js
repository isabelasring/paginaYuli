/**
 * Contenido editable en vivo desde GitHub.
 * GET /api/content?file=site|services|testimonials|results
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

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

function liveImageUrl(imageUrl, version) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith("/api/")) return imageUrl;
  const path = String(imageUrl).replace(/^\.?\/+/, "").split("?")[0];
  const v = version ? `&v=${encodeURIComponent(version)}` : "";
  return `/api/media?path=${encodeURIComponent(path)}${v}`;
}

function rewriteImages(value, version) {
  if (typeof value === "string") {
    if (
      value.startsWith("assets/") ||
      value.startsWith("./assets/") ||
      value.startsWith("/assets/")
    ) {
      return liveImageUrl(value.replace(/^\.?\/+/, ""), version);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => rewriteImages(v, version));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = rewriteImages(v, version);
    return out;
  }
  return value;
}

const ALLOWED = {
  site: "data/site.json",
  services: "data/services.json",
  testimonials: "data/testimonials.json",
  results: "data/results.json",
};

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    return json(res, 405, { error: "Método no permitido" });
  }

  const url = new URL(req.url, "http://localhost");
  const fileKey = String(url.searchParams.get("file") || "").trim();
  const path = ALLOWED[fileKey];
  if (!path) {
    return json(res, 400, {
      error: "Usa ?file=site|services|testimonials|results",
    });
  }

  const { token, owner, repo, branch } = getRepo();

  // Sin token: el front usa fallback a archivos locales
  if (!token) {
    return json(res, 503, { error: "Falta GITHUB_TOKEN", fallback: true });
  }

  try {
    const gh = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "paginaYuli-content",
        },
      }
    );
    const data = await gh.json().catch(() => ({}));
    if (!gh.ok) {
      return json(res, gh.status || 502, {
        error: data.message || "No se pudo leer el contenido de GitHub",
      });
    }

    const raw = Buffer.from(data.content, "base64").toString("utf8");
    const parsed = JSON.parse(raw);
    const version = data.sha || String(Date.now());
    return json(res, 200, {
      ok: true,
      file: fileKey,
      version,
      data: rewriteImages(parsed, version),
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || "Error leyendo contenido" });
  }
};
