/* =========================================================
   POST /api/contact-submit
   Validates a contact-form message on the server and delivers it
   by email through Resend (https://resend.com).

   Every JSON response has { ok, code, title, message } and, for
   validation errors, { fields: { fieldName: "message" } }.

   Environment variables (Netlify → Project configuration →
   Environment variables; scope must include "Functions"):
     RESEND_API_KEY       required  re_…  (Resend → API Keys)
     CONTACT_TO_EMAIL     required  inbox that receives messages
     CONTACT_FROM_EMAIL   optional  sender, e.g. "GLOWW <hello@your-domain.com>"
                                    (domain must be verified in Resend).
                                    Default: "GLOWW Contact <onboarding@resend.dev>",
                                    which Resend only delivers to the
                                    Resend account owner's own address.
========================================================= */
import { json, readBody, methodNotAllowed } from "../lib/http.mjs";

const RESEND_API = "https://api.resend.com/emails";
const PROVIDER_BUDGET_MS = 8_000; // stay inside Netlify's 10 s function limit
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SUBJECTS = ["Product advice", "Help with my routine", "Shipping & returns", "Press & partnerships", "Something else"];
const DEFAULT_FROM = "GLOWW Contact <onboarding@resend.dev>";

const CODES = {
    SENT: { status: 200, title: "Message sent", message: "Thank you for writing to us. We'll reply to the email address you provided." },
    INVALID: { status: 400, title: "Please check the form", message: "Some details need attention before we can send your message." },
    NOT_CONFIGURED: { status: 503, title: "Your message has not been sent", message: "Our contact form is temporarily unavailable. Please try again later." },
    PROVIDER_AUTH_FAILED: { status: 502, title: "Your message has not been sent", message: "We couldn't send your message just now. Please try again later." },
    PROVIDER_REJECTED: { status: 502, title: "Your message has not been sent", message: "We couldn't send your message just now. Please try again later." },
    PROVIDER_UNAVAILABLE: { status: 502, title: "Your message has not been sent", message: "Our email service isn't responding. Please try again in a moment." },
    PROVIDER_TIMEOUT: { status: 504, title: "Your message has not been sent", message: "Our email service didn't respond in time. Please try again in a moment." }
};

function reply(code, extra = {}) {
    const { status, title, message } = CODES[code];
    return json(status, { ok: status < 300, code, title, message, ...extra });
}

