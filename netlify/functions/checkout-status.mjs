/* =========================================================
   GET /api/checkout-status?session_id=cs_…
   Returns the confirmed order details for the success page,
   read from Stripe (never from the visitor's bag).

   Environment variables: STRIPE_SECRET_KEY (required)
========================================================= */
import { json, methodNotAllowed } from "../lib/http.mjs";

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
const toAmount = (cents) => (cents || 0) / 100;

export function summarise(session) {
    const totals = session.total_details || {};
    return {
        status: session.status,                   // "complete" | "open" | "expired"
        paymentStatus: session.payment_status,    // "paid" | "unpaid" | "no_payment_required"
        livemode: Boolean(session.livemode),
        reference: session.id.slice(-8).toUpperCase(),
        email: (session.customer_details && session.customer_details.email) || null,
        currency: (session.currency || "usd").toUpperCase(),
        items: ((session.line_items && session.line_items.data) || []).map((line) => ({
            name: line.description,
            quantity: line.quantity,
            amount: toAmount(line.amount_total)
        })),
        subtotal: toAmount(session.amount_subtotal),
        shipping: toAmount(totals.amount_shipping),
        tax: toAmount(totals.amount_tax),
        discount: toAmount(totals.amount_discount),
        total: toAmount(session.amount_total)
    };
}

export default async (req) => {
    if (req.method !== "GET") return methodNotAllowed("GET");

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
        console.error("Checkout status: STRIPE_SECRET_KEY is not set");
        return json(503, { message: "Order details are temporarily unavailable." });
    }

    const id = new URL(req.url).searchParams.get("session_id") || "";
    if (!SESSION_ID.test(id)) return json(400, { message: "That order link isn't valid." });

    let response;
    let data;
    try {
        response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}?expand[]=line_items`, {
            headers: { Authorization: `Bearer ${secret}` },
            signal: AbortSignal.timeout(10_000)
        });
        data = await response.json();
    } catch (error) {
        console.error("Checkout status: Stripe request failed", error);
        return json(502, { message: "We couldn't load your order details just now." });
    }

    if (response.status === 404) return json(404, { message: "We couldn't find that order." });
    if (!response.ok) {
        console.error("Checkout status: Stripe error", response.status, data && data.error && data.error.message);
        return json(502, { message: "We couldn't load your order details just now." });
    }

    return json(200, summarise(data));
};

export const config = { path: "/api/checkout-status" };
