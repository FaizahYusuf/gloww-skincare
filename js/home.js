/* =========================================================
   Homepage — renders product rows from the catalog and
   the price of each ritual bundle.
========================================================= */
(function () {
    "use strict";

    var GLOWW = window.GLOWW;
    var ui = GLOWW.ui;

    document.querySelectorAll("[data-product-list]").forEach(function (list) {
        var ids = list.getAttribute("data-product-list").split(",");
        list.innerHTML = ids.map(function (id) {
            var product = GLOWW.getProduct(id.trim());
            return product ? ui.productCard(product) : "";
        }).join("");
        list.querySelectorAll(".product-card").forEach(function (card, i) {
            card.classList.add("reveal");
            card.style.setProperty("--reveal-delay", i * 0.08 + "s");
        });
        ui.observeReveals(list);
    });

    document.querySelectorAll("[data-ritual-total]").forEach(function (el) {
        var ids = GLOWW.rituals[el.getAttribute("data-ritual-total")] || [];
        var total = ids.reduce(function (sum, id) {
            var product = GLOWW.getProduct(id);
            return sum + (product ? product.price : 0);
        }, 0);
        el.textContent = "· " + ui.formatPrice(total);
    });
})();
