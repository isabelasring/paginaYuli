const { getConfig, json, readBody, makeSessionToken } = require("../lib/admin-github");

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
  if (!cfg.password) {
    return json(res, 503, {
      error: "Falta ADMIN_PASSWORD en Vercel (Settings → Environment Variables).",
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Petición inválida" });
  }

  const password = String(body.password || "");
  if (password !== cfg.password) {
    return json(res, 401, { error: "Contraseña incorrecta" });
  }

  if (!cfg.token) {
    return json(res, 503, {
      error: "Falta GITHUB_TOKEN en Vercel. Sin eso no se pueden guardar cambios en el repo.",
    });
  }

  return json(res, 200, { token: makeSessionToken(cfg), ok: true });
};
