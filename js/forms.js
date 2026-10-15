/* =========================================================
   Forms — validation and submission for [data-form] forms
   (newsletter, contact).

   A form with data-endpoint="…" posts its fields there and shows
   loading, success and error states. If the endpoint replies with
   JSON { ok, code, title, message }, that copy is shown to the
   visitor. Failures are told apart:
     • server   — the function answered with an error (its copy is shown)
     • unreachable — something other than the function answered
                  (non-JSON, redirect, site protection, missing function)
     • timeout / network — the request never completed
     • Newsletter → /api/newsletter-subscribe (Mailchimp, via a
       Netlify Function)
     • Contact    → /api/contact-submit (email via Resend, via a
       Netlify Function)
   Without a reachable endpoint the form still validates and tells
   the visitor honestly that nothing was sent or stored.
========================================================= */
(function () {
    "use strict";

    var ui = window.GLOWW.ui;
    var TIMEOUT = 15000;

    var COPY = {
        newsletter: {
            success: ["You're on the list", "Thank you for subscribing — look out for our first letter soon."],
            unconnected: ["Thank you for your interest", "Newsletter sign-up works on the live website, so your email address has not been saved here."]
        },
        contact: {
            success: ["Message sent", "Thank you for writing to us. We'll reply to the email address you provided."],
            unconnected: ["Your message has not been sent", "The contact form works on the live website, so nothing was sent from here. Please keep a copy of your message."]
        },
        error: ["We couldn't send that just now", "Please check your connection and try again in a moment."],
        timeout: ["That took too long", "The service didn't respond in time. Please try again in a moment."],
        unreachable: ["This service isn't available right now", "We couldn't reach our sign-up service. Nothing was saved — please try again a little later."]
    };

    function labelText(field) {
        var label = field.form.querySelector('label[for="' + field.id + '"]');
        return label ? label.firstChild.textContent.trim().toLowerCase() : "this field";
    }

    function messageFor(field) {
        var v = field.validity;
        if (v.valueMissing) {
            return field.tagName === "SELECT" ? "Please choose a " + labelText(field) + "." : "Please enter your " + labelText(field) + ".";
        }
        if (v.typeMismatch && field.type === "email") return "Please enter a valid email address, like name@example.com.";
        if (v.tooShort) return "Please write at least " + field.minLength + " characters.";
        if (v.tooLong) return "Please keep this under " + field.maxLength + " characters.";
        if (v.patternMismatch) return field.getAttribute("data-pattern-message") || "Please check the format of this field.";
        return "";
    }

    function validateField(field) {
        if (field.type === "email" || field.type === "text") field.value = field.value.trim();
        return setFieldError(field, field.checkValidity() ? "" : messageFor(field));
    }

    /* Shows (or clears) an inline error under a field; used for browser and server validation */
    function setFieldError(field, message) {
        var wrapper = field.closest(".field");
        var error = document.getElementById(field.id + "-error");
        if (wrapper) wrapper.classList.toggle("is-invalid", Boolean(message));
        if (message) {
            field.setAttribute("aria-invalid", "true");
        } else {
            field.removeAttribute("aria-invalid");
        }
        if (error) error.textContent = message;
        return !message;
    }

    function showStatus(form, type, copy) {
        var status = form.querySelector("[data-form-status]");
        if (!status) return;
        status.innerHTML =
            '<div class="form-status form-status--' + type + '" role="' + (type === "error" ? "alert" : "status") + '" tabindex="-1">' +
                ui.icon(type === "success" ? "check" : "alert") +
                "<div><strong>" + ui.escapeHTML(copy[0]) + "</strong>" + ui.escapeHTML(copy[1]) + "</div>" +
            "</div>";
        status.firstChild.focus({ preventScroll: true });
    }

    function setLoading(form, loading) {
        var button = form.querySelector('[type="submit"]');
        if (!button) return;
        button.classList.toggle("is-loading", loading);
        button.disabled = loading;
        button.setAttribute("aria-busy", String(loading));
        form.setAttribute("aria-busy", String(loading));
    }

    /* Resolves with the server's JSON on success; rejects with { kind, ... } */
    function send(endpoint, form) {
        var controller = "AbortController" in window ? new AbortController() : null;
        var timer = window.setTimeout(function () { if (controller) controller.abort(); }, TIMEOUT);
        return fetch(endpoint, {
            method: "POST",
            body: new FormData(form),
            headers: { Accept: "application/json" },
            redirect: "manual",
            signal: controller ? controller.signal : undefined
        }).then(function (response) {
            window.clearTimeout(timer);
            var type = response.headers.get("content-type") || "";
            /* Only our functions answer with JSON. Anything else (an HTML login or
               error page, a redirect) means the request never reached the function. */
            if (response.type === "opaqueredirect" || type.indexOf("application/json") === -1) {
                if (window.console) {
                    console.warn("Form endpoint " + endpoint + " answered with HTTP " + response.status + " (" +
                        (response.type === "opaqueredirect" ? "redirect" : type || "no content type") +
                        ") instead of JSON, so the request did not reach the function. Check that the site is not protected by a login or password and that the function is deployed.");
                }
                throw { kind: "unreachable", status: response.status };
            }
            return response.json().catch(function () { return {}; }).then(function (data) {
                if (!response.ok || data.ok === false) {
                    throw { kind: "server", status: response.status, code: data.code, title: data.title, message: data.message, fields: data.fields };
                }
                return data;
            });
        }, function (error) {
            window.clearTimeout(timer);
            throw { kind: error && error.name === "AbortError" ? "timeout" : "network" };
        });
    }

    /* Visitor-facing copy for a rejected send() — never raw technical errors */
    function errorCopy(failure) {
        if (failure && failure.kind === "server" && failure.message) return [failure.title || COPY.error[0], failure.message];
        if (failure && failure.kind === "unreachable") return COPY.unreachable;
        if (failure && failure.kind === "timeout") return COPY.timeout;
        return COPY.error;
    }

    document.querySelectorAll("form[data-form]").forEach(function (form) {
        var type = form.getAttribute("data-form");
        var copy = COPY[type] || COPY.contact;
        var fields = Array.prototype.slice.call(form.querySelectorAll("input, select, textarea")).filter(function (field) {
            return field.type !== "hidden" && field.name;
        });

        fields.forEach(function (field) {
            /* Validate once the visitor leaves a field, then live while they fix it */
            field.addEventListener("blur", function () {
                /* A server error stays until the visitor edits the field */
                if (field.dataset.serverValue === field.value) return;
                if (field.value || field.getAttribute("aria-invalid")) validateField(field);
            });
            field.addEventListener("input", function () {
                delete field.dataset.serverValue;
                if (field.getAttribute("aria-invalid")) validateField(field);
            });
            field.addEventListener("change", function () {
                if (field.tagName === "SELECT") validateField(field);
            });
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            if (form.getAttribute("aria-busy") === "true") return;

            /* Honeypot: silently ignore obvious bots */
            var trap = form.querySelector("[data-honeypot]");
            if (trap && trap.value) return;

            var invalid = fields.filter(function (field) { return !validateField(field); });
            if (invalid.length) {
                invalid[0].focus();
                ui.announce(invalid.length === 1 ? "There is 1 error in the form." : "There are " + invalid.length + " errors in the form.");
                return;
            }

            var endpoint = form.getAttribute("data-endpoint");
            /* Site-relative endpoints (Netlify Functions) can't run from a file opened on disk */
            if (!endpoint || (window.location.protocol === "file:" && endpoint.charAt(0) === "/")) {
                showStatus(form, "info", copy.unconnected);
                return;
            }

            setLoading(form, true);
            send(endpoint, form).then(function (data) {
                setLoading(form, false);
                form.reset();
                showStatus(form, "success", data && data.message ? [data.title || copy.success[0], data.message] : copy.success);
            }).catch(function (failure) {
                setLoading(form, false);
                /* Server-side validation errors appear next to the matching fields */
                if (failure && failure.fields) {
                    Object.keys(failure.fields).forEach(function (name) {
                        var field = form.elements[name];
                        if (field && field.id) {
                            setFieldError(field, failure.fields[name]);
                            field.dataset.serverValue = field.value;
                        }
                    });
                }
                showStatus(form, "error", errorCopy(failure));
            });
        });
    });

    /* Character counter for textareas with maxlength */
    document.querySelectorAll("[data-char-count]").forEach(function (counter) {
        var field = document.getElementById(counter.getAttribute("data-char-count"));
        if (!field) return;
        var update = function () {
            counter.textContent = field.value.length + " / " + field.maxLength;
        };
        field.addEventListener("input", update);
        update();
    });
})();
