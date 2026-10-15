/* =========================================================
   Core site script — loaded on every page.
   * Shared UI helpers (price format, icons, product cards,
     announcements, toasts)
   * Sticky header state
   * Mobile navigation (focus trap, Escape, scroll lock)
   * Bag / wishlist counters
   * Scroll-reveal animations
   * Footer year (kept from the original script)
========================================================= */
(function () {
    "use strict";

    var GLOWW = (window.GLOWW = window.GLOWW || {});
    var root = document.documentElement;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* ---------- Helpers ---------- */

    var priceFormat = new Intl.NumberFormat(GLOWW.config.locale, {
        style: "currency",
        currency: GLOWW.config.currency
    });
    var wholeFormat = new Intl.NumberFormat(GLOWW.config.locale, {
        style: "currency",
        currency: GLOWW.config.currency,
        maximumFractionDigits: 0
    });

    function formatPrice(value) {
        return value % 1 === 0 ? wholeFormat.format(value) : priceFormat.format(value);
    }

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, function (char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
    }

    var ICONS = {
        search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
        heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20Z"/>',
        bag: '<path d="M5 8h14l-1.2 12H6.2L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
        close: '<path d="M6 6l12 12M18 6 6 18"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        minus: '<path d="M5 12h14"/>',
        arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
        check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
        star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/>',
        alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.8v5M12 16.2v.1"/>',
        leaf: '<path d="M5 19C5 10 11 5 20 4c0 9-5 15-14 15"/><path d="M5 19c3-4 6-7 10-9"/>',
        lock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
    };

    function icon(name, extraClass) {
        return '<svg class="icon' + (extraClass ? " " + extraClass : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
    }

    function productUrl(product) {
        return "product-detail.html?p=" + encodeURIComponent(product.id);
    }

    function imageTag(image, options) {
        options = options || {};
        return '<img src="' + image.src + '" alt="' + escapeHTML(options.alt === undefined ? image.alt : options.alt) + '" width="' + image.w + '" height="' + image.h + '"' +
            ' loading="' + (options.eager ? "eager" : "lazy") + '" decoding="async">';
    }

    function wishlistButton(product) {
        var saved = GLOWW.store.isWishlisted(product.id);
        return '<button type="button" class="wishlist-btn" data-wishlist="' + product.id + '" aria-pressed="' + saved + '" aria-label="Save ' + escapeHTML(product.name) + ' to wishlist">' + icon("heart") + "</button>";
    }

    /* Product card markup — shared by home, shop, product page and search */
    function productCard(product, options) {
        options = options || {};
        var heading = options.headingLevel || 3;
        return '<article class="product-card">' +
            '<div class="product-card__media">' +
                imageTag(product.images[0], { alt: "", eager: options.eager }) +
                (product.badge ? '<span class="product-card__flag">' + escapeHTML(product.badge) + "</span>" : "") +
                wishlistButton(product) +
                '<button type="button" class="product-card__quick" data-quick-view="' + product.id + '">Quick view<span class="visually-hidden"> of ' + escapeHTML(product.name) + "</span></button>" +
            "</div>" +
            '<div class="product-card__body">' +
                '<span class="product-card__category">' + escapeHTML(GLOWW.getCategory(product.category).label) + "</span>" +
                "<h" + heading + ' class="product-card__name"><a href="' + productUrl(product) + '">' + escapeHTML(product.name) + "</a></h" + heading + ">" +
                '<p class="product-card__desc">' + escapeHTML(product.short) + "</p>" +
                '<div class="product-card__footer">' +
                    '<span class="price">' + formatPrice(product.price) + "</span>" +
                    '<button type="button" class="btn btn--outline btn--sm" data-add-to-bag="' + product.id + '">Add to bag<span class="visually-hidden">: ' + escapeHTML(product.name) + "</span></button>" +
                "</div>" +
            "</div>" +
        "</article>";
    }

    function skeletonCards(count) {
        var html = "";
        for (var i = 0; i < count; i++) {
            html += '<div class="skeleton-card" aria-hidden="true"><div class="skeleton skeleton--media"></div><div class="skeleton skeleton--line"></div><div class="skeleton skeleton--line"></div></div>';
        }
        return html;
    }

    /* Screen-reader announcements */
    /* While a modal <dialog> is open the rest of the page is inert, so live
       regions and toasts are moved inside the open dialog to stay usable */
    function overlayHost() {
        var open = document.querySelectorAll("dialog[open]");
        return open.length ? open[open.length - 1] : document.body;
    }

    var liveRegion;
    function announce(message) {
        if (!liveRegion) {
            liveRegion = document.createElement("div");
            liveRegion.className = "visually-hidden";
            liveRegion.setAttribute("role", "status");
            liveRegion.setAttribute("aria-live", "polite");
        }
        if (liveRegion.parentNode !== overlayHost()) overlayHost().appendChild(liveRegion);
        liveRegion.textContent = "";
        window.setTimeout(function () { liveRegion.textContent = message; }, 60);
    }

    /* Visual toast (announced via the live region) */
    var toastRegion;
    function toast(message, action) {
        if (!toastRegion) {
            toastRegion = document.createElement("div");
            toastRegion.className = "toast-region";
        }
        if (toastRegion.parentNode !== overlayHost()) overlayHost().appendChild(toastRegion);
        var el = document.createElement("div");
        el.className = "toast";
        el.innerHTML = "<span>" + escapeHTML(message) + "</span>";
        if (action) {
            var button = document.createElement("button");
            button.type = "button";
            button.textContent = action.label;
            button.addEventListener("click", function () {
                action.onClick();
                dismiss();
            });
            el.appendChild(button);
        }
        toastRegion.appendChild(el);
        announce(message);
        var timer = window.setTimeout(dismiss, 4200);
        function dismiss() {
            window.clearTimeout(timer);
            el.classList.add("is-leaving");
            window.setTimeout(function () { el.remove(); }, 350);
        }
    }

    /* Scroll lock shared by the mobile nav and dialogs */
    var locks = 0;
    function lockScroll(lock) {
        locks = Math.max(0, locks + (lock ? 1 : -1));
        root.classList.toggle("is-locked", locks > 0);
    }

    function focusable(container) {
        return Array.prototype.filter.call(
            container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'),
            function (el) { return el.offsetParent !== null || el === document.activeElement; }
        );
    }

    GLOWW.ui = {
        formatPrice: formatPrice,
        escapeHTML: escapeHTML,
        icon: icon,
        imageTag: imageTag,
        productUrl: productUrl,
        productCard: productCard,
        skeletonCards: skeletonCards,
        wishlistButton: wishlistButton,
        announce: announce,
        toast: toast,
        lockScroll: lockScroll,
        focusable: focusable,
        reducedMotion: reducedMotion
    };

    /* ---------- Header state ---------- */

    var header = document.querySelector("[data-header]");
    if (header) {
        var ticking = false;
        var updateHeader = function () {
            header.classList.toggle("is-scrolled", window.scrollY > 8);
            ticking = false;
        };
        window.addEventListener("scroll", function () {
            if (!ticking) {
                ticking = true;
                window.requestAnimationFrame(updateHeader);
            }
        }, { passive: true });
        updateHeader();
    }

    /* ---------- Mobile navigation ---------- */

    var navToggle = document.querySelector("[data-nav-toggle]");
    var nav = document.getElementById("primary-nav");
    var desktopNav = window.matchMedia("(min-width: 1024px)");

    function setNav(open) {
        if (!nav || !navToggle) return;
        var isOpen = root.classList.contains("nav-open");
        if (open === isOpen) return;
        root.classList.toggle("nav-open", open);
        navToggle.setAttribute("aria-expanded", String(open));
        lockScroll(open);
        ["main", ".site-footer", ".announcement"].forEach(function (selector) {
            var el = document.querySelector(selector);
            if (el) el.inert = open;
        });
        if (open) {
            var close = nav.querySelector("[data-nav-close]");
            window.setTimeout(function () { (close || nav).focus(); }, 50);
        } else {
            navToggle.focus();
        }
    }

    if (navToggle && nav) {
        navToggle.addEventListener("click", function () { setNav(true); });

        nav.addEventListener("click", function (event) {
            if (event.target.closest("[data-nav-close]") || event.target.closest("a")) {
                if (!desktopNav.matches) setNav(false);
            }
        });

        var scrim = document.querySelector("[data-nav-scrim]");
        if (scrim) scrim.addEventListener("click", function () { setNav(false); });

        document.addEventListener("keydown", function (event) {
            if (!root.classList.contains("nav-open")) return;
            if (event.key === "Escape") {
                setNav(false);
            } else if (event.key === "Tab") {
                var items = focusable(nav);
                if (!items.length) return;
                var first = items[0];
                var last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });

        var onBreakpoint = function (event) {
            if (event.matches) setNav(false);
        };
        if (desktopNav.addEventListener) {
            desktopNav.addEventListener("change", onBreakpoint);
        } else {
            desktopNav.addListener(onBreakpoint);
        }
    }

    /* ---------- Bag & wishlist counters ---------- */

    function updateCounts(bump) {
        var bagCount = GLOWW.store.bagCount();
        var wishCount = GLOWW.store.getWishlist().length;

        document.querySelectorAll("[data-bag-count]").forEach(function (el) {
            el.textContent = bagCount;
            el.hidden = bagCount === 0;
            if (bump === "bag") {
                el.classList.remove("is-bumping");
                void el.offsetWidth;
                el.classList.add("is-bumping");
            }
        });
        document.querySelectorAll("[data-wishlist-count]").forEach(function (el) {
            el.textContent = wishCount;
            el.hidden = wishCount === 0;
        });
        document.querySelectorAll('[data-open="bag"]').forEach(function (el) {
            el.setAttribute("aria-label", "Shopping bag, " + bagCount + (bagCount === 1 ? " item" : " items"));
        });
        document.querySelectorAll('[data-open="wishlist"]').forEach(function (el) {
            if (el.classList.contains("icon-btn")) {
                el.setAttribute("aria-label", "Wishlist, " + wishCount + (wishCount === 1 ? " item" : " items"));
            }
        });
    }

    document.addEventListener("gloww:store", function (event) {
        var type = event.detail.type;
        updateCounts(type === "bag:add" ? "bag" : null);

        /* Keep every heart on the page in sync */
        if (type.indexOf("wishlist") === 0 || type === "sync") {
            document.querySelectorAll("[data-wishlist]").forEach(function (button) {
                button.setAttribute("aria-pressed", String(GLOWW.store.isWishlisted(button.getAttribute("data-wishlist"))));
            });
        }
    });

    updateCounts();

    /* ---------- Scroll reveal ---------- */

    GLOWW.ui.observeReveals = function (scope) {
        var items = (scope || document).querySelectorAll(".reveal:not(.is-visible), .reveal-image:not(.is-visible)");
        if (!("IntersectionObserver" in window) || reducedMotion.matches) {
            items.forEach(function (el) { el.classList.add("is-visible"); });
            return;
        }
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
        items.forEach(function (el) { observer.observe(el); });
    };

    GLOWW.ui.observeReveals();

    /* ---------- Footer year (from the original script) ---------- */

    document.querySelectorAll("[data-year]").forEach(function (el) {
        el.textContent = new Date().getFullYear();
    });
})();
