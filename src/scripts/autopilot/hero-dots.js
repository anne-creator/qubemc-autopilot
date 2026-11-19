// The particle renderer uses the same locally hosted dot font as the heading.
export async function loadDotFont() {
  const root = document.documentElement;
  try {
    const faces = await document.fonts.load("800 64px Doto");
    root.dataset.referenceFont = faces.length ? "ready" : "failed";
  } catch {
    root.dataset.referenceFont = "failed";
  }
}

export function mountDotScatter(hero) {
  const root = document.documentElement,
    title = hero.querySelector("#hero-title");
  if (!title) return;
  const canvas = document.createElement("canvas");
  canvas.className = "reference-dot-scatter";
  canvas.setAttribute("aria-hidden", "true");
  title.append(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(any-hover: hover) and (any-pointer: fine)");
  let atlas,
    lightAtlas,
    hoverLight = 0,
    dots = [],
    raf = 0,
    rebuildFrame = 0,
    last = 0,
    visible = true;
  let width = 0,
    height = 0,
    dpr = 1,
    enabled = false;
  let lightX = -10000,
    lightY = -10000;
  const pointer = { x: -10000, y: -10000, time: 0 };
  const allowed = () =>
    enabled &&
    visible &&
    !document.hidden &&
    !reduced.matches &&
    finePointer.matches;
  const resetPointer = () => {
    pointer.x = pointer.y = -10000;
    pointer.time = 0;
    dots.forEach((dot) => {
      dot.armed = true;
      dot.held = false;
    });
  };

  function build() {
    cancelAnimationFrame(raf);
    raf = 0;
    title.classList.remove("dot-scatter-ready");
    enabled =
      root.dataset.referenceFont === "ready" &&
      finePointer.matches &&
      !reduced.matches;
    dots = [];
    hoverLight = 0;
    if (!enabled) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const style = getComputedStyle(title),
      box = title.getBoundingClientRect();
    width = Math.ceil(box.width + 640);
    height = Math.ceil(box.height + 640);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    atlas = document.createElement("canvas");
    atlas.width = canvas.width;
    atlas.height = canvas.height;
    const ink = atlas.getContext("2d", { willReadFrequently: true });
    if (!ink) return;
    ink.scale(dpr, dpr);
    ink.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ink.fillStyle = style.color;
    ink.textBaseline = "alphabetic";
    const ascent = ink.measureText("Hg").fontBoundingBoxAscent;
    // Match the native heading, including its current responsive line breaks.
    for (const span of title.querySelectorAll(":scope > span")) {
      const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        for (let i = 0; i < node.length; i++) {
          if (!node.data[i].trim()) continue;
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getBoundingClientRect();
          ink.fillText(
            node.data[i],
            r.left - box.left + 320,
            r.top - box.top + 320 + ascent,
          );
        }
      }
    }
    // White highlight keeps the exact alpha of each ink sprite, never a cursor disc.
    lightAtlas = document.createElement("canvas");
    lightAtlas.width = atlas.width;
    lightAtlas.height = atlas.height;
    const lightInk = lightAtlas.getContext("2d");
    if (!lightInk) return;
    lightInk.drawImage(atlas, 0, 0);
    lightInk.globalCompositeOperation = "source-in";
    lightInk.fillStyle = "#fff";
    lightInk.fillRect(0, 0, atlas.width, atlas.height);
    // Small atlas tiles preserve every pixel at rest, including antialiasing.
    const w = atlas.width,
      h = atlas.height;
    const pixels = ink.getImageData(0, 0, w, h).data;
    const step = Math.max(
      2,
      Math.round(parseFloat(style.fontSize) * 0.075 * dpr),
    );
    for (let sy = 0; sy < h; sy += step)
      for (let sx = 0; sx < w; sx += step) {
        const sw = Math.min(step, w - sx),
          sh = Math.min(step, h - sy);
        let occupied = false;
        for (let y = sy; y < sy + sh && !occupied; y++)
          for (let x = sx; x < sx + sw; x++) {
            if (pixels[(y * w + x) * 4 + 3]) {
              occupied = true;
              break;
            }
          }
        if (occupied)
          dots.push({
            sx,
            sy,
            sw,
            sh,
            homeX: (sx + sw / 2) / dpr,
            homeY: (sy + sh / 2) / dpr,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            seed:
              ((Math.imul(sx + 17, 73856093) ^ Math.imul(sy + 31, 19349663)) >>>
                0) /
              4294967296,
            armed: true,
            held: false,
            driftUntil: 0,
            anchorX: null,
            anchorY: null,
          });
      }
    if (!dots.length) return;
    // Cache each tight particle halo once; avoid per-frame shadow filtering.
    const pad = Math.ceil(12 * dpr);
    for (const dot of dots) {
      const sprite = document.createElement("canvas");
      sprite.width = dot.sw + pad * 2;
      sprite.height = dot.sh + pad * 2;
      const glow = sprite.getContext("2d");
      if (!glow) continue;
      glow.shadowColor = "#edf5ff";
      glow.shadowBlur = 7 * dpr;
      glow.drawImage(
        lightAtlas,
        dot.sx,
        dot.sy,
        dot.sw,
        dot.sh,
        pad,
        pad,
        dot.sw,
        dot.sh,
      );
      dot.lightSprite = sprite;
      dot.lightPad = pad / dpr;
    }
    canvas.dataset.dotCount = String(dots.length);
    title.classList.add("dot-scatter-ready");
    draw();
  }
  function draw(now = performance.now()) {
    raf = 0;
    if (!enabled) return;
    const dt = Math.min(0.035, Math.max(0.001, (now - last) / 1000));
    last = now;
    const animate = allowed();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const lightTarget = animate && pointer.time > 0 ? 1 : 0;
    hoverLight = animate
      ? hoverLight + (lightTarget - hoverLight) * (1 - Math.exp(-dt * 12))
      : 0;
    if (hoverLight < 0.001) hoverLight = 0;
    // Keep the last cursor center during fade-out so only lit particles fade.
    let moving = hoverLight > 0,
      displaced = 0;
    for (const dot of dots) {
      // A kick supplies momentum once. No cursor-facing target or circular wall.
      if (animate) {
        const drifting = now < dot.driftUntil;
        let targetX = 0,
          targetY = 0;
        let spring = drifting ? 0 : 2.2 + dot.seed * 1.8;
        let drag = drifting ? 0.8 + dot.seed * 0.6 : 3;
        if (dot.held && !drifting) {
          if (dot.anchorX === null) {
            dot.anchorX = dot.x;
            dot.anchorY = dot.y;
          }
          const t = (now / 1000) * (0.4 + dot.seed * 0.16),
            phase = dot.seed * 73;
          // Independent, slow eddies around each scattered landing position.
          // No shared orbit, and no restoration to the glyph until hover ends.
          targetX =
            dot.anchorX +
            Math.sin(t * 0.55 + phase) * 22 +
            Math.sin(t * 0.21 + phase * 1.7) * 14;
          targetY =
            dot.anchorY +
            Math.sin(t * 0.43 + phase * 1.3) * 26 +
            Math.cos(t * 0.19 + phase) * 12;
          spring = 0.65;
          drag = 1.65;
        }
        dot.vx += ((targetX - dot.x) * spring - dot.vx * drag) * dt;
        dot.vy += ((targetY - dot.y) * spring - dot.vy * drag) * dt;
        dot.x += dot.vx * dt;
        dot.y += dot.vy * dt;
      } else {
        dot.x = dot.y = dot.vx = dot.vy = 0;
      }
      const unsettled =
        (!dot.held && Math.hypot(dot.x, dot.y) > 0.025) ||
        Math.hypot(dot.vx, dot.vy) > 0.05;
      if (unsettled || dot.held) moving = true;
      else {
        dot.vx = dot.vy = 0;
        if (!dot.held) dot.x = dot.y = 0;
      }
      if (Math.hypot(dot.x, dot.y) > 1) displaced++;
      ctx.drawImage(
        atlas,
        dot.sx,
        dot.sy,
        dot.sw,
        dot.sh,
        dot.sx / dpr + dot.x,
        dot.sy / dpr + dot.y,
        dot.sw / dpr,
        dot.sh / dpr,
      );
      // Distance follows the moving particle, not its original glyph position.
      const distance = Math.hypot(
        dot.homeX + dot.x - lightX,
        dot.homeY + dot.y - lightY,
      );
      const reach = Math.max(0, 1 - distance / 150);
      const brightness = hoverLight * reach * reach * (3 - 2 * reach);
      if (dot.lightSprite && brightness > 0.002) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = brightness * 0.9;
        ctx.drawImage(
          dot.lightSprite,
          dot.sx / dpr + dot.x - dot.lightPad,
          dot.sy / dpr + dot.y - dot.lightPad,
          dot.lightSprite.width / dpr,
          dot.lightSprite.height / dpr,
        );
        ctx.restore();
      }
    }
    canvas.dataset.heldDots = String(dots.filter((dot) => dot.held).length);
    canvas.dataset.displacedDots = String(displaced);
    canvas.dataset.running = String(animate && moving);
    if (animate && moving) raf = requestAnimationFrame(draw);
  }
  function wake() {
    if (!raf && enabled) {
      last = performance.now();
      raf = requestAnimationFrame(draw);
    }
  }
  function rebuild() {
    cancelAnimationFrame(rebuildFrame);
    rebuildFrame = requestAnimationFrame(build);
  }
  hero.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch" || !allowed()) return;
      const r = canvas.getBoundingClientRect(),
        now = performance.now();
      const x = event.clientX - r.left,
        y = event.clientY - r.top;
      // Canvas padding and scattered sprites are not hover targets. Require the
      // pointer to be within18px of the original visible title ink.
      const closeToInk = dots.some(
        (dot) => (dot.homeX - x) ** 2 + (dot.homeY - y) ** 2 < 18 ** 2,
      );
      if (!closeToInk) {
        resetPointer();
        wake();
        return;
      }
      const continuing = now - pointer.time < 140;
      const ax = continuing ? pointer.x : x,
        ay = continuing ? pointer.y : y;
      const dx = x - ax,
        dy = y - ay,
        length2 = dx * dx + dy * dy;
      const elapsed = Math.max(16, now - pointer.time) / 1000;
      const motionX = Math.max(-180, Math.min(180, dx / elapsed));
      const motionY = Math.max(-180, Math.min(180, dy / elapsed));
      // A jittered, soft brush along the swept path, without a common boundary.
      for (const dot of dots) {
        // Hold each irregular landing position while the cursor remains nearby.
        // Moving away releases it for the existing slow return, with no radial wall.
        const brushX = 40 + dot.seed * 20,
          brushY = 30 + (1 - dot.seed) * 12;
        const endpoint =
          ((dot.homeX - x) / brushX) ** 2 + ((dot.homeY - y) / brushY) ** 2;
        if (endpoint > 1.5) {
          dot.held = false;
          dot.armed = true;
        }
        if (!dot.armed) continue;
        const px = dot.homeX,
          py = dot.homeY;
        const t = length2
          ? Math.max(
              0,
              Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2),
            )
          : 0;
        const ox = px - (ax + dx * t),
          oy = py - (ay + dy * t);
        const exposure = Math.exp(
          -2 * ((ox / brushX) ** 2 + (oy / brushY) ** 2),
        );
        if (exposure < 0.12) continue;
        const angle =
          dot.seed * Math.PI * 2 + Math.sin(now * 0.003 + dot.seed * 31) * 0.8;
        // Independent travel lengths fill a loose cloud rather than a ring.
        const noise =
          Math.sin(dot.seed * 91.73 + dot.homeX * 0.17 + dot.homeY * 0.11) *
          43758.5453;
        const variation = 0.25 + 0.75 * (noise - Math.floor(noise));
        const impulse = (310 + dot.seed * 460) * exposure * variation;
        dot.vx += Math.cos(angle) * impulse + motionX * 0.5 * exposure;
        dot.vy += Math.sin(angle) * impulse + motionY * 0.5 * exposure;
        dot.anchorX = dot.anchorY = null;
        dot.armed = false;
        dot.held = endpoint <= 1.5;
        dot.driftUntil = now + 320 + dot.seed * 440;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.time = now;
      lightX = x;
      lightY = y;
      wake();
    },
    { passive: true },
  );
  hero.addEventListener("pointerleave", () => {
    resetPointer();
    wake();
  });
  window.addEventListener("blur", () => {
    resetPointer();
    wake();
  });
  document.addEventListener("visibilitychange", () => {
    resetPointer();
    wake();
  });
  new ResizeObserver(rebuild).observe(title);
  new MutationObserver(rebuild).observe(root, {
    attributes: true,
    attributeFilter: ["data-reference-font"],
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    resetPointer();
    wake();
  }).observe(hero);
  reduced.addEventListener("change", rebuild);
  finePointer.addEventListener("change", rebuild);
  window.addEventListener("resize", rebuild);
  document.fonts.ready.then(rebuild);
  rebuild();
}
