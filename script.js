/* Yuly Sánchez Skin Beauty — Interactions */

document.addEventListener("DOMContentLoaded", async () => {
  initHeader();
  initMobileNav();
  initPages();

  if (window.SiteCMS?.mountAll) {
    try {
      await SiteCMS.mountAll();
    } catch (e) {
      console.warn("CMS:", e);
    }
  }

  initServicesCarousel();
  initServiceGalleries();
  initProductFlips();
  initRoutines();
  initRoutineLightbox();
  initBeforeAfter();
  initTestimonials();

  if (window.ProductsCore?.mountPublicCatalog) {
    await ProductsCore.mountPublicCatalog();
  }
  initProductFilters();
  initReveals();
});

const PAGE_IDS = ["inicio", "servicios", "productos", "sobre-mi", "testimonios"];

const HASH_TO_PAGE = {
  inicio: "inicio",
  promesa: "inicio",
  experiencia: "inicio",
  atmosfera: "inicio",
  "para-ti": "inicio",
  "inicio-cita": "inicio",
  servicios: "servicios",
  productos: "productos",
  rutinas: "inicio",
  "sobre-mi": "sobre-mi",
  resultados: "testimonios",
  testimonios: "testimonios",
};

function resolvePage(raw) {
  const key = (raw || "").replace(/^#/, "");
  return HASH_TO_PAGE[key] || (PAGE_IDS.includes(key) ? key : "inicio");
}

  function showPage(pageId, { updateHash = true } = {}) {
  const page = PAGE_IDS.includes(pageId) ? pageId : "inicio";

  document.body.dataset.activePage = page;

  document.querySelectorAll(".page-panel").forEach((panel) => {
    const match = panel.dataset.page === page;
    panel.classList.toggle("is-active", match);

    // Reinicia animaciones cada vez que se abre una sección
    if (match) {
      panel.querySelectorAll(
        ".trust-item, .home-invite__card, .why-card, .experience-step, .home-for__card, .service-item, .product-card, .routine-step, .testimonial-card, .info-block, .services-value, .section__head, .experience__head, .section__cta, .why__quote, .home-cta__box, .ba-carousel, .ba-case, .results__copy, .about__visual, .about__content, .contact__form-wrap, .contact__info, .services-aside, .hero__content, .hero__visual, .hero__mini-item"
      ).forEach((el) => {
        el.style.animation = "none";
        // force reflow
        void el.offsetWidth;
        el.style.animation = "";
      });
    }
  });

  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.nav === page);
  });

  if (updateHash) {
    const hash = `#${page}`;
    if (location.hash !== hash) {
      history.pushState({ page }, "", hash);
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });

  document.querySelectorAll(".page-panel.is-active .reveal").forEach((el) => {
    el.classList.add("is-visible");
  });
}

function initPages() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const hashKey = href.slice(1);
      const page = anchor.dataset.nav || resolvePage(href);

      if (!PAGE_IDS.includes(page) && !HASH_TO_PAGE[hashKey]) return;

      e.preventDefault();
      showPage(page);
    });
  });

  window.addEventListener("popstate", () => {
    showPage(resolvePage(location.hash || "inicio"), { updateHash: false });
  });

  showPage(resolvePage(location.hash || "inicio"), { updateHash: false });
}

function initServicesCarousel() {
  const root = document.getElementById("servicesCarousel");
  const track = document.getElementById("servicesTrack");
  if (!root || !track) return;

  const cards = Array.from(track.querySelectorAll(".service-card"));
  if (!cards.length) return;

  let active = Math.floor(cards.length / 2);

  const render = () => {
    cards.forEach((card, i) => {
      const offset = i - active;
      const abs = Math.abs(offset);
      const x = offset * 230;
      const rot = offset * -24;
      const scale = Math.max(0.62, 1 - abs * 0.1);
      const z = 100 - abs * 10;
      const opacity = abs > 3 ? 0 : Math.max(0.25, 1 - abs * 0.22);

      card.style.transform = `translate(-50%, -50%) translateX(${x}px) rotateY(${rot}deg) scale(${scale})`;
      card.style.zIndex = String(z);
      card.style.opacity = String(opacity);
      card.style.filter = abs === 0 ? "none" : `brightness(${Math.max(0.75, 1 - abs * 0.08)})`;
      card.classList.toggle("is-active", offset === 0);
      card.setAttribute("aria-hidden", abs > 3 ? "true" : "false");
    });
  };

  const goTo = (index) => {
    active = ((index % cards.length) + cards.length) % cards.length;
    render();
  };

  const next = () => goTo(active + 1);
  const prev = () => goTo(active - 1);

  root.querySelector(".services-carousel__nav--next")?.addEventListener("click", next);
  root.querySelector(".services-carousel__nav--prev")?.addEventListener("click", prev);

  cards.forEach((card, i) => {
    card.addEventListener("click", () => goTo(i));
  });

  let touchStartX = 0;
  root.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].clientX;
    },
    { passive: true }
  );
  root.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) < 40) return;
      if (dx < 0) next();
      else prev();
    },
    { passive: true }
  );

  render();
}

