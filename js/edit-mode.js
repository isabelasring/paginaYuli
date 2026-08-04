/**
 * Modo edición visual (?edit=1): lapicitos sobre la web real.
 * Requiere sesión admin (localStorage ys_admin_token, compartido con admin.html).
 */
(function () {
  const TOKEN_KEY = "ys_admin_token";
  const PENCIL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

  let site = null;
  let services = null;
  let testimonials = null;
  let results = null;
  let products = [];
  let pendingImage = null;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stripLive(url) {
    if (!url) return "";
    const m = String(url).match(/[?&]path=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
    return String(url).split("?")[0];
  }

  function toRepo(data) {
    const walk = (node) => {
      if (typeof node === "string") return stripLive(node);
      if (Array.isArray(node)) return node.map(walk);
      if (node && typeof node === "object") {
        const out = {};
        for (const [k, v] of Object.entries(node)) out[k] = walk(v);
        return out;
      }
      return node;
    };
    return walk(JSON.parse(JSON.stringify(data)));
  }

  async function api(body) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  async function saveFile(file, data, newImages = []) {
    return api({
      action: "saveContent",
      file,
      data: toRepo(data),
      newImages,
    });
  }

  function liveify(value, version = Date.now()) {
    if (typeof value === "string") {
      if (
        value.startsWith("assets/") ||
        value.startsWith("./assets/") ||
        value.startsWith("/assets/")
      ) {
        const path = value.replace(/^\.?\/+/, "").split("?")[0];
        return `/api/media?path=${encodeURIComponent(path)}&v=${encodeURIComponent(version)}`;
      }
      return value;
    }
    if (Array.isArray(value)) return value.map((v) => liveify(v, version));
    if (value && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = liveify(v, version);
      return out;
    }
    return value;
  }

  function getByPath(obj, pathStr) {
    const parts = String(pathStr || "")
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .filter(Boolean);
    let cur = obj;
    for (const key of parts) {
      if (cur == null) return "";
      cur = cur[/^\d+$/.test(key) ? Number(key) : key];
    }
    return cur;
  }

  function teardownEditUi() {
    document.querySelectorAll(".cms-wrap--img").forEach((wrapEl) => {
      const img = wrapEl.querySelector("img");
      wrapEl.querySelector(".cms-pencil")?.remove();
      if (img) wrapEl.parentNode?.insertBefore(img, wrapEl);
      wrapEl.remove();
    });
    document.querySelectorAll(".cms-pencil").forEach((btn) => btn.remove());
    document.querySelectorAll("[data-cms-edit]").forEach((el) => {
      delete el.dataset.cmsEdit;
      el.classList.remove("is-hot");
    });
    document.querySelectorAll(".cms-section-add").forEach((el) => el.remove());
  }

  function flashSaved(msg) {
    let el = document.getElementById("cmsSavedToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "cmsSavedToast";
      el.className = "cms-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(flashSaved._t);
    flashSaved._t = setTimeout(() => el.classList.remove("is-on"), 2500);
  }

  function rebindAll() {
    bindHero();
    bindPromesa();
    bindExperiencia();
    bindAtmosfera();
    bindRutinas();
    bindInicioCita();
    bindAbout();
    bindServices();
    bindProducts();
    bindTestimonials();
    bindResults();
    fabs();
  }

  async function refreshAfterSave(result, { previewImg, previewBase64, setPath } = {}) {
    const version = Date.now();
    if (result?.file === "site" && result.data) site = result.data;
    if (result?.file === "services" && result.data) services = result.data;
    if (result?.file === "testimonials" && result.data) testimonials = result.data;
    if (result?.file === "results" && result.data) results = result.data;

    // Productos guardados
    if (Array.isArray(result?.products)) {
      products = result.products.map((p, i) => {
        const n = ProductsCore.normalizeProduct(p, p.id || `p-${i}`);
        n.imagePath = stripLive(p.imageUrl || n.imageUrl);
        n.imageUrl = ProductsCore.toLiveImageUrl(n.imagePath);
        return n;
      });
      const grid = document.getElementById("productsGrid");
      if (grid && window.ProductsCore?.productCardHtml) {
        grid.innerHTML = products.map((p) => ProductsCore.productCardHtml(p)).join("");
        if (window.initProductFlips) window.initProductFlips();
        if (window.initProductFilters) window.initProductFilters();
      }
      teardownEditUi();
      rebindAll();
      flashSaved("Producto guardado · ya lo ves aquí");
      return;
    }

    // Vista inmediata de la foto nueva
    const imgEl =
      previewImg?.tagName === "IMG" ? previewImg : previewImg?.querySelector?.("img");
    if (imgEl && previewBase64) {
      imgEl.src = previewBase64;
    }

    // Servicios / testimonios / resultados: flash y recarga corta (carruseles)
    if (result?.file && result.file !== "site") {
      flashSaved("Guardado · ya se ve la foto");
      setTimeout(() => {
        const u = new URL(location.href);
        u.searchParams.set("edit", "1");
        u.searchParams.set("t", String(Date.now()));
        location.replace(u.pathname + u.search + u.hash);
      }, 650);
      return;
    }

    teardownEditUi();

    if (window.SiteCMS?.applyBundle) {
      SiteCMS.applyBundle({
        site: site ? liveify(site, version) : null,
        services: services ? liveify(services, version) : null,
        testimonials: testimonials ? liveify(testimonials, version) : null,
        results: results ? liveify(results, version) : null,
      });
    }

    if (imgEl && previewBase64) {
      imgEl.src = previewBase64;
      const repoPath = setPath && result?.data ? getByPath(result.data, setPath) : "";
      if (repoPath && String(repoPath).startsWith("assets/")) {
        setTimeout(() => {
          imgEl.src = `/api/media?path=${encodeURIComponent(repoPath)}&v=${Date.now()}`;
        }, 1800);
      }
    }

    rebindAll();
    flashSaved("Guardado · ya lo ves aquí");
  }

  function ensureStyles() {
    if (document.getElementById("cmsEditStyles")) return;
    const style = document.createElement("style");
    style.id = "cmsEditStyles";
    style.textContent = `
      .cms-wrap--img { position: relative; display: inline-block; line-height: 0; max-width: 100%; overflow: visible; }
      .cms-pencil {
        position: absolute; top: 8px; right: 8px; z-index: 40;
        width: 34px; height: 34px; border-radius: 50%;
        border: 2px solid #fff; background: #b07a68; color: #fff;
        display: grid; place-items: center; cursor: pointer;
        box-shadow: 0 6px 16px rgba(79,52,42,.28);
      }
      .cms-pencil:hover { background: #8f5f50; transform: scale(1.06); }
      .cms-pencil svg { width: 15px; height: 15px; }
      [data-cms-edit] { position: relative; }
      [data-cms-edit].is-hot { outline: 2px dashed rgba(176,122,104,.7); outline-offset: 4px; border-radius: 8px; }
      body.cms-editing .product-card {
        overflow: visible !important;
      }
      /* media sigue con overflow hidden para que la foto no se salga */
      body.cms-editing .service-card__media {
        overflow: hidden !important;
      }
      body.cms-editing .testimonials__track {
        overflow-x: auto !important;
        overflow-y: visible !important;
        padding-top: 0.35rem;
        padding-right: 0.35rem;
      }
      body.cms-editing .services-carousel__viewport {
        overflow: visible !important;
        padding-top: 0.5rem;
      }
      body.cms-editing .service-card__media > .cms-pencil,
      body.cms-editing .ba-case > .cms-pencil,
      body.cms-editing .experience-step__visual > .cms-pencil,
      body.cms-editing .home-invite__media > .cms-pencil,
      body.cms-editing .home-atmosphere__visual > .cms-pencil,
      body.cms-editing .about__frame > .cms-pencil,
      body.cms-editing .hero__frame > .cms-pencil {
        top: 10px;
        right: 10px;
      }
      .cms-toast {
        position: fixed; left: 50%; bottom: 1.25rem; z-index: 10060;
        transform: translateX(-50%) translateY(120%);
        background: #2f2926; color: #fbf7f2; padding: 0.7rem 1.15rem;
        border-radius: 999px; font-family: Outfit, system-ui, sans-serif; font-size: 0.85rem;
        box-shadow: 0 12px 30px rgba(0,0,0,.25); transition: transform .25s ease; pointer-events: none;
      }
      .cms-toast.is-on { transform: translateX(-50%) translateY(0); }
      .cms-bar {
        position: fixed; top: 0.75rem; right: 0.75rem; z-index: 10001;
        display: flex; gap: 0.4rem;
      }
      .cms-bar a, .cms-bar button {
        border: 0; border-radius: 999px; padding: 0.55rem 0.9rem;
        background: #2f2926; color: #fbf7f2; font-weight: 500; cursor: pointer;
        box-shadow: 0 8px 22px rgba(47,41,38,.28); text-decoration: none;
        font-family: Outfit, system-ui, sans-serif; font-size: 0.78rem;
      }
      .cms-fab {
        position: fixed; bottom: 1.25rem; right: 1.25rem; z-index: 10001;
        display: flex; flex-direction: column; gap: .5rem;
      }
      .cms-section-add {
        display: flex; justify-content: center; margin: 0.85rem 0 1rem;
      }
      .cms-section-add--after {
        margin: 1rem 0 0.5rem;
      }
      .cms-section-add button, .cms-fab button {
        border: 0; border-radius: 999px; padding: .75rem 1.1rem;
        background: #b07a68; color: #fff; font-weight: 600; cursor: pointer;
        box-shadow: 0 10px 28px rgba(79,52,42,.25);
        font-family: Outfit, system-ui, sans-serif; font-size: .82rem;
      }
      .cms-section-add button:hover, .cms-fab button:hover { background: #8f5f50; }
      .cms-modal[hidden] { display: none !important; }
      .cms-modal { position: fixed; inset: 0; z-index: 10050; display: grid; place-items: center; padding: 1rem; }
      .cms-modal__bg { position: absolute; inset: 0; background: rgba(47,41,38,.45); }
      .cms-modal__card {
        position: relative; width: min(440px, 100%); background: #fff;
        border-radius: 18px; padding: 1.25rem; box-shadow: 0 20px 50px rgba(0,0,0,.2);
        font-family: Outfit, system-ui, sans-serif; color: #2f2926;
      }
      .cms-modal__card h3 { font-family: Cormorant Garamond, Georgia, serif; font-size: 1.5rem; margin: 0 0 .75rem; }
      .cms-modal__card label { display: grid; gap: .35rem; margin-bottom: .75rem; font-size: .85rem; color: #6f625b; }
      .cms-modal__card input, .cms-modal__card textarea {
        border: 1px solid rgba(176,122,104,.35); border-radius: 12px; padding: .7rem .85rem; font: inherit; color: #2f2926;
      }
      .cms-modal__card textarea { min-height: 110px; resize: vertical; }
      .cms-modal__actions { display: flex; gap: .5rem; justify-content: flex-end; margin-top: .5rem; }
      .cms-modal__actions button {
        border-radius: 999px; padding: .65rem 1rem; border: 1px solid rgba(176,122,104,.35);
        background: #fff; cursor: pointer; font: inherit;
      }
      .cms-modal__actions .primary { background: #b07a68; border-color: #b07a68; color: #fff; }
      .cms-err { color: #a34444; font-size: .85rem; margin: .25rem 0 .5rem; }
      .cms-preview { max-width: 140px; max-height: 140px; border-radius: 12px; margin-bottom: .5rem; object-fit: cover; }
    `;
    document.head.appendChild(style);
  }

  function ensureAuth() {
    if (token()) return true;
    location.replace("admin.html");
    return false;
  }

  function topBar() {
    if (document.getElementById("cmsTopBar")) return;
    const bar = document.createElement("div");
    bar.id = "cmsTopBar";
    bar.className = "cms-bar";
    bar.innerHTML = `<button type="button" id="cmsLogout">Salir</button>`;
    document.body.appendChild(bar);
    bar.querySelector("#cmsLogout")?.addEventListener("click", () => {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      location.href = "index.html";
    });
  }

  function wrap(el, opts = {}) {
    if (!el || el.dataset.cmsEdit || el.closest("[data-cms-edit]")) return;

    let host = el;
    if (opts.img || el.tagName === "IMG") {
      // No envolver <img>: rompe galerías (opacity/absolute) y deja el recuadro vacío.
      // Ponemos el lápiz en el contenedor de la foto.
      const mediaHost = el.closest(
        ".service-card__media, .ba-case, .experience-step__visual, .home-invite__media, .home-atmosphere__visual, .about__frame, .hero__frame, .hero__visual"
      );
      if (mediaHost) {
        if (mediaHost.dataset.cmsEdit || mediaHost.querySelector(":scope > .cms-pencil")) return;
        host = mediaHost;
        const pos = getComputedStyle(host).position;
        if (pos === "static") host.style.position = "relative";
      } else {
        const wrapEl = document.createElement("span");
        wrapEl.className = "cms-wrap cms-wrap--img";
        el.parentNode.insertBefore(wrapEl, el);
        wrapEl.appendChild(el);
        host = wrapEl;
      }
    } else {
      host = el;
      const pos = getComputedStyle(host).position;
      if (pos === "static") host.style.position = "relative";
    }

    host.dataset.cmsEdit = "1";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cms-pencil";
    btn.setAttribute("aria-label", "Editar");
    btn.innerHTML = PENCIL;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      opts.onEdit();
    });
    host.addEventListener("mouseenter", () => host.classList.add("is-hot"));
    host.addEventListener("mouseleave", () => host.classList.remove("is-hot"));
    host.appendChild(btn);
  }

  function openModal({ title, fieldsHtml, onSave, previewImg }) {
    pendingImage = null;
    let modal = document.getElementById("cmsEditModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "cmsEditModal";
      modal.className = "cms-modal";
      modal.hidden = true;
      modal.innerHTML = `
        <div class="cms-modal__bg" data-cms-close></div>
        <div class="cms-modal__card" role="dialog" aria-modal="true">
          <h3 id="cmsModalTitle"></h3>
          <div id="cmsModalBody"></div>
          <p class="cms-err" id="cmsModalErr" hidden></p>
          <div class="cms-modal__actions">
            <button type="button" data-cms-close>Cancelar</button>
            <button type="button" class="primary" id="cmsModalSave">Guardar</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelectorAll("[data-cms-close]").forEach((el) =>
        el.addEventListener("click", () => {
          modal.hidden = true;
        })
      );
    }
    modal.querySelector("#cmsModalTitle").textContent = title;
    modal.querySelector("#cmsModalBody").innerHTML = fieldsHtml;
    const err = modal.querySelector("#cmsModalErr");
    err.hidden = true;
    err.textContent = "";
    modal.hidden = false;

    const file = modal.querySelector('input[type="file"]');
    if (file) {
      file.addEventListener("change", () => {
        const f = file.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          pendingImage = {
            base64: String(reader.result),
            fileName: f.name,
            folder: file.dataset.folder || "site",
            setPath: file.dataset.setpath || "",
          };
          const prev = modal.querySelector(".cms-preview");
          if (prev) prev.src = String(reader.result);
        };
        reader.readAsDataURL(f);
      });
    }

    const saveBtn = modal.querySelector("#cmsModalSave");
    saveBtn.onclick = async () => {
      const previewBase64 = pendingImage?.base64 || null;
      const setPath = pendingImage?.setPath || file?.dataset?.setpath || "";
      try {
        saveBtn.disabled = true;
        const result = await onSave(modal);
        modal.hidden = true;
        await refreshAfterSave(result || {}, { previewImg, previewBase64, setPath });
      } catch (e) {
        err.textContent = e.message || "No se pudo guardar";
        err.hidden = false;
      } finally {
        saveBtn.disabled = false;
      }
    };
  }

  function textField(name, label, value, multiline) {
    if (multiline) {
      return `<label>${esc(label)}<textarea name="${name}">${esc(value)}</textarea></label>`;
    }
    return `<label>${esc(label)}<input name="${name}" value="${esc(value)}" /></label>`;
  }

  function fileField(folder, setPath, currentUrl) {
    return `${
      currentUrl ? `<img class="cms-preview" src="${esc(currentUrl)}" alt="" />` : ""
    }<label>Nueva foto
      <input type="file" accept="image/*" data-folder="${esc(folder)}" data-setpath="${esc(setPath)}" />
    </label>`;
  }

  async function saveProducts(next, newImages = []) {
    const repoProducts = next.map((p) => {
      const imageUrl = stripLive(p.imagePath || p.imageUrl || "");
      return {
        id: p.id,
        name: p.name,
        brand: p.brand || "",
        category: p.category || "tratamiento",
        order: Number(p.order) || 1,
        price: p.price,
        priceOld: p.priceOld ?? null,
        badge: p.badge || "",
        benefits: Array.isArray(p.benefits) ? p.benefits : [],
        imageUrl,
      };
    });
    return api({
      action: "save",
      products: repoProducts,
      newImages,
    });
  }

  function productFieldsHtml(p = {}) {
    const cat = p.category || "tratamiento";
    const benefits = Array.isArray(p.benefits) ? p.benefits.join("\n") : "";
    return (
      textField("name", "Nombre", p.name || "") +
      textField("brand", "Marca", p.brand || "") +
      `<label>Categoría
        <select name="category">
          <option value="limpieza"${cat === "limpieza" ? " selected" : ""}>Limpieza</option>
          <option value="hidratacion"${cat === "hidratacion" ? " selected" : ""}>Hidratación</option>
          <option value="tratamiento"${cat === "tratamiento" ? " selected" : ""}>Tratamiento</option>
          <option value="proteccion"${cat === "proteccion" ? " selected" : ""}>Protección</option>
        </select>
      </label>` +
      textField("price", "Precio (solo números)", p.price != null ? String(p.price) : "") +
      textField("priceOld", "Precio anterior (opcional)", p.priceOld != null ? String(p.priceOld) : "") +
      textField("badge", "Etiqueta (opcional)", p.badge || "") +
      textField("order", "Orden", String(p.order ?? products.length + 1)) +
      textField("benefits", "Beneficios (uno por línea)", benefits, true) +
      fileField("productos", "", p.imageUrl || "")
    );
  }

  function readProductForm(m, existing) {
    const name = m.querySelector("[name=name]").value.trim();
    const price = Number(String(m.querySelector("[name=price]").value).replace(/\D/g, ""));
    if (!name) throw new Error("Escribe el nombre");
    if (!Number.isFinite(price) || price <= 0) throw new Error("Escribe un precio válido");
    const priceOldRaw = String(m.querySelector("[name=priceOld]").value || "").replace(/\D/g, "");
    const priceOld = priceOldRaw ? Number(priceOldRaw) : null;
    const benefits = String(m.querySelector("[name=benefits]").value || "")
      .split("\n")
      .map((l) => l.replace(/^[•\-\*\s]+/, "").trim())
      .filter(Boolean);
    return {
      id: existing?.id || `producto-${Date.now().toString(36)}`,
      name,
      brand: m.querySelector("[name=brand]").value.trim(),
      category: m.querySelector("[name=category]").value || "tratamiento",
      order: Number(m.querySelector("[name=order]").value) || products.length + 1,
      price,
      priceOld: Number.isFinite(priceOld) && priceOld > 0 ? priceOld : null,
      badge: m.querySelector("[name=badge]").value.trim(),
      benefits,
      imageUrl: stripLive(existing?.imagePath || existing?.imageUrl || ""),
      imagePath: stripLive(existing?.imagePath || existing?.imageUrl || ""),
    };
  }

  function openProductEditor(product, previewImg) {
    const isNew = !product?.id;
    openModal({
      title: isNew ? "Nuevo producto" : "Editar producto",
      previewImg,
      fieldsHtml: productFieldsHtml(product || {}),
      onSave: async (m) => {
        const nextProduct = readProductForm(m, product);
        if (!pendingImage && !nextProduct.imageUrl) {
          throw new Error("Sube una foto del producto");
        }
        const next = products.filter((p) => p.id !== nextProduct.id);
        next.push(nextProduct);
        next.sort((a, b) => (a.order || 0) - (b.order || 0));
        const imgs = [];
        if (pendingImage) {
          pendingImage.id = nextProduct.id;
          imgs.push({
            id: nextProduct.id,
            fileName: pendingImage.fileName,
            base64: pendingImage.base64,
          });
        }
        return await saveProducts(next, imgs);
      },
    });
  }

  function bindProducts() {
    document.querySelectorAll("#productsGrid .product-card").forEach((card) => {
      const id = card.dataset.id;
      const product = products.find((p) => p.id === id);
      if (!product) return;
      const img = card.querySelector(".product-card__media img");
      wrap(card, {
        block: true,
        onEdit: () => openProductEditor(product, img),
      });
    });
  }

  function bindHero() {
    const h = site.hero || {};
    wrap(document.querySelector("#inicio .hero__content .eyebrow"), {
      onEdit: () =>
        openModal({
          title: "Eyebrow",
          fieldsHtml: textField("v", "Texto", h.eyebrow),
          onSave: async (m) => {
            site.hero.eyebrow = m.querySelector("[name=v]").value;
            return await saveFile("site", site);
          },
        }),
    });
    const h1 = document.querySelector("#inicio .hero__content h1");
    if (h1) {
      wrap(h1, {
        block: true,
        onEdit: () =>
          openModal({
            title: "Título del hero",
            fieldsHtml:
              textField("before", "Primera línea", h.headlineBefore) +
              textField("script", "Palabra en cursiva", h.headlineScript),
            onSave: async (m) => {
              site.hero.headlineBefore = m.querySelector("[name=before]").value;
              site.hero.headlineScript = m.querySelector("[name=script]").value;
              return await saveFile("site", site);
            },
          }),
      });
    }
    wrap(document.querySelector("#inicio .hero__lead"), {
      block: true,
      onEdit: () =>
        openModal({
          title: "Párrafo",
          fieldsHtml: textField("v", "Texto", h.lead, true),
          onSave: async (m) => {
            site.hero.lead = m.querySelector("[name=v]").value;
            return await saveFile("site", site);
          },
        }),
    });
    const float = document.querySelector("#inicio .hero__float-card");
    if (float) {
      wrap(float, {
        onEdit: () =>
          openModal({
            title: "Bolita",
            fieldsHtml:
              textField("label", "Texto arriba", h.floatLabel) +
              textField("strong", "Palabra script", h.floatStrong),
            onSave: async (m) => {
              site.hero.floatLabel = m.querySelector("[name=label]").value;
              site.hero.floatStrong = m.querySelector("[name=strong]").value;
              return await saveFile("site", site);
            },
          }),
      });
    }
    const img = document.querySelector("#inicio .hero__frame img");
    if (img) {
      wrap(img, {
        img: true,
        onEdit: () =>
          openModal({
            previewImg: img,
            title: "Foto del hero",
            fieldsHtml: fileField("site", "hero.imageUrl", h.imageUrl),
            onSave: async () => {
              if (!pendingImage) throw new Error("Elige una foto");
              pendingImage.folder = "site";
              pendingImage.setPath = "hero.imageUrl";
              return await saveFile("site", site, [pendingImage]);
            },
          }),
      });
    }
    document.querySelectorAll("#inicio .trust-item").forEach((el, i) => {
      const item = (h.trustItems || [])[i];
      if (!item) return;
      const textHost = el.querySelector(":scope > div") || el;
      wrap(textHost, {
        onEdit: () =>
          openModal({
            title: `Trust ${i + 1}`,
            fieldsHtml: textField("strong", "Título", item.strong) + textField("span", "Subtítulo", item.span),
            onSave: async (m) => {
              site.hero.trustItems[i].strong = m.querySelector("[name=strong]").value;
              site.hero.trustItems[i].span = m.querySelector("[name=span]").value;
              return await saveFile("site", site);
            },
          }),
      });
    });
    const primary = document.querySelector("#inicio .hero__actions .btn--primary");
    const secondary = document.querySelector("#inicio .hero__actions .btn--outline");
    if (primary) {
      wrap(primary, {
        onEdit: () =>
          openModal({
            title: "Botón principal",
            fieldsHtml: textField("v", "Texto", h.ctaPrimaryLabel),
            onSave: async (m) => {
              site.hero.ctaPrimaryLabel = m.querySelector("[name=v]").value;
              return await saveFile("site", site);
            },
          }),
      });
    }
    if (secondary) {
      wrap(secondary, {
        onEdit: () =>
          openModal({
            title: "Botón secundario",
            fieldsHtml: textField("v", "Texto", h.ctaSecondaryLabel),
            onSave: async (m) => {
              site.hero.ctaSecondaryLabel = m.querySelector("[name=v]").value;
              return await saveFile("site", site);
            },
          }),
      });
    }
  }

  function bindPromesa() {
    if (!site.promesa) site.promesa = {};
    const p = site.promesa;
    const head = document.querySelector("#promesa .section__head");
    if (head) {
      wrap(head, {
        block: true,
        onEdit: () =>
          openModal({
            title: "Bienvenida",
            fieldsHtml:
              textField("eyebrow", "Eyebrow", p.eyebrow) +
              textField("l1", "Título línea 1", p.titleLine1) +
              textField("l2", "Título línea 2", p.titleLine2) +
              textField("sub", "Subtítulo", p.sub, true),
            onSave: async (m) => {
              p.eyebrow = m.querySelector("[name=eyebrow]").value;
              p.titleLine1 = m.querySelector("[name=l1]").value;
              p.titleLine2 = m.querySelector("[name=l2]").value;
              p.sub = m.querySelector("[name=sub]").value;
              return await saveFile("site", site);
            },
          }),
      });
    }
    if (!p.inviteCards) p.inviteCards = [];
    document.querySelectorAll("#promesa .home-invite__card").forEach((card, i) => {
      if (!p.inviteCards[i]) p.inviteCards[i] = { label: "", title: "", text: "", imageUrl: "" };
      const item = p.inviteCards[i];
      const img = card.querySelector("img");
      if (img) {
        wrap(img, {
          img: true,
          onEdit: () =>
            openModal({
            previewImg: img,
              title: `Foto card ${i + 1}`,
              fieldsHtml: fileField("inicio", `promesa.inviteCards.${i}.imageUrl`, item.imageUrl),
              onSave: async () => {
                if (!pendingImage) throw new Error("Elige una foto");
                pendingImage.folder = "inicio";
                pendingImage.setPath = `promesa.inviteCards.${i}.imageUrl`;
                return await saveFile("site", site, [pendingImage]);
              },
            }),
        });
      }
      wrap(card.querySelector("h3") || card, {
        onEdit: () =>
          openModal({
            title: `Card ${i + 1}`,
            fieldsHtml:
              textField("label", "Número", item.label) +
              textField("title", "Título", item.title) +
              textField("text", "Texto", item.text, true),
            onSave: async (m) => {
              item.label = m.querySelector("[name=label]").value;
              item.title = m.querySelector("[name=title]").value;
              item.text = m.querySelector("[name=text]").value;
              return await saveFile("site", site);
            },
          }),
      });
    });
    if (!p.whyCards) p.whyCards = [];
    document.querySelectorAll("#promesa .why-card").forEach((card, i) => {
      if (!p.whyCards[i]) p.whyCards[i] = { title: "", text: "" };
      const item = p.whyCards[i];
      wrap(card.querySelector("h3") || card, {
        onEdit: () =>
          openModal({
            title: `Valor ${i + 1}`,
            fieldsHtml: textField("title", "Título", item.title) + textField("text", "Texto", item.text, true),
            onSave: async (m) => {
              item.title = m.querySelector("[name=title]").value;
              item.text = m.querySelector("[name=text]").value;
              return await saveFile("site", site);
            },
          }),
      });
    });
    const quote = document.querySelector("#promesa .why__quote");
    if (quote) {
      wrap(quote, {
        block: true,
        onEdit: () =>
          openModal({
            title: "Cita",
            fieldsHtml: textField("v", "Texto (sin comillas)", p.quote, true),
            onSave: async (m) => {
              p.quote = m.querySelector("[name=v]").value;
              return await saveFile("site", site);
            },
          }),
      });
    }
  }

  function bindAtmosfera() {
    if (!site.atmosfera) site.atmosfera = {};
    const a = site.atmosfera;
    const content = document.querySelector("#atmosfera .home-atmosphere__content");
    if (content) {
      wrap(content.querySelector("h2") || content, {
        onEdit: () =>
          openModal({
            title: "Atmósfera",
            fieldsHtml:
              textField("eyebrow", "Eyebrow", a.eyebrow) +
              textField("l1", "Título línea 1", a.titleLine1) +
              textField("l2", "Título línea 2", a.titleLine2) +
              textField("text", "Párrafo", a.text, true) +
              textField("cta", "Botón", a.ctaLabel),
            onSave: async (m) => {
              a.eyebrow = m.querySelector("[name=eyebrow]").value;
              a.titleLine1 = m.querySelector("[name=l1]").value;
              a.titleLine2 = m.querySelector("[name=l2]").value;
              a.text = m.querySelector("[name=text]").value;
              a.ctaLabel = m.querySelector("[name=cta]").value;
              return await saveFile("site", site);
            },
          }),
      });
      content.querySelectorAll(".home-atmosphere__list li").forEach((li, i) => {
        if (!a.list) a.list = [];
        wrap(li, {
          onEdit: () =>
            openModal({
              title: `Viñeta ${i + 1}`,
              fieldsHtml: textField("v", "Texto", a.list[i] || ""),
              onSave: async (m) => {
                a.list[i] = m.querySelector("[name=v]").value;
                return await saveFile("site", site);
              },
            }),
        });
      });
    }
    const img = document.querySelector("#atmosfera .home-atmosphere__visual img");
    if (img) {
      wrap(img, {
        img: true,
        onEdit: () =>
          openModal({
            previewImg: img,
            title: "Foto del espacio",
            fieldsHtml: fileField("inicio", "atmosfera.imageUrl", a.imageUrl),
            onSave: async () => {
              if (!pendingImage) throw new Error("Elige una foto");
              pendingImage.folder = "inicio";
              pendingImage.setPath = "atmosfera.imageUrl";
              return await saveFile("site", site, [pendingImage]);
            },
          }),
      });
    }
  }

  function bindRutinas() {
    if (!site.rutinas) site.rutinas = { panels: {} };
    const r = site.rutinas;
    if (!r.panels) r.panels = {};
    const head = document.querySelector("#rutinas .section__head");
    if (head) {
      wrap(head, {
        block: true,
        onEdit: () =>
          openModal({
            title: "Rutinas",
            fieldsHtml:
              textField("eyebrow", "Eyebrow", r.eyebrow) +
              textField("before", "Título", r.titleBefore) +
              textField("em", "Palabra en cursiva", r.titleEm) +
              textField("intro", "Intro", r.intro, true),
            onSave: async (m) => {
              r.eyebrow = m.querySelector("[name=eyebrow]").value;
              r.titleBefore = m.querySelector("[name=before]").value;
              r.titleEm = m.querySelector("[name=em]").value;
              r.intro = m.querySelector("[name=intro]").value;
              return await saveFile("site", site);
            },
          }),
      });
    }
    ["grasa", "seca", "mixta", "sensible"].forEach((key) => {
      const root = document.querySelector(`#panel-${key}`);
      if (!root) return;
      if (!r.panels[key]) r.panels[key] = { headEm: "", steps: [] };
      const panel = r.panels[key];
      if (!panel.steps) panel.steps = [];
      const headEm = root.querySelector(".routine-flow__head em");
      if (headEm) {
        wrap(headEm, {
          onEdit: () =>
            openModal({
              title: `Rutina ${key}`,
              fieldsHtml: textField("v", "Nombre en cursiva", panel.headEm),
              onSave: async (m) => {
                panel.headEm = m.querySelector("[name=v]").value;
                return await saveFile("site", site);
              },
            }),
        });
      }
      root.querySelectorAll(":scope > .experience__steps > .experience-step").forEach((el, i) => {
        if (!panel.steps[i]) panel.steps[i] = { title: "", text: "", imageUrl: "" };
        const step = panel.steps[i];
        const img = el.querySelector("img");
        if (img) {
          wrap(img, {
            img: true,
            onEdit: () =>
              openModal({
            previewImg: img,
                title: `Foto ${key} paso ${i + 1}`,
                fieldsHtml: fileField("rutinas", `rutinas.panels.${key}.steps.${i}.imageUrl`, step.imageUrl),
                onSave: async () => {
                  if (!pendingImage) throw new Error("Elige una foto");
                  pendingImage.folder = "rutinas";
                  pendingImage.setPath = `rutinas.panels.${key}.steps.${i}.imageUrl`;
                  return await saveFile("site", site, [pendingImage]);
                },
              }),
          });
        }
        wrap(el.querySelector("h3") || el, {
          onEdit: () =>
            openModal({
              title: `${key} · paso ${i + 1}`,
              fieldsHtml: textField("title", "Título", step.title) + textField("text", "Texto", step.text, true),
              onSave: async (m) => {
                step.title = m.querySelector("[name=title]").value;
                step.text = m.querySelector("[name=text]").value;
                return await saveFile("site", site);
              },
            }),
        });
      });
    });
  }

  function bindInicioCita() {
    if (!site.inicioCita) site.inicioCita = {};
    const c = site.inicioCita;
    const box = document.querySelector("#inicio-cita .home-cta__box > div");
    if (!box) return;
    wrap(box, {
      block: true,
      onEdit: () =>
        openModal({
          title: "Agenda",
          fieldsHtml:
            textField("eyebrow", "Eyebrow", c.eyebrow) +
            textField("l1", "Título línea 1", c.titleLine1) +
            textField("l2", "Título línea 2", c.titleLine2) +
            textField("text", "Párrafo", c.text, true),
          onSave: async (m) => {
            c.eyebrow = m.querySelector("[name=eyebrow]").value;
            c.titleLine1 = m.querySelector("[name=l1]").value;
            c.titleLine2 = m.querySelector("[name=l2]").value;
            c.text = m.querySelector("[name=text]").value;
            return await saveFile("site", site);
          },
        }),
    });
  }

  function bindExperiencia() {
    const ex = site.experiencia || {};
    const head = document.querySelector("#experiencia .experience__head");
    if (head) {
      wrap(head, {
        block: true,
        onEdit: () =>
          openModal({
            title: "Experiencia",
            fieldsHtml:
              textField("eyebrow", "Eyebrow", ex.eyebrow) +
              textField("before", "Título", ex.titleBefore) +
              textField("script", "Script", ex.titleScript),
            onSave: async (m) => {
              site.experiencia.eyebrow = m.querySelector("[name=eyebrow]").value;
              site.experiencia.titleBefore = m.querySelector("[name=before]").value;
              site.experiencia.titleScript = m.querySelector("[name=script]").value;
              return await saveFile("site", site);
            },
          }),
      });
    }
    document.querySelectorAll("#experiencia .experience-step").forEach((el, i) => {
      const step = (ex.steps || [])[i];
      if (!step) return;
      const img = el.querySelector("img");
      if (img) {
        wrap(img, {
          img: true,
          onEdit: () =>
            openModal({
            previewImg: img,
              title: `Foto paso ${step.num || i + 1}`,
              fieldsHtml: fileField("experiencia", `experiencia.steps.${i}.imageUrl`, step.imageUrl),
              onSave: async () => {
                if (!pendingImage) throw new Error("Elige una foto");
                pendingImage.folder = "experiencia";
                pendingImage.setPath = `experiencia.steps.${i}.imageUrl`;
                return await saveFile("site", site, [pendingImage]);
              },
            }),
        });
      }
      const body = el.querySelector("h3")?.parentElement || el;
      wrap(el.querySelector("h3") || body, {
        onEdit: () =>
          openModal({
            title: `Paso ${step.num || i + 1}`,
            fieldsHtml: textField("title", "Título", step.title) + textField("text", "Texto", step.text, true),
            onSave: async (m) => {
              site.experiencia.steps[i].title = m.querySelector("[name=title]").value;
              site.experiencia.steps[i].text = m.querySelector("[name=text]").value;
              return await saveFile("site", site);
            },
          }),
      });
    });
  }

  function bindAbout() {
    const a = site.about || {};
    const content = document.querySelector("#sobre-mi .about__content");
    if (content) {
      wrap(content.querySelector("h2"), {
        onEdit: () =>
          openModal({
            title: "Título Sobre mí",
            fieldsHtml: textField("before", "Antes", a.titleBefore) + textField("em", "Nombre", a.titleEm),
            onSave: async (m) => {
              site.about.titleBefore = m.querySelector("[name=before]").value;
              site.about.titleEm = m.querySelector("[name=em]").value;
              return await saveFile("site", site);
            },
          }),
      });
      content.querySelectorAll(":scope > p:not(.eyebrow)").forEach((p, i) => {
        wrap(p, {
          block: true,
          onEdit: () =>
            openModal({
              title: `Párrafo ${i + 1}`,
              fieldsHtml: textField("v", "Texto", (a.paragraphs || [])[i] || "", true),
              onSave: async (m) => {
                site.about.paragraphs[i] = m.querySelector("[name=v]").value;
                return await saveFile("site", site);
              },
            }),
        });
      });
    }
    const img = document.querySelector("#sobre-mi .about__frame img");
    if (img) {
      wrap(img, {
        img: true,
        onEdit: () =>
          openModal({
            previewImg: img,
            title: "Foto Sobre mí",
            fieldsHtml: fileField("about", "about.imageUrl", a.imageUrl),
            onSave: async () => {
              if (!pendingImage) throw new Error("Elige una foto");
              pendingImage.folder = "about";
              pendingImage.setPath = "about.imageUrl";
              return await saveFile("site", site, [pendingImage]);
            },
          }),
      });
    }
  }

  function bindServices() {
    const section = services.section || {};
    const head = document.querySelector("#servicios .section__head");
    if (head) {
      wrap(head, {
        block: true,
        onEdit: () =>
          openModal({
            title: "Títulos de servicios",
            fieldsHtml:
              textField("eyebrow", "Eyebrow", section.eyebrow) +
              textField("before", "Título", section.titleBefore) +
              textField("em", "Énfasis", section.titleEm) +
              textField("sub", "Subtítulo", section.sub),
            onSave: async (m) => {
              services.section.eyebrow = m.querySelector("[name=eyebrow]").value;
              services.section.titleBefore = m.querySelector("[name=before]").value;
              services.section.titleEm = m.querySelector("[name=em]").value;
              services.section.sub = m.querySelector("[name=sub]").value;
              return await saveFile("services", services);
            },
          }),
      });
    }

    document.querySelectorAll("#servicesTrack .service-card").forEach((card) => {
      const id = card.dataset.id;
      const item = (services.items || []).find((s) => s.id === id);
      if (!item) return;
      const idx = services.items.indexOf(item);
      const mediaImg = card.querySelector(".service-card__media img, .service-card__gallery img.is-active");
      if (mediaImg) {
        wrap(mediaImg, {
          img: true,
          onEdit: () =>
            openModal({
            previewImg: mediaImg,
              title: `Foto · ${item.name}`,
              fieldsHtml: fileField("services", `items.${idx}.images.0`, (item.images || [])[0]),
              onSave: async () => {
                if (!pendingImage) throw new Error("Elige una foto");
                if (!item.images?.length) item.images = [""];
                pendingImage.folder = "services";
                pendingImage.setPath = `items.${idx}.images.0`;
                return await saveFile("services", services, [pendingImage]);
              },
            }),
        });
      }
      const body = card.querySelector(".service-card__body");
      if (body) {
        wrap(body, {
          block: true,
          onEdit: () =>
            openModal({
              title: item.name || "Servicio",
              fieldsHtml:
                textField("name", "Nombre", item.name) +
                textField("description", "Descripción", item.description, true) +
                textField("price", "Precio (números)", String(item.price)),
              onSave: async (m) => {
                item.name = m.querySelector("[name=name]").value.trim();
                item.description = m.querySelector("[name=description]").value.trim();
                item.price = Number(String(m.querySelector("[name=price]").value).replace(/\D/g, ""));
                if (!item.name) throw new Error("Pon un nombre");
                if (!Number.isFinite(item.price)) throw new Error("Precio inválido");
                return await saveFile("services", services);
              },
            }),
        });
      }
    });
  }

  function bindTestimonials() {
    const section = testimonials.section || {};
    const head = document.querySelector("#testimonios .section__head");
    if (head) {
      wrap(head, {
        block: true,
        onEdit: () =>
          openModal({
            title: "Títulos testimonios",
            fieldsHtml: textField("eyebrow", "Eyebrow", section.eyebrow) + textField("title", "Título", section.title),
            onSave: async (m) => {
              testimonials.section.eyebrow = m.querySelector("[name=eyebrow]").value;
              testimonials.section.title = m.querySelector("[name=title]").value;
              return await saveFile("testimonials", testimonials);
            },
          }),
      });
    }
    document.querySelectorAll("#testimonialsTrack .testimonial-card").forEach((card) => {
      const id = card.dataset.id;
      const item = (testimonials.items || []).find((t) => t.id === id);
      if (!item) return;
      wrap(card, {
        block: true,
        onEdit: () =>
          openModal({
            title: "Testimonio",
            fieldsHtml:
              textField("name", "Nombre", item.name) +
              textField("quote", "Comentario", item.quote, true) +
              textField("stars", "Estrellas 1-5", String(item.stars || 5)),
            onSave: async (m) => {
              item.name = m.querySelector("[name=name]").value.trim();
              item.quote = m.querySelector("[name=quote]").value.trim();
              item.stars = Math.max(1, Math.min(5, Number(m.querySelector("[name=stars]").value) || 5));
              return await saveFile("testimonials", testimonials);
            },
          }),
      });
    });
  }

  function bindResults() {
    const section = results.section || {};
    const copy = document.querySelector("#resultados .results__copy");
    if (copy) {
      wrap(copy, {
        block: true,
        onEdit: () =>
          openModal({
            title: "Textos resultados",
            fieldsHtml:
              textField("eyebrow", "Eyebrow", section.eyebrow) +
              textField("l1", "Título línea 1", section.titleLine1) +
              textField("l2", "Título línea 2", section.titleLine2) +
              textField("lead", "Texto", section.lead, true),
            onSave: async (m) => {
              results.section.eyebrow = m.querySelector("[name=eyebrow]").value;
              results.section.titleLine1 = m.querySelector("[name=l1]").value;
              results.section.titleLine2 = m.querySelector("[name=l2]").value;
              results.section.lead = m.querySelector("[name=lead]").value;
              return await saveFile("results", results);
            },
          }),
      });
    }
    document.querySelectorAll("#baCarouselTrack .ba-case img").forEach((img, i) => {
      const item = (results.items || [])[i];
      if (!item) return;
      wrap(img, {
        img: true,
        onEdit: () =>
          openModal({
            previewImg: img,
            title: `Imagen ${i + 1}`,
            fieldsHtml: fileField("results", `items.${i}.imageUrl`, item.imageUrl),
            onSave: async () => {
              if (!pendingImage) throw new Error("Elige una foto");
              pendingImage.folder = "results";
              pendingImage.setPath = `items.${i}.imageUrl`;
              return await saveFile("results", results, [pendingImage]);
            },
          }),
      });
    });
  }

  function addSectionButton(anchorEl, label, onClick, { after = false } = {}) {
    if (!anchorEl || !anchorEl.parentNode) return;
    if (anchorEl.parentElement?.querySelector(`.cms-section-add[data-label="${label}"]`)) return;
    const wrapEl = document.createElement("div");
    wrapEl.className = `cms-section-add${after ? " cms-section-add--after" : ""}`;
    wrapEl.dataset.label = label;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    wrapEl.appendChild(btn);
    if (after) anchorEl.parentNode.insertBefore(wrapEl, anchorEl.nextSibling);
    else anchorEl.parentNode.insertBefore(wrapEl, anchorEl);
  }

  function fabs() {
    addSectionButton(document.getElementById("servicesCarousel"), "+ Servicio", () => {
      openModal({
        title: "Nuevo servicio",
        fieldsHtml:
          textField("name", "Nombre", "") +
          textField("description", "Descripción", "", true) +
          textField("price", "Precio", "80000") +
          fileField("services", "items.NEW.images.0"),
        onSave: async (m) => {
          if (!pendingImage) throw new Error("Agrega una foto");
          const name = m.querySelector("[name=name]").value.trim();
          const description = m.querySelector("[name=description]").value.trim();
          const price = Number(String(m.querySelector("[name=price]").value).replace(/\D/g, ""));
          if (!name) throw new Error("Pon un nombre");
          services.items = services.items || [];
          services.items.push({
            id: `svc-${Date.now()}`,
            order: services.items.length + 1,
            name,
            description,
            price,
            images: [""],
          });
          pendingImage.folder = "services";
          pendingImage.setPath = `items.${services.items.length - 1}.images.0`;
          return await saveFile("services", services, [pendingImage]);
        },
      });
    });

    addSectionButton(
      document.querySelector("#productos .products__toolbar") || document.getElementById("productsGrid"),
      "+ Producto",
      () => openProductEditor(null, null)
    );

    addSectionButton(
      document.getElementById("baCarousel"),
      "+ Foto antes/después",
      () => {
        openModal({
          title: "Nueva foto antes/después",
          fieldsHtml: fileField("results", "items.NEW.imageUrl"),
          onSave: async () => {
            if (!pendingImage) throw new Error("Elige una foto");
            results.items = results.items || [];
            const order = results.items.length + 1;
            results.items.push({
              id: `ba-${Date.now()}`,
              order,
              imageUrl: "",
              alt: `Resultado ${order}`,
            });
            pendingImage.folder = "results";
            pendingImage.setPath = `items.${results.items.length - 1}.imageUrl`;
            return await saveFile("results", results, [pendingImage]);
          },
        });
      },
      { after: true }
    );

    addSectionButton(document.getElementById("testimonialsTrack"), "+ Testimonio", () => {
      openModal({
        title: "Nuevo testimonio",
        fieldsHtml:
          textField("name", "Nombre", "") +
          textField("quote", "Comentario", "", true) +
          textField("stars", "Estrellas", "5"),
        onSave: async (m) => {
          const name = m.querySelector("[name=name]").value.trim();
          const quote = m.querySelector("[name=quote]").value.trim();
          const stars = Math.max(1, Math.min(5, Number(m.querySelector("[name=stars]").value) || 5));
          if (!name || !quote) throw new Error("Completa nombre y comentario");
          testimonials.items = testimonials.items || [];
          testimonials.items.push({
            id: `t-${Date.now()}`,
            order: testimonials.items.length + 1,
            name,
            quote,
            stars,
          });
          return await saveFile("testimonials", testimonials);
        },
      });
    });
  }

  async function boot() {
    ensureStyles();
    if (!ensureAuth()) return;
    document.body.classList.add("cms-editing");
    topBar();

    const [s, svc, t, r, catalog] = await Promise.all([
      SiteCMS.loadFile("site"),
      SiteCMS.loadFile("services"),
      SiteCMS.loadFile("testimonials"),
      SiteCMS.loadFile("results"),
      window.ProductsCore?.loadProducts
        ? ProductsCore.loadProducts().catch(() => ({ products: [] }))
        : Promise.resolve({ products: [] }),
    ]);
    site = s.data;
    services = svc.data;
    testimonials = t.data;
    results = r.data;
    products = (catalog.products || []).map((p, i) => {
      const n = ProductsCore.normalizeProduct(p, p.id || `p-${i}`);
      n.imagePath = stripLive(p.imageUrl || n.imageUrl);
      n.imageUrl = ProductsCore.toLiveImageUrl(n.imagePath);
      return n;
    });

    setTimeout(() => {
      try {
        bindHero();
        bindPromesa();
        bindExperiencia();
        bindAtmosfera();
        bindRutinas();
        bindInicioCita();
        bindAbout();
        bindServices();
        bindProducts();
        bindTestimonials();
        bindResults();
        fabs();
      } catch (e) {
        console.error(e);
      }
    }, 400);
  }

  window.CmsEditMode = {
    start() {
      const params = new URLSearchParams(location.search);
      if (params.get("edit") !== "1") return;
      boot().catch((e) => console.error("Edit mode:", e));
    },
  };
})();
