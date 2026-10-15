/* =========================================================
   /api/newsletter-subscribe
     POST  Adds an email address to a Mailchimp audience.
     GET   Safe status check: is the function reachable and
           configured? (Never reveals key values.)

   Uses Mailchimp's "add or update member" endpoint, so repeat
   sign-ups are handled gracefully. Double opt-in is on by
   default: Mailchimp emails a confirmation link and the person
   is only subscribed once they click it.

   Every JSON response has { ok, code, title, message }:
     • title/message — safe copy shown to the visitor
     • code          — machine-readable reason (see CODES below),
                       also written to the Netlify Function log

   Environment variables (Netlify → Project configuration →
   Environment variables; scope must include "Functions"):
     MAILCHIMP_API_KEY         required  e.g. 0123abcd…-us21
     MAILCHIMP_AUDIENCE_ID     required  Audience → Settings → Audience ID
     MAILCHIMP_SERVER_PREFIX   optional  e.g. us21 — only used if the key
                                         has no "-us21" style suffix
     MAILCHIMP_DOUBLE_OPT_IN   optional  "false" to subscribe immediately
========================================================= */
import { createHash } from "node:crypto";
import { json, readBody, methodNotAllowed } from "../lib/http.mjs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Netlify stops synchronous functions after 10 s; stay well inside it,
   across both possible Mailchimp calls, so we always answer with JSON */
const MAILCHIMP_BUDGET_MS = 8_000;

const CODES = {
    PENDING: { status: 200, title: "Almost there", message: "Please check your inbox and click the confirmation link to complete your subscription." },
    SUBSCRIBED: { status: 200, title: "You're on the list", message: "Thank you for subscribing — look out for our first letter soon." },
    INVALID_EMAIL: { status: 400, title: "Please check your email", message: "That doesn't look like a valid email address." },
    MAILCHIMP_REJECTED: { status: 400, title: "We couldn't subscribe this address", message: "Please check the address, or try a different one." },
    NOT_CONFIGURED: { status: 503, title: "Sign-up is temporarily unavailable", message: "Please try again a little later." },
    MAILCHIMP_AUTH_FAILED: { status: 502, title: "Sign-up is temporarily unavailable", message: "Please try again a little later." },
    MAILCHIMP_AUDIENCE_NOT_FOUND: { status: 502, title: "Sign-up is temporarily unavailable", message: "Please try again a little later." },
    MAILCHIMP_UNAVAILABLE: { status: 502, title: "Sign-up is temporarily unavailable", message: "Our mailing list provider isn't responding. Please try again a little later." },
    MAILCHIMP_TIMEOUT: { status: 504, title: "Sign-up is taking too long", message: "Our mailing list provider didn't respond in time. Please try again in a moment." }
};

function reply(code) {
    const { status, title, message } = CODES[code];
    return json(status, { ok: status < 300, code, title, message });
}