function initServiceGalleries() {
  const galleries = document.querySelectorAll("[data-gallery] .service-card__gallery");
  if (!galleries.length) return;

  galleries.forEach((gallery) => {
    const slides = Array.from(gallery.querySelectorAll("img"));
    if (slides.length < 2) return;

    let index = slides.findIndex((img) => img.classList.contains("is-active"));
    if (index < 0) index = 0;

    const show = (i) => {
      index = ((i % slides.length) + slides.length) % slides.length;
      slides.forEach((img, idx) => {
        img.classList.toggle("is-active", idx === index);
      });
    };

    gallery.style.cursor = "pointer";
    gallery.addEventListener("click", (e) => {
      e.stopPropagation();
      show(index + 1);
    });
  });
}

function initHeader() {
  const header = document.getElementById("header");
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initMobileNav() {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("nav");
  if (!toggle || !nav) return;

  const close = () => {
    toggle.classList.remove("is-open");
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    toggle.classList.toggle("is-open", open);
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", close);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) close();
  });
}

function initReveals() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

function initProductFilters() {
  const filters = document.querySelectorAll(".filter");
  const search = document.getElementById("productSearch");
  let active = "todos";

  const apply = () => {
    const query = (search?.value || "").trim().toLowerCase();
    const cards = document.querySelectorAll("#productsGrid .product-card");

    cards.forEach((card) => {
      const category = card.dataset.category || "";
      const name = card.dataset.name || "";
      const matchFilter = active === "todos" || category === active;
      const matchSearch = !query || name.includes(query);
      card.classList.toggle("is-hidden", !(matchFilter && matchSearch));
    });
  };

  filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      filters.forEach((f) => f.classList.remove("is-active"));
      btn.classList.add("is-active");
      active = btn.dataset.filter || "todos";
      apply();
    });
  });

  search?.addEventListener("input", apply);
}

function initProductFlips() {
  const grid = document.getElementById("productsGrid");
  if (!grid || grid.dataset.flipBound === "1") return;
  grid.dataset.flipBound = "1";
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (!card || !grid.contains(card)) return;
    card.classList.toggle("is-flipped");
  });
}

function initRoutines() {
  const tabs = document.querySelectorAll(".routine-tab");
  const panels = document.querySelectorAll(".routine-panel");
  if (!tabs.length || !panels.length) return;

  let isAnimating = false;
  const FADE_MS = 380;

  const showRoutine = (routineId) => {
    if (isAnimating) return;

    const nextPanel = document.querySelector(`.routine-panel[data-routine="${routineId}"]`);
    const currentPanel = document.querySelector(".routine-panel.is-active");
    if (!nextPanel || currentPanel === nextPanel) return;

    isAnimating = true;

    tabs.forEach((tab) => {
      const active = tab.dataset.routine === routineId;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    const revealNext = () => {
      if (currentPanel) {
        currentPanel.hidden = true;
        currentPanel.classList.remove("is-active", "is-leaving");
      }

      nextPanel.hidden = false;
      nextPanel.classList.add("is-entering");

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          nextPanel.classList.remove("is-entering");
          nextPanel.classList.add("is-active");
        });
      });

      window.setTimeout(() => {
        isAnimating = false;
      }, FADE_MS);
    };

    if (currentPanel) {
      currentPanel.classList.add("is-leaving");
      currentPanel.classList.remove("is-active");
      window.setTimeout(revealNext, FADE_MS);
    } else {
      revealNext();
    }
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const routineId = tab.dataset.routine;
      if (!routineId || tab.classList.contains("is-active")) return;
      showRoutine(routineId);
    });
  });
}

