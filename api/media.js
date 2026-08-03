/**
 * Sirve imágenes del repo desde GitHub al instante (sin redeploy).
 * GET /api/media?path=assets/productos/archivo.webp
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

function sendError(res, status, msg) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ error: msg }));
}

function contentTypeFor(path) {
  const ext = path.split(".").pop()?.toLowerCase();
  const map = {
    webp: "image/webp",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    json: "application/json",
  };
  return map[ext] || "application/octet-stream";
}

function safeAssetPath(raw) {
  const path = String(raw || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\0/g, "");
  if (!path || path.includes("..") || path.includes("//")) return null;
  if (!path.startsWith("assets/")) return null;
  return path;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    return sendError(res, 405, "Método no permitido");
  }

  const url = new URL(req.url, "http://localhost");
  const path = safeAssetPath(url.searchParams.get("path") || "");
  if (!path) {
    return sendError(res, 400, "Ruta de imagen no válida");
  }

  const { token, owner, repo, branch } = getRepo();
  if (!token) {
    return sendError(res, 503, "Falta GITHUB_TOKEN");
  }

  try {
    const gh = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "paginaYuli-media",
        },
      }
    );
    const data = await gh.json().catch(() => ({}));
    if (!gh.ok) {
      return sendError(res, gh.status || 404, data.message || "Archivo no encontrado");
    }
    if (data.encoding !== "base64" || !data.content) {
      return sendError(res, 502, "No se pudo leer el archivo");
    }

    const buf = Buffer.from(data.content.replace(/\n/g, ""), "base64");
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypeFor(path));
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(buf);
  } catch (e) {
    console.error(e);
    return sendError(res, 500, e.message || "Error al servir la imagen");
  }
};
