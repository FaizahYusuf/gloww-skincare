/* =========================================================
   POST /api/create-checkout-session
   Creates a Stripe Checkout Session for the visitor's bag.

   The browser sends ONLY product ids and quantities:
     { "items": [{ "id": "rose-hydration-serum", "qty": 2 }] }
   Names, prices, shipping and currency are rebuilt here from the
   catalog (js/products.js), so a tampered request cannot change
   what is charged.

   Environment variables (Netlify → Site configuration → Environment):
     STRIPE_SECRET_KEY          required  sk_test_… or sk_live_…
     STRIPE_SHIPPING_COUNTRIES  optional  comma-separated ISO codes, default "US"
     STRIPE_AUTOMATIC_TAX       optional  "true" once Stripe Tax is set up
========================================================= */
import catalog from "../../js/products.js";
import { json, readBody, methodNotAllowed } from "../lib/http.mjs";

const STRIPE_API = "https://api.stripe.com/v1/checkout/sessions";
const MAX_LINES = 20;
const toCents = (amount) => Math.round(amount * 100);

/* Returns validated [{ product, qty }] or null */
function validateItems(items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) return null;
    const seen = new Set();
    const lines = [];
    for (const item of items) {
        const product = item && typeof item.id === "string" ? catalog.getProduct(item.id) : null;
        const qty = item ? item.qty : null;
        if (!product || seen.has(product.id)) return null;
        if (!Number.isInteger(qty) || qty < 1 || qty > catalog.config.maxQuantity) return null;
        seen.add(product.id);
        lines.push({ product, qty });
    }
    return lines;
}

function shippingCountries() {
    const codes = (process.env.STRIPE_SHIPPING_COUNTRIES || "US")
        .split(",")
        .map((code) => code.trim().toUpperCase())
        .filter((code) => /^[A-Z]{2}$/.test(code));
    return codes.length ? codes : ["US"];
}

export function buildSessionParams(lines, origin) {
    const { config } = catalog;
    const currency = config.currency.toLowerCase();
    const params = new URLSearchParams();

    params.append("mode", "payment");
    params.append("success_url", `${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${origin}/Product.html?checkout=cancelled`);

    let subtotal = 0;
    lines.forEach(({ product, qty }, i) => {
        const key = `line_items[${i}]`;
        const unitAmount = toCents(product.price);
        subtotal += unitAmount * qty;
        params.append(`${key}[quantity]`, String(qty));
        params.append(`${key}[price_data][currency]`, currency);
        params.append(`${key}[price_data][unit_amount]`, String(unitAmount));
        params.append(`${key}[price_data][product_data][name]`, product.name);
        params.append(`${key}[price_data][product_data][description]`, `${product.size} — ${product.short}`);
        params.append(`${key}[price_data][product_data][images][0]`, `${origin}/${encodeURI(product.images[0].src)}`);
        params.append(`${key}[price_data][product_data][metadata][product_id]`, product.id);
    });

    /* Same rule as the bag: complimentary over the threshold */
    const free = subtotal >= toCents(config.freeShippingThreshold);
    const rate = "shipping_options[0][shipping_rate_data]";
    params.append(`${rate}[type]`, "fixed_amount");
    params.append(`${rate}[display_name]`, free ? "Complimentary standard shipping" : "Standard shipping");
    params.append(`${rate}[fixed_amount][amount]`, String(free ? 0 : toCents(config.standardShipping)));
    params.append(`${rate}[fixed_amount][currency]`, currency);

    shippingCountries().forEach((code, i) => {
        params.append(`shipping_address_collection[allowed_countries][${i}]`, code);
    });

    if (process.env.STRIPE_AUTOMATIC_TAX === "true") {
        params.append("automatic_tax[enabled]", "true");
    }

    params.append("metadata[bag]", lines.map(({ product, qty }) => `${product.id}:${qty}`).join(",").slice(0, 500));
    return params;
}

/* ---------- Server-side diagnostics (never log key values) ---------- */

const STRIPE_KEY_PATTERN = /(sk|rk|pk)_(test|live)_[A-Za-z0-9]+/g;
const redact = (text) => String(text || "").replace(STRIPE_KEY_PATTERN, "$1_$2_***");

/* Explains WHY the key is missing, e.g. a key pasted into the variable's Name field */
function explainMissingKey() {
    const misplaced = Object.keys(process.env).some((name) => /^(sk|rk)_(test|live)_/.test(name));
    if (misplaced) {
        return "STRIPE_SECRET_KEY is not set, but an environment variable NAME looks like a Stripe secret key — " +
            "the key was entered in the Name field instead of the Value field. Create a variable named " +
            "STRIPE_SECRET_KEY with the key as its value, delete the misnamed one, then redeploy.";
    }
    return "STRIPE_SECRET_KEY is not set — check the exact name, that its scope includes Functions and that it " +
        "has a value for the production context, then redeploy.";
}

/* Returns the cleaned key, logging (safely) if its shape is wrong */
function readSecretKey() {
    const raw = process.env.STRIPE_SECRET_KEY || "";
    const key = raw.trim().replace(/^["']+|["']+$/g, "").trim();
    if (key && key !== raw) console.warn("Checkout: STRIPE_SECRET_KEY had surrounding spaces/quotes; they were ignored");
    if (key.startsWith("pk_")) console.error("Checkout: STRIPE_SECRET_KEY holds a PUBLISHABLE key (pk_…); it must be the SECRET key (sk_… or rk_…)");
    else if (key.startsWith("whsec_")) console.error("Checkout: STRIPE_SECRET_KEY holds a webhook signing secret (whsec_…); it must be the API secret key (sk_…)");
    else if (key && !/^(sk|rk)_(test|live)_/.test(key)) console.error("Checkout: STRIPE_SECRET_KEY does not look like a Stripe secret key (expected sk_test_…, sk_live_… or rk_…)");
    return key;
}

export default async (req) => {
    if (req.method !== "POST") return methodNotAllowed("POST");

    const secret = readSecretKey();
    if (!secret) {
        console.error(`Checkout: ${explainMissingKey()}`);
        return json(503, { message: "Checkout is temporarily unavailable. Your bag is saved — please try again later." });
    }

    const body = await readBody(req);
    const lines = validateItems(body.items);
    if (!lines) {
        return json(400, { message: "Something in your bag couldn't be checked out. Please refresh the page and try again." });
    }

    const origin = new URL(req.url).origin;
    let response;
    let data;
    try {
        response = await fetch(STRIPE_API, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${secret}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: buildSessionParams(lines, origin),
            signal: AbortSignal.timeout(10_000)
        });
        data = await response.json();
    } catch (error) {
        console.error(`Checkout: Stripe request failed — ${error && error.name}: ${redact(error && error.message)}`);
        return json(502, { message: "We couldn't reach our payment provider. Please try again in a moment." });
    }

    if (!response.ok || !data.url) {
        const err = (data && data.error) || {};
        const hint = response.status === 401 ? " (Stripe rejected the API key: wrong, rolled or test/live mismatch)" : "";
        console.error(`Checkout: Stripe error HTTP ${response.status}${hint} — type=${err.type || "?"} code=${err.code || "?"} param=${err.param || "?"} message=${redact(err.message)}`);
        return json(502, { message: "We couldn't start checkout just now. Please try again in a moment." });
    }

    return json(200, { url: data.url });
};

export const config = { path: "/api/create-checkout-session" };
