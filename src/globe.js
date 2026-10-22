// The Vcorp planet as pixel art: drawn on a small canvas, enlarged by CSS without smoothing
import { geometry, ROUTES, SWISS_ROUTES, R, C, SPEED } from "./planet.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hex = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
const LIT = hex("#fbfbfb"), SHADE = hex("#dfe4e9"), DEEP = hex("#c3cbd3"), GLOW = hex("#24282c");

export function mountGlobe(canvas) {
  const ctx = canvas.getContext("2d");
  const routes = matchMedia("(max-width: 767px)").matches ? ROUTES.filter((_, i) => i % 2 === 0) : ROUTES;
  // Same number of globe pixels on every screen: about 360 across the canvas
  const pixel = () => Math.max(2, Math.round(canvas.clientWidth / 360));
  let rot = -20, time = 4200;

  const draw = () => {
    const g = geometry(rot, time, routes), sw = geometry(rot, time, SWISS_ROUTES);
    const k = canvas.width / 1240, px = 1 / k;     // viewBox units per globe pixel
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k, 0, 0, k, 120 * k, 120 * k);
    ctx.lineWidth = px; ctx.lineCap = "square"; ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.strokeStyle = "#8d9bab"; ctx.stroke();
    ctx.strokeStyle = "#a7b1ba"; ctx.stroke(new Path2D(g.continents));
    ctx.setLineDash([2 * px, 3 * px]); ctx.lineDashOffset = -time / 150 * px;
    ctx.strokeStyle = "#6b7885"; ctx.stroke(new Path2D(g.arrived)); ctx.stroke(new Path2D(g.transit));
    ctx.strokeStyle = "#ff4400"; ctx.stroke(new Path2D(sw.arrived + sw.transit));
    ctx.setLineDash([]);
    ctx.fillStyle = "#6b7885"; ctx.fill(new Path2D(g.heads)); ctx.fill(new Path2D(g.dots));
    ctx.fillStyle = "#ff4400"; ctx.fill(new Path2D(sw.heads)); ctx.fill(new Path2D(sw.dots));

    // Pixel pass: lines fully on or off, then the sphere painted under them with a dithered shadow
    const n = canvas.width, img = ctx.getImageData(0, 0, n, n), a = img.data;
    const cx = (C + 120) * k, r = R * k;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const o = (y * n + x) * 4;
      if (a[o + 3] > 128) { a[o + 3] = 255; continue; }
      a[o + 3] = 0;
      const dx = (x + .5 - cx) / r, dy = (y + .5 - cx) / r, d = dx * dx + dy * dy;
      const t = BAYER[(y & 3) * 4 + (x & 3)] / 16;
      let c = null;
      if (d <= 1) {
        // Light from the top left: the far side falls into a soft, dithered shadow
        const light = -.55 * dx - .6 * dy + .58 * Math.sqrt(1 - d);
        c = light > .32 + t * .3 ? LIT : light > -.05 + t * .3 ? SHADE : DEEP;
      } else if (d < 1.035 && t < (1.035 - d) / .035 * .45) c = GLOW;   // a thin dithered glow around the planet
      if (c) { a[o] = c[0]; a[o + 1] = c[1]; a[o + 2] = c[2]; a[o + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
  };

  // Resizing a canvas clears it: redraw right away
  const fit = () => {
    canvas.width = canvas.height = Math.max(1, Math.round(canvas.clientWidth / pixel()));
    draw();
  };
  fit();
  addEventListener("resize", fit);

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let raf = 0, last = 0, prev = 0;
  const tick = (now) => {
    if (!prev) prev = now;
    time += now - prev; prev = now;
    if (now - last >= 50) { last = now; rot = -20 - (time - 4200) * SPEED; draw(); }   // 20 images/s: enough for pixel art
    raf = requestAnimationFrame(tick);
  };
  // Only animate while the globe is on screen
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { prev = 0; raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf);
  }).observe(canvas);
}