/* Tolerate values pasted with spaces, line breaks or quotes */
const clean = (value) => String(value || "").trim().replace(/^["']+|["']+$/g, "").trim();

export function mailchimpConfig(env = process.env) {
    const apiKey = clean(env.MAILCHIMP_API_KEY);
    const audience = clean(env.MAILCHIMP_AUDIENCE_ID);
    const prefix = clean(env.MAILCHIMP_SERVER_PREFIX).toLowerCase();
    /* The data center is the part after the last "-" in the key (e.g. "-us21"); it is authoritative */
    const dash = apiKey.lastIndexOf("-");
    const fromKey = dash > 0 ? apiKey.slice(dash + 1).toLowerCase() : "";
    const server = fromKey || prefix;

    const problems = [];
    if (!apiKey) problems.push("MAILCHIMP_API_KEY is not set");
    if (!audience) problems.push("MAILCHIMP_AUDIENCE_ID is not set");
    if (apiKey && !/^[a-z]{2,}\d+$/.test(server)) {
        problems.push("data center missing: the API key should end in something like -us21 (or set MAILCHIMP_SERVER_PREFIX)");
    }
    if (fromKey && prefix && fromKey !== prefix) {
        console.warn(`Newsletter: MAILCHIMP_SERVER_PREFIX "${prefix}" ignored — the API key belongs to "${fromKey}"`);
    }
    return { apiKey, audience, server, problems };
}

async function mailchimp(cfg, method, path, body, signal) {
    const response = await fetch(`https://${cfg.server}.api.mailchimp.com/3.0${path}`, {
        method,
        headers: {
            Authorization: `Basic ${Buffer.from(`anystring:${cfg.apiKey}`).toString("base64")}`,
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: body ? JSON.stringify(body) : undefined,
        signal
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
}

/* Map a failed Mailchimp response to one of our codes (and log why) */
function mailchimpFailure(result) {
    const why = `Mailchimp HTTP ${result.status} — ${result.data.title || "no title"}`;
    if (result.status === 401 || result.status === 403) {
        console.error(`Newsletter: MAILCHIMP_AUTH_FAILED (${why}). Check MAILCHIMP_API_KEY is a valid, active key.`);
        return "MAILCHIMP_AUTH_FAILED";
    }
    if (result.status === 404) {
        console.error(`Newsletter: MAILCHIMP_AUDIENCE_NOT_FOUND (${why}). Check MAILCHIMP_AUDIENCE_ID (Audience → Settings → Audience ID).`);
        return "MAILCHIMP_AUDIENCE_NOT_FOUND";
    }
    if (result.status === 400) {
        /* Fake/role addresses, permanently deleted contacts, compliance holds */
        console.warn(`Newsletter: MAILCHIMP_REJECTED (${why})`);
        return "MAILCHIMP_REJECTED";
    }
    console.error(`Newsletter: MAILCHIMP_UNAVAILABLE (${why})`);
    return "MAILCHIMP_UNAVAILABLE";
}

export default async (req) => {
    if (req.method === "GET") {
        const { problems } = mailchimpConfig();
        return json(200, { ok: true, service: "newsletter-subscribe", configured: problems.length === 0, accepts: "POST" });
    }
    if (req.method !== "POST") return methodNotAllowed("GET, POST");

    const body = await readBody(req);

    /* Honeypot field: bots get a normal-looking reply, nothing is stored */
    if (body.company) return reply("PENDING");

    const email = String(body.email || "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) return reply("INVALID_EMAIL");

    const cfg = mailchimpConfig();
    if (cfg.problems.length) {
        console.error(`Newsletter: NOT_CONFIGURED — ${cfg.problems.join("; ")}`);
        return reply("NOT_CONFIGURED");
    }

    const doubleOptIn = clean(process.env.MAILCHIMP_DOUBLE_OPT_IN).toLowerCase() !== "false";
    const memberPath = `/lists/${encodeURIComponent(cfg.audience)}/members/${createHash("md5").update(email).digest("hex")}`;
    const signal = AbortSignal.timeout(MAILCHIMP_BUDGET_MS);

    try {
        let result = await mailchimp(cfg, "PUT", memberPath, {
            email_address: email,
            status_if_new: doubleOptIn ? "pending" : "subscribed"
        }, signal);

        /* Someone who unsubscribed earlier must re-confirm before rejoining */
        if (result.ok && result.data.status === "unsubscribed") {
            result = await mailchimp(cfg, "PATCH", memberPath, { status: "pending" }, signal);
        }

        if (!result.ok) return reply(mailchimpFailure(result));

        const code = result.data.status === "subscribed" ? "SUBSCRIBED" : "PENDING";
        console.log(`Newsletter: ${code} (member status "${result.data.status}")`);
        return reply(code);
    } catch (error) {
        if (error && (error.name === "TimeoutError" || error.name === "AbortError")) {
            console.error(`Newsletter: MAILCHIMP_TIMEOUT — no response within ${MAILCHIMP_BUDGET_MS} ms`);
            return reply("MAILCHIMP_TIMEOUT");
        }
        console.error(`Newsletter: MAILCHIMP_UNAVAILABLE — could not reach https://${cfg.server}.api.mailchimp.com (${error && error.message})`);
        return reply("MAILCHIMP_UNAVAILABLE");
    }
};

export const config = { path: "/api/newsletter-subscribe" };
