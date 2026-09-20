// Shared landing-page behavior: navbar scroll state, scroll-reveal, FAQ accordion.
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const navWrap = document.querySelector(".nav-wrap");
    if (navWrap) {
      const onScroll = () => navWrap.classList.toggle("scrolled", window.scrollY > 24);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    const reveals = document.querySelectorAll(".reveal");
    if (reveals.length) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
      );
      reveals.forEach((el) => io.observe(el));
    }

    document.querySelectorAll("[data-faq-item]").forEach((item) => {
      const btn = item.querySelector(".faq-q");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const wasOpen = item.classList.contains("open");
        item.closest(".faq-list").querySelectorAll(".faq-item").forEach((other) => {
          other.classList.remove("open");
          other.querySelector(".faq-q")?.setAttribute("aria-expanded", "false");
        });
        if (!wasOpen) {
          item.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });

    // First FAQ item open by default, matching the original page's initial state.
    const firstFaq = document.querySelector(".faq-item");
    if (firstFaq) {
      firstFaq.classList.add("open");
      firstFaq.querySelector(".faq-q")?.setAttribute("aria-expanded", "true");
    }
  });
})();
