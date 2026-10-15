/* =========================================================
   Drawers & dialogs — loaded on every page.
   * Bag drawer       (quantities, remove, shipping meter, totals)
   * Wishlist drawer  (remove, move to bag)
   * Search overlay   (live results, keyboard friendly)
   * Quick view modal
   * Delegated actions: [data-open], [data-add-to-bag],
     [data-wishlist], [data-quick-view], [data-add-ritual]

   Built on native <dialog>, which provides focus containment,
   Escape-to-close and an inert page behind the dialog.
========================================================= */
(function () {
    "use strict";

    var GLOWW = window.GLOWW;
    var ui = GLOWW.ui;
    var store = GLOWW.store;
    var esc = ui.escapeHTML;

    /* ---------- Generic dialog with enter/exit animation ---------- */

    function createDialog(options) {
        var dialog = document.createElement("dialog");
        dialog.className = "dialog dialog--" + options.variant;
        dialog.id = options.id;
        dialog.setAttribute("aria-labelledby", options.id + "-title");
        dialog.innerHTML = '<div class="dialog__scrim" data-dialog-close></div><div class="dialog__panel">' + options.html + "</div>";
        document.body.appendChild(dialog);

        var opener = null;
        var closing = false;
        var locked = false;

        function open(trigger) {
            if (dialog.open) return;
            opener = trigger || document.activeElement;
            if (typeof dialog.showModal === "function") {
                dialog.showModal();
            } else {
                dialog.setAttribute("open", "");
            }
            locked = true;
            ui.lockScroll(true);
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(function () { dialog.classList.add("is-open"); });
            });
            if (options.onOpen) options.onOpen();
        }

        /* Animate out, then close natively */
        function close() {
            if (!dialog.open || closing) return;
            closing = true;
            dialog.classList.remove("is-open");
            window.setTimeout(function () {
                closing = false;
                if (typeof dialog.close === "function") {
                    dialog.close();
                } else {
                    dialog.removeAttribute("open");
                    cleanup();
                }
            }, ui.reducedMotion.matches ? 0 : 380);
        }

        /* Runs however the dialog was closed — including a browser-forced
           Escape close that skips the animated path */
        function cleanup() {
            dialog.classList.remove("is-open");
            if (!locked) return;
            locked = false;
            ui.lockScroll(false);
            /* The opener may have been hidden meanwhile (e.g. inside the closed mobile menu) */
            if (opener && (!document.contains(opener) || opener.offsetParent === null)) {
                opener = document.querySelector("[data-nav-toggle]");
            }
            if (opener && typeof opener.focus === "function") opener.focus();
        }

        dialog.addEventListener("close", cleanup);

        dialog.addEventListener("cancel", function (event) {
            event.preventDefault();
            close();
        });

        dialog.addEventListener("click", function (event) {
            if (event.target.closest("[data-dialog-close]")) close();
        });

        return { el: dialog, open: open, close: close, isOpen: function () { return dialog.open; } };
    }

    function closeButton(label) {
        return '<button type="button" class="icon-btn dialog__close" data-dialog-close aria-label="' + label + '">' + ui.icon("close") + "</button>";
    }

    /* ---------- Bag drawer ---------- */

    var bag = createDialog({
        id: "bag-drawer",
        variant: "drawer",
        html:
            '<div class="dialog__header"><h2 class="dialog__title" id="bag-drawer-title">Your bag <small data-bag-heading-count></small></h2>' + closeButton("Close bag") + "</div>" +
            '<div class="dialog__body" data-bag-body></div>' +
            '<div class="dialog__footer" data-bag-footer></div>',
        onOpen: renderBag
    });

    function renderBag() {
        var lines = store.getBag();
        var body = bag.el.querySelector("[data-bag-body]");
        var footer = bag.el.querySelector("[data-bag-footer]");
        var count = store.bagCount();
        bag.el.querySelector("[data-bag-heading-count]").textContent = count ? "(" + count + ")" : "";

        if (!lines.length) {
            body.innerHTML =
                '<div class="empty-state">' +
                    '<span class="empty-state__icon">' + ui.icon("bag") + "</span>" +
                    "<h3>Your bag is empty</h3>" +
                    "<p>Discover our serums, creams and rituals — everything you add will wait for you here.</p>" +
                    '<a class="btn btn--primary" href="Product.html">Explore the collection</a>' +
                "</div>";
            footer.hidden = true;
            return;
        }

        var totals = store.totals();
        var meter = totals.remainingForFreeShipping > 0
            ? "You're <strong>" + ui.formatPrice(totals.remainingForFreeShipping) + "</strong> away from complimentary shipping."
            : "<strong>Your order qualifies for complimentary shipping.</strong>";

        body.innerHTML =
            '<div class="shipping-meter">' + meter +
                '<div class="shipping-meter__bar"><span style="transform:scaleX(' + totals.freeShippingProgress + ')"></span></div>' +
            "</div>" +
            '<ul class="line-items" role="list">' + lines.map(function (line) {
                var p = line.product;
                return '<li class="line-item">' +
                    '<a class="line-item__media" href="' + ui.productUrl(p) + '" tabindex="-1" aria-hidden="true">' + ui.imageTag(p.images[0], { alt: "" }) + "</a>" +
                    "<div>" +
                        '<div class="line-item__top">' +
                            '<div><h3 class="line-item__name"><a href="' + ui.productUrl(p) + '">' + esc(p.name) + "</a></h3>" +
                            '<p class="line-item__meta">' + esc(p.size) + " · " + ui.formatPrice(p.price) + " each</p></div>" +
                            '<span class="price">' + ui.formatPrice(line.lineTotal) + "</span>" +
                        "</div>" +
                        '<div class="line-item__actions">' +
                            quantityControl(line) +
                            '<button type="button" class="link-btn" data-bag-remove="' + p.id + '">Remove<span class="visually-hidden"> ' + esc(p.name) + "</span></button>" +
                        "</div>" +
                    "</div>" +
                "</li>";
            }).join("") + "</ul>";

        footer.hidden = false;
        footer.innerHTML =
            '<dl class="summary">' +
                "<div><dt>Subtotal</dt><dd>" + ui.formatPrice(totals.subtotal) + "</dd></div>" +
                "<div><dt>Shipping</dt><dd>" + (totals.shipping === 0 ? "Complimentary" : ui.formatPrice(totals.shipping)) + "</dd></div>" +
                "<div><dt>Taxes</dt><dd>Calculated at checkout</dd></div>" +
                '<div class="summary__total"><dt>Estimated total</dt><dd>' + ui.formatPrice(totals.total) + "</dd></div>" +
            "</dl>" +
            '<button type="button" class="btn btn--primary btn--block" aria-describedby="checkout-note" data-checkout' + (CHECKOUT_AVAILABLE ? "" : " disabled") + ">" +
                ui.icon("lock", "icon--sm") + "Secure checkout</button>" +
            '<div class="checkout-status" data-checkout-status></div>' +
            '<p class="checkout-note" id="checkout-note">' + (CHECKOUT_AVAILABLE
                ? "Payments are processed securely by Stripe. You'll add your shipping details and pay on the next page."
                : "Checkout is available on the live website. Your bag is saved on this device.") + "</p>";
    }

    /* Checkout runs through a Netlify Function, so it can't work from a file opened on disk */
    var CHECKOUT_AVAILABLE = window.location.protocol !== "file:";

    /* Sends only ids and quantities; the server prices the order and returns a Stripe Checkout URL */
    function startCheckout(button) {
        var status = bag.el.querySelector("[data-checkout-status]");
        var items = store.getBag().map(function (line) { return { id: line.id, qty: line.qty }; });
        if (!items.length || button.disabled) return;

        button.classList.add("is-loading");
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        status.innerHTML = "";
        ui.announce("Preparing secure checkout");

        fetch(GLOWW.config.checkoutEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ items: items })
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (data) {
                if (!response.ok || typeof data.url !== "string" || data.url.indexOf("https://") !== 0) throw data;
                window.location.assign(data.url);
            });
        }).catch(function (data) {
            button.classList.remove("is-loading");
            button.disabled = false;
            button.removeAttribute("aria-busy");
            status.innerHTML =
                '<div class="form-status form-status--error" role="alert">' + ui.icon("alert") +
                    "<div><strong>Checkout couldn't start</strong>" +
                    esc((data && !(data instanceof Error) && data.message) || "Please check your connection and try again. Your bag is saved.") +
                "</div></div>";
        });
    }

    function quantityControl(line) {
        var max = GLOWW.config.maxQuantity;
        return '<div class="qty qty--sm" role="group" aria-label="Quantity for ' + esc(line.product.name) + '">' +
            '<button type="button" data-bag-qty="' + line.id + '" data-step="-1" aria-label="Decrease quantity">' + ui.icon("minus", "icon--sm") + "</button>" +
            '<output aria-live="polite">' + line.qty + "</output>" +
            '<button type="button" data-bag-qty="' + line.id + '" data-step="1" aria-label="Increase quantity"' + (line.qty >= max ? " disabled" : "") + ">" + ui.icon("plus", "icon--sm") + "</button>" +
        "</div>";
    }

    bag.el.addEventListener("click", function (event) {
        var qtyButton = event.target.closest("[data-bag-qty]");
        if (qtyButton) {
            var id = qtyButton.getAttribute("data-bag-qty");
            var next = store.quantityOf(id) + parseInt(qtyButton.getAttribute("data-step"), 10);
            var name = GLOWW.getProduct(id).name;
            store.setQuantity(id, next);
            ui.announce(next < 1 ? name + " removed from your bag" : name + " quantity " + next);
            restoreFocus('[data-bag-qty="' + id + '"][data-step="' + qtyButton.getAttribute("data-step") + '"]');
            return;
        }
        var removeButton = event.target.closest("[data-bag-remove]");
        if (removeButton) {
            var removeId = removeButton.getAttribute("data-bag-remove");
            store.removeFromBag(removeId);
            ui.toast(GLOWW.getProduct(removeId).name + " removed", {
                label: "Undo",
                onClick: function () { store.addToBag(removeId, 1); }
            });
            restoreFocus("[data-bag-remove], .dialog__close");
            return;
        }
        var checkoutButton = event.target.closest("[data-checkout]");
        if (checkoutButton) startCheckout(checkoutButton);
    });

    /* Re-rendering replaces nodes; keep keyboard focus in a sensible place */
    function restoreFocus(selector) {
        window.requestAnimationFrame(function () {
            var target = bag.el.querySelector(selector) || bag.el.querySelector(".dialog__close");
            if (target && !target.disabled) {
                target.focus();
            } else {
                bag.el.querySelector(".dialog__close").focus();
            }
        });
    }

    /* ---------- Wishlist drawer ---------- */

    var wishlist = createDialog({
        id: "wishlist-drawer",
        variant: "drawer",
        html:
            '<div class="dialog__header"><h2 class="dialog__title" id="wishlist-drawer-title">Wishlist <small data-wish-heading-count></small></h2>' + closeButton("Close wishlist") + "</div>" +
            '<div class="dialog__body" data-wish-body></div>',
        onOpen: renderWishlist
    });

    function renderWishlist() {
        var ids = store.getWishlist();
        var body = wishlist.el.querySelector("[data-wish-body]");
        wishlist.el.querySelector("[data-wish-heading-count]").textContent = ids.length ? "(" + ids.length + ")" : "";

        if (!ids.length) {
            body.innerHTML =
                '<div class="empty-state">' +
                    '<span class="empty-state__icon">' + ui.icon("heart") + "</span>" +
                    "<h3>Nothing saved yet</h3>" +
                    "<p>Tap the heart on any product to keep it here for later.</p>" +
                    '<a class="btn btn--primary" href="Product.html">Browse products</a>' +
                "</div>";
            return;
        }

        body.innerHTML = '<ul class="line-items" role="list">' + ids.map(function (id) {
            var p = GLOWW.getProduct(id);
            return '<li class="line-item">' +
                '<a class="line-item__media" href="' + ui.productUrl(p) + '" tabindex="-1" aria-hidden="true">' + ui.imageTag(p.images[0], { alt: "" }) + "</a>" +
                "<div>" +
                    '<div class="line-item__top"><div><h3 class="line-item__name"><a href="' + ui.productUrl(p) + '">' + esc(p.name) + "</a></h3>" +
                    '<p class="line-item__meta">' + esc(GLOWW.getCategory(p.category).label) + " · " + esc(p.size) + "</p></div>" +
                    '<span class="price">' + ui.formatPrice(p.price) + "</span></div>" +
                    '<div class="line-item__actions">' +
                        '<button type="button" class="btn btn--primary btn--sm" data-wish-move="' + p.id + '">Move to bag<span class="visually-hidden">: ' + esc(p.name) + "</span></button>" +
                        '<button type="button" class="link-btn" data-wish-remove="' + p.id + '">Remove<span class="visually-hidden"> ' + esc(p.name) + "</span></button>" +
                    "</div>" +
                "</div>" +
            "</li>";
        }).join("") + "</ul>" +
        '<p class="checkout-note">Your wishlist is saved in this browser on this device only.</p>';
    }

    wishlist.el.addEventListener("click", function (event) {
        var move = event.target.closest("[data-wish-move]");
        if (move) {
            var id = move.getAttribute("data-wish-move");
            store.moveToBag(id);
            ui.toast(GLOWW.getProduct(id).name + " moved to your bag", {
                label: "View bag",
                onClick: function () { wishlist.close(); window.setTimeout(function () { bag.open(); }, 400); }
            });
            wishlist.el.querySelector(".dialog__close").focus();
            return;
        }
        var remove = event.target.closest("[data-wish-remove]");
        if (remove) {
            var removeId = remove.getAttribute("data-wish-remove");
            store.removeFromWishlist(removeId);
            ui.announce(GLOWW.getProduct(removeId).name + " removed from your wishlist");
            wishlist.el.querySelector(".dialog__close").focus();
        }
    });

    /* ---------- Search overlay ---------- */

    var SUGGESTIONS = ["Serum", "Hydration", "Night cream", "Eye", "Body", "Gift set"];

    var search = createDialog({
        id: "search-dialog",
        variant: "search",
        html:
            '<div class="search-panel container">' +
                '<div class="search-panel__head">' +
                    '<h2 class="visually-hidden" id="search-dialog-title">Search products</h2>' +
                    '<form class="search-form" role="search" action="Product.html" method="get">' +
                        '<label class="visually-hidden" for="site-search">Search products</label>' +
                        ui.icon("search") +
                        '<input class="search-form__input" id="site-search" name="q" type="search" placeholder="Search serums, creams, ingredients…" autocomplete="off" spellcheck="false" aria-controls="search-results" aria-describedby="search-status">' +
                        '<button type="button" class="link-btn search-form__clear" data-search-clear hidden>Clear</button>' +
                    "</form>" +
                    closeButton("Close search") +
                "</div>" +
                '<p class="visually-hidden" id="search-status" role="status" aria-live="polite"></p>' +
                '<div class="search-panel__results" id="search-results"></div>' +
            "</div>",
        onOpen: function () {
            renderSearch();
            window.setTimeout(function () { searchInput.focus(); searchInput.select(); }, 60);
        }
    });

    var searchInput = search.el.querySelector("#site-search");
    var searchResults = search.el.querySelector("#search-results");
    var searchStatus = search.el.querySelector("#search-status");
    var searchClear = search.el.querySelector("[data-search-clear]");
    var searchTimer;

    function renderSearch() {
        var query = searchInput.value.trim();
        searchClear.hidden = !query;

        if (!query) {
            searchStatus.textContent = "";
            searchResults.innerHTML =
                '<p class="search-panel__label">Popular searches</p>' +
                '<ul class="chip-list" role="list">' + SUGGESTIONS.map(function (term) {
                    return '<li><button type="button" class="chip" data-search-term="' + esc(term) + '">' + esc(term) + "</button></li>";
                }).join("") + "</ul>" +
                '<p class="search-panel__label">Bestsellers</p>' +
                resultList(GLOWW.products.filter(function (p) { return p.bestseller; }).slice(0, 4));
            return;
        }

        var matches = GLOWW.searchProducts(query);
        searchStatus.textContent = matches.length + (matches.length === 1 ? " product found" : " products found");

        if (!matches.length) {
            searchResults.innerHTML =
                '<div class="empty-state">' +
                    '<span class="empty-state__icon">' + ui.icon("search") + "</span>" +
                    "<h3>No results for “" + esc(query) + "”</h3>" +
                    "<p>Try a product type such as “serum” or “cream”, or a skin need like “hydration”.</p>" +
                    '<button type="button" class="btn btn--outline btn--sm" data-search-clear-btn>Clear search</button>' +
                "</div>";
            return;
        }

        searchResults.innerHTML =
            '<p class="search-panel__label">' + matches.length + (matches.length === 1 ? " product" : " products") + "</p>" +
            resultList(matches.slice(0, 6)) +
            '<a class="text-link search-panel__all" href="Product.html?q=' + encodeURIComponent(query) + '">View all results in the shop ' + ui.icon("arrow", "icon--sm") + "</a>";
    }

    function resultList(products) {
        return '<ul class="search-results" role="list">' + products.map(function (p) {
            return '<li><a class="search-result" href="' + ui.productUrl(p) + '">' +
                '<span class="search-result__media">' + ui.imageTag(p.images[0], { alt: "" }) + "</span>" +
                '<span class="search-result__text"><span class="search-result__name">' + esc(p.name) + "</span>" +
                '<span class="search-result__meta">' + esc(GLOWW.getCategory(p.category).label) + " · " + ui.formatPrice(p.price) + "</span></span>" +
            "</a></li>";
        }).join("") + "</ul>";
    }

    searchInput.addEventListener("input", function () {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(renderSearch, 120);
    });

    /* Escape closes the overlay in one press (search inputs would otherwise just clear) */
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            event.preventDefault();
            search.close();
        }
    });

    /* Arrow keys move between the input and the results */
    search.el.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        var links = Array.prototype.slice.call(searchResults.querySelectorAll(".search-result, .chip, .search-panel__all"));
        if (!links.length) return;
        var index = links.indexOf(document.activeElement);
        event.preventDefault();
        if (event.key === "ArrowDown") {
            (links[index + 1] || links[0]).focus();
        } else if (index <= 0) {
            searchInput.focus();
        } else {
            links[index - 1].focus();
        }
    });

    search.el.addEventListener("click", function (event) {
        var term = event.target.closest("[data-search-term]");
        if (term) {
            searchInput.value = term.getAttribute("data-search-term");
            renderSearch();
            searchInput.focus();
            return;
        }
        if (event.target.closest("[data-search-clear], [data-search-clear-btn]")) {
            searchInput.value = "";
            renderSearch();
            searchInput.focus();
        }
    });

    /* ---------- Quick view ---------- */

    var quick = createDialog({
        id: "quick-view",
        variant: "modal",
        html: '<div data-quick-body></div>'
    });

    function openQuickView(id, trigger) {
        var p = GLOWW.getProduct(id);
        if (!p) return;
        var body = quick.el.querySelector("[data-quick-body]");
        body.innerHTML =
            '<div class="quick-view">' +
                '<div class="quick-view__media">' + ui.imageTag(p.images[0], { eager: true }) + "</div>" +
                '<div class="quick-view__info">' +
                    '<div class="quick-view__close">' + closeButton("Close quick view") + "</div>" +
                    '<span class="eyebrow">' + esc(GLOWW.getCategory(p.category).label) + "</span>" +
                    '<h2 class="quick-view__title" id="quick-view-title">' + esc(p.name) + "</h2>" +
                    '<p class="quick-view__price"><span class="price">' + ui.formatPrice(p.price) + '</span> <span class="quick-view__size">' + esc(p.size) + "</span></p>" +
                    '<p class="quick-view__desc">' + esc(p.short) + "</p>" +
                    '<ul class="check-list" role="list">' + p.highlights.map(function (h) { return "<li>" + ui.icon("check", "icon--sm") + esc(h) + "</li>"; }).join("") + "</ul>" +
                    '<div class="quick-view__actions">' +
                        '<div class="qty" role="group" aria-label="Quantity">' +
                            '<button type="button" data-qty-step="-1" aria-label="Decrease quantity" disabled>' + ui.icon("minus", "icon--sm") + "</button>" +
                            '<input type="number" inputmode="numeric" min="1" max="' + GLOWW.config.maxQuantity + '" value="1" aria-label="Quantity" data-qty-input>' +
                            '<button type="button" data-qty-step="1" aria-label="Increase quantity">' + ui.icon("plus", "icon--sm") + "</button>" +
                        "</div>" +
                        '<button type="button" class="btn btn--primary" data-add-to-bag="' + p.id + '" data-qty-from=".quick-view">Add to bag</button>' +
                        ui.wishlistButton(p).replace("wishlist-btn", "wishlist-btn wishlist-btn--inline") +
                    "</div>" +
                    '<a class="text-link" href="' + ui.productUrl(p) + '">View full details ' + ui.icon("arrow", "icon--sm") + "</a>" +
                "</div>" +
            "</div>";
        quick.open(trigger);
    }

    /* Shared quantity stepper behaviour for quick view & product page */
    document.addEventListener("click", function (event) {
        var step = event.target.closest("[data-qty-step]");
        if (!step) return;
        var input = step.parentElement.querySelector("[data-qty-input]");
        var value = (parseInt(input.value, 10) || 1) + parseInt(step.getAttribute("data-qty-step"), 10);
        input.value = Math.max(1, Math.min(GLOWW.config.maxQuantity, value));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    document.addEventListener("change", function (event) {
        if (!event.target.matches("[data-qty-input]")) return;
        var input = event.target;
        var value = parseInt(input.value, 10);
        input.value = isNaN(value) ? 1 : Math.max(1, Math.min(GLOWW.config.maxQuantity, value));
        var group = input.parentElement;
        group.querySelector('[data-qty-step="-1"]').disabled = Number(input.value) <= 1;
        group.querySelector('[data-qty-step="1"]').disabled = Number(input.value) >= GLOWW.config.maxQuantity;
    });

    /* ---------- Delegated actions (all pages) ---------- */

    var panels = { bag: bag, wishlist: wishlist, search: search };

    function openPanel(name, trigger) {
        var target = panels[name];
        if (!target) return;
        var openOne = null;
        Object.keys(panels).concat(["quick"]).forEach(function (key) {
            var panel = key === "quick" ? quick : panels[key];
            if (panel !== target && panel.isOpen()) openOne = panel;
        });
        if (openOne) {
            openOne.close();
            window.setTimeout(function () { target.open(trigger); }, 400);
        } else {
            target.open(trigger);
        }
    }

    document.addEventListener("click", function (event) {
        var opener = event.target.closest("[data-open]");
        if (opener) {
            event.preventDefault();
            if (document.documentElement.classList.contains("nav-open")) {
                var navClose = document.querySelector("[data-nav-close]");
                if (navClose) navClose.click();
            }
            openPanel(opener.getAttribute("data-open"), opener);
            return;
        }

        var add = event.target.closest("[data-add-to-bag]");
        if (add) {
            var id = add.getAttribute("data-add-to-bag");
            var qty = 1;
            var scope = add.getAttribute("data-qty-from");
            if (scope) {
                var input = document.querySelector(scope + " [data-qty-input]");
                if (input) qty = parseInt(input.value, 10) || 1;
            }
            var before = store.quantityOf(id);
            if (before >= GLOWW.config.maxQuantity) {
                ui.toast("You already have the maximum of " + GLOWW.config.maxQuantity + " in your bag");
                return;
            }
            store.addToBag(id, qty);
            confirmButton(add);
            ui.announce(GLOWW.getProduct(id).name + " added to your bag");
            if (quick.isOpen()) {
                quick.close();
                window.setTimeout(function () { bag.open(); }, 400);
            } else {
                bag.open(add);
            }
            return;
        }

        var heart = event.target.closest("[data-wishlist]");
        if (heart) {
            var wishId = heart.getAttribute("data-wishlist");
            var saved = store.toggleWishlist(wishId);
            heart.classList.remove("is-popping");
            void heart.offsetWidth;
            heart.classList.add("is-popping");
            var name = GLOWW.getProduct(wishId).name;
            ui.toast(saved ? name + " saved to your wishlist" : name + " removed from your wishlist", saved ? {
                label: "View",
                onClick: function () { openPanel("wishlist"); }
            } : null);
            return;
        }

        var quickTrigger = event.target.closest("[data-quick-view]");
        if (quickTrigger) {
            openQuickView(quickTrigger.getAttribute("data-quick-view"), quickTrigger);
            return;
        }

        var ritual = event.target.closest("[data-add-ritual]");
        if (ritual) {
            var ids = GLOWW.rituals[ritual.getAttribute("data-add-ritual")] || [];
            ids.forEach(function (ritualId) {
                if (store.quantityOf(ritualId) === 0) store.addToBag(ritualId, 1);
            });
            confirmButton(ritual);
            ui.announce("Ritual added to your bag");
            bag.open(ritual);
        }
    });

    function confirmButton(button) {
        if (button.classList.contains("is-confirmed")) return;
        var original = button.innerHTML;
        button.classList.add("is-confirmed");
        button.innerHTML = ui.icon("check", "icon--sm") + " Added";
        window.setTimeout(function () {
            button.innerHTML = original;
            button.classList.remove("is-confirmed");
        }, 1600);
    }

    /* Re-render open drawers whenever the store changes */
    document.addEventListener("gloww:store", function () {
        if (bag.isOpen()) renderBag();
        if (wishlist.isOpen()) renderWishlist();
    });

    /* "/" opens search from anywhere (except while typing) */
    document.addEventListener("keydown", function (event) {
        if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
        var tag = (document.activeElement && document.activeElement.tagName) || "";
        if (/INPUT|TEXTAREA|SELECT/.test(tag) || document.activeElement.isContentEditable) return;
        event.preventDefault();
        openPanel("search");
    });

    /* Coming back with the browser's Back button from Stripe: reset the loading button */
    window.addEventListener("pageshow", function (event) {
        if (event.persisted && bag.isOpen()) renderBag();
    });

    /* Returning from Stripe without paying (cancel_url adds ?checkout=cancelled) */
    var returnParams = new URLSearchParams(window.location.search);
    if (returnParams.get("checkout") === "cancelled") {
        returnParams.delete("checkout");
        try {
            var rest = returnParams.toString();
            window.history.replaceState(null, "", window.location.pathname + (rest ? "?" + rest : "") + window.location.hash);
        } catch (error) {
            /* history may be unavailable; the message still shows */
        }
        if (store.bagCount() > 0) bag.open();
        ui.toast("Checkout cancelled — your bag is saved");
    }

    GLOWW.dialogs = { bag: bag, wishlist: wishlist, search: search, quick: quick, openPanel: openPanel, openQuickView: openQuickView };
})();
