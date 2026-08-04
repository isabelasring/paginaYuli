/**
 * Carga y monta contenido editable (site, services, testimonials, results).
 */
(function () {
  const FILE_FALLBACK = {
    site: "data/site.json",
    services: "data/services.json",
    testimonials: "data/testimonials.json",
    results: "data/results.json",
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatServicePrice(n) {
    if (typeof n === "string" && n.trim()) return n.trim();
    const num = Number(n);
    if (!Number.isFinite(num)) return "";
    return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(num)}`;
  }

  function stars(n) {
    const count = Math.max(1, Math.min(5, Number(n) || 5));
    return "★".repeat(count);
  }

  async function loadFile(key) {
    const t = Date.now();
    try {
      const res = await fetch(`/api/content?file=${encodeURIComponent(key)}&t=${t}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data) return { data: json.data, source: "live", version: json.version };
      }
    } catch {
      /* fallback */
    }
    const res2 = await fetch(`${FILE_FALLBACK[key]}?t=${t}`, { cache: "no-store" });
    if (!res2.ok) throw new Error(`No se pudo cargar ${key}`);
    const data = await res2.json();
    return { data, source: "file" };
  }

  function applyHero(site) {
    const h = site?.hero;
    if (!h) return;
    const eyebrow = document.querySelector("#inicio .hero__content .eyebrow");
    const h1 = document.querySelector("#inicio .hero__content h1");
    const lead = document.querySelector("#inicio .hero__lead");
    const img = document.querySelector("#inicio .hero__frame img");
    const floatSpan = document.querySelector("#inicio .hero__float-card span");
    const floatStrong = document.querySelector("#inicio .hero__float-card strong");
    const primary = document.querySelector("#inicio .hero__actions .btn--primary");
    const secondary = document.querySelector("#inicio .hero__actions .btn--outline");

    if (eyebrow && h.eyebrow) eyebrow.textContent = h.eyebrow;
    if (h1 && (h.headlineBefore || h.headlineScript)) {
      h1.innerHTML = `${escapeHtml(h.headlineBefore || "")}<br /><em class="hero__script">${escapeHtml(
        h.headlineScript || ""
      )}</em>`;
    }
    if (lead && h.lead) lead.textContent = h.lead;
    if (img && h.imageUrl) {
      img.src = h.imageUrl;
      if (h.eyebrow) img.alt = h.eyebrow;
    }
    if (floatSpan && h.floatLabel) floatSpan.textContent = h.floatLabel;
    if (floatStrong && h.floatStrong) floatStrong.textContent = h.floatStrong;
    if (primary && h.ctaPrimaryLabel) primary.textContent = h.ctaPrimaryLabel;
    if (secondary && h.ctaSecondaryLabel) secondary.textContent = h.ctaSecondaryLabel;

    const trust = document.querySelectorAll("#inicio .trust-item");
    (h.trustItems || []).forEach((item, i) => {
      const el = trust[i];
      if (!el) return;
      // Nunca tocar .trust-item__icon (ahí vive el SVG)
      const strong = el.querySelector(":scope > div > strong");
      const textSpan =
        el.querySelector(":scope > div > .trust-item__label") ||
        el.querySelector(":scope > div > span:not(.trust-item__icon)");
      if (strong && item.strong) strong.textContent = item.strong;
      if (textSpan && item.span) textSpan.textContent = item.span;
    });
  }

  function applyExperiencia(site) {
    const ex = site?.experiencia;
    if (!ex) return;
    const eyebrow = document.querySelector("#experiencia .experience__eyebrow");
    const h2 = document.querySelector("#experiencia .experience__head h2");
    if (eyebrow && ex.eyebrow) {
      eyebrow.innerHTML = `${escapeHtml(ex.eyebrow)} <span aria-hidden="true">♡</span>`;
    }
    if (h2 && (ex.titleBefore || ex.titleScript)) {
      h2.innerHTML = `${escapeHtml(ex.titleBefore || "")}<em class="experience__script">${escapeHtml(
        ex.titleScript || ""
      )}</em>`;
    }

    const steps = document.querySelectorAll("#experiencia .experience-step");
    (ex.steps || []).forEach((step, i) => {
      const el = steps[i];
      if (!el) return;
      const img = el.querySelector("img");
      const num = el.querySelector(".experience-step__num");
      const title = el.querySelector("h3");
      const p = el.querySelector("p");
      if (img && step.imageUrl) img.src = step.imageUrl;
      if (num && step.num) num.textContent = step.num;
      if (title && step.title) title.textContent = step.title;
      if (p && step.text) p.textContent = step.text;
    });
  }

  function applyAbout(site) {
    const a = site?.about;
    if (!a) return;
    const root = document.querySelector("#sobre-mi .about__content");
    if (!root) return;
    const eyebrow = root.querySelector(".eyebrow");
    const h2 = root.querySelector("h2");
    const paras = root.querySelectorAll(":scope > p:not(.eyebrow)");
    const sigStrong = root.querySelector(".about__signature strong");
    const sigSpans = root.querySelectorAll(".about__signature span");
    const cta = root.querySelector(".btn");
    const img = document.querySelector("#sobre-mi .about__frame img");

    if (eyebrow && a.eyebrow) eyebrow.textContent = a.eyebrow;
    if (h2 && (a.titleBefore || a.titleEm)) {
      h2.innerHTML = `${escapeHtml(a.titleBefore || "")}<em>${escapeHtml(a.titleEm || "")}</em>`;
    }
    (a.paragraphs || []).forEach((text, i) => {
      if (paras[i] && text) paras[i].textContent = text;
    });
    if (sigStrong && a.signatureName) sigStrong.textContent = a.signatureName;
    if (sigSpans[0] && a.signatureRole) sigSpans[0].textContent = a.signatureRole;
    if (sigSpans[1] && a.signatureTagline) sigSpans[1].textContent = a.signatureTagline;
    if (cta) {
      if (a.ctaLabel) cta.textContent = a.ctaLabel;
      if (a.ctaUrl) cta.href = a.ctaUrl;
    }
    if (img && a.imageUrl) {
      img.src = a.imageUrl;
      if (a.signatureName) img.alt = a.signatureName;
    }
  }

  function applyProductsSection(site) {
    const p = site?.productsSection;
    if (!p) return;
    const head = document.querySelector("#productos .section__head");
    if (!head) return;
    const eyebrow = head.querySelector(".eyebrow");
    const h2 = head.querySelector("h2");
    const sub = head.querySelector(".section__sub");
    if (eyebrow && p.eyebrow) eyebrow.textContent = p.eyebrow;
    if (h2 && p.title) h2.textContent = p.title;
    if (sub && p.sub) sub.textContent = p.sub;
  }

  function serviceCardHtml(item, index) {
    const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    const gallery = images.length > 1;
    const media = gallery
      ? `<div class="service-card__media service-card__media--gallery" data-gallery>
          <div class="service-card__gallery">
            ${images
              .map(
                (src, i) =>
                  `<img class="${i === 0 ? "is-active" : ""}" src="${escapeHtml(src)}" alt="${escapeHtml(
                    item.name || ""
                  )}" loading="lazy" />`
              )
              .join("")}
          </div>
        </div>`
      : `<div class="service-card__media">
          <img src="${escapeHtml(images[0] || "")}" alt="${escapeHtml(item.name || "")}" loading="lazy" />
        </div>`;

    return `<article class="service-card" data-index="${index}" data-id="${escapeHtml(item.id || "")}">
      ${media}
      <div class="service-card__body">
        <h3>${escapeHtml(item.name || "")}</h3>
        <p>${escapeHtml(item.description || "")}</p>
        <span class="service-card__price">${escapeHtml(formatServicePrice(item.price))}</span>
      </div>
    </article>`;
  }

  function mountServices(data) {
    const track = document.getElementById("servicesTrack");
    if (!track || !data) return;
    const section = data.section || {};
    const head = document.querySelector("#servicios .section__head");
    if (head) {
      const eyebrow = head.querySelector(".eyebrow");
      const h2 = head.querySelector("h2");
      const sub = head.querySelector(".section__sub");
      if (eyebrow && section.eyebrow) eyebrow.textContent = section.eyebrow;
      if (h2 && (section.titleBefore || section.titleEm)) {
        h2.innerHTML = `${escapeHtml(section.titleBefore || "")}<em>${escapeHtml(
          section.titleEm || ""
        )}</em>${escapeHtml(section.titleAfter || "")}`;
      }
      if (sub && section.sub) sub.textContent = section.sub;
    }
    const cta = document.querySelector("#servicios .section__cta .btn");
    if (cta) {
      if (section.ctaLabel) cta.textContent = section.ctaLabel;
      if (section.ctaUrl) cta.href = section.ctaUrl;
    }

    const items = [...(data.items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    // No vaciar el HTML original si no hay items
    if (items.length) {
      track.innerHTML = items.map((item, i) => serviceCardHtml(item, i)).join("");
    }
  }

  function mountTestimonials(data) {
    const track = document.getElementById("testimonialsTrack");
    const dotsWrap = document.getElementById("testimonialDots");
    if (!track || !data) return;

    const section = data.section || {};
    const head = document.querySelector("#testimonios .section__head");
    if (head) {
      const eyebrow = head.querySelector(".eyebrow");
      const h2 = head.querySelector("h2");
      if (eyebrow && section.eyebrow) eyebrow.textContent = section.eyebrow;
      if (h2 && section.title) h2.textContent = section.title;
    }

    const items = [...(data.items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!items.length) return;

    track.innerHTML = items
      .map(
        (item) => `<article class="testimonial-card" data-id="${escapeHtml(item.id || "")}">
          <div class="testimonial-card__author">
            <span class="stars" aria-label="${item.stars || 5} estrellas">${stars(item.stars)}</span>
            <strong>${escapeHtml(item.name || "")}</strong>
          </div>
          <p>“${escapeHtml(item.quote || "")}”</p>
        </article>`
      )
      .join("");

    if (dotsWrap) {
      dotsWrap.innerHTML = items
        .map(
          (_, i) =>
            `<button class="dot${i === 0 ? " is-active" : ""}" type="button" aria-label="Testimonio ${
              i + 1
            }"></button>`
        )
        .join("");
    }
  }

  function mountResults(data) {
    if (!data) return;
    const section = data.section || {};
    const copy = document.querySelector("#resultados .results__copy");
    if (copy) {
      const eyebrow = copy.querySelector(".eyebrow");
      const h2 = copy.querySelector("h2");
      const lead = copy.querySelector(".results__lead");
      if (eyebrow) eyebrow.textContent = section.eyebrow || "";
      if (h2) {
        h2.innerHTML = `${escapeHtml(section.titleLine1 || "")}<br />${escapeHtml(
          section.titleLine2 || ""
        )}`;
      }
      if (lead) lead.textContent = section.lead || "";
    }

    const items = [...(data.items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    window.__CMS_RESULTS__ = items;
  }

  async function mountAll() {
    const [site, services, testimonials, results] = await Promise.all([
      loadFile("site").catch(() => null),
      loadFile("services").catch(() => null),
      loadFile("testimonials").catch(() => null),
      loadFile("results").catch(() => null),
    ]);

    if (site?.data) {
      applyHero(site.data);
      applyExperiencia(site.data);
      applyAbout(site.data);
      applyProductsSection(site.data);
    }
    if (services?.data) mountServices(services.data);
    if (testimonials?.data) mountTestimonials(testimonials.data);
    if (results?.data) mountResults(results.data);

    return {
      site: site?.data,
      services: services?.data,
      testimonials: testimonials?.data,
      results: results?.data,
    };
  }

  window.SiteCMS = {
    loadFile,
    mountAll,
    formatServicePrice,
    escapeHtml,
  };
})();
