/* =========================================================
   Hero slideshow — the original prev / next / dots / autoplay
   behaviour, rebuilt to be accessible:
   * real buttons, keyboard arrows, visible pause control
   * pauses on hover, on focus and when the tab is hidden
   * no autoplay when the visitor prefers reduced motion
========================================================= */
(function () {
    "use strict";

    var INTERVAL = 6500;

    document.querySelectorAll("[data-slideshow]").forEach(function (root) {
        var slides = root.querySelectorAll(".slide");
        var controls = root.querySelector("[data-slideshow-controls]");
        if (slides.length < 2 || !controls) return;

        var dots = controls.querySelectorAll(".dot");
        var pauseButton = controls.querySelector("[data-slide-pause]");
        var reduced = window.GLOWW.ui.reducedMotion.matches;
        var index = 0;
        var timer = null;
        var userPaused = reduced;
        var hoverPaused = false;

        controls.hidden = false;

        function show(next) {
            index = (next + slides.length) % slides.length;
            slides.forEach(function (slide, i) {
                var active = i === index;
                slide.classList.toggle("is-active", active);
                slide.setAttribute("aria-hidden", String(!active));
                var img = slide.querySelector("img");
                if (active && img && img.loading === "lazy") img.loading = "eager";
            });
            dots.forEach(function (dot, i) {
                if (i === index) {
                    dot.setAttribute("aria-current", "true");
                } else {
                    dot.removeAttribute("aria-current");
                }
            });
        }

        function schedule() {
            window.clearTimeout(timer);
            if (userPaused || hoverPaused || document.hidden) return;
            timer = window.setTimeout(function () {
                show(index + 1);
                schedule();
            }, INTERVAL);
        }

        function setPaused(paused) {
            userPaused = paused;
            pauseButton.setAttribute("aria-label", paused ? "Play slideshow" : "Pause slideshow");
            pauseButton.querySelector("[data-icon-pause]").hidden = paused;
            pauseButton.querySelector("[data-icon-play]").hidden = !paused;
            schedule();
        }

        controls.querySelector("[data-slide-prev]").addEventListener("click", function () {
            show(index - 1);
            schedule();
        });

        controls.querySelector("[data-slide-next]").addEventListener("click", function () {
            show(index + 1);
            schedule();
        });

        dots.forEach(function (dot, i) {
            dot.addEventListener("click", function () {
                show(i);
                schedule();
            });
        });

        pauseButton.addEventListener("click", function () {
            setPaused(!userPaused);
        });

        root.addEventListener("keydown", function (event) {
            if (event.key === "ArrowLeft") {
                show(index - 1);
                schedule();
            } else if (event.key === "ArrowRight") {
                show(index + 1);
                schedule();
            }
        });

        root.addEventListener("mouseenter", function () { hoverPaused = true; schedule(); });
        root.addEventListener("mouseleave", function () { hoverPaused = false; schedule(); });
        root.addEventListener("focusin", function () { hoverPaused = true; schedule(); });
        root.addEventListener("focusout", function (event) {
            if (!root.contains(event.relatedTarget)) {
                hoverPaused = false;
                schedule();
            }
        });
        document.addEventListener("visibilitychange", schedule);

        show(0);
        setPaused(userPaused);
    });
})();
