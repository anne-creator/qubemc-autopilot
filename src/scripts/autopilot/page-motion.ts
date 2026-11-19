import { WheelGesture } from "./wheel-gesture.mjs";

export function setupPageMotion(reducedMotion: MediaQueryList) {
  const root = document.documentElement;
  const screens = Array.from(
    document.querySelectorAll<HTMLElement>("main > [data-screen]"),
  );
  const desktop = matchMedia("(min-width: 1000px) and (min-height: 740px)");
  const easing = "cubic-bezier(.22, 1, .36, 1)";
  let positions: number[] = [];
  let target: number | undefined;
  let navigationTimeout: number | undefined;

  function measureScreens() {
    const viewport = root.clientHeight;
    positions = screens.map((screen, index) =>
      index === 0 ? 0 : screen.getBoundingClientRect().top + scrollY,
    );
    const fits = positions.every(
      (position, index) =>
        (positions[index + 1] ?? root.scrollHeight) - position <= viewport + 2,
    );
    root.toggleAttribute(
      "data-screen-mode",
      desktop.matches && fits && !reducedMotion.matches,
    );
  }

  function stopNavigation() {
    target = undefined;
    window.clearTimeout(navigationTimeout);
  }

  function go(delta: number) {
    const current =
      target ??
      positions.reduce(
        (closest, position, index) =>
          Math.abs(position - scrollY) < Math.abs(positions[closest] - scrollY)
            ? index
            : closest,
        0,
      );
    const next = Math.max(0, Math.min(positions.length - 1, current + delta));
    if (next === current) return;
    target = next;
    scrollTo({ top: positions[next], behavior: "smooth" });
    window.clearTimeout(navigationTimeout);
    navigationTimeout = window.setTimeout(stopNavigation, 1100);
  }

  const wheelGesture = new WheelGesture();

  window.addEventListener(
    "wheel",
    (event) => {
      if (
        !root.hasAttribute("data-screen-mode") ||
        event.defaultPrevented ||
        event.ctrlKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          "dialog, textarea, select, input, [contenteditable]",
        )
      )
        return;
      if (!event.cancelable) return;

      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
      if (Math.abs(delta) < 0.5) return;
      event.preventDefault();
      const direction = wheelGesture.feed(
        delta,
        event.timeStamp,
        event.deltaMode === 1,
      );
      if (direction) go(direction);
    },
    { passive: false },
  );

  document.addEventListener("scrollend", stopNavigation);
  window.addEventListener("hashchange", stopNavigation);
  desktop.addEventListener("change", measureScreens);
  reducedMotion.addEventListener("change", measureScreens);
  const layout = new ResizeObserver(measureScreens);
  screens.forEach((screen) => layout.observe(screen));
  window.addEventListener("resize", measureScreens);
  measureScreens();

  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      !root.hasAttribute("data-screen-mode") ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey
    )
      return;
    if (
      event.target instanceof Element &&
      event.target.closest(
        "a, button, [tabindex], input, textarea, select, [contenteditable]",
      )
    )
      return;
    const keys: Record<string, number> = {
      PageDown: 1,
      PageUp: -1,
      ArrowDown: 1,
      ArrowUp: -1,
      " ": event.shiftKey ? -1 : 1,
    };
    const direction = keys[event.key];
    if (!direction) return;
    event.preventDefault();
    go(direction);
  });

  const controls = document.querySelectorAll<HTMLElement>(
    ".button, .menu-action, .menu-button, [data-step], [data-pixels]",
  );
  controls.forEach((control) => control.setAttribute("data-specular", ""));
  const preparedHighlights = new WeakSet<HTMLElement>();
  document.addEventListener("pointermove", (event) => {
    if (
      event.pointerType !== "mouse" ||
      reducedMotion.matches ||
      !(event.target instanceof Element)
    )
      return;
    const control = event.target.closest<HTMLElement>("[data-specular]");
    if (!control) return;
    const bounds = control.getBoundingClientRect();
    control.style.setProperty(
      "--pointer-x",
      `${event.clientX - bounds.left + 1}px`,
    );
    control.style.setProperty(
      "--pointer-y",
      `${event.clientY - bounds.top + 1}px`,
    );
    control.setAttribute("data-lit", "");
    if (!control.matches(".menu-button") && !preparedHighlights.has(control)) {
      preparedHighlights.add(control);
      void import("./specular-button")
        .then(({ observeSpecularControl }) => observeSpecularControl(control))
        .catch(() => {
          // The CSS border provides the highlight if the shader cannot load.
        });
    }
  });
  controls.forEach((control) =>
    control.addEventListener("pointerleave", () =>
      control.removeAttribute("data-lit"),
    ),
  );

  const animations = new Set<Animation>();
  function play(
    element: Element,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    if (reducedMotion.matches || document.hidden) return;
    const animation = element.animate(frames, { easing, ...options });
    animations.add(animation);
    animation.addEventListener("finish", () => animations.delete(animation), {
      once: true,
    });
  }

  // Keep the entrance on fast starts without hiding text the reader has seen.
  const firstPaint = performance.getEntriesByName("first-contentful-paint")[0];
  const justPainted = performance.now() - (firstPaint?.startTime ?? 0) < 300;
  if (!location.hash && scrollY < 60 && justPainted) {
    const title = document.getElementById("hero-title");
    if (title) {
      play(
        title,
        [
          { clipPath: "inset(-320px 100% -320px 0)" },
          { clipPath: "inset(-320px 0 -320px 0)" },
        ],
        {
          id: "hero-title-reveal",
          duration: 1050,
          easing: "cubic-bezier(.24, .46, .45, .94)",
        },
      );
    }
    document
      .querySelectorAll(".hero .intro, .hero .hero-audience, .hero .actions")
      .forEach((element, index) => {
        play(
          element,
          [
            { opacity: 0, transform: "translateY(22px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 850, delay: 620 + index * 120, fill: "backwards" },
        );
      });
  }

  function reveal(element: Element) {
    if (element.matches(".environment-image")) {
      const photo = element.querySelector("img");
      if (photo instanceof HTMLImageElement) {
        const zoom = () => {
          if (
            element.getBoundingClientRect().bottom > 0 &&
            element.getBoundingClientRect().top < innerHeight
          ) {
            if (!reducedMotion.matches) photo.setAttribute("data-zoomed", "");
          } else {
            revealObserver.observe(element);
          }
        };
        if (photo.complete && photo.naturalWidth) zoom();
        else photo.addEventListener("load", zoom, { once: true });
      }
      return;
    }
    play(
      element,
      [
        { opacity: 0.2, transform: "translateY(15px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 650 },
    );
  }
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio < 0.3 || document.hidden) return;
        observer.unobserve(entry.target);
        reveal(entry.target);
      });
    },
    { threshold: 0.3 },
  );
  document
    .querySelectorAll("[data-screen]:not(.hero-stage) h2, .environment-image")
    .forEach((element) => revealObserver.observe(element));
  reducedMotion.addEventListener("change", () => {
    if (!reducedMotion.matches) return;
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    document
      .querySelectorAll("[data-lit]")
      .forEach((element) => element.removeAttribute("data-lit"));
  });
}
