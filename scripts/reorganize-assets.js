/**
 * Reorganiza assets usados en la web en carpetas claras y nombres descriptivos.
 * Ejecutar desde la raíz: node scripts/reorganize-assets.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const assets = path.join(root, "assets");

/** from relative to assets -> to relative to assets */
const MOVES = {
  // Marca
  "logo-ys.webp": "brand/logo-ys.webp",
  "favicon.png": "brand/favicon.png",

  // Inicio
  "hero-tratamiento.webp": "inicio/hero-tratamiento.webp",
  "home-servicios.webp": "inicio/card-servicios.webp",
  "home-productos.webp": "inicio/card-productos.webp",
  "home-clientes.webp": "inicio/card-clientes.webp",
  "atmosfera-espacio.webp": "inicio/atmosfera-espacio.webp",

  // Experiencia (ya en carpeta; renombrar más legible)
  "experiencia/paso-01-reservas.webp": "experiencia/paso-01-reservas.webp",
  "experiencia/paso-02-evaluamos.webp": "experiencia/paso-02-evaluamos.webp",
  "experiencia/paso-03-tratamiento.webp": "experiencia/paso-03-tratamiento.webp",
  "experiencia/paso-04-plan.webp": "experiencia/paso-04-plan.webp",

  // Servicios
  "servicio-limpieza-profunda.webp": "servicios/limpieza-facial-profunda.webp",
  "servicio-premium-1.webp": "servicios/limpieza-premium-resultado-1.webp",
  "servicio-premium-2.webp": "servicios/limpieza-premium-resultado-2.webp",
  "servicio-acne.webp": "servicios/limpieza-acne.webp",
  "servicio-acne-peeling.webp": "servicios/limpieza-acne-peeling.webp",
  "servicio-porcelanizacion.webp": "servicios/porcelanizacion-hidrafacial.webp",
  "servicio-microneedling.webp": "servicios/microneedling-principio-activo.webp",
  "servicio-pink-glow-1.webp": "servicios/microneedling-pink-glow-1.webp",
  "servicio-pink-glow-2.webp": "servicios/microneedling-pink-glow-2.webp",
  "servicio-espalda-1.webp": "servicios/limpieza-espalda-1.webp",
  "servicio-espalda-2.webp": "servicios/limpieza-espalda-2.webp",
  "servicio-masaje.webp": "servicios/masaje-relajacion.webp",

  // Productos
  "products/kit-dermabsolu.webp": "productos/kit-dermabsolu-contorno-ojos.webp",
  "products/cicalfate.webp": "productos/cicalfate-plus-crema.webp",
  "products/vitamin-cg.webp": "productos/serum-vitamin-activ-cg.webp",
  "products/hyaluron-b3.webp": "productos/serum-hyaluron-activ-b3.webp",
  "products/cleanance.webp": "productos/cleanance-aqua-gel.webp",
  "products/hyaluron-b3-noche.webp": "productos/crema-noche-hyaluron-activ-b3.webp",
  "products/agua-termal.webp": "productos/agua-termal-150ml.webp",
  "products/hyaluron-b3-dia.webp": "productos/crema-dia-hyaluron-activ-b3.webp",
  "products/contorno-dermabsolu.webp": "productos/contorno-ojos-dermabsolu.webp",
  "products/protector-solar-spf50.webp": "productos/protector-solar-spf50.webp",
  "products/retrinal-01.webp": "productos/retrinal-crema-01.webp",

  // Sobre mí
  "yuly-retrato.webp": "sobre-mi/yuly-retrato.webp",

  // Rutinas (mantienen estructura)
  "rutinas/grasa/01-limpiar.webp": "rutinas/piel-grasa/01-limpiar.webp",
  "rutinas/grasa/02-tonificar.webp": "rutinas/piel-grasa/02-tonificar.webp",
  "rutinas/grasa/03-tratar.webp": "rutinas/piel-grasa/03-tratar.webp",
  "rutinas/grasa/04-proteger.webp": "rutinas/piel-grasa/04-proteger.webp",
  "rutinas/seca/01-limpiar.webp": "rutinas/piel-seca/01-limpiar.webp",
  "rutinas/seca/02-tonificar.webp": "rutinas/piel-seca/02-tonificar.webp",
  "rutinas/seca/03-tratar.webp": "rutinas/piel-seca/03-tratar.webp",
  "rutinas/seca/04-proteger.webp": "rutinas/piel-seca/04-proteger.webp",
  "rutinas/mixta/01-limpiar.webp": "rutinas/piel-mixta/01-limpiar.webp",
  "rutinas/mixta/02-tonificar.webp": "rutinas/piel-mixta/02-tonificar.webp",
  "rutinas/mixta/03-tratar.webp": "rutinas/piel-mixta/03-tratar.webp",
  "rutinas/mixta/04-proteger.webp": "rutinas/piel-mixta/04-proteger.webp",
  "rutinas/sensible/01-limpiar.webp": "rutinas/piel-sensible/01-limpiar.webp",
  "rutinas/sensible/02-tonificar.webp": "rutinas/piel-sensible/02-tonificar.webp",
  "rutinas/sensible/03-tratar.webp": "rutinas/piel-sensible/03-tratar.webp",
  "rutinas/sensible/04-proteger.webp": "rutinas/piel-sensible/04-proteger.webp",
};

// Resultados: 2..18 → testimonios/antes-despues/caso-01..17
const resultIds = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
resultIds.forEach((id, i) => {
  const n = String(i + 1).padStart(2, "0");
  MOVES[`resultados/${id}.webp`] = `testimonios/antes-despues/caso-${n}.webp`;
});

// Fallbacks si no existe webp del producto
const FALLBACKS = {
  "products/vitamin-cg.webp": "products/vitamin-cg.png",
  "products/agua-termal.webp": "products/agua-termal.jpg",
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  let moved = 0;
  let missing = 0;

  for (const [fromRel, toRel] of Object.entries(MOVES)) {
    let from = path.join(assets, fromRel);
    const to = path.join(assets, toRel);

    if (!fs.existsSync(from) && FALLBACKS[fromRel]) {
      const alt = path.join(assets, FALLBACKS[fromRel]);
      if (fs.existsSync(alt)) {
        // destino con extensión del fallback
        const ext = path.extname(alt);
        const toAlt = to.replace(/\.webp$/i, ext);
        ensureDir(toAlt);
        if (path.resolve(from) === path.resolve(toAlt)) continue;
        fs.copyFileSync(alt, toAlt);
        console.log("copy+rename", FALLBACKS[fromRel], "->", path.relative(assets, toAlt));
        moved++;
        continue;
      }
    }

    if (!fs.existsSync(from)) {
      console.warn("missing", fromRel);
      missing++;
      continue;
    }

    if (path.resolve(from) === path.resolve(to)) {
      continue;
    }

    ensureDir(to);
    fs.copyFileSync(from, to);
    console.log("->", toRel);
    moved++;
  }

  console.log({ moved, missing });
}

main();
