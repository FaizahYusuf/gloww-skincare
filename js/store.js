/* =========================================================
   Store — shopping bag & wishlist state.

   * Persists to localStorage on this device only.
   * Stores product ids and quantities only; prices are always
     read from the catalog, never from storage.
   * Falls back to in-memory state if storage is unavailable.
   * Broadcasts "gloww:store" events so every UI stays in sync,
     including other open tabs.
========================================================= */
(function () {
    "use strict";

    var GLOWW = (window.GLOWW = window.GLOWW || {});
    var KEYS = { bag: "gloww.bag.v1", wishlist: "gloww.wishlist.v1" };
    var memory = {};
    var MAX_QTY = GLOWW.config.maxQuantity;

    function readRaw(key) {
        try {
            var value = window.localStorage.getItem(key);
            return value === null ? memory[key] : JSON.parse(value);
        } catch (error) {
            return memory[key];
        }
    }

    function write(key, value) {
        memory[key] = value;
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            /* Storage blocked (private mode, quota): keep in memory for this visit */
        }
    }

    function clampQty(qty) {
        qty = parseInt(qty, 10);
        if (isNaN(qty) || qty < 1) return 1;
        return Math.min(qty, MAX_QTY);
    }

    /* Drop anything malformed or no longer in the catalog */
    function readBag() {
        var raw = readRaw(KEYS.bag);
        if (!Array.isArray(raw)) return [];
        var seen = {};
        return raw.filter(function (line) {
            if (!line || !GLOWW.getProduct(line.id) || seen[line.id]) return false;
            seen[line.id] = true;
            return true;
        }).map(function (line) {
            return { id: line.id, qty: clampQty(line.qty) };
        });
    }

    function readWishlist() {
        var raw = readRaw(KEYS.wishlist);
        if (!Array.isArray(raw)) return [];
        return raw.filter(function (id, index) {
            return typeof id === "string" && GLOWW.getProduct(id) && raw.indexOf(id) === index;
        });
    }

    function emit(type, id) {
        document.dispatchEvent(new CustomEvent("gloww:store", { detail: { type: type, id: id } }));
    }

    function roundMoney(value) {
        return Math.round(value * 100) / 100;
    }

    var store = {
        /* ---------- Bag ---------- */

        getBag: function () {
            return readBag().map(function (line) {
                var product = GLOWW.getProduct(line.id);
                return { id: line.id, qty: line.qty, product: product, lineTotal: roundMoney(product.price * line.qty) };
            });
        },

        bagCount: function () {
            return readBag().reduce(function (sum, line) { return sum + line.qty; }, 0);
        },

        quantityOf: function (id) {
            var line = readBag().filter(function (l) { return l.id === id; })[0];
            return line ? line.qty : 0;
        },

        addToBag: function (id, qty) {
            if (!GLOWW.getProduct(id)) return false;
            var bag = readBag();
            var line = bag.filter(function (l) { return l.id === id; })[0];
            var add = clampQty(qty || 1);
            if (line) {
                line.qty = Math.min(line.qty + add, MAX_QTY);
            } else {
                bag.push({ id: id, qty: add });
            }
            write(KEYS.bag, bag);
            emit("bag:add", id);
            return true;
        },

        setQuantity: function (id, qty) {
            var bag = readBag();
            var line = bag.filter(function (l) { return l.id === id; })[0];
            if (!line) return;
            if (parseInt(qty, 10) < 1) {
                store.removeFromBag(id);
                return;
            }
            line.qty = clampQty(qty);
            write(KEYS.bag, bag);
            emit("bag:update", id);
        },

        removeFromBag: function (id) {
            write(KEYS.bag, readBag().filter(function (l) { return l.id !== id; }));
            emit("bag:remove", id);
        },

        /* Used after Stripe confirms payment */
        clearBag: function () {
            write(KEYS.bag, []);
            emit("bag:clear");
        },

        totals: function () {
            var config = GLOWW.config;
            var subtotal = roundMoney(store.getBag().reduce(function (sum, line) { return sum + line.lineTotal; }, 0));
            var qualifies = subtotal >= config.freeShippingThreshold;
            var shipping = subtotal === 0 || qualifies ? 0 : config.standardShipping;
            return {
                subtotal: subtotal,
                shipping: shipping,
                total: roundMoney(subtotal + shipping),
                remainingForFreeShipping: qualifies ? 0 : roundMoney(config.freeShippingThreshold - subtotal),
                freeShippingProgress: Math.min(subtotal / config.freeShippingThreshold, 1)
            };
        },

        /* ---------- Wishlist ---------- */

        getWishlist: function () {
            return readWishlist();
        },

        isWishlisted: function (id) {
            return readWishlist().indexOf(id) !== -1;
        },

        toggleWishlist: function (id) {
            if (!GLOWW.getProduct(id)) return false;
            var list = readWishlist();
            var index = list.indexOf(id);
            if (index === -1) {
                list.unshift(id);
            } else {
                list.splice(index, 1);
            }
            write(KEYS.wishlist, list);
            emit(index === -1 ? "wishlist:add" : "wishlist:remove", id);
            return index === -1;
        },

        removeFromWishlist: function (id) {
            write(KEYS.wishlist, readWishlist().filter(function (item) { return item !== id; }));
            emit("wishlist:remove", id);
        },

        moveToBag: function (id) {
            store.addToBag(id, 1);
            store.removeFromWishlist(id);
        }
    };

    /* Keep tabs in sync */
    window.addEventListener("storage", function (event) {
        if (event.key === KEYS.bag || event.key === KEYS.wishlist) emit("sync");
    });

    GLOWW.store = store;
})();
