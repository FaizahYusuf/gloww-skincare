/* =========================================================
   Shop page (Product.html) — search, filtering, sorting.
   Filter state lives in the URL (?q=&category=&benefit=&price=&sort=)
   so links from other pages land on the right view and the
   browser back button behaves as expected.
========================================================= */
(function () {
    "use strict";

    var GLOWW = window.GLOWW;
    var ui = GLOWW.ui;
    var esc = ui.escapeHTML;

    var grid = document.querySelector("[data-product-grid]");
    if (!grid) return;

    var PRICE_RANGES = [
        { id: "under-40", label: "Under $40", test: function (p) { return p.price < 40; } },
        { id: "40-70", label: "$40 – $70", test: function (p) { return p.price >= 40 && p.price <= 70; } },
        { id: "over-70", label: "Over $70", test: function (p) { return p.price > 70; } }
    ];

    var CATEGORY_OPTIONS = [{ id: "face", label: "Face" }].concat(GLOWW.categories);

    var FILTERS = {
        category: { label: "Category", options: CATEGORY_OPTIONS },
        benefit: { label: "Skin need", options: GLOWW.benefits },
        price: { label: "Price", options: PRICE_RANGES }
    };

    var SORTS = {
        featured: function (a, b) { return a.order - b.order; },
        "price-asc": function (a, b) { return a.price - b.price || a.order - b.order; },
        "price-desc": function (a, b) { return b.price - a.price || a.order - b.order; },
        name: function (a, b) { return a.name.localeCompare(b.name); }
    };

    var searchInput = document.querySelector("[data-shop-search]");
    var searchClear = document.querySelector("[data-shop-search-clear]");
    var sortSelect = document.querySelector("[data-shop-sort]");
    var countEl = document.querySelector("[data-result-count]");
    var activeEl = document.querySelector("[data-active-filters]");
    var emptyEl = document.querySelector("[data-shop-empty]");
    var filtersPanel = document.querySelector("[data-shop-filters]");
    var filterToggle = document.querySelector("[data-filter-toggle]");
    var filterCount = document.querySelector("[data-filter-count]");

    /* ---------- State <-> URL ---------- */

    function validOption(key, value) {
        return FILTERS[key].options.some(function (o) { return o.id === value; }) ? value : "";
    }

    function readState() {
        var params = new URLSearchParams(window.location.search);
        return {
            q: (params.get("q") || "").slice(0, 80),
            category: validOption("category", params.get("category") || ""),
            benefit: validOption("benefit", params.get("benefit") || ""),
            price: validOption("price", params.get("price") || ""),
            sort: SORTS[params.get("sort")] ? params.get("sort") : "featured"
        };
    }

    var state = readState();

    function writeState() {
        var params = new URLSearchParams();
        if (state.q) params.set("q", state.q);
        ["category", "benefit", "price"].forEach(function (key) {
            if (state[key]) params.set(key, state[key]);
        });
        if (state.sort !== "featured") params.set("sort", state.sort);
        var query = params.toString();
        try {
            window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
        } catch (error) {
            /* Some browsers block history changes on file:// — filtering still works */
        }
    }

    /* ---------- Filtering ---------- */

    function applyFilters() {
        var list = GLOWW.searchProducts(state.q);
        if (state.category) {
            list = list.filter(function (p) { return p.category === state.category || p.area === state.category; });
        }
        if (state.benefit) {
            list = list.filter(function (p) { return p.benefits.indexOf(state.benefit) !== -1; });
        }
        if (state.price) {
            var range = PRICE_RANGES.filter(function (r) { return r.id === state.price; })[0];
            list = list.filter(range.test);
        }
        return list.sort(SORTS[state.sort]);
    }

    /* ---------- Rendering ---------- */

    function renderFilterOptions() {
        Object.keys(FILTERS).forEach(function (key) {
            var container = filtersPanel.querySelector('[data-filter="' + key + '"]');
            var options = [{ id: "", label: "All" }].concat(FILTERS[key].options);
            container.innerHTML = options.map(function (option) {
                var id = "filter-" + key + "-" + (option.id || "all");
                return '<input class="filter-radio" type="radio" name="' + key + '" id="' + id + '" value="' + option.id + '"' + (state[key] === option.id ? " checked" : "") + ">" +
                    '<label class="chip" for="' + id + '">' + esc(option.label) + "</label>";
            }).join("");
        });
    }

    function syncControls() {
        searchInput.value = state.q;
        searchClear.hidden = !state.q;
        sortSelect.value = state.sort;
        Object.keys(FILTERS).forEach(function (key) {
            var input = filtersPanel.querySelector('input[name="' + key + '"][value="' + state[key] + '"]');
            if (input) input.checked = true;
        });
        var active = ["category", "benefit", "price"].filter(function (key) { return state[key]; }).length;
        filterCount.textContent = active ? "(" + active + ")" : "";
    }

    function renderActiveFilters() {
        var chips = [];
        if (state.q) chips.push({ key: "q", label: "“" + state.q + "”" });
        ["category", "benefit", "price"].forEach(function (key) {
            if (!state[key]) return;
            chips.push({ key: key, label: GLOWW.labelFor(FILTERS[key].options, state[key]) });
        });
        activeEl.innerHTML = chips.map(function (chip) {
            return '<li><button type="button" class="chip chip--removable" data-remove-filter="' + chip.key + '">' +
                esc(chip.label) + ui.icon("close", "icon--sm") + '<span class="visually-hidden"> — remove filter</span></button></li>';
        }).join("");
    }

    var firstRender = true;

    function render() {
        var results = applyFilters();
        grid.setAttribute("aria-busy", "false");
        grid.innerHTML = results.map(function (product, i) {
            return ui.productCard(product, { eager: i < 4 });
        }).join("");

        grid.querySelectorAll(".product-card").forEach(function (card, i) {
            card.style.animationDelay = Math.min(i, 8) * 0.04 + "s";
            card.classList.add("is-entering");
        });

        var total = GLOWW.products.length;
        countEl.textContent = results.length === total
            ? "Showing all " + total + " products"
            : results.length + (results.length === 1 ? " product" : " products") + " found";

        emptyEl.hidden = results.length > 0;
        grid.hidden = results.length === 0;
        renderActiveFilters();
        syncControls();

        if (!firstRender) writeState();
        firstRender = false;
    }

    function update(changes) {
        Object.keys(changes).forEach(function (key) { state[key] = changes[key]; });
        render();
    }

    function clearAll() {
        update({ q: "", category: "", benefit: "", price: "" });
        searchInput.focus();
    }

    /* ---------- Events ---------- */

    var searchTimer;
    searchInput.addEventListener("input", function () {
        window.clearTimeout(searchTimer);
        searchClear.hidden = !searchInput.value;
        searchTimer = window.setTimeout(function () {
            update({ q: searchInput.value.trim().slice(0, 80) });
        }, 180);
    });

    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && searchInput.value) {
            event.preventDefault();
            update({ q: "" });
        }
    });

    searchClear.addEventListener("click", function () {
        update({ q: "" });
        searchInput.focus();
    });

    sortSelect.addEventListener("change", function () {
        update({ sort: sortSelect.value });
    });

    filtersPanel.addEventListener("change", function (event) {
        if (event.target.matches(".filter-radio")) {
            var change = {};
            change[event.target.name] = event.target.value;
            update(change);
        }
    });

    document.addEventListener("click", function (event) {
        if (event.target.closest("[data-clear-filters]")) {
            clearAll();
            return;
        }
        var remove = event.target.closest("[data-remove-filter]");
        if (remove) {
            var change = {};
            change[remove.getAttribute("data-remove-filter")] = "";
            update(change);
            /* The chip was removed; keep focus nearby */
            (activeEl.querySelector("button") || searchInput).focus();
        }
    });

    /* Mobile filter panel */
    filterToggle.addEventListener("click", function () {
        var open = filterToggle.getAttribute("aria-expanded") !== "true";
        filterToggle.setAttribute("aria-expanded", String(open));
        filtersPanel.classList.toggle("is-open", open);
    });

    /* Collection tiles and in-page links update the view without a reload */
    document.querySelectorAll('a[href^="Product.html?"]').forEach(function (link) {
        link.addEventListener("click", function (event) {
            if (event.metaKey || event.ctrlKey || event.shiftKey) return;
            var params = new URLSearchParams(link.getAttribute("href").split("?")[1].split("#")[0]);
            event.preventDefault();
            update({
                q: "",
                category: validOption("category", params.get("category") || ""),
                benefit: validOption("benefit", params.get("benefit") || ""),
                price: ""
            });
            document.getElementById("shop").scrollIntoView({ behavior: ui.reducedMotion.matches ? "auto" : "smooth" });
        });
    });

    window.addEventListener("popstate", function () {
        state = readState();
        render();
    });

    renderFilterOptions();
    render();

    /* Arriving from a filtered link: bring the results into view */
    if ((state.q || state.category || state.benefit || state.price) && !window.location.hash) {
        document.getElementById("shop").scrollIntoView();
    }
})();
