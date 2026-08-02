const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const types = ["grasa", "seca", "mixta", "sensible"];
const steps = ["01-limpiar", "02-tonificar", "03-tratar", "04-proteger"];

/** Convierte el fondo crema de la infografía a transparente. */
function clearCreamBackground(data, channels) {
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = channels === 4 ? data[i + 3] : 255;
    if (a === 0) continue;

    // Fondo crema claro ~ #F7F1EB / #FBF8F4 (sin líneas oscuras ni rellenos rosa)
    const avg = (r + g + b) / 3;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max - min;

    const isLightCream = avg > 228 && sat < 28 && r >= g - 2 && g >= b - 6;
    if (isLightCream) {
      if (channels === 4) data[i + 3] = 0;
      else {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }
  }
}

async function cropType(type) {
  const png = path.join(__dirname, "..", "assets", `rutina-piel-${type}.png`);
  const webp = path.join(__dirname, "..", "assets", `rutina-piel-${type}.webp`);
  const src = fs.existsSync(png) ? png : webp;
  const outDir = path.join(__dirname, "..", "assets", "rutinas", type);
  fs.mkdirSync(outDir, { recursive: true });

  const meta = await sharp(src).metadata();
  const { width, height } = meta;

  // Solo producto + adornos (sin círculo de número ni texto)
  const top = Math.round(height * 0.45);
  const cropH = Math.round(height * 0.28);
  const colW = Math.floor(width / 4);
  const insetX = Math.round(colW * 0.1);
  const cropW = colW - insetX * 2;

  for (let i = 0; i < 4; i++) {
    const left = i * colW + insetX;
    const { data, info } = await sharp(src)
      .extract({
        left: Math.max(0, left),
        top: Math.max(0, top),
        width: Math.min(cropW, width - left),
        height: Math.min(cropH, height - top),
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    clearCreamBackground(data, info.channels);

    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels,
      },
    })
      .trim({ threshold: 8 })
      .resize({
        width: 360,
        height: 360,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 93, alphaQuality: 100 })
      .toFile(path.join(outDir, `${steps[i]}.webp`));
  }
  console.log(type, "ok", width, height);
}

async function main() {
  for (const t of types) await cropType(t);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
