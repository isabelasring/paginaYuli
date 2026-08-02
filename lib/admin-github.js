/**
 * Helpers compartidos para las API de Vercel (admin → GitHub).
 */
const crypto = require("crypto");

function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

function getConfig() {
  return {
    password: env("ADMIN_PASSWORD"),
    token: env("GITHUB_TOKEN"),
    owner: env("GITHUB_OWNER", "isabelasring"),
    repo: env("GITHUB_REPO", "paginaYuli"),
    branch: env("GITHUB_BRANCH", "main"),
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
      } catch (e) {
        reject(new Error("JSON inválido"));
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
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function github(path, { method = "GET", body, token } = {}) {
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
    const msg = data?.message || `GitHub ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** Un solo commit con varios archivos (json + imágenes). */
async function commitFiles({ owner, repo, branch, token, message, files }) {
  // files: [{ path, content (utf8 string for text OR Buffer/base64 for binary), encoding: 'utf-8'|'base64' }]
  const ref = await github(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, { token });
  const latestCommitSha = ref.object.sha;
  const commit = await github(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, { token });
  const baseTree = commit.tree.sha;

  const treeItems = [];
  for (const file of files) {
    const blob = await github(`/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      token,
      body: {
        content: file.content,
        encoding: file.encoding || "utf-8",
      },
    });
    treeItems.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const tree = await github(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    token,
    body: {
      base_tree: baseTree,
      tree: treeItems,
    },
  });

  const newCommit = await github(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    token,
    body: {
      message,
      tree: tree.sha,
      parents: [latestCommitSha],
    },
  });

  await github(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    token,
    body: { sha: newCommit.sha },
  });

  return newCommit.sha;
}

module.exports = {
  getConfig,
  json,
  readBody,
  makeSessionToken,
  verifySessionToken,
  getBearer,
  github,
  commitFiles,
};
