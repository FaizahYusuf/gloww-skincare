/* Small helpers shared by the Netlify Functions. */

export function json(status, body, headers = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...headers
        }
    });
}

/* Accepts JSON or form posts; returns {} when the body can't be read */
export async function readBody(req, maxBytes = 10_000) {
    const length = Number(req.headers.get("content-length") || 0);
    if (length > maxBytes) return {};
    const type = req.headers.get("content-type") || "";
    try {
        if (type.includes("application/json")) return (await req.json()) || {};
        if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
            return Object.fromEntries(await req.formData());
        }
    } catch {
        /* fall through */
    }
    return {};
}

export const methodNotAllowed = (allow) =>
    json(405, { message: "Method not allowed." }, { Allow: allow });
