// Pixel art: the pictures of the page are drawn here as SVG squares, from small bitmaps
const NS = "http://www.w3.org/2000/svg";

const rnd = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

const rect = (svg, x, y, w, h, fill, opacity = 1) => {
  const r = document.createElementNS(NS, "rect");
  r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", w); r.setAttribute("height", h);
  r.setAttribute("fill", fill);
  if (opacity < 1) r.setAttribute("opacity", opacity);
  svg.append(r);
};

const ICONS = {
  file: ["#####...", "#...##..", "#...#.#.", "#...####", "#......#", "#......#", "#......#", "#......#", "#......#", "########"],
  lock: ["..###..", ".#...#.", ".#...#.", "#######", "###.###", "###.###", "#######"],
  news: ["#########", "#.......#", "#.###.#.#", "#.###.#.#", "#.......#", "#.#####.#", "#########"],
  scale: ["....#....", ".#######.", ".#..#..#.", "#.#.#.#.#", "###.#.###", "....#....", "..#####.."],
  case: ["...###...", "..#...#..", "#########", "#...#...#", "####.####", "#.......#", "#########"],
};

const icon = (svg, name, x, y, s, fill) =>
  ICONS[name].forEach((row, j) => [...row].forEach((c, i) => c === "#" && rect(svg, x + i * s, y + j * s, s, s, fill)));

// The computer of step 2 and the radio beside it. "S" is a screen pixel, on both, redrawn as noise
const PC_COLORS = { A: "#804000", B: "#e66100", C: "#000" };
const SCREEN = ["#c0c0c0", "#fff", "#808080"];
const PC = [
  "AAABBBBBBBBBBBBB", "AAABCCCCCCCCCCCB", "AAABCSSSSSSSSSCB", "AAABCSSSSSSSSSCB",
  "AAABCSSSSSSSSSCB", "AAABCSSSSSSSSSCB", "AAABCSSSSSSSSSCB", "AAABCSSSSSSSSSCB",
  "AAABCSSSSSSSSSCB", "AAABCCCCCCCCCCCB", "AAABBBBBBBBBBBBB", "AAABBBBBBBBBBBBB",
  "AAABBCCBCCCBCCBB", "AAABBCCBCCCBCCBB", "AAABBBBBBBBBBBBB", "AAABBBBBBBBBBBBB",
];
const RADIO = [
  ".....B......", "....B.......", "...B........", "..B.........", "ABBBBBBBBBBB",
  "ABSSSSBBCBCB", "ABSSSSBCBCBB", "ABBBBBBBBBBB", ".AABB..AABB.",
];

const bitmap = (svg, rows, x, y) => rows.forEach((row, j) => [...row].forEach((c, i) => {
  if (c === ".") return;
  rect(svg, x + i, y + j, 1, 1, c === "S" ? SCREEN[0] : PC_COLORS[c]);
  if (c === "S") svg.lastChild.classList.add("noise");
}));

const computer = (svg) => {
  svg.setAttribute("viewBox", "0 0 30 16");
  bitmap(svg, PC, 0, 0);
  bitmap(svg, RADIO, 18, 7);
  const noise = [...svg.querySelectorAll(".noise")];
  // Each tick, about half of the screen pixels, picked at random, take a new shade
  const scramble = (share) => noise.forEach((r) => Math.random() < share && r.setAttribute("fill", SCREEN[Math.floor(Math.random() * SCREEN.length)]));
  scramble(1);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(() => scramble(.5), 90);
};

// The file of step 3: whole at the top, it crumbles lower down. The lower a pixel is, the more likely
// it breaks away, the further it falls and the dimmer it gets
const FILE = [
  "GGGGGGGGG...", "GWWWWWWWGG..", "GWDDDDDWGWG.", "GWWWWWWWGWWG", "GWDDDDDWGGGG",
  "GWWWWWWWWWWG", "GWDDDDDDDDWG", "GWWWWWWWWWWG", "GWDDDDDDDDWG", "GWWWWWWWWWWG",
  "GWDDDDDDDDWG", "GWWWWWWWWWWG", "GWDDDDDDDDWG", "GWWWWWWWWWWG", "GGGGGGGGGGGG",
];
const FILE_COLORS = { W: "#fff", G: "#c0c0c0", D: "#808080" };

// Drawn on its own layer: 12 units a pixel, centred on the 600 x 360 tiles
const dust = (svg) => {
  const layer = document.createElementNS(NS, "g");
  layer.setAttribute("transform", "translate(228 36) scale(12)");
  svg.append(layer);
  const height = 24, cut = 7, r = rnd(7), taken = new Set();
  FILE.forEach((row, j) => [...row].forEach((c, i) => {
    if (c === ".") return;
    const depth = (j - cut) / (FILE.length - 1 - cut);   // 0 at the cut, 1 at the bottom edge
    let x = i, y = j;
    if (depth > 0 && r() < .3 + depth * .7) {
      if (r() < .35 + depth * .25) return;                 // gone, too fine to see
      const fall = 1 + Math.round(depth * 5 + r() * 4);
      y += fall;
      x += Math.round((r() - .5) * 2 * depth);
      c = fall > 5 ? "D" : fall > 2 ? "G" : c === "D" ? "G" : c;
    }
    if (y >= height || taken.has(`${x},${y}`)) return;
    taken.add(`${x},${y}`);
    rect(layer, x, y, 1, 1, FILE_COLORS[c]);
  }));
};

// A field of tiles: each tile picks a shade, a few are lighter, like sunlight on a wall
const tiles = (svg, cols, rows, size, palette, seed, light = .12) => {
  const r = rnd(seed);
  svg.setAttribute("viewBox", `0 0 ${cols * size} ${rows * size}`);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    rect(svg, x * size, y * size, size, size, palette[Math.floor(r() * palette.length)]);
    if (r() < light) rect(svg, x * size, y * size, size, size, "#fff", .14);
  }
  for (let x = 1; x < cols; x++) rect(svg, x * size, 0, 1, rows * size, "#fff", .18);
  for (let y = 1; y < rows; y++) rect(svg, 0, y * size, cols * size, 1, "#fff", .18);
};

export function drawPixelArt() {
  // Step 1: a file and its lock, on warm tiles
  const art1 = document.getElementById("art1");
  tiles(art1, 20, 12, 30, ["#ff7a33", "#ff8a45", "#ff9a58", "#ffab6b", "#ff6a24"], 11);
  rect(art1, 240, 120, 120, 120, "#fff", .22);
  icon(art1, "file", 262, 130, 10, "#fff");
  icon(art1, "lock", 300, 190, 7, "#000");

  // Step 2: the computer, its screen scrambled
  computer(document.getElementById("pc"));

  // Step 3: the file crumbles and falls apart, on red-orange tiles
  const art3 = document.getElementById("art3");
  tiles(art3, 20, 12, 30, ["#e63a00", "#ff4400", "#ff5314", "#f03f00"], 21, .08);
  dust(art3);

  // Quote background and pixel icons
  tiles(document.getElementById("art4"), 12, 10, 40, ["#ff4400", "#ff4c0b", "#ff5516"], 3, .1);
  [["ic1", "news"], ["ic2", "scale"], ["ic3", "case"]].forEach(([id, n]) => icon(document.getElementById(id), n, 0, 0, 1, "currentColor"));
}
