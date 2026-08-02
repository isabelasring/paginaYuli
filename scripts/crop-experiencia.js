const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const src = path.join(__dirname, "..", "assets", "experiencia.png");
const outDir = path.join(__dirname, "..", "assets", "experiencia");

const steps = [
  { name: "paso-01-reservas", insetL: 0.04, insetR: 0.08, top: 0.3, h: 0.36 },
  { name: "paso-02-evaluamos", insetL: 0.09, insetR: 0.09, top: 0.3, h: 0.36 },
  { name: "paso-03-tratamiento", insetL: 0.04, insetR: 0.04, top: 0.335, h: 0.34 },
  { name: "paso-04-plan", insetL: 0.12, insetR: 0.04, top: 0.3, h: 0.34 },
];

function isCreamBg(r, g, b) {
  const avg = (r + g + b) / 3;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  return avg > 240 && sat < 18 && r >= g - 1 && g >= b - 3;
}

function floodClearBackground(data, width, height, channels) {
  const seen = new Uint8Array(width * height);
  const q = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (seen[i]) return;
    const o = i * channels;
    if (!isCreamBg(data[o], data[o + 1], data[o + 2])) return;
    seen[i] = 1;
    q.push(i);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (q.length) {
    const i = q.pop();
    data[i * channels + 3] = 0;
    const x = i % width;
    const y = (i / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const meta = await sharp(src).metadata();
  const { width, height } = meta;
  const colW = Math.floor(width / 4);

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const insetL = Math.round(colW * s.insetL);
    const insetR = Math.round(colW * s.insetR);
    const left = i * colW + insetL;
    const cropW = colW - insetL - insetR;
    const top = Math.round(height * s.top);
    const cropH = Math.round(height * s.h);

    let img = sharp(src).extract({
      left: Math.max(0, left),
      top: Math.max(0, top),
      width: Math.min(cropW, width - left),
      height: Math.min(cropH, height - top),
    });

    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    floodClearBackground(data, info.width, info.height, info.channels);

    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels,
      },
    })
      .trim({ threshold: 3 })
      .extend({
        top: 56,
        bottom: 56,
        left: 56,
        right: 56,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .resize({
        width: 520,
        height: 520,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 95, alphaQuality: 100 })
      .toFile(path.join(outDir, `${s.name}.webp`));
  }

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
