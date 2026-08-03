/* Editor visual · textos e imágenes → commit a main */
(function () {
  const SESSION_KEY = "ys_admin_token";
  const PENCIL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;

  let tab = "inicio";
  let site = null;
  let services = null;
  let testimonials = null;
  let results = null;
  let pendingImage = null; // { base64, fileName, folder, setPath }
  let wired = false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function showAlert(message, title = "Aviso") {
    const modal = $("#alertModal");
    const titleEl = $("#alertModalTitle");
    const textEl = $("#alertModalText");
    if (!modal || !textEl) {
      window.alert(message);
      return;
    }
    if (titleEl) titleEl.textContent = title;
    textEl.textContent = message;
    modal.hidden = false;
  }

  function getToken() {
    return sessionStorage.getItem(SESSION_KEY) || "";
  }

  async function api(body) {
    const t = getToken();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  async function loadAll() {
    if (!window.SiteCMS?.loadFile) {
      throw new Error("No se cargó js/cms.js. Recarga con Ctrl+F5.");
    }
    const [s, svc, t, r] = await Promise.all([
      SiteCMS.loadFile("site").catch((e) => {
        console.warn(e);
        return null;
      }),
      SiteCMS.loadFile("services").catch((e) => {
        console.warn(e);
        return null;
      }),
      SiteCMS.loadFile("testimonials").catch((e) => {
        console.warn(e);
        return null;
      }),
      SiteCMS.loadFile("results").catch((e) => {
        console.warn(e);
        return null;
      }),
    ]);
    site = s?.data || site || { hero: {}, experiencia: { steps: [] }, about: {}, productsSection: {} };
    services = svc?.data || services || { section: {}, items: [] };
    testimonials = t?.data || testimonials || { section: {}, items: [] };
    results = r?.data || results || { section: {}, items: [] };
    if (!s?.data && !svc?.data) {
      throw new Error("No se pudo cargar el contenido. Revisa /api/content o data/*.json");
    }
  }

  function stripLive(url) {
    if (!url) return "";
    const m = String(url).match(/[?&]path=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
    return String(url).split("?")[0];
  }

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function toRepoData(fileKey, data) {
    const clone = deepClone(data);
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
    return walk(clone);
  }

  async function saveFile(fileKey, data, newImages = []) {
    const payload = {
      action: "saveContent",
      file: fileKey,
      data: toRepoData(fileKey, data),
      newImages: newImages.map((img) => ({
        ...img,
        // setPath applies on server after upload
      })),
    };
    return api(payload);
  }

  function pencilBtn(action, meta = {}) {
    const encoded = encodeURIComponent(JSON.stringify(meta));
    return `<button class="pencil" type="button" data-action="${action}" data-meta="${encoded}" aria-label="Editar">${PENCIL}</button>`;
  }

  function row(label, value, action, meta, extra = "") {
    return `<div class="editor-row">
      <div>
        <div class="editor-row__label">${label}</div>
        <div class="editor-row__value">${value || "—"}</div>
        ${extra}
      </div>
      ${pencilBtn(action, meta)}
    </div>`;
  }

  function escAttr(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function imgRow(label, src, action, meta) {
    const url = src || "";
    return `<div class="editor-row">
      <div>
        <div class="editor-row__label">${label}</div>
        ${
          url
            ? `<img class="editor-thumb" src="${escAttr(url)}" alt="" />`
            : `<div class="editor-row__value">Sin foto</div>`
        }
      </div>
      ${pencilBtn(action, meta)}
    </div>`;
  }

  function renderInicio() {
    const h = site.hero || {};
    const ex = site.experiencia || {};
    const trust = (h.trustItems || [])
      .map(
        (item, i) =>
          row(
            `Trust ${i + 1}`,
            `<strong>${item.strong || ""}</strong> · ${item.span || ""}`,
            "editTrust",
            { index: i }
          )
      )
      .join("");

    const steps = (ex.steps || [])
      .map(
        (step, i) => `<div class="editor-block" style="margin-top:0.75rem">
        <div class="editor-block__head"><h2>Paso ${step.num || i + 1}</h2></div>
        ${row("Título", step.title, "editExpStep", { index: i, field: "title" })}
        ${row("Texto", step.text, "editExpStep", { index: i, field: "text" })}
        ${imgRow("Foto", step.imageUrl, "editExpStepImage", { index: i })}
      </div>`
      )
      .join("");

    return `<div class="editor-block">
      <div class="editor-block__head"><h2>Hero (inicio)</h2></div>
      ${row("Eyebrow", h.eyebrow, "editHero", { field: "eyebrow" })}
      ${row("Título", h.headlineBefore, "editHero", { field: "headlineBefore" })}
      ${row("Palabra script", h.headlineScript, "editHero", { field: "headlineScript" })}
      ${row("Párrafo", h.lead, "editHero", { field: "lead" })}
      ${row("Bolita (arriba)", h.floatLabel, "editHero", { field: "floatLabel" })}
      ${row("Bolita (script)", h.floatStrong, "editHero", { field: "floatStrong" })}
      ${row("Botón principal", h.ctaPrimaryLabel, "editHero", { field: "ctaPrimaryLabel" })}
      ${row("Botón secundario", h.ctaSecondaryLabel, "editHero", { field: "ctaSecondaryLabel" })}
      ${imgRow("Foto principal", h.imageUrl, "editHeroImage", {})}
      ${trust}
    </div>
    <div class="editor-block">
      <div class="editor-block__head"><h2>Experiencia</h2></div>
      ${row("Eyebrow", ex.eyebrow, "editExp", { field: "eyebrow" })}
      ${row("Título", ex.titleBefore, "editExp", { field: "titleBefore" })}
      ${row("Script", ex.titleScript, "editExp", { field: "titleScript" })}
    </div>
    ${steps}`;
  }

  function renderServicios() {
    const section = services.section || {};
    const items = [...(services.items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const cards = items
      .map((item, i) => {
        const img = (item.images && item.images[0]) || "";
        return `<div class="editor-block">
          <div class="editor-block__head">
            <h2>${item.name || "Servicio"}</h2>
            <div class="editor-actions">
              ${pencilBtn("editService", { id: item.id })}
              <button class="btn btn--ghost" type="button" data-action="deleteService" data-meta="${encodeURIComponent(
                JSON.stringify({ id: item.id })
              )}">Eliminar</button>
            </div>
          </div>
          <div class="editor-row">
            <div class="card-mini">
              ${img ? `<img class="editor-thumb" src="${img}" alt="" />` : ""}
              <strong>${item.name || ""}</strong>
              <div class="editor-row__value--muted">${SiteCMS.formatServicePrice(item.price)}</div>
              <div class="editor-row__value--muted">${(item.description || "").slice(0, 120)}…</div>
            </div>
          </div>
        </div>`;
      })
      .join("");

    return `<div class="editor-block">
      <div class="editor-block__head">
        <h2>Sección servicios</h2>
        <button class="btn btn--primary" type="button" data-action="addService">+ Nuevo servicio</button>
      </div>
      ${row("Eyebrow", section.eyebrow, "editSvcSection", { field: "eyebrow" })}
      ${row("Título", section.titleBefore, "editSvcSection", { field: "titleBefore" })}
      ${row("Énfasis", section.titleEm, "editSvcSection", { field: "titleEm" })}
      ${row("Subtítulo", section.sub, "editSvcSection", { field: "sub" })}
      ${row("Botón CTA", section.ctaLabel, "editSvcSection", { field: "ctaLabel" })}
    </div>
    ${cards}`;
  }

  function renderProductos() {
    return `<div class="editor-block">
      <div class="editor-block__head"><h2>Productos</h2></div>
      <p class="muted">Los productos se editan en el panel de catálogo (mismo estilo de cards, fotos, precios y beneficios).</p>
      <div class="editor-actions">
        <a class="btn btn--primary" href="admin.html">Abrir panel de productos</a>
      </div>
      ${row("Eyebrow catálogo", site.productsSection?.eyebrow, "editProductsSection", { field: "eyebrow" })}
      ${row("Título", site.productsSection?.title, "editProductsSection", { field: "title" })}
      ${row("Subtítulo", site.productsSection?.sub, "editProductsSection", { field: "sub" })}
    </div>`;
  }

  function renderSobreMi() {
    const a = site.about || {};
    const paras = (a.paragraphs || [])
      .map((p, i) => row(`Párrafo ${i + 1}`, p, "editAboutPara", { index: i }))
      .join("");
    return `<div class="editor-block">
      <div class="editor-block__head"><h2>Sobre mí</h2></div>
      ${row("Eyebrow", a.eyebrow, "editAbout", { field: "eyebrow" })}
      ${row("Título", a.titleBefore, "editAbout", { field: "titleBefore" })}
      ${row("Nombre (énfasis)", a.titleEm, "editAbout", { field: "titleEm" })}
      ${paras}
      ${row("Firma nombre", a.signatureName, "editAbout", { field: "signatureName" })}
      ${row("Firma rol", a.signatureRole, "editAbout", { field: "signatureRole" })}
      ${row("Firma tagline", a.signatureTagline, "editAbout", { field: "signatureTagline" })}
      ${row("Botón", a.ctaLabel, "editAbout", { field: "ctaLabel" })}
      ${row("Link botón", a.ctaUrl, "editAbout", { field: "ctaUrl" })}
      ${imgRow("Foto", a.imageUrl, "editAboutImage", {})}
    </div>`;
  }

  function renderResultados() {
    const section = results.section || {};
    const items = [...(results.items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const cards = items
      .map(
        (item) => `<div class="editor-row">
        <div>
          <div class="editor-row__label">Caso ${item.order || ""}</div>
          <img class="editor-thumb" src="${item.imageUrl || ""}" alt="" />
        </div>
        <div class="editor-actions">
          ${pencilBtn("editResultImage", { id: item.id })}
          <button class="btn btn--ghost" type="button" data-action="deleteResult" data-meta="${encodeURIComponent(
            JSON.stringify({ id: item.id })
          )}">Eliminar</button>
        </div>
      </div>`
      )
      .join("");

    return `<div class="editor-block">
      <div class="editor-block__head">
        <h2>Antes y después</h2>
        <button class="btn btn--primary" type="button" data-action="addResult">+ Agregar imagen</button>
      </div>
      ${row("Eyebrow", section.eyebrow, "editResultsSection", { field: "eyebrow" })}
      ${row("Título línea 1", section.titleLine1, "editResultsSection", { field: "titleLine1" })}
      ${row("Título línea 2", section.titleLine2, "editResultsSection", { field: "titleLine2" })}
      ${row("Texto", section.lead, "editResultsSection", { field: "lead" })}
      ${cards}
    </div>`;
  }

  function renderTestimonios() {
    const section = testimonials.section || {};
    const items = [...(testimonials.items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const cards = items
      .map(
        (item) => `<div class="editor-block">
        <div class="editor-block__head">
          <h2>${item.name || "Testimonio"}</h2>
          <div class="editor-actions">
            ${pencilBtn("editTestimonial", { id: item.id })}
            <button class="btn btn--ghost" type="button" data-action="deleteTestimonial" data-meta="${encodeURIComponent(
              JSON.stringify({ id: item.id })
            )}">Eliminar</button>
          </div>
        </div>
        <div class="editor-row__value--muted">${"★".repeat(item.stars || 5)}</div>
        <div class="editor-row__value">“${item.quote || ""}”</div>
      </div>`
      )
      .join("");

    return `<div class="editor-block">
      <div class="editor-block__head">
        <h2>Testimonios</h2>
        <button class="btn btn--primary" type="button" data-action="addTestimonial">+ Nuevo comentario</button>
      </div>
      ${row("Eyebrow", section.eyebrow, "editTestimonialsSection", { field: "eyebrow" })}
      ${row("Título", section.title, "editTestimonialsSection", { field: "title" })}
    </div>
    ${cards}`;
  }

  function openModal(title, fieldsHtml, onSave) {
    pendingImage = null;
    $("#editModalTitle").textContent = title;
    $("#editModalBody").innerHTML = fieldsHtml;
    $("#editModalError").hidden = true;
    $("#editModal").hidden = false;

    const fileInput = $("#editModalBody input[type=file]");
    if (fileInput) {
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          pendingImage = {
            base64: String(reader.result),
            fileName: file.name,
            folder: fileInput.dataset.folder || "site",
            setPath: fileInput.dataset.setpath || "",
          };
          const preview = $("#editModalBody .edit-preview");
          if (preview) preview.src = String(reader.result);
        };
        reader.readAsDataURL(file);
      });
    }

    const saveBtn = $("#editModalSave");
    saveBtn.onclick = async () => {
      try {
        saveBtn.disabled = true;
        await onSave();
        $("#editModal").hidden = true;
        render();
      } catch (e) {
        const err = $("#editModalError");
        err.textContent = e.message || "No se pudo guardar";
        err.hidden = false;
      } finally {
        saveBtn.disabled = false;
      }
    };
  }

  function closeModal() {
    $("#editModal").hidden = true;
  }

  function textField(name, label, value, multiline = false) {
    if (multiline) {
      return `<label>${label}<textarea name="${name}">${value || ""}</textarea></label>`;
    }
    return `<label>${label}<input name="${name}" value="${String(value || "").replace(/"/g, "&quot;")}" /></label>`;
  }

  function fileField(folder, setPath) {
    return `<label>Nueva foto (opcional)
      <input type="file" accept="image/*" data-folder="${folder}" data-setpath="${setPath}" />
    </label>
    <img class="edit-preview" src="" alt="" hidden onload="this.hidden=false" />`;
  }

  async function handleAction(action, meta) {
    if (action === "editHero") {
      const field = meta.field;
      openModal(
        "Editar texto",
        textField("value", field, site.hero[field], field === "lead"),
        async () => {
          const v = $("#editModalBody [name=value]").value;
          site.hero[field] = v;
          const res = await saveFile("site", site);
          site = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "editHeroImage") {
      openModal(
        "Foto del hero",
        `${site.hero.imageUrl ? `<img class="edit-preview" src="${site.hero.imageUrl}" alt="" />` : ""}${fileField(
          "site",
          "hero.imageUrl"
        )}`,
        async () => {
          if (!pendingImage) throw new Error("Elige una foto nueva");
          pendingImage.setPath = "hero.imageUrl";
          pendingImage.folder = "site";
          const res = await saveFile("site", site, [pendingImage]);
          site = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "editTrust") {
      const item = site.hero.trustItems[meta.index];
      openModal(
        "Trust bar",
        textField("strong", "Título", item.strong) + textField("span", "Subtítulo", item.span),
        async () => {
          item.strong = $("#editModalBody [name=strong]").value;
          item.span = $("#editModalBody [name=span]").value;
          const res = await saveFile("site", site);
          site = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "editExp") {
      openModal(
        "Experiencia",
        textField("value", meta.field, site.experiencia[meta.field]),
        async () => {
          site.experiencia[meta.field] = $("#editModalBody [name=value]").value;
          const res = await saveFile("site", site);
          site = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "editExpStep") {
      const step = site.experiencia.steps[meta.index];
      openModal(
        "Paso",
        textField("value", meta.field, step[meta.field], meta.field === "text"),
        async () => {
          step[meta.field] = $("#editModalBody [name=value]").value;
          const res = await saveFile("site", site);
          site = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "editExpStepImage") {
      const step = site.experiencia.steps[meta.index];
      openModal(
        "Foto del paso",
        `${step.imageUrl ? `<img class="edit-preview" src="${step.imageUrl}" alt="" />` : ""}${fileField(
          "experiencia",
          `experiencia.steps.${meta.index}.imageUrl`
        )}`,
        async () => {
          if (!pendingImage) throw new Error("Elige una foto nueva");
          pendingImage.folder = "experiencia";
          pendingImage.setPath = `experiencia.steps.${meta.index}.imageUrl`;
          const res = await saveFile("site", site, [pendingImage]);
          site = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "editSvcSection") {
      openModal(
        "Sección servicios",
        textField("value", meta.field, services.section[meta.field]),
        async () => {
          services.section[meta.field] = $("#editModalBody [name=value]").value;
          const res = await saveFile("services", services);
          services = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "addService") {
      openModal(
        "Nuevo servicio",
        textField("name", "Nombre", "") +
          textField("description", "Descripción", "", true) +
          textField("price", "Precio (solo números)", "80000") +
          fileField("services", "items.-1.images.0"),
        async () => {
          const name = $("#editModalBody [name=name]").value.trim();
          const description = $("#editModalBody [name=description]").value.trim();
          const price = Number(String($("#editModalBody [name=price]").value).replace(/\D/g, ""));
          if (!name) throw new Error("Pon un nombre");
          if (!Number.isFinite(price)) throw new Error("Precio inválido");
          if (!pendingImage) throw new Error("Agrega una foto");
          const id = `svc-${Date.now()}`;
          const item = {
            id,
            order: (services.items?.length || 0) + 1,
            name,
            description,
            price,
            images: [""],
          };
          services.items = [...(services.items || []), item];
          pendingImage.folder = "services";
          pendingImage.setPath = `items.${services.items.length - 1}.images.0`;
          const res = await saveFile("services", services, [pendingImage]);
          services = res.data;
          showAlert(res.note || "Servicio agregado", "Listo");
        }
      );
      return;
    }

    if (action === "editService") {
      const item = services.items.find((s) => s.id === meta.id);
      if (!item) return;
      openModal(
        "Editar servicio",
        textField("name", "Nombre", item.name) +
          textField("description", "Descripción", item.description, true) +
          textField("price", "Precio", String(item.price)) +
          `${item.images?.[0] ? `<img class="edit-preview" src="${item.images[0]}" alt="" />` : ""}` +
          fileField("services", `items.${services.items.indexOf(item)}.images.0`),
        async () => {
          item.name = $("#editModalBody [name=name]").value.trim();
          item.description = $("#editModalBody [name=description]").value.trim();
          item.price = Number(String($("#editModalBody [name=price]").value).replace(/\D/g, ""));
          if (!item.name) throw new Error("Pon un nombre");
          const imgs = pendingImage
            ? [
                {
                  ...pendingImage,
                  folder: "services",
                  setPath: `items.${services.items.indexOf(item)}.images.0`,
                },
              ]
            : [];
          const res = await saveFile("services", services, imgs);
          services = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "deleteService") {
      if (!confirm("¿Eliminar este servicio de la web?")) return;
      services.items = (services.items || []).filter((s) => s.id !== meta.id);
      const res = await saveFile("services", services);
      services = res.data;
      render();
      showAlert(res.note || "Eliminado", "Listo");
      return;
    }

    if (action === "editProductsSection") {
      if (!site.productsSection) site.productsSection = {};
      openModal(
        "Catálogo",
        textField("value", meta.field, site.productsSection[meta.field]),
        async () => {
          site.productsSection[meta.field] = $("#editModalBody [name=value]").value;
          const res = await saveFile("site", site);
          site = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "editAbout") {
      openModal(
        "Sobre mí",
        textField("value", meta.field, site.about[meta.field], false),
        async () => {
          site.about[meta.field] = $("#editModalBody [name=value]").value;
          const res = await saveFile("site", site);
          site = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "editAboutPara") {
      openModal(
        `Párrafo ${meta.index + 1}`,
        textField("value", "Texto", site.about.paragraphs[meta.index], true),
        async () => {
          site.about.paragraphs[meta.index] = $("#editModalBody [name=value]").value;
          const res = await saveFile("site", site);
          site = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "editAboutImage") {
      openModal(
        "Foto Sobre mí",
        `${site.about.imageUrl ? `<img class="edit-preview" src="${site.about.imageUrl}" alt="" />` : ""}${fileField(
          "about",
          "about.imageUrl"
        )}`,
        async () => {
          if (!pendingImage) throw new Error("Elige una foto nueva");
          pendingImage.folder = "about";
          pendingImage.setPath = "about.imageUrl";
          const res = await saveFile("site", site, [pendingImage]);
          site = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "editResultsSection") {
      openModal(
        "Resultados",
        textField("value", meta.field, results.section[meta.field], meta.field === "lead"),
        async () => {
          results.section[meta.field] = $("#editModalBody [name=value]").value;
          const res = await saveFile("results", results);
          results = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "addResult") {
      openModal("Nueva imagen antes/después", fileField("results", "items.-1.imageUrl"), async () => {
        if (!pendingImage) throw new Error("Elige una foto");
        const id = `ba-${Date.now()}`;
        const order = (results.items?.length || 0) + 1;
        results.items = [
          ...(results.items || []),
          { id, order, imageUrl: "", alt: `Resultado antes y después ${order}` },
        ];
        pendingImage.folder = "results";
        pendingImage.setPath = `items.${results.items.length - 1}.imageUrl`;
        const res = await saveFile("results", results, [pendingImage]);
        results = res.data;
        showAlert(res.note || "Imagen agregada", "Listo");
      });
      return;
    }

    if (action === "editResultImage") {
      const item = results.items.find((x) => x.id === meta.id);
      const idx = results.items.indexOf(item);
      openModal(
        "Cambiar imagen",
        `${item.imageUrl ? `<img class="edit-preview" src="${item.imageUrl}" alt="" />` : ""}${fileField(
          "results",
          `items.${idx}.imageUrl`
        )}`,
        async () => {
          if (!pendingImage) throw new Error("Elige una foto nueva");
          pendingImage.folder = "results";
          pendingImage.setPath = `items.${idx}.imageUrl`;
          const res = await saveFile("results", results, [pendingImage]);
          results = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "deleteResult") {
      if (!confirm("¿Quitar esta imagen del carrusel?")) return;
      results.items = (results.items || []).filter((x) => x.id !== meta.id);
      const res = await saveFile("results", results);
      results = res.data;
      render();
      showAlert(res.note || "Eliminado", "Listo");
      return;
    }

    if (action === "editTestimonialsSection") {
      openModal(
        "Testimonios",
        textField("value", meta.field, testimonials.section[meta.field]),
        async () => {
          testimonials.section[meta.field] = $("#editModalBody [name=value]").value;
          const res = await saveFile("testimonials", testimonials);
          testimonials = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "addTestimonial") {
      openModal(
        "Nuevo testimonio",
        textField("name", "Nombre", "") +
          textField("quote", "Comentario", "", true) +
          textField("stars", "Estrellas (1-5)", "5"),
        async () => {
          const name = $("#editModalBody [name=name]").value.trim();
          const quote = $("#editModalBody [name=quote]").value.trim();
          const stars = Math.max(1, Math.min(5, Number($("#editModalBody [name=stars]").value) || 5));
          if (!name || !quote) throw new Error("Nombre y comentario son obligatorios");
          testimonials.items = [
            ...(testimonials.items || []),
            { id: `t-${Date.now()}`, order: (testimonials.items?.length || 0) + 1, name, quote, stars },
          ];
          const res = await saveFile("testimonials", testimonials);
          testimonials = res.data;
          showAlert(res.note || "Agregado", "Listo");
        }
      );
      return;
    }

    if (action === "editTestimonial") {
      const item = testimonials.items.find((t) => t.id === meta.id);
      openModal(
        "Editar testimonio",
        textField("name", "Nombre", item.name) +
          textField("quote", "Comentario", item.quote, true) +
          textField("stars", "Estrellas (1-5)", String(item.stars || 5)),
        async () => {
          item.name = $("#editModalBody [name=name]").value.trim();
          item.quote = $("#editModalBody [name=quote]").value.trim();
          item.stars = Math.max(1, Math.min(5, Number($("#editModalBody [name=stars]").value) || 5));
          const res = await saveFile("testimonials", testimonials);
          testimonials = res.data;
          showAlert(res.note || "Guardado", "Listo");
        }
      );
      return;
    }

    if (action === "deleteTestimonial") {
      if (!confirm("¿Eliminar este comentario?")) return;
      testimonials.items = (testimonials.items || []).filter((t) => t.id !== meta.id);
      const res = await saveFile("testimonials", testimonials);
      testimonials = res.data;
      render();
      showAlert(res.note || "Eliminado", "Listo");
    }
  }

  function applyTab() {
    const pageRoot = $("#pageEditorRoot");
    const productsPanel = $("#productsPanel");
    const isProducts = tab === "productos";
    if (pageRoot) {
      pageRoot.hidden = false;
      if (isProducts) pageRoot.setAttribute("hidden", "");
      else pageRoot.removeAttribute("hidden");
      pageRoot.style.display = isProducts ? "none" : "grid";
    }
    if (productsPanel) {
      if (isProducts) {
        productsPanel.removeAttribute("hidden");
        productsPanel.style.display = "";
      } else {
        productsPanel.setAttribute("hidden", "");
        productsPanel.style.display = "none";
      }
    }
    if (!isProducts) {
      try {
        render();
      } catch (e) {
        console.error(e);
        if (pageRoot) {
          pageRoot.innerHTML = `<div class="editor-block"><p class="form-error">Error al mostrar esta sección: ${
            e.message || e
          }</p></div>`;
        }
      }
    }
  }

  function render() {
    const root = $("#pageEditorRoot");
    if (!root) return;
    if (!site) site = { hero: {}, experiencia: { steps: [] }, about: {}, productsSection: {} };
    if (!services) services = { section: {}, items: [] };
    if (!testimonials) testimonials = { section: {}, items: [] };
    if (!results) results = { section: {}, items: [] };
    const map = {
      inicio: renderInicio,
      servicios: renderServicios,
      productos: () => "",
      "sobre-mi": renderSobreMi,
      resultados: renderResultados,
      testimonios: renderTestimonios,
    };
    const html = (map[tab] || renderInicio)();
    root.innerHTML = html || `<div class="editor-block"><p class="muted">Nada para mostrar en esta pestaña.</p></div>`;
  }

  function wireOnce() {
    if (wired) return;
    wired = true;

    $$("#editorTabs .editor-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.tab || "inicio";
        $$("#editorTabs .editor-tab").forEach((b) => b.classList.toggle("is-active", b === btn));
        applyTab();
      });
    });

    $("#pageEditorRoot")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      let meta = {};
      try {
        meta = JSON.parse(decodeURIComponent(btn.getAttribute("data-meta") || "%7B%7D"));
      } catch {
        meta = {};
      }
      handleAction(btn.dataset.action, meta);
    });

    $$("#editModal [data-close]").forEach((el) => el.addEventListener("click", closeModal));
  }

  async function init() {
    wireOnce();
    const root = $("#pageEditorRoot");
    if (root) {
      root.removeAttribute("hidden");
      root.style.display = "grid";
      root.innerHTML = `<div class="editor-block"><p class="muted">Cargando contenido…</p></div>`;
    }
    try {
      await loadAll();
    } catch (e) {
      console.error(e);
      if (root) {
        root.innerHTML = `<div class="editor-block"><p class="form-error">${
          e.message || "No se pudo cargar"
        }</p><button class="btn btn--primary" type="button" id="retryEditorLoad">Reintentar</button></div>`;
        $("#retryEditorLoad")?.addEventListener("click", () => init());
      }
      throw e;
    }
    tab = "inicio";
    $$("#editorTabs .editor-tab").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.tab === "inicio");
    });
    applyTab();
  }

  window.AdminPageEditor = { init, applyTab };
})();