function initRoutineLightbox() {
  // Las rutinas ahora son HTML estructurado; se mantiene el lightbox
  // por si se reutiliza en otras imágenes de la página.
  const lightbox = document.getElementById("imgLightbox");
  const lightboxImg = document.getElementById("imgLightboxImg");
  if (!lightbox || !lightboxImg) return;

  const closeBtn = lightbox.querySelector(".img-lightbox__close");
  const backdrop = lightbox.querySelector(".img-lightbox__backdrop");

  const open = (src, alt) => {
    lightboxImg.src = src;
    lightboxImg.alt = alt || "Imagen ampliada";
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    closeBtn?.focus();
  };

  const close = () => {
    lightbox.hidden = true;
    lightboxImg.src = "";
    document.body.classList.remove("lightbox-open");
  };

  document.querySelectorAll("[data-zoom-src]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      open(btn.dataset.zoomSrc || "", btn.dataset.zoomAlt || "");
    });
  });

  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightbox.hidden) close();
  });
}

function initBeforeAfter() {
  const carousel = document.getElementById("baCarousel");
  const track = document.getElementById("baCarouselTrack");
  const dotsWrap = document.getElementById("baDots");
  const counter = document.getElementById("baCounter");
  if (!carousel || !track || !dotsWrap) return;

  const cmsItems = Array.isArray(window.__CMS_RESULTS__) ? window.__CMS_RESULTS__ : null;
  let items = cmsItems;
  if (!items || !items.length) {
    items = Array.from({ length: 17 }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return {
        imageUrl: `assets/testimonios/antes-despues/caso-${n}.webp`,
        alt: `Resultado antes y después ${i + 1}`,
      };
    });
  }

  track.innerHTML = "";
  dotsWrap.innerHTML = "";

  items.forEach((item, i) => {
    const slide = document.createElement("div");
    slide.className = `ba-slide${i === 0 ? " is-active" : ""}`;
    slide.innerHTML = `
      <figure class="ba-case">
        <img
          src="${item.imageUrl}"
          alt="${item.alt || `Resultado antes y después ${i + 1}`}"
          loading="${i === 0 ? "eager" : "lazy"}"
          decoding="async"
        />
      </figure>
    `;
    track.appendChild(slide);

    const dot = document.createElement("button");
    dot.className = `dot${i === 0 ? " is-active" : ""}`;
    dot.type = "button";
    dot.setAttribute("aria-label", `Resultado ${i + 1}`);
    dotsWrap.appendChild(dot);
  });

  const slides = Array.from(track.querySelectorAll(".ba-slide"));
  const dots = Array.from(dotsWrap.querySelectorAll(".dot"));
  if (!slides.length) return;

  let active = 0;

  const showSlide = (index) => {
    active = ((index % slides.length) + slides.length) % slides.length;
    track.style.transform = `translateX(-${active * 100}%)`;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === active);
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === active);
    });
    if (counter) counter.textContent = `${active + 1} / ${slides.length}`;
  };

  carousel.querySelector(".ba-carousel__nav--next")?.addEventListener("click", () => {
    showSlide(active + 1);
  });
  carousel.querySelector(".ba-carousel__nav--prev")?.addEventListener("click", () => {
    showSlide(active - 1);
  });

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => showSlide(i));
  });

  let touchStartX = 0;
  carousel.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].clientX;
    },
    { passive: true }
  );
  carousel.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) < 50) return;
      if (dx < 0) showSlide(active + 1);
      else showSlide(active - 1);
    },
    { passive: true }
  );

  showSlide(0);
}

function initTestimonials() {
  const track = document.getElementById("testimonialsTrack");
  const dots = Array.from(document.querySelectorAll("#testimonialDots .dot"));
  const cards = track ? Array.from(track.querySelectorAll(".testimonial-card")) : [];
  if (!track || !cards.length) return;

  let active = 0;
  let scrollRaf = 0;

  const setActive = (i) => {
    active = Math.max(0, Math.min(i, cards.length - 1));
    dots.forEach((dot, idx) => {
      dot.classList.toggle("is-active", idx === active);
    });
  };

  const scrollToCard = (i) => {
    const card = cards[i];
    if (!card) return;
    setActive(i);
    track.scrollTo({
      left: card.offsetLeft - track.offsetLeft - 4,
      behavior: "smooth",
    });
  };

  const updateFromScroll = () => {
    scrollRaf = 0;
    const left = track.scrollLeft;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs(card.offsetLeft - track.offsetLeft - left);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActive(best);
  };

  track.addEventListener(
    "scroll",
    () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(updateFromScroll);
    },
    { passive: true }
  );

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => scrollToCard(i));
  });

  setActive(0);
}
