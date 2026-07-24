/* Yuly Sánchez Skin Beauty — Interactions */

document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  initMobileNav();
  initPages();
  initServicesCarousel();
  initReveals();
  initProductFilters();
  initProductFlips();
  initRoutines();
  initRoutineLightbox();
  initBeforeAfter();
  initTestimonials();
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
  rutinas: "productos",
  "sobre-mi": "sobre-mi",
  resultados: "testimonios",
  testimonios: "testimonios",
  instagram: "testimonios",
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
        ".trust-item, .home-invite__card, .why-card, .process-step, .home-for__card, .service-item, .product-card, .routine-step, .testimonial-card, .instagram__item, .info-block, .services-value, .section__head, .section__cta, .why__quote, .home-cta__box, .ba-slider, .results__copy, .about__visual, .about__content, .contact__form-wrap, .contact__info, .services-aside, .hero__content, .hero__visual, .hero__mini-item"
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
  let autoTimer = null;

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

  const startAuto = () => {
    window.clearInterval(autoTimer);
    autoTimer = window.setInterval(next, 3800);
  };

  root.querySelector(".services-carousel__nav--next")?.addEventListener("click", () => {
    next();
    startAuto();
  });
  root.querySelector(".services-carousel__nav--prev")?.addEventListener("click", () => {
    prev();
    startAuto();
  });

  cards.forEach((card, i) => {
    card.addEventListener("click", () => {
      goTo(i);
      startAuto();
    });
  });

  root.addEventListener("mouseenter", () => window.clearInterval(autoTimer));
  root.addEventListener("mouseleave", startAuto);

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
      startAuto();
    },
    { passive: true }
  );

  render();
  startAuto();
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
  const cards = document.querySelectorAll(".product-card");
  const search = document.getElementById("productSearch");
  let active = "todos";

  const apply = () => {
    const query = (search?.value || "").trim().toLowerCase();

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
  const cards = document.querySelectorAll("#productsGrid .product-card");
  if (!cards.length) return;

  cards.forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest(".product-card__cart")) return;
      card.classList.toggle("is-flipped");
    });

    const cart = card.querySelector(".product-card__cart");
    cart?.addEventListener("click", (event) => {
      event.stopPropagation();
    });
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

  document.querySelectorAll(".routine-panel__zoom").forEach((btn) => {
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
  const slider = document.getElementById("baSlider");
  const wrap = document.getElementById("baBeforeWrap");
  const handle = document.getElementById("baHandle");
  const beforeImg = slider?.querySelector(".ba-slider__before");
  if (!slider || !wrap || !handle) return;

  let dragging = false;

  const syncBeforeWidth = () => {
    const track = slider.querySelector(".ba-slider__track");
    if (!track || !beforeImg) return;
    beforeImg.style.width = `${track.offsetWidth}px`;
  };

  const setPosition = (clientX) => {
    const track = slider.querySelector(".ba-slider__track");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    let percent = ((clientX - rect.left) / rect.width) * 100;
    percent = Math.min(96, Math.max(4, percent));
    wrap.style.width = `${percent}%`;
    handle.style.left = `${percent}%`;
    handle.setAttribute("aria-valuenow", String(Math.round(percent)));
  };

  const start = (e) => {
    dragging = true;
    handle.focus({ preventScroll: true });
    if (e.type === "mousedown") setPosition(e.clientX);
    if (e.type === "touchstart") setPosition(e.touches[0].clientX);
  };

  const move = (e) => {
    if (!dragging) return;
    if (e.type === "mousemove") setPosition(e.clientX);
    if (e.type === "touchmove") {
      e.preventDefault();
      setPosition(e.touches[0].clientX);
    }
  };

  const end = () => {
    dragging = false;
  };

  handle.addEventListener("mousedown", start);
  wrap.addEventListener("mousedown", start);
  slider.addEventListener("mousedown", (e) => {
    if (e.target.closest(".ba-slider__track")) {
      dragging = true;
      setPosition(e.clientX);
    }
  });

  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  handle.addEventListener("touchstart", start, { passive: true });
  slider.addEventListener(
    "touchstart",
    (e) => {
      dragging = true;
      setPosition(e.touches[0].clientX);
    },
    { passive: true }
  );
  window.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", end);

  handle.addEventListener("keydown", (e) => {
    const current = Number(handle.getAttribute("aria-valuenow") || 50);
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const track = slider.querySelector(".ba-slider__track");
      if (!track) return;
      const rect = track.getBoundingClientRect();
      setPosition(rect.left + ((current - 3) / 100) * rect.width);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const track = slider.querySelector(".ba-slider__track");
      if (!track) return;
      const rect = track.getBoundingClientRect();
      setPosition(rect.left + ((current + 3) / 100) * rect.width);
    }
  });

  syncBeforeWidth();
  window.addEventListener("resize", syncBeforeWidth);
}

function initTestimonials() {
  const track = document.getElementById("testimonialsTrack");
  const dots = document.querySelectorAll("#testimonialDots .dot");
  const cards = track?.querySelectorAll(".testimonial-card");
  if (!track || !dots.length || !cards?.length) return;

  let index = 0;

  const show = (i) => {
    index = i;
    const isMobile = window.innerWidth <= 820;

    if (isMobile) {
      cards.forEach((card, idx) => {
        card.style.display = idx === index ? "block" : "none";
      });
    } else {
      cards.forEach((card) => {
        card.style.display = "block";
      });
    }

    dots.forEach((dot, idx) => {
      dot.classList.toggle("is-active", idx === index);
    });
  };

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => show(i));
  });

  window.addEventListener("resize", () => show(index));
  show(0);
}
