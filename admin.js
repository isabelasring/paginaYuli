(function () {
  const setupPanel = document.getElementById("setupPanel");
  const loginPanel = document.getElementById("loginPanel");
  const appPanel = document.getElementById("appPanel");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const btnLogout = document.getElementById("btnLogout");
  const sessionLabel = document.getElementById("sessionLabel");
  const productList = document.getElementById("productList");
  const listMeta = document.getElementById("listMeta");
  const productForm = document.getElementById("productForm");
  const formTitle = document.getElementById("formTitle");
  const formError = document.getElementById("formError");
  const formOk = document.getElementById("formOk");
  const btnNew = document.getElementById("btnNew");
  const btnSeed = document.getElementById("btnSeed");
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

  function showError(el, msg) {
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
    showError(formOk, msg);
    if (msg) setTimeout(() => showError(formOk, ""), 3500);
  }

  function configured() {
    return window.isFirebaseConfigured && window.isFirebaseConfigured();
  }

  function setAuthUI(user) {
    if (!configured()) {
      setupPanel.hidden = false;
      loginPanel.hidden = true;
      appPanel.hidden = true;
      btnLogout.hidden = true;
      return;
    }

    setupPanel.hidden = true;

    if (user) {
      loginPanel.hidden = true;
      appPanel.hidden = false;
      btnLogout.hidden = false;
      sessionLabel.textContent = `Conectada como ${user.email}`;
      refreshList();
    } else {
      loginPanel.hidden = false;
      appPanel.hidden = true;
      btnLogout.hidden = true;
      productForm.hidden = true;
    }
  }

  async function refreshList() {
    listMeta.textContent = "Cargando…";
    productList.innerHTML = "";
    try {
      const { products: list, source } = await ProductsCore.loadProducts();
      products = list;
      const sourceNote =
        source === "firebase"
          ? "Guardados en la nube"
          : source === "seed-empty-firebase"
            ? "La nube está vacía · mostrando catálogo base (cárgalo con el botón de arriba)"
            : "Catálogo base (aún no hay nube / Firebase)";
      listMeta.textContent = `${list.length} producto(s) · ${sourceNote}`;

      if (!list.length) {
        productList.innerHTML = `<p class="empty">No hay productos. Crea uno o carga el catálogo base.</p>`;
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
        </button>
      `
        )
        .join("");
    } catch (err) {
      listMeta.textContent = "Error al cargar";
      productList.innerHTML = `<p class="empty">${ProductsCore.escapeHtml(err.message || String(err))}</p>`;
    }
  }

  function openNew() {
    currentId = null;
    existingImageUrl = "";
    productForm.hidden = false;
    formTitle.textContent = "Nuevo producto";
    productForm.reset();
    document.getElementById("productId").value = "";
    document.getElementById("fieldBrand").value = "Eau Thermale Avène";
    document.getElementById("fieldOrder").value = String((products[products.length - 1]?.order || 0) + 1);
    btnDelete.hidden = true;
    imagePreview.hidden = true;
    imagePreviewImg.removeAttribute("src");
    showError(formError, "");
    showError(formOk, "");
    productForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openEdit(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    currentId = id;
    existingImageUrl = p.imageUrl || "";
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
    showError(formError, "");
    showError(formOk, "");
    Array.from(productList.querySelectorAll(".list-item")).forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.id === id);
    });
    productForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm() {
    productForm.hidden = true;
    currentId = null;
    existingImageUrl = "";
    fieldImage.value = "";
    Array.from(productList.querySelectorAll(".list-item")).forEach((btn) => btn.classList.remove("is-active"));
  }

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(loginError, "");
    if (!configured()) {
      showError(loginError, "Primero configura Firebase en js/firebase-config.js");
      return;
    }
    ProductsCore.initFirebase();
    const { auth } = ProductsCore.getFirebase();
    try {
      await auth.signInWithEmailAndPassword(
        document.getElementById("loginEmail").value.trim(),
        document.getElementById("loginPassword").value
      );
    } catch (err) {
      showError(loginError, mapAuthError(err));
    }
  });

  btnLogout?.addEventListener("click", async () => {
    const { auth } = ProductsCore.getFirebase();
    if (auth) await auth.signOut();
  });

  btnNew?.addEventListener("click", openNew);
  btnCancel?.addEventListener("click", closeForm);

  btnSeed?.addEventListener("click", async () => {
    if (!confirm("¿Subir el catálogo base (productos actuales) a la nube?")) return;
    try {
      btnSeed.disabled = true;
      const n = await ProductsCore.seedToFirebase(false);
      showOk(`Listo: ${n} productos guardados en la nube.`);
      await refreshList();
    } catch (err) {
      const force = String(err.message || "").includes("Ya hay productos");
      if (force && confirm(`${err.message}\n\n¿Forzar importación (puede sobrescribir IDs del seed)?`)) {
        try {
          const n = await ProductsCore.seedToFirebase(true);
          showOk(`Importados ${n} productos.`);
          await refreshList();
        } catch (e2) {
          alert(e2.message || e2);
        }
      } else {
        alert(err.message || err);
      }
    } finally {
      btnSeed.disabled = false;
    }
  });

  productList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".list-item");
    if (!btn) return;
    openEdit(btn.dataset.id);
  });

  fieldImage?.addEventListener("change", () => {
    const file = fieldImage.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    imagePreview.hidden = false;
    imagePreviewImg.src = url;
    imagePreviewNote.textContent = `Nueva foto: ${file.name}`;
  });

  productForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(formError, "");
    showError(formOk, "");
    btnSave.disabled = true;
    try {
      const file = fieldImage.files?.[0] || null;
      const benefits = document
        .getElementById("fieldBenefits")
        .value.split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const product = {
        id: document.getElementById("productId").value || null,
        name: document.getElementById("fieldName").value.trim(),
        brand: document.getElementById("fieldBrand").value.trim() || "Eau Thermale Avène",
        category: document.getElementById("fieldCategory").value,
        order: Number(document.getElementById("fieldOrder").value) || 999,
        price: ProductsCore.parsePrice(document.getElementById("fieldPrice").value),
        priceOld: ProductsCore.parsePrice(document.getElementById("fieldPriceOld").value),
        badge: document.getElementById("fieldBadge").value.trim(),
        benefits,
        imageUrl: existingImageUrl,
      };

      if (!product.name) throw new Error("Escribe el nombre del producto.");
      if (product.price == null) throw new Error("Escribe un precio válido.");
      if (!file && !existingImageUrl) throw new Error("Sube una foto del producto.");

      await ProductsCore.saveProduct(product, file);
      showOk("Producto guardado. Ya se refleja en la web pública.");
      closeForm();
      await refreshList();
    } catch (err) {
      showError(formError, err.message || String(err));
    } finally {
      btnSave.disabled = false;
    }
  });

  btnDelete?.addEventListener("click", async () => {
    if (!currentId) return;
    if (!confirm("¿Eliminar este producto del catálogo?")) return;
    try {
      await ProductsCore.deleteProduct(currentId);
      closeForm();
      await refreshList();
      showOk("Producto eliminado.");
    } catch (err) {
      showError(formError, err.message || String(err));
    }
  });

  function mapAuthError(err) {
    const code = err?.code || "";
    if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
      return "Correo o contraseña incorrectos.";
    }
    if (code.includes("too-many-requests")) return "Demasiados intentos. Espera un momento.";
    if (code.includes("invalid-api-key") || code.includes("configuration")) {
      return "Configuración de Firebase incompleta o incorrecta.";
    }
    return err.message || "No se pudo iniciar sesión.";
  }

  // Boot
  if (!configured()) {
    setAuthUI(null);
  } else {
    ProductsCore.initFirebase();
    const { auth } = ProductsCore.getFirebase();
    auth.onAuthStateChanged((user) => setAuthUI(user));
  }
})();
