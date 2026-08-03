(function () {
  const TOKEN_KEY = "ys_admin_token";

  const loginPanel = document.getElementById("loginPanel");
  const appPanel = document.getElementById("appPanel");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const btnLogout = document.getElementById("btnLogout");
  const productList = document.getElementById("productList");
  const listMeta = document.getElementById("listMeta");
  const productForm = document.getElementById("productForm");
  const formTitle = document.getElementById("formTitle");
  const formError = document.getElementById("formError");
  const formOk = document.getElementById("formOk");
  const btnNew = document.getElementById("btnNew");
  const btnNewEmpty = document.getElementById("btnNewEmpty");
  const editorEmpty = document.getElementById("editorEmpty");
  const btnCancel = document.getElementById("btnCancel");
  const btnSave = document.getElementById("btnSave");
  const fieldImage = document.getElementById("fieldImage");
  const imagePreview = document.getElementById("imagePreview");
  const imagePreviewImg = document.getElementById("imagePreviewImg");
  const imagePreviewNote = document.getElementById("imagePreviewNote");

  let products = [];
  let currentId = null;
  let existingImageUrl = "";
  let pendingImage = null; // { id, fileName, base64 }
  let listSourceNote = "";
  let activeFilter = "todos";

  function showEditor(open) {
    if (productForm) productForm.hidden = !open;
    if (editorEmpty) editorEmpty.hidden = open;
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(t) {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  function showMsg(el, msg) {
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function showOk(msg) {
    showMsg(formOk, msg);
    if (msg) setTimeout(() => showMsg(formOk, ""), 5000);
  }

  function setAuthUI(loggedIn) {
    loginPanel.hidden = loggedIn;
    appPanel.hidden = !loggedIn;
    btnLogout.hidden = !loggedIn;
    if (loggedIn) {
      showEditor(false);
      refreshList();
      if (window.AdminPageEditor?.init) {
        window.AdminPageEditor.init().catch((e) => {
          console.warn("Editor:", e);
          const root = document.getElementById("pageEditorRoot");
          if (root) {
            root.removeAttribute("hidden");
            root.style.display = "grid";
            root.innerHTML = `<div class="editor-block"><p class="form-error">No se pudo cargar el editor: ${
              e.message || e
            }</p></div>`;
          }
        });
      } else {
        const root = document.getElementById("pageEditorRoot");
        if (root) {
          root.innerHTML =
            `<div class="editor-block"><p class="form-error">Falta editor.js. Recarga con Ctrl+F5.</p></div>`;
        }
      }
    } else {
      showEditor(false);
      productForm.hidden = true;
      pendingImage = null;
    }
  }

  async function api(path, { method = "GET", body, token } = {}) {
    const res = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text?.slice(0, 200) || `Error ${res.status}` };
    }

    if (!res.ok) {
      let msg = data.error || data.message || `Error ${res.status}`;
      if (res.status === 404 && /not found/i.test(String(msg)) && !data.repo) {
        msg =
          "No se encontró la API del admin. Espera a que Vercel termine de desplegar y recarga la página.";
      }
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function refreshList() {
    listMeta.textContent = "Cargando…";
    productList.innerHTML = "";
    try {
      const { products: list, source } = await ProductsCore.loadProducts();
      const note =
        source === "live" ? "en vivo (sin esperar redeploy)" : "archivo local";
      renderList(list, note);
    } catch (err) {
      listMeta.textContent = "Error al cargar";
      productList.innerHTML = `<p class="empty">${ProductsCore.escapeHtml(err.message)}</p>`;
    }
  }

  function renderList(list, sourceNote = "actualizado") {
    products = (Array.isArray(list) ? list : []).map((p) => ({
      ...p,
      imageUrl: ProductsCore.toLiveImageUrl
        ? ProductsCore.toLiveImageUrl(p.imagePath || p.imageUrl)
        : p.imageUrl,
    }));
    listSourceNote = sourceNote;
    if (!products.length) {
      listMeta.textContent = `0 producto(s) · ${sourceNote}`;
      productList.innerHTML = `<p class="empty">No hay productos. Crea el primero.</p>`;
      return;
    }
    productList.innerHTML = products
      .map((p) => {
        const searchName = `${p.brand || ""} ${p.name || ""} ${p.badge || ""}`.toLowerCase().trim();
        return `
        <div class="list-item${p.id === currentId ? " is-active" : ""}" data-id="${ProductsCore.escapeHtml(p.id)}" data-category="${ProductsCore.escapeHtml(p.category || "")}" data-name="${ProductsCore.escapeHtml(searchName)}">
          <button type="button" class="list-item__main" data-action="edit" data-id="${ProductsCore.escapeHtml(p.id)}">
            <img src="${ProductsCore.escapeHtml(p.imageUrl)}" alt="" />
            <span>
              <span class="list-item__title">${ProductsCore.escapeHtml(p.name)}</span>
              <span class="list-item__meta">${ProductsCore.escapeHtml(ProductsCore.CATEGORY_LABELS[p.category] || p.category)}${p.badge ? " · " + ProductsCore.escapeHtml(p.badge) : ""}</span>
            </span>
            <span class="list-item__price">${ProductsCore.escapeHtml(ProductsCore.formatPrice(p.price))}</span>
          </button>
          <button type="button" class="btn btn--danger-sm" data-action="delete" data-id="${ProductsCore.escapeHtml(p.id)}" aria-label="Eliminar ${ProductsCore.escapeHtml(p.name)}">
            Eliminar
          </button>
        </div>`;
      })
      .join("");
    applyListFilter();
  }

  function applyListFilter() {
    const search = document.getElementById("adminProductSearch");
    const query = (search?.value || "").trim().toLowerCase();
    const cards = productList.querySelectorAll(".list-item");
    if (!cards.length) {
      listMeta.textContent = `0 producto(s) · ${listSourceNote || ""}`;
      return;
    }

    let visible = 0;
    cards.forEach((card) => {
      const category = card.dataset.category || "";
      const name = card.dataset.name || "";
      const matchFilter = activeFilter === "todos" || category === activeFilter;
      const matchSearch = !query || name.includes(query);
      const show = matchFilter && matchSearch;
      card.hidden = !show;
      if (show) visible += 1;
    });

    const filterLabel =
      activeFilter === "todos"
        ? "todos"
        : ProductsCore.CATEGORY_LABELS[activeFilter] || activeFilter;
    const searchNote = query ? ` · “${query}”` : "";
    listMeta.textContent = `${visible} de ${products.length} · ${filterLabel}${searchNote} · ${listSourceNote || ""}`;

    let emptyEl = productList.querySelector(".empty--filter");
    if (visible === 0 && products.length) {
      if (!emptyEl) {
        emptyEl = document.createElement("p");
        emptyEl.className = "empty empty--filter";
        productList.appendChild(emptyEl);
      }
      emptyEl.textContent = "Ningún producto coincide con la búsqueda o categoría.";
      emptyEl.hidden = false;
    } else if (emptyEl) {
      emptyEl.hidden = true;
    }
  }

  function bindListFilters() {
    const wrap = document.querySelector(".admin-filters");
    const filters = document.querySelectorAll(".admin-filter");
    const search = document.getElementById("adminProductSearch");
    if (!wrap || wrap.dataset.bound === "1") return;
    wrap.dataset.bound = "1";

    filters.forEach((btn) => {
      btn.addEventListener("click", () => {
        filters.forEach((f) => f.classList.remove("is-active"));
        btn.classList.add("is-active");
        activeFilter = btn.dataset.filter || "todos";
        applyListFilter();
      });
    });
    search?.addEventListener("input", applyListFilter);
  }

  function showBanner(msg, isError = false) {
    let el = document.getElementById("adminBanner");
    if (!el) {
      el = document.createElement("p");
      el.id = "adminBanner";
      el.setAttribute("role", "status");
      const app = document.getElementById("appPanel");
      app?.insertBefore(el, app.firstChild);
    }
    el.className = isError ? "form-error" : "form-ok";
    el.hidden = false;
    el.textContent = msg;
    if (!isError) {
      setTimeout(() => {
        if (el.textContent === msg) el.hidden = true;
      }, 6000);
    }
  }

  function bulletizeBenefits(list) {
    const items = (list || []).map((b) => String(b).trim()).filter(Boolean);
    if (!items.length) return "• ";
    return items.map((b) => `• ${b.replace(/^[\s•\-\*]+/, "")}`).join("\n");
  }

  function parseBenefitsFromText(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.replace(/^[\s•\-\*]+/, "").trim())
      .filter(Boolean);
  }

  /** Mantiene viñetas al escribir Enter o al completar líneas. */
  function syncBenefitsBullets(textarea, { forceCursorEnd = false } = {}) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lines = textarea.value.split("\n");
    const next = lines
      .map((line) => {
        const bare = line.replace(/^[\s•\-\*]+/, "").trimStart();
        // línea vacía al final (solo cursor de nueva viñeta)
        if (!bare && lines.length > 1 && line === lines[lines.length - 1]) return "• ";
        if (!bare && !line.trim()) return "• ";
        if (!bare) return "• ";
        return `• ${bare.replace(/^[\s•\-\*]+/, "")}`;
      })
      .join("\n");

    if (next !== textarea.value) {
      textarea.value = next;
      if (!forceCursorEnd && start != null) {
        // intenta conservar posición razonable al final de la edición
        const pos = Math.min(next.length, Math.max(start, end) + 2);
        try {
          textarea.setSelectionRange(pos, pos);
        } catch {
          /* ignore */
        }
      }
    }
  }

  function bindBenefitsField() {
    const ta = document.getElementById("fieldBenefits");
    if (!ta || ta.dataset.bulletsBound === "1") return;
    ta.dataset.bulletsBound = "1";

    ta.addEventListener("focus", () => {
      if (!ta.value.trim()) {
        ta.value = "• ";
        ta.setSelectionRange(2, 2);
      } else {
        syncBenefitsBullets(ta);
      }
    });

    ta.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const start = ta.selectionStart;
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(ta.selectionEnd);
      ta.value = `${before}\n• ${after.replace(/^\n?/, "")}`;
      const pos = before.length + 3; // salto + "• "
      ta.setSelectionRange(pos, pos);
    });

    ta.addEventListener("blur", () => syncBenefitsBullets(ta));
  }

  function makeId(name) {
    const base = String(name || "producto")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return `${base || "producto"}-${Date.now().toString(36)}`;
  }

  function openNew() {
    currentId = null;
    existingImageUrl = "";
    pendingImage = null;
    showEditor(true);
    formTitle.textContent = "Nuevo producto";
    productForm.reset();
    document.getElementById("productId").value = "";
    document.getElementById("fieldBrand").value = "";
    document.getElementById("fieldOrder").value = String((products[products.length - 1]?.order || 0) + 1);
    document.getElementById("fieldBenefits").value = "• ";
    document.getElementById("fieldName").value = "";
    document.getElementById("fieldPrice").value = "";
    document.getElementById("fieldPriceOld").value = "";
    document.getElementById("fieldBadge").value = "";
    imagePreview.hidden = true;
    showMsg(formError, "");
    showMsg(formOk, "");
    productForm.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("fieldName")?.focus();
  }

  function toRepoImagePath(url) {
    if (!url) return "";
    const s = String(url);
    if (s.includes("/api/media")) {
      try {
        const u = new URL(s, window.location.origin);
        return u.searchParams.get("path") || "";
      } catch {
        return "";
      }
    }
    if (/^https?:\/\//i.test(s)) return s;
    return s.replace(/^\.?\/+/, "");
  }

  function openEdit(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    currentId = id;
    existingImageUrl = toRepoImagePath(p.imagePath || p.imageUrl) || "";
    pendingImage = null;
    showEditor(true);
    formTitle.textContent = "Editar producto";
    document.getElementById("productId").value = p.id;
    document.getElementById("fieldName").value = p.name || "";
    document.getElementById("fieldBrand").value = p.brand || "";
    document.getElementById("fieldCategory").value = p.category || "tratamiento";
    document.getElementById("fieldOrder").value = String(p.order ?? 1);
    document.getElementById("fieldPrice").value =
      p.price != null ? ProductsCore.formatPriceInput(p.price) : "";
    document.getElementById("fieldPriceOld").value =
      p.priceOld != null ? ProductsCore.formatPriceInput(p.priceOld) : "";
    document.getElementById("fieldBadge").value = p.badge || "";
    document.getElementById("fieldBenefits").value = bulletizeBenefits(p.benefits);
    fieldImage.value = "";
    if (p.imageUrl) {
      imagePreview.hidden = false;
      imagePreviewImg.src = p.imageUrl;
      imagePreviewNote.textContent = "Foto actual (elige otra solo si quieres cambiarla)";
    } else {
      imagePreview.hidden = true;
    }
    showMsg(formError, "");
    showMsg(formOk, "");
    productList.querySelectorAll(".list-item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.id === id);
    });
    productForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm() {
    showEditor(false);
    currentId = null;
    pendingImage = null;
    existingImageUrl = "";
    fieldImage.value = "";
    productForm.reset();
    productList.querySelectorAll(".list-item").forEach((b) => b.classList.remove("is-active"));
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Reduce un poco fotos muy pesadas (canvas JPEG). */
  async function prepareImage(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen");
    if (file.size <= 900 * 1024) {
      const dataUrl = await fileToBase64(file);
      return { fileName: file.name, base64: dataUrl };
    }

    const dataUrl = await fileToBase64(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });

    const max = 1200;
    let { width, height } = img;
    if (width > max || height > max) {
      const r = Math.min(max / width, max / height);
      width = Math.round(width * r);
      height = Math.round(height * r);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    const jpeg = canvas.toDataURL("image/jpeg", 0.82);
    return { fileName: file.name.replace(/\.\w+$/, "") + ".jpg", base64: jpeg };
  }

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg(loginError, "");
    try {
      const data = await api("/api/admin", {
        method: "POST",
        body: { action: "login", password: document.getElementById("loginPassword").value },
      });
      setToken(data.token);
      setAuthUI(true);
    } catch (err) {
      if (err.status === 404 || String(err.message).includes("Failed to fetch")) {
        showMsg(
          loginError,
          "El guardado solo funciona en la web publicada (Vercel), no en servidor local. Abre admin desde tu dominio .vercel.app"
        );
      } else {
        showMsg(loginError, err.message || "No se pudo entrar");
      }
    }
  });

  btnLogout?.addEventListener("click", () => {
    setToken("");
    setAuthUI(false);
  });

  btnNew?.addEventListener("click", openNew);
  btnNewEmpty?.addEventListener("click", openNew);
  btnCancel?.addEventListener("click", closeForm);

  productList?.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn || !productList.contains(actionBtn)) return;
    e.preventDefault();
    e.stopPropagation();
    const id = actionBtn.getAttribute("data-id");
    if (!id) return;
    if (actionBtn.dataset.action === "delete") {
      deleteProduct(id);
      return;
    }
    if (actionBtn.dataset.action === "edit") openEdit(id);
  });

  fieldImage?.addEventListener("change", async () => {
    const file = fieldImage.files?.[0];
    if (!file) return;
    try {
      const prepared = await prepareImage(file);
      pendingImage = prepared;
      imagePreview.hidden = false;
      imagePreviewImg.src = prepared.base64;
      imagePreviewNote.textContent = `Nueva foto: ${prepared.fileName}`;
    } catch (err) {
      showMsg(formError, err.message || "No se pudo leer la imagen");
    }
  });

  // Formato colombiano; solo números, punto y coma
  function sanitizePriceInput(raw) {
    return String(raw || "")
      .replace(/[^\d.,]/g, "") // solo dígitos, punto (miles) y coma (decimales)
      .replace(/,/g, (m, offset, str) => {
        // una sola coma decimal
        return str.indexOf(",") === offset ? "," : "";
      });
  }

  function bindPriceInput(el) {
    if (!el) return;

    el.setAttribute("inputmode", "decimal");
    el.setAttribute("pattern", "[0-9.,]*");
    el.setAttribute("autocomplete", "off");

    el.addEventListener("beforeinput", (e) => {
      if (e.inputType && e.inputType.startsWith("delete")) return;
      if (e.inputType === "insertFromPaste" || e.inputType === "insertFromDrop") return;
      if (e.data == null) return;
      if (!/^[0-9.,]+$/.test(e.data)) e.preventDefault();
    });

    el.addEventListener("input", () => {
      const cleaned = sanitizePriceInput(el.value);
      if (cleaned !== el.value) {
        const pos = el.selectionStart;
        el.value = cleaned;
        try {
          el.setSelectionRange(pos - 1, pos - 1);
        } catch {
          /* ignore */
        }
      }
    });

    el.addEventListener("keypress", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const ch = e.key;
      if (ch.length === 1 && !/[0-9.,]/.test(ch)) e.preventDefault();
    });

    el.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text");
      const cleaned = sanitizePriceInput(text);
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      el.value = sanitizePriceInput(el.value.slice(0, start) + cleaned + el.value.slice(end));
    });

    el.addEventListener("blur", () => {
      const n = ProductsCore.parsePrice(el.value);
      el.value = n == null ? sanitizePriceInput(el.value) : ProductsCore.formatPriceInput(n);
    });
  }
  bindPriceInput(document.getElementById("fieldPrice"));
  bindPriceInput(document.getElementById("fieldPriceOld"));

  productForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg(formError, "");
    showMsg(formOk, "");
    btnSave.disabled = true;
    btnSave.textContent = "Guardando…";

    try {
      const name = document.getElementById("fieldName").value.trim();
      const id = document.getElementById("productId").value || makeId(name);
      const benefits = parseBenefitsFromText(document.getElementById("fieldBenefits").value);

      const price = ProductsCore.parsePrice(document.getElementById("fieldPrice").value);
      if (!name) throw new Error("Escribe el nombre");
      if (price == null) throw new Error("Escribe un precio válido");
      if (!pendingImage && !existingImageUrl) throw new Error("Sube una foto del producto");

      const product = {
        id,
        name,
        brand: document.getElementById("fieldBrand").value.trim(),
        category: document.getElementById("fieldCategory").value,
        order: Number(document.getElementById("fieldOrder").value) || products.length + 1,
        price,
        priceOld: ProductsCore.parsePrice(document.getElementById("fieldPriceOld").value),
        badge: document.getElementById("fieldBadge").value.trim(),
        benefits,
        imageUrl: existingImageUrl || "",
      };

      const next = products.filter((p) => p.id !== id);
      next.push(product);
      next.sort((a, b) => (a.order || 0) - (b.order || 0));

      const newImages = [];
      if (pendingImage) {
        newImages.push({
          id,
          fileName: pendingImage.fileName,
          base64: pendingImage.base64,
        });
      }

      const result = await api("/api/admin", {
        method: "POST",
        token: getToken(),
        body: { action: "save", products: next, newImages },
      });

      products = (result.products || next).map((p, i) => {
        const n = ProductsCore.normalizeProduct(p, p.id || `p-${i}`);
        n.imagePath = p.imageUrl || n.imageUrl;
        n.imageUrl = ProductsCore.toLiveImageUrl(n.imagePath || n.imageUrl);
        return n;
      });
      showOk(result.note || "Guardado. Ya se ve en la web (recarga Productos).");
      showBanner(result.note || "Producto guardado · visible de inmediato en la web.");
      closeForm();
      renderList(products, "guardado · en vivo");
    } catch (err) {
      showMsg(formError, err.message || String(err));
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = "Guardar en la web";
    }
  });

  function showAlert(message, title = "Aviso") {
    const modal = document.getElementById("alertModal");
    const titleEl = document.getElementById("alertModalTitle");
    const textEl = document.getElementById("alertModalText");
    if (!modal || !textEl) {
      window.alert(message);
      return Promise.resolve();
    }
    if (titleEl) titleEl.textContent = title;
    textEl.textContent = message;
    modal.hidden = false;
    document.body.style.overflow = "hidden";

    return new Promise((resolve) => {
      const finish = () => {
        modal.hidden = true;
        document.body.style.overflow = "";
        resolve();
      };
      modal.querySelectorAll("[data-alert-ok]").forEach((el) => {
        el.addEventListener("click", finish, { once: true });
      });
    });
  }

  function showConfirm({ title, text, confirmLabel = "Eliminar" } = {}) {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmModalTitle");
    const textEl = document.getElementById("confirmModalText");
    const okBtn = document.getElementById("confirmModalOk");
    if (!modal) {
      return Promise.resolve(window.confirm(`${title || ""}\n${text || ""}`.trim()));
    }
    if (titleEl) titleEl.textContent = title || "¿Continuar?";
    if (textEl) textEl.textContent = text || "";
    if (okBtn) okBtn.textContent = confirmLabel;
    modal.hidden = false;
    document.body.style.overflow = "hidden";

    return new Promise((resolve) => {
      const cleanup = (result) => {
        modal.hidden = true;
        document.body.style.overflow = "";
        okBtn?.removeEventListener("click", onOk);
        modal.querySelectorAll("[data-modal-cancel]").forEach((el) => {
          el.removeEventListener("click", onCancel);
        });
        document.removeEventListener("keydown", onKey);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onKey = (e) => {
        if (e.key === "Escape") cleanup(false);
        if (e.key === "Enter") cleanup(true);
      };
      okBtn?.addEventListener("click", onOk);
      modal.querySelectorAll("[data-modal-cancel]").forEach((el) => {
        el.addEventListener("click", onCancel);
      });
      document.addEventListener("keydown", onKey);
      okBtn?.focus();
    });
  }

  async function deleteProduct(id) {
    const productId = String(id || "").trim();
    if (!productId) {
      await showAlert("No se pudo identificar el producto.", "Error");
      return;
    }
    const product = products.find((p) => String(p.id) === productId);
    const name = product?.name || "este producto";
    const ok = await showConfirm({
      title: `¿Eliminar “${name}”?`,
      text: "Se quitará del catálogo y dejará de verse en la web en unos segundos.",
      confirmLabel: "Sí, eliminar",
    });
    if (!ok) return;

    const listBtns = productList.querySelectorAll('[data-action="delete"]');
    listBtns.forEach((b) => {
      b.disabled = true;
    });
    showBanner("Eliminando producto…");

    try {
      const result = await api("/api/admin", {
        method: "POST",
        token: getToken(),
        body: { action: "delete", productId },
      });

      const next = (result.products || []).map((p, i) => {
        const n = ProductsCore.normalizeProduct(p, p.id || `p-${i}`);
        n.imagePath = p.imageUrl || n.imageUrl;
        n.imageUrl = ProductsCore.toLiveImageUrl
          ? ProductsCore.toLiveImageUrl(n.imagePath || n.imageUrl)
          : n.imageUrl;
        return n;
      });
      if (currentId && String(currentId) === productId) closeForm();
      renderList(next, "eliminado · en vivo");
      showBanner(result.note || "Producto eliminado. Ya no debe verse en la web (recarga Productos).");
      showOk(result.note || "Producto eliminado.");
    } catch (err) {
      showBanner(err.message || "No se pudo eliminar", true);
      showMsg(formError, err.message || String(err));
      await showAlert(err.message || "No se pudo eliminar", "Error al eliminar");
      await refreshList();
    } finally {
      listBtns.forEach((b) => {
        b.disabled = false;
      });
    }
  }

  // boot
  bindListFilters();
  bindBenefitsField();
  if (getToken()) setAuthUI(true);
  else setAuthUI(false);
})();