/* Tolerate values pasted with spaces, line breaks or quotes */
const clean = (value) => String(value || "").trim().replace(/^["']+|["']+$/g, "").trim();
/* Single-line fields must never contain line breaks (no header-style injection) */
const oneLine = (value) => String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function validate(body) {
    const data = {
        name: oneLine(body.name).slice(0, 200),
        email: oneLine(body.email).toLowerCase().slice(0, 300),
        subject: oneLine(body.subject),
        message: String(body.message || "").replace(/\r\n?/g, "\n").trim()
    };
    const fields = {};
    if (data.name.length < 2) fields.name = "Please enter your full name.";
    else if (data.name.length > 80) fields.name = "Please keep your name under 80 characters.";
    if (!EMAIL.test(data.email) || data.email.length > 254) fields.email = "Please enter a valid email address, like name@example.com.";
    if (!SUBJECTS.includes(data.subject)) fields.subject = "Please choose a subject.";
    if (data.message.length < 20) fields.message = "Please write at least 20 characters.";
    else if (data.message.length > 1000) fields.message = "Please keep this under 1000 characters.";
    return { data, fields };
}

export function contactConfig(env = process.env) {
    const apiKey = clean(env.RESEND_API_KEY);
    const to = clean(env.CONTACT_TO_EMAIL);
    const from = clean(env.CONTACT_FROM_EMAIL) || DEFAULT_FROM;
    const problems = [];
    if (!apiKey) problems.push("RESEND_API_KEY is not set");
    else if (!apiKey.startsWith("re_")) problems.push("RESEND_API_KEY does not look like a Resend key (expected re_…)");
    if (!to) problems.push("CONTACT_TO_EMAIL is not set");
    else if (!EMAIL.test(to)) problems.push("CONTACT_TO_EMAIL is not a valid email address");
    return { apiKey, to, from, problems };
}

export function buildEmail({ name, email, subject, message }, cfg) {
    const text = `New message from the GLOWW contact form\n\n` +
        `Name:    ${name}\nEmail:   ${email}\nSubject: ${subject}\n\n${message}\n\n— Reply to this email to answer ${name} directly.`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#232323">` +
        `<p style="margin:0 0 12px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#66625b">GLOWW contact form</p>` +
        `<table style="border-collapse:collapse;margin-bottom:16px">` +
        `<tr><td style="padding:2px 12px 2px 0;color:#66625b">Name</td><td>${escapeHTML(name)}</td></tr>` +
        `<tr><td style="padding:2px 12px 2px 0;color:#66625b">Email</td><td>${escapeHTML(email)}</td></tr>` +
        `<tr><td style="padding:2px 12px 2px 0;color:#66625b">Subject</td><td>${escapeHTML(subject)}</td></tr></table>` +
        `<div style="white-space:pre-wrap;border-left:3px solid #a88a55;padding-left:12px">${escapeHTML(message)}</div>` +
        `<p style="margin-top:16px;color:#66625b;font-size:13px">Reply to this email to answer ${escapeHTML(name)} directly.</p></div>`;
    return {
        from: cfg.from,
        to: [cfg.to],
        reply_to: email,
        subject: `GLOWW contact: ${subject} — ${name}`.slice(0, 200),
        text,
        html
    };
}

export default async (req) => {
    if (req.method === "GET") {
        const { problems } = contactConfig();
        return json(200, { ok: true, service: "contact-submit", configured: problems.length === 0, accepts: "POST" });
    }
    if (req.method !== "POST") return methodNotAllowed("GET, POST");

    const body = await readBody(req, 20_000);

    /* Honeypot: bots get a normal-looking reply, nothing is sent */
    if (body.company) return reply("SENT");

    const { data, fields } = validate(body);
    if (Object.keys(fields).length) return reply("INVALID", { fields });

    const cfg = contactConfig();
    if (cfg.problems.length) {
        console.error(`Contact: NOT_CONFIGURED — ${cfg.problems.join("; ")}`);
        return reply("NOT_CONFIGURED");
    }

    let response;
    let result;
    try {
        response = await fetch(RESEND_API, {
            method: "POST",
            headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(buildEmail(data, cfg)),
            signal: AbortSignal.timeout(PROVIDER_BUDGET_MS)
        });
        result = await response.json().catch(() => ({}));
    } catch (error) {
        if (error && (error.name === "TimeoutError" || error.name === "AbortError")) {
            console.error(`Contact: PROVIDER_TIMEOUT — no response from Resend within ${PROVIDER_BUDGET_MS} ms`);
            return reply("PROVIDER_TIMEOUT");
        }
        console.error(`Contact: PROVIDER_UNAVAILABLE — could not reach Resend (${error && error.message})`);
        return reply("PROVIDER_UNAVAILABLE");
    }

    if (response.ok && result.id) {
        console.log(`Contact: SENT (Resend id ${result.id})`);
        return reply("SENT");
    }

    /* Resend's message can contain addresses; keep them out of the logs */
    const detail = String(result.message || "").replace(/[^\s@<>()]+@[^\s@<>()]+/g, "<email>").slice(0, 200);
    const why = `Resend HTTP ${response.status} — ${result.name || "error"}: ${detail}`;
    /* Resend also uses 403 when the sender/recipient isn't allowed (not a key problem) */
    if (response.status === 403 && /testing emails|own email|verify a domain|domain is not verified/i.test(String(result.message))) {
        console.error(`Contact: PROVIDER_REJECTED (${why}). Without a verified domain, CONTACT_TO_EMAIL must be the email address of your Resend account — or verify a domain in Resend and set CONTACT_FROM_EMAIL.`);
        return reply("PROVIDER_REJECTED");
    }
    if (response.status === 401 || response.status === 403) {
        console.error(`Contact: PROVIDER_AUTH_FAILED (${why}). Check RESEND_API_KEY.`);
        return reply("PROVIDER_AUTH_FAILED");
    }
    if (response.status === 400 || response.status === 422) {
        /* e.g. unverified sender domain, or onboarding@resend.dev sending to an address that isn't the account owner's */
        console.error(`Contact: PROVIDER_REJECTED (${why}). Check CONTACT_FROM_EMAIL / CONTACT_TO_EMAIL and the domain in Resend.`);
        return reply("PROVIDER_REJECTED");
    }
    console.error(`Contact: PROVIDER_UNAVAILABLE (${why})`);
    return reply("PROVIDER_UNAVAILABLE");
};

export const config = { path: "/api/contact-submit" };
