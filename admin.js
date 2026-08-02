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
  const btnCancel = document.getElementById("btnCancel");
  const btnDelete = document.getElementById("btnDelete");
  const btnSave = document.getElementById("btnSave");
  const fieldImage = document.getElementById("fieldImage");
  const imagePreview = document.getElementById("imagePreview");
  const imagePreviewImg = document.getElementById("imagePreviewImg");
  const imagePreviewNote = document.getElementById("imagePreviewNote");

  let products = [];
  let currentId = null;
  let existingImageUrl = "";
  let pendingImage = null; // { id, fileName, base64 }

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
    if (loggedIn) refreshList();
    else {
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Error ${res.status}`);
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
      const { products: list } = await ProductsCore.loadProducts();
      products = list;
      listMeta.textContent = `${list.length} producto(s) · desde el repositorio`;
      if (!list.length) {
        productList.innerHTML = `<p class="empty">No hay productos. Crea el primero.</p>`;
        return;
      }
      productList.innerHTML = list
        .map(
          (p) => `
        <button type="button" class="list-item${p.id === currentId ? " is-active" : ""}" data-id="${ProductsCore.escapeHtml(p.id)}">
          <img src="${ProductsCore.escapeHtml(p.imageUrl)}" alt="" />
          <span>
            <span class="list-item__title">${ProductsCore.escapeHtml(p.name)}</span>
            <span class="list-item__meta">${ProductsCore.escapeHtml(ProductsCore.CATEGORY_LABELS[p.category] || p.category)}${p.badge ? " · " + ProductsCore.escapeHtml(p.badge) : ""}</span>
          </span>
          <span class="list-item__price">${ProductsCore.escapeHtml(ProductsCore.formatPrice(p.price))}</span>
        </button>`
        )
        .join("");
    } catch (err) {
      listMeta.textContent = "Error al cargar";
      productList.innerHTML = `<p class="empty">${ProductsCore.escapeHtml(err.message)}</p>`;
    }
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
    productForm.hidden = false;
    formTitle.textContent = "Nuevo producto";
    productForm.reset();
    document.getElementById("productId").value = "";
    document.getElementById("fieldBrand").value = "Eau Thermale Avène";
    document.getElementById("fieldOrder").value = String((products[products.length - 1]?.order || 0) + 1);
    btnDelete.hidden = true;
    imagePreview.hidden = true;
    showMsg(formError, "");
    showMsg(formOk, "");
    productForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openEdit(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    currentId = id;
    existingImageUrl = p.imageUrl || "";
    pendingImage = null;
    productForm.hidden = false;
    formTitle.textContent = "Editar producto";
    document.getElementById("productId").value = p.id;
    document.getElementById("fieldName").value = p.name || "";
    document.getElementById("fieldBrand").value = p.brand || "";
    document.getElementById("fieldCategory").value = p.category || "tratamiento";
    document.getElementById("fieldOrder").value = String(p.order ?? 1);
    document.getElementById("fieldPrice").value = p.price != null ? String(p.price) : "";
    document.getElementById("fieldPriceOld").value = p.priceOld != null ? String(p.priceOld) : "";
    document.getElementById("fieldBadge").value = p.badge || "";
    document.getElementById("fieldBenefits").value = (p.benefits || []).join("\n");
    fieldImage.value = "";
    btnDelete.hidden = false;
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
    productForm.hidden = true;
    currentId = null;
    pendingImage = null;
    fieldImage.value = "";
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
      const data = await api("/api/login", {
        method: "POST",
        body: { password: document.getElementById("loginPassword").value },
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
  btnCancel?.addEventListener("click", closeForm);

  productList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".list-item");
    if (btn) openEdit(btn.dataset.id);
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

  productForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg(formError, "");
    showMsg(formOk, "");
    btnSave.disabled = true;
    btnSave.textContent = "Guardando…";

    try {
      const name = document.getElementById("fieldName").value.trim();
      const id = document.getElementById("productId").value || makeId(name);
      const benefits = document
        .getElementById("fieldBenefits")
        .value.split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const price = ProductsCore.parsePrice(document.getElementById("fieldPrice").value);
      if (!name) throw new Error("Escribe el nombre");
      if (price == null) throw new Error("Escribe un precio válido");
      if (!pendingImage && !existingImageUrl) throw new Error("Sube una foto del producto");

      const product = {
        id,
        name,
        brand: document.getElementById("fieldBrand").value.trim() || "Eau Thermale Avène",
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

      const result = await api("/api/products", {
        method: "POST",
        token: getToken(),
        body: { products: next, newImages },
      });

      products = result.products || next;
      showOk(result.note || "Guardado. En 1–2 minutos se ve en la web.");
      closeForm();
      await refreshList();
    } catch (err) {
      showMsg(formError, err.message || String(err));
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = "Guardar en la web";
    }
  });

  btnDelete?.addEventListener("click", async () => {
    if (!currentId) return;
    if (!confirm("¿Eliminar este producto del catálogo?")) return;
    btnDelete.disabled = true;
    try {
      const next = products.filter((p) => p.id !== currentId);
      const result = await api("/api/products", {
        method: "POST",
        token: getToken(),
        body: { products: next, newImages: [] },
      });
      products = result.products || next;
      closeForm();
      await refreshList();
      showOk("Producto eliminado. Se actualiza la web en 1–2 min.");
    } catch (err) {
      showMsg(formError, err.message || String(err));
    } finally {
      btnDelete.disabled = false;
    }
  });

  // boot
  if (getToken()) setAuthUI(true);
  else setAuthUI(false);
})();
