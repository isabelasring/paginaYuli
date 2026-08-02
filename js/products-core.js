/**
 * Catálogo de productos: carga desde Firebase o seed local.
 */
(function () {
  const CATEGORY_LABELS = {
    limpieza: "Limpieza",
    hidratacion: "Hidratación",
    tratamiento: "Tratamiento",
    proteccion: "Protección",
  };

  let firebaseApp = null;
  let db = null;
  let storage = null;
  let auth = null;

  function formatPrice(value) {
    if (value == null || value === "") return "";
    const n = typeof value === "number" ? value : parsePrice(value);
    if (n == null) return String(value);
    return `$${n.toLocaleString("es-CO")}`;
  }

  function parsePrice(str) {
    if (str == null || str === "") return null;
    if (typeof str === "number" && Number.isFinite(str)) return Math.round(str);
    const digits = String(str).replace(/[^\d]/g, "");
    if (!digits) return null;
    return Number(digits);
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

  function initFirebase() {
    if (!window.isFirebaseConfigured || !window.isFirebaseConfigured()) return false;
    if (typeof firebase === "undefined") return false;
    if (firebaseApp) return true;
    firebaseApp = firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    return true;
  }

  function getFirebase() {
    initFirebase();
    return { app: firebaseApp, auth, db, storage };
  }

  async function loadSeed() {
    const res = await fetch("data/products-seed.json", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar el catálogo base");
    const list = await res.json();
    return list.map((p, i) => normalizeProduct({ ...p, id: p.id || `seed-${i}` }));
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
      brand: raw.brand || "Eau Thermale Avène",
      category: raw.category || "tratamiento",
      price: parsePrice(raw.price),
      priceOld: parsePrice(raw.priceOld),
      badge: raw.badge || "",
      imageUrl: raw.imageUrl || "",
      benefits,
      order: typeof raw.order === "number" ? raw.order : 999,
    };
  }

  async function loadFromFirestore() {
    const { db: database } = getFirebase();
    if (!database) return null;
    const snap = await database.collection("products").orderBy("order", "asc").get();
    if (snap.empty) return [];
    return snap.docs.map((doc) => normalizeProduct(doc.data(), doc.id));
  }

  async function loadProducts() {
    if (initFirebase()) {
      try {
        const remote = await loadFromFirestore();
        if (remote && remote.length) return { products: remote, source: "firebase" };
        if (remote && remote.length === 0) {
          const seed = await loadSeed();
          return { products: seed, source: "seed-empty-firebase" };
        }
      } catch (err) {
        console.warn("Firebase productos:", err);
      }
    }
    const seed = await loadSeed();
    return { products: seed, source: "seed" };
  }

  function badgeClass(badge) {
    const b = String(badge || "").toLowerCase();
    if (b.includes("nuevo") || b === "new") return "product-card__badge product-card__badge--new";
    return "product-card__badge";
  }

  function productCardHtml(product) {
    const catLabel = CATEGORY_LABELS[product.category] || product.category;
    const badge =
      product.badge
        ? `<span class="${badgeClass(product.badge)}">${escapeHtml(product.badge)}</span>`
        : "";
    const oldPrice =
      product.priceOld != null
        ? `<span class="price price--old">${escapeHtml(formatPrice(product.priceOld))}</span>`
        : "";
    const benefits = (product.benefits || [])
      .map((b) => `<li>${escapeHtml(b)}</li>`)
      .join("");

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

  async function saveProduct(product, file) {
    const { auth: a, db: database, storage: st } = getFirebase();
    if (!a?.currentUser || !database) {
      throw new Error("Debes iniciar sesión para guardar.");
    }

    const data = normalizeProduct(product);
    let imageUrl = data.imageUrl || "";

    if (file) {
      if (!st) throw new Error("Storage no está disponible.");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `products/${Date.now()}-${safeName}`;
      const ref = st.ref().child(path);
      await ref.put(file);
      imageUrl = await ref.getDownloadURL();
    }

    if (!imageUrl) throw new Error("Agrega una foto del producto.");

    const payload = {
      name: data.name,
      brand: data.brand,
      category: data.category,
      price: data.price,
      priceOld: data.priceOld,
      badge: data.badge || "",
      imageUrl,
      benefits: data.benefits,
      order: data.order,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (data.id) {
      await database.collection("products").doc(data.id).set(payload, { merge: true });
      return data.id;
    }

    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    const docRef = await database.collection("products").add(payload);
    return docRef.id;
  }

  async function deleteProduct(id) {
    const { auth: a, db: database } = getFirebase();
    if (!a?.currentUser || !database) throw new Error("Debes iniciar sesión.");
    await database.collection("products").doc(id).delete();
  }

  async function seedToFirebase(force = false) {
    const { auth: a, db: database } = getFirebase();
    if (!a?.currentUser || !database) throw new Error("Debes iniciar sesión.");

    const existing = await database.collection("products").limit(1).get();
    if (!existing.empty && !force) {
      throw new Error("Ya hay productos en la nube. Usa “Forzar” solo si quieres duplicar el catálogo base.");
    }

    const seed = await loadSeed();
    const batch = database.batch();
    seed.forEach((p) => {
      const ref = database.collection("products").doc(p.id);
      batch.set(ref, {
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        priceOld: p.priceOld,
        badge: p.badge || "",
        imageUrl: p.imageUrl,
        benefits: p.benefits,
        order: p.order,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    return seed.length;
  }

  window.ProductsCore = {
    CATEGORY_LABELS,
    formatPrice,
    parsePrice,
    escapeHtml,
    initFirebase,
    getFirebase,
    loadProducts,
    loadSeed,
    mountPublicCatalog,
    productCardHtml,
    saveProduct,
    deleteProduct,
    seedToFirebase,
    normalizeProduct,
  };
})();
