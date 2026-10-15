/* =========================================================
   Product detail page (product-detail.html?p=<product-id>)
   Renders gallery, details, accordions, related products
   and a mobile sticky add-to-bag bar from the catalog.
========================================================= */
(function () {
    "use strict";

    var GLOWW = window.GLOWW;
    var ui = GLOWW.ui;
    var esc = ui.escapeHTML;

    var root = document.querySelector("[data-product-root]");
    if (!root) return;

    var id = new URLSearchParams(window.location.search).get("p");
    var product = id ? GLOWW.getProduct(id) : null;

    function setMeta(title, description) {
        document.title = title;
        var desc = document.querySelector('meta[name="description"]');
        if (desc) desc.setAttribute("content", description);
        var ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute("content", title);
        var ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute("content", description);
    }

    /* ---------- Not found ---------- */

    if (!product) {
        setMeta("Product not available | GLOWW", "This product could not be found. Explore the full GLOWW collection.");
        root.setAttribute("aria-busy", "false");
        root.innerHTML =
            '<div class="container empty-state pdp-missing">' +
                '<span class="empty-state__icon">' + ui.icon("search") + "</span>" +
                "<h1>This product isn't available</h1>" +
                "<p>It may have been renamed or retired from the collection. Our full range is just a click away.</p>" +
                '<a class="btn btn--primary" href="Product.html">Explore the collection</a>' +
            "</div>";
        return;
    }

    var category = GLOWW.getCategory(product.category);
    setMeta(product.name + " — " + category.label + " | GLOWW", product.short + " " + product.size + ", " + ui.formatPrice(product.price) + ".");

    document.querySelector("[data-breadcrumbs]").insertAdjacentHTML("beforeend",
        '<li><a href="Product.html?category=' + category.id + '">' + esc(category.label) + "</a></li>" +
        '<li><span aria-current="page">' + esc(product.name) + "</span></li>");

    /* ---------- Gallery ---------- */

    function stageImage(image, eager) {
        return '<img src="' + image.src + '" alt="' + esc(image.alt) + '" width="' + image.w + '" height="' + image.h + '"' +
            ' class="pdp__image"' + (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ">";
    }

    var thumbs = product.images.length > 1
        ? '<div class="pdp__thumbs" role="group" aria-label="Product images">' + product.images.map(function (image, i) {
            return '<button type="button" class="pdp__thumb" data-thumb="' + i + '" aria-pressed="' + (i === 0) + '" aria-label="Show image ' + (i + 1) + " of " + product.images.length + '">' +
                ui.imageTag(image, { alt: "" }) + "</button>";
        }).join("") + "</div>"
        : "";

    /* ---------- Details ---------- */

    var benefitLinks = product.benefits.map(function (benefitId) {
        return '<li><a class="chip" href="Product.html?benefit=' + benefitId + '">' + esc(GLOWW.labelFor(GLOWW.benefits, benefitId)) + "</a></li>";
    }).join("");

    root.setAttribute("aria-busy", "false");
    root.innerHTML =
        '<article class="container pdp">' +
            '<div class="pdp__gallery">' +
                '<div class="pdp__stage" data-stage>' + stageImage(product.images[0], true) +
                    (product.badge ? '<span class="product-card__flag">' + esc(product.badge) + "</span>" : "") +
                "</div>" +
                thumbs +
            "</div>" +

            '<div class="pdp__info">' +
                '<a class="eyebrow pdp__category" href="Product.html?category=' + category.id + '">' + esc(category.label) + "</a>" +
                '<h1 class="pdp__title">' + esc(product.name) + "</h1>" +
                '<p class="pdp__short">' + esc(product.short) + "</p>" +
                '<p class="pdp__price"><span class="price">' + ui.formatPrice(product.price) + '</span><span class="pdp__size">' + esc(product.size) + "</span></p>" +

                '<div class="pdp__buy" data-buy>' +
                    '<div class="qty" role="group" aria-label="Quantity">' +
                        '<button type="button" data-qty-step="-1" aria-label="Decrease quantity" disabled>' + ui.icon("minus", "icon--sm") + "</button>" +
                        '<input type="number" inputmode="numeric" min="1" max="' + GLOWW.config.maxQuantity + '" value="1" aria-label="Quantity" data-qty-input>' +
                        '<button type="button" data-qty-step="1" aria-label="Increase quantity">' + ui.icon("plus", "icon--sm") + "</button>" +
                    "</div>" +
                    '<button type="button" class="btn btn--primary pdp__add" data-add-to-bag="' + product.id + '" data-qty-from="[data-buy]">Add to bag</button>' +
                    ui.wishlistButton(product).replace("wishlist-btn", "wishlist-btn wishlist-btn--inline") +
                "</div>" +

                '<ul class="pdp__assurances" role="list">' +
                    "<li>" + ui.icon("check", "icon--sm") + "Complimentary shipping on orders over " + ui.formatPrice(GLOWW.config.freeShippingThreshold) + "</li>" +
                    "<li>" + ui.icon("heart", "icon--sm") + "Save to your wishlist — kept on this device</li>" +
                "</ul>" +

                '<div class="pdp__description"><p>' + esc(product.description) + "</p></div>" +

                '<h2 class="pdp__subhead">Why you\'ll love it</h2>' +
                '<ul class="check-list" role="list">' + product.highlights.map(function (h) {
                    return "<li>" + ui.icon("check", "icon--sm") + esc(h) + "</li>";
                }).join("") + "</ul>" +

                '<ul class="chip-list pdp__benefits" role="list" aria-label="Skin needs">' + benefitLinks + "</ul>" +

                '<div class="accordion">' +
                    '<details open><summary>Key ingredients</summary><div class="accordion__body"><dl class="ingredient-list">' +
                        product.ingredients.map(function (ing) {
                            return "<div><dt>" + esc(ing.name) + "</dt><dd>" + esc(ing.note) + "</dd></div>";
                        }).join("") +
                    "</dl></div></details>" +
                    '<details><summary>How to use</summary><div class="accordion__body"><p>' + esc(product.howTo) + "</p></div></details>" +
                    '<details><summary>Good to know</summary><div class="accordion__body"><p>For external use only. Patch test before first use and discontinue if discomfort occurs. Our descriptions are cosmetic and are not medical advice — please speak to a professional about specific skin concerns.</p></div></details>' +
                "</div>" +
            "</div>" +
        "</article>";

    /* Thumbnails swap the stage image */
    var stage = root.querySelector("[data-stage]");
    root.querySelectorAll("[data-thumb]").forEach(function (button) {
        button.addEventListener("click", function () {
            var index = parseInt(button.getAttribute("data-thumb"), 10);
            var current = stage.querySelector(".pdp__image");
            current.outerHTML = stageImage(product.images[index], true);
            root.querySelectorAll("[data-thumb]").forEach(function (b) {
                b.setAttribute("aria-pressed", String(b === button));
            });
        });
    });

    /* ---------- Related products ---------- */

    var related = GLOWW.products.filter(function (p) {
        return p.id !== product.id && (p.category === product.category || p.benefits.some(function (b) { return product.benefits.indexOf(b) !== -1; }));
    }).sort(function (a, b) {
        var aScore = (a.category === product.category ? 2 : 0) + (a.bestseller ? 1 : 0);
        var bScore = (b.category === product.category ? 2 : 0) + (b.bestseller ? 1 : 0);
        return bScore - aScore || a.order - b.order;
    }).slice(0, 4);

    if (related.length) {
        var relatedSection = document.querySelector("[data-related]");
        relatedSection.querySelector("[data-related-grid]").innerHTML = related.map(function (p) {
            return ui.productCard(p);
        }).join("");
        relatedSection.hidden = false;
    }

    /* ---------- Mobile sticky add-to-bag ---------- */

    var sticky = document.querySelector("[data-sticky-buy]");
    var addButton = root.querySelector(".pdp__add");
    if (sticky && addButton) {
        sticky.innerHTML =
            '<div class="sticky-buy__text"><span class="sticky-buy__name">' + esc(product.name) + '</span><span class="price">' + ui.formatPrice(product.price) + "</span></div>" +
            '<button type="button" class="btn btn--primary btn--sm" data-add-to-bag="' + product.id + '" data-qty-from="[data-buy]" tabindex="-1">Add to bag</button>';
        sticky.hidden = false;
        var stickyButton = sticky.querySelector("button");
        var shown = null;
        var ticking = false;

        /* Visible once the main button has scrolled above the viewport. Checked from the
           button's position on every frame, so jumps (anchors, flings, restored scroll
           position) can't skip past it the way a crossing-based observer can. */
        var updateSticky = function () {
            ticking = false;
            var visible = addButton.getBoundingClientRect().bottom < 0;
            if (visible === shown) return;
            shown = visible;
            sticky.classList.toggle("is-visible", visible);
            sticky.setAttribute("aria-hidden", String(!visible));
            stickyButton.tabIndex = visible ? 0 : -1;
        };
        var requestUpdate = function () {
            if (!ticking) {
                ticking = true;
                window.requestAnimationFrame(updateSticky);
            }
        };
        window.addEventListener("scroll", requestUpdate, { passive: true });
        window.addEventListener("resize", requestUpdate);
        updateSticky();
    }
})();
