/* =========================================================
   Order confirmation (checkout-success.html?session_id=cs_…)
   Loads the order from Stripe via /api/checkout-status — never
   from the bag — and clears the bag only once Stripe reports
   the payment as paid.
========================================================= */
(function () {
    "use strict";

    var GLOWW = window.GLOWW;
    var ui = GLOWW.ui;
    var esc = ui.escapeHTML;

    var root = document.querySelector("[data-order-root]");
    if (!root) return;

    var sessionId = new URLSearchParams(window.location.search).get("session_id") || "";

    function money(amount, currency) {
        return new Intl.NumberFormat(GLOWW.config.locale, { style: "currency", currency: currency }).format(amount);
    }

    function render(html, title) {
        root.innerHTML = html;
        root.setAttribute("aria-busy", "false");
        document.title = title + " | GLOWW";
        var heading = root.querySelector("h1");
        if (heading) {
            heading.setAttribute("tabindex", "-1");
            heading.focus({ preventScroll: true });
        }
    }

    function header(icon, eyebrow, heading, lede) {
        return '<div class="order__header">' +
            '<span class="empty-state__icon order__icon">' + ui.icon(icon) + "</span>" +
            '<span class="eyebrow">' + eyebrow + "</span>" +
            '<h1 id="order-title">' + heading + "</h1>" +
            (lede ? '<p class="lede">' + lede + "</p>" : "") +
        "</div>";
    }

    function showProblem(message) {
        render(
            header("alert", "Order confirmation", "We couldn't load your order details", esc(message)) +
            '<p class="order__note">If you completed payment, it has been processed securely by Stripe. Please <a href="contact.html">contact us</a> with the email address you used and we\'ll help.</p>' +
            '<div class="order__actions"><a class="btn btn--primary" href="Product.html">Continue shopping</a></div>',
            "Order details unavailable"
        );
    }

    function showOrder(order) {
        var paid = order.paymentStatus === "paid" || order.paymentStatus === "no_payment_required";

        if (!paid) {
            var open = order.status === "open";
            render(
                header("bag", "Order status",
                    open ? "Your payment wasn't completed" : "Your payment is being processed",
                    open ? "No payment has been taken. Your bag is still saved, so you can try again whenever you're ready."
                         : "We'll confirm your order as soon as the payment clears. Please keep your reference: <strong>" + esc(order.reference) + "</strong>.") +
                '<div class="order__actions">' +
                    (open ? '<button type="button" class="btn btn--primary" data-open="bag">Return to your bag</button>' : "") +
                    '<a class="btn btn--outline" href="Product.html">Continue shopping</a>' +
                "</div>",
                open ? "Payment not completed" : "Payment processing"
            );
            return;
        }

        GLOWW.store.clearBag();

        var c = order.currency;
        var rows =
            "<div><dt>Subtotal</dt><dd>" + money(order.subtotal, c) + "</dd></div>" +
            "<div><dt>Shipping</dt><dd>" + (order.shipping === 0 ? "Complimentary" : money(order.shipping, c)) + "</dd></div>" +
            (order.discount > 0 ? "<div><dt>Discount</dt><dd>−" + money(order.discount, c) + "</dd></div>" : "") +
            (order.tax > 0 ? "<div><dt>Tax</dt><dd>" + money(order.tax, c) + "</dd></div>" : "") +
            '<div class="summary__total"><dt>Total paid</dt><dd>' + money(order.total, c) + "</dd></div>";

        render(
            (order.livemode ? "" : '<p class="order__test" role="note">Test mode — no real payment was taken.</p>') +
            header("check", "Order confirmed", "Thank you — your order is <em>confirmed</em>",
                "Your payment was successful." + (order.email ? " Confirmation details are linked to <strong>" + esc(order.email) + "</strong>." : "")) +
            '<div class="order-card">' +
                '<div class="order-card__head"><h2>Order summary</h2><p>Reference <strong>' + esc(order.reference) + "</strong></p></div>" +
                '<ul class="order-items" role="list">' + order.items.map(function (item) {
                    return "<li><span>" + esc(item.name) + ' <span class="order-items__qty">× ' + item.quantity + "</span></span><span>" + money(item.amount, c) + "</span></li>";
                }).join("") + "</ul>" +
                '<dl class="summary">' + rows + "</dl>" +
            "</div>" +
            '<p class="order__note">Questions about your order? <a href="contact.html">Contact us</a> and quote your reference.</p>' +
            '<div class="order__actions"><a class="btn btn--primary" href="Product.html">Continue shopping</a><a class="btn btn--outline" href="index.html">Back to home</a></div>',
            "Order confirmed"
        );
    }

    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
        showProblem("This page needs a valid order link.");
        return;
    }
    if (window.location.protocol === "file:") {
        showProblem("Order details are only available on the live website.");
        return;
    }

    fetch(GLOWW.config.checkoutStatusEndpoint + "?session_id=" + encodeURIComponent(sessionId), {
        headers: { Accept: "application/json" }
    }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
            if (!response.ok) throw data;
            showOrder(data);
        });
    }).catch(function (data) {
        showProblem((data && !(data instanceof Error) && data.message) || "Please check your connection and refresh the page.");
    });
})();
