/**
 * Catálogo de productos desde data/products.json (también actualizable desde /admin).
 */
(function () {
  const CATEGORY_LABELS = {
    limpieza: "Limpieza",
    hidratacion: "Hidratación",
    tratamiento: "Tratamiento",
    proteccion: "Protección",
  };

  /**
   * Formato pesos colombianos: $191.800 o $191.800,50
   * (punto = miles, coma = decimales)
   */
  function formatPrice(value, { withCents = true } = {}) {
    if (value == null || value === "") return "";
    const n = typeof value === "number" ? value : parsePrice(value);
    if (n == null || !Number.isFinite(n)) return String(value);
    return (
      "$" +
      n.toLocaleString("es-CO", {
        minimumFractionDigits: withCents ? 2 : 0,
        maximumFractionDigits: 2,
      })
    );
  }

  /**
   * Interpreta precios en formato colombiano o numérico.
   * Acepta: 191800 | 191.800 | 191.800,50 | $191.800,00
   */
  function parsePrice(str) {
    if (str == null || str === "") return null;
    if (typeof str === "number" && Number.isFinite(str)) {
      return Math.round(str * 100) / 100;
    }

    let s = String(str).trim().replace(/\$/g, "").replace(/\s/g, "");
    if (!s) return null;

    // Formato con decimales: 1.234.567,89
    if (s.includes(",")) {
      const parts = s.split(",");
      const decimals = (parts.pop() || "").replace(/\D/g, "").slice(0, 2);
      const integer = parts.join("").replace(/\./g, "").replace(/\D/g, "");
      if (!integer && !decimals) return null;
      const n = Number(`${integer || "0"}.${decimals || "0"}`);
      return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
    }

    // Solo puntos como separador de miles: 191.800
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      const n = Number(s.replace(/\./g, ""));
      return Number.isFinite(n) ? n : null;
    }

    // Punto como decimal (estilo tech): 191800.5
    if (/^\d+\.\d{1,2}$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
    }

    // Solo dígitos
    const digits = s.replace(/[^\d]/g, "");
    if (!digits) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
  }

  /** Solo separadores de miles, sin símbolo $ (para inputs del admin). */
  function formatPriceInput(value) {
    if (value == null || value === "") return "";
    const n = typeof value === "number" ? value : parsePrice(value);
    if (n == null || !Number.isFinite(n)) return "";
    return n.toLocaleString("es-CO", {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function searchName(product) {
    return `${product.brand || ""} ${product.name || ""}`.toLowerCase().trim();
  }

  function normalizeProduct(raw, id) {
    const benefits = Array.isArray(raw.benefits)
      ? raw.benefits.filter(Boolean)
      : String(raw.benefits || "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

    return {
      id: id || raw.id || "",
      name: raw.name || "",
      brand: raw.brand || "",
      category: raw.category || "tratamiento",
      price: parsePrice(raw.price),
      priceOld: parsePrice(raw.priceOld),
      badge: raw.badge || "",
      imageUrl: raw.imageUrl || "",
      benefits,
      order: typeof raw.order === "number" ? raw.order : 999,
    };
  }

  async function loadProducts() {
    // 1) Catálogo en vivo (GitHub vía API) — cambios se ven en segundos
    try {
      const live = await fetch(`/api/catalog?t=${Date.now()}`, { cache: "no-store" });
      if (live.ok) {
        const data = await live.json();
        const products = (Array.isArray(data.products) ? data.products : []).map((p, i) =>
          normalizeProduct({ ...p, id: p.id || `p-${i}` }, p.id)
        );
        products.sort((a, b) => (a.order || 0) - (b.order || 0));
        return { products, source: "live", version: data.version };
      }
    } catch (e) {
      console.warn("Catálogo en vivo no disponible, usando archivo local", e);
    }

    // 2) Fallback local / sin API (dev con only serve)
    const res = await fetch(`data/products.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar el catálogo");
    const list = await res.json();
    const products = (Array.isArray(list) ? list : []).map((p, i) =>
      normalizeProduct({ ...p, id: p.id || `p-${i}` })
    );
    products.sort((a, b) => (a.order || 0) - (b.order || 0));
    return { products, source: "file" };
  }

  /** Para el admin: ver fotos subidas de inmediato aunque no haya redeploy. */
  function toLiveImageUrl(imageUrl) {
    if (!imageUrl) return "";
    if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith("/api/")) return imageUrl;
    const path = String(imageUrl).replace(/^\.?\/+/, "");
    return `/api/media?path=${encodeURIComponent(path)}&v=${Date.now()}`;
  }

  function badgeClass(badge) {
    const b = String(badge || "").toLowerCase();
    if (b.includes("nuevo") || b === "new") return "product-card__badge product-card__badge--new";
    return "product-card__badge";
  }

  function productCardHtml(product) {
    const catLabel = CATEGORY_LABELS[product.category] || product.category;
    const badge = product.badge
      ? `<span class="${badgeClass(product.badge)}">${escapeHtml(product.badge)}</span>`
      : "";
    const oldPrice =
      product.priceOld != null
        ? `<span class="price price--old">${escapeHtml(formatPrice(product.priceOld))}</span>`
        : "";
    const benefits = (product.benefits || []).map((b) => `<li>${escapeHtml(b)}</li>`).join("");

    return `
      <article class="product-card reveal is-visible" data-category="${escapeHtml(product.category)}" data-name="${escapeHtml(searchName(product))}" data-id="${escapeHtml(product.id)}">
        ${badge}
        <div class="product-card__inner">
          <div class="product-card__face product-card__face--front">
            <div class="product-card__media">
              <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />
            </div>
            <div class="product-card__body">
              <span class="product-card__brand">${escapeHtml(product.brand)}</span>
              <span class="product-card__cat">${escapeHtml(catLabel)}</span>
              <h3>${escapeHtml(product.name)}</h3>
              <div class="product-card__meta">
                <span class="price">${escapeHtml(formatPrice(product.price))}</span>
                ${oldPrice}
              </div>
              <p class="product-card__note">Toca para ver beneficios</p>
            </div>
          </div>
          <div class="product-card__face product-card__face--back">
            <strong>Beneficios</strong>
            <ul>${benefits || "<li>Consulta por WhatsApp para más información</li>"}</ul>
          </div>
        </div>
      </article>
    `;
  }

  async function mountPublicCatalog() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;

    grid.innerHTML = `<p class="products__status" id="productsStatus">Cargando catálogo…</p>`;

    try {
      const { products, source } = await loadProducts();
      if (!products.length) {
        grid.innerHTML = `<p class="products__status">Aún no hay productos publicados.</p>`;
        return { products, source };
      }
      grid.innerHTML = products.map(productCardHtml).join("");
      return { products, source };
    } catch (err) {
      console.error(err);
      grid.innerHTML = `<p class="products__status">No se pudo cargar el catálogo. Intenta recargar.</p>`;
      return { products: [], source: "error" };
    }
  }

  window.ProductsCore = {
    CATEGORY_LABELS,
    formatPrice,
    formatPriceInput,
    parsePrice,
    escapeHtml,
    loadProducts,
    mountPublicCatalog,
    productCardHtml,
    normalizeProduct,
    toLiveImageUrl,
  };
})();
