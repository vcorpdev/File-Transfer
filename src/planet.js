// Geometry of the Vcorp planet: a tilted globe in orthographic projection, slowly turning west to east.
// Continents are outlines, routes are arcs between cities; parts hidden behind the planet are left out.
// Coordinates are in a 1000 x 1000 viewBox, the planet has its centre at C and radius R.

const D2R = Math.PI / 180;

// [longitude, latitude]
const CONTINENTS = [
  [[-168, 66], [-162, 70], [-140, 70], [-125, 71], [-95, 72], [-80, 73], [-62, 66], [-64, 60], [-56, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31], [-80, 25], [-83, 29], [-90, 30], [-97, 27], [-97, 21], [-90, 21], [-87, 15], [-83, 9], [-79, 8], [-85, 12], [-92, 15], [-105, 20], [-110, 24], [-115, 31], [-118, 34], [-124, 40], [-124, 48], [-133, 56], [-150, 60], [-165, 60], [-168, 66]],
  [[-50, 60], [-42, 60], [-22, 70], [-18, 77], [-30, 83], [-60, 82], [-72, 78], [-56, 72], [-50, 60]],
  [[-24, 64], [-22, 66], [-15, 66], [-13, 65], [-18, 63], [-24, 64]],
  [[-5, 50], [1, 51], [2, 53], [0, 57], [-3, 59], [-6, 58], [-5, 55], [-3, 54], [-5, 52], [-5, 50]],
  [[180, 69], [160, 70], [140, 72], [130, 71], [113, 74], [100, 77], [80, 73], [73, 72], [68, 69], [55, 69], [44, 68], [42, 67], [34, 69], [26, 71], [18, 70], [13, 67], [5, 62], [6, 58], [8, 57], [9, 55], [8, 54], [4, 52], [1, 50], [-5, 48], [-1, 44], [-9, 43], [-9, 37], [-6, 36], [0, 38], [3, 43], [9, 44], [13, 42], [16, 38], [18, 40], [19, 42], [23, 38], [26, 40], [29, 41], [36, 37], [35, 33], [34, 31], [34, 29], [39, 21], [43, 13], [52, 16], [59, 22], [57, 25], [60, 25], [67, 24], [72, 21], [73, 16], [77, 8], [80, 15], [87, 21], [92, 22], [98, 16], [98, 8], [103, 1], [104, 10], [109, 12], [108, 21], [117, 23], [121, 30], [122, 37], [118, 39], [122, 40], [126, 38], [129, 35], [129, 40], [132, 43], [141, 48], [141, 53], [135, 55], [143, 59], [156, 62], [163, 60], [178, 64], [180, 69]],
  [[130, 31], [135, 34], [140, 35], [142, 39], [141, 43], [145, 44], [140, 42], [136, 37], [132, 34], [130, 31]],
  [[32, 30], [25, 32], [20, 31], [10, 33], [10, 37], [3, 37], [-6, 36], [-10, 30], [-17, 21], [-17, 15], [-12, 7], [-5, 5], [5, 6], [9, 4], [10, -2], [12, -6], [14, -17], [18, -34], [26, -34], [35, -25], [40, -15], [40, -5], [51, 11], [43, 12], [37, 18], [34, 28], [32, 30]],
  [[-80, 9], [-72, 12], [-62, 11], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-74, -50], [-71, -18], [-81, -5], [-80, 9]],
  [[114, -22], [122, -18], [131, -12], [137, -12], [142, -11], [146, -19], [153, -26], [151, -34], [146, -39], [138, -35], [132, -32], [115, -34], [114, -22]],
  [[173, -35], [178, -38], [175, -41], [172, -41], [167, -46], [171, -44], [173, -35]],
];

const CITIES = {
  "New York": [-74, 40.7], "Chicago": [-87.6, 41.9], "Toronto": [-79.4, 43.7], "Los Angeles": [-118.2, 34], "San Francisco": [-122.4, 37.8],
  "Vancouver": [-123.1, 49.3], "Mexico": [-99.1, 19.4], "Miami": [-80.2, 25.8], "Nuuk": [-51.7, 64.2], "Anchorage": [-149.9, 61.2],
  "Sao Paulo": [-46.6, -23.5], "Buenos Aires": [-58.4, -34.6], "Lima": [-77, -12],
  "London": [-0.1, 51.5], "Paris": [2.35, 48.85], "Madrid": [-3.7, 40.4], "Berlin": [13.4, 52.5], "Stockholm": [18.1, 59.3],
  "Reykjavik": [-21.9, 64.1], "Moscow": [37.6, 55.7], "Zurich": [8.5, 47.4], "Rome": [12.5, 41.9], "Istanbul": [29, 41],
  "Cairo": [31.2, 30], "Casablanca": [-7.6, 33.6], "Lagos": [3.4, 6.5], "Nairobi": [36.8, -1.3], "Johannesburg": [28, -26.2], "Dakar": [-17.4, 14.7],
  "Dubai": [55.3, 25.2], "Mumbai": [72.8, 19], "Delhi": [77.2, 28.6], "Singapore": [103.8, 1.3], "Beijing": [116.4, 39.9],
  "Shanghai": [121.5, 31.2], "Tokyo": [139.7, 35.7], "Seoul": [127, 37.5], "Sydney": [151.2, -33.9], "Perth": [115.9, -32], "Auckland": [174.8, -36.8],
};

// [from, to, arrived (1) or in transit (0), phase offset of a route in transit]
export const ROUTES = [
  ["New York", "London", 1, 0], ["Chicago", "Berlin", 1, 0], ["Toronto", "Reykjavik", 1, 0], ["Casablanca", "New York", 0, 0.1],
  ["Nuuk", "Stockholm", 1, 0], ["Madrid", "Istanbul", 1, 0], ["Paris", "Cairo", 0, 0.55], ["London", "Tokyo", 1, 0],
  ["Paris", "Singapore", 0, 0.3], ["Berlin", "Beijing", 1, 0], ["Moscow", "Delhi", 1, 0], ["London", "Dubai", 0, 0.8],
  ["New York", "Sao Paulo", 1, 0], ["Miami", "Buenos Aires", 0, 0.45], ["Los Angeles", "Tokyo", 1, 0], ["San Francisco", "Sydney", 0, 0.65],
  ["Vancouver", "Seoul", 1, 0], ["Lagos", "Sao Paulo", 1, 0], ["Dakar", "Madrid", 0, 0.2], ["Cairo", "Nairobi", 1, 0],
  ["Johannesburg", "Perth", 0, 0.9], ["Mumbai", "Singapore", 1, 0], ["Shanghai", "Auckland", 1, 0], ["Mexico", "Madrid", 0, 0.35],
  ["Anchorage", "Tokyo", 1, 0], ["Lima", "Mexico", 1, 0], ["Rome", "Johannesburg", 0, 0.7], ["Stockholm", "Moscow", 0, 0.15],
];

// Routes leaving our servers in Switzerland, drawn in orange
export const SWISS_ROUTES = [["Zurich", "New York", 0, 0.1], ["Zurich", "Singapore", 0, 0.55], ["Zurich", "Johannesburg", 0, 0.3], ["Zurich", "Stockholm", 1, 0]];

export const R = 480, C = 500;      // radius and centre in the viewBox
export const SPEED = 0.004;         // degrees per millisecond (about 90 s per turn)
const TILT = 18 * D2R;              // the axis leans towards the viewer
const TRANSIT_PERIOD = 9000;        // length of one trip in transit (ms)

// Returns SVG path strings for the planet at a given rotation (degrees) and time (ms)
export function geometry(rotDeg, time, routes) {
  const L0 = rotDeg * D2R, cosL = Math.cos(L0), sinL = Math.sin(L0), cosT = Math.cos(TILT), sinT = Math.sin(TILT);
  const world = ([lon, lat]) => { const p = lat * D2R, l = lon * D2R; return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)]; };
  const view = (v, r) => {
    const x1 = v[0] * cosL - v[2] * sinL, z1 = v[0] * sinL + v[2] * cosL, y1 = v[1];
    return { x: x1 * r, y: (y1 * cosT - z1 * sinT) * r, z: (y1 * sinT + z1 * cosT) * r };
  };
  const f = (n) => Math.round(n * 10) / 10;
  const sx = (x) => f(C + R * x), sy = (y) => f(C - R * y);
  const seg = (run) => (run.length > 1 ? "M" + run.map((p) => sx(p.x) + " " + sy(p.y)).join("L") : "");
  const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

  let continents = "";
  for (const poly of CONTINENTS) {
    let run = [];
    for (const pt of poly) {
      const v = view(world(pt), 1);
      if (v.z > 0.01) run.push(v);
      else { continents += seg(run); run = []; }
    }
    continents += seg(run);
  }

  let arrived = "", transit = "", heads = "", dots = "";
  const used = {};
  for (const [a, b, done, off] of routes) {
    const A = world(CITIES[a]), B = world(CITIES[b]);
    const om = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
    const so = Math.sin(om), H = Math.min(0.2, 0.03 + 0.13 * om);
    const prog = done ? 1 : (time / TRANSIT_PERIOD + off) % 1;
    used[a] = 1;
    if (done) used[b] = 1;
    if (prog < 0.02) continue;
    const N = Math.max(10, Math.round(36 * om * prog));
    let run = [], d = "", head = null;
    for (let i = 0; i <= N; i++) {
      const t = prog * i / N, s1 = Math.sin((1 - t) * om) / so, s2 = Math.sin(t * om) / so;
      const r = 1 + H * Math.sin(Math.PI * t);
      const v = view([s1 * A[0] + s2 * B[0], s1 * A[1] + s2 * B[1], s1 * A[2] + s2 * B[2]], r);
      const vis = v.z > 0 || v.x * v.x + v.y * v.y > 1;   // in front of the planet, or outside its disc
      if (vis) run.push(v);
      else { d += seg(run); run = []; }
      if (i === N) head = { v, vis };
    }
    d += seg(run);
    if (done) arrived += d;
    else {
      transit += d;
      if (head && head.vis) heads += circ(C + R * head.v.x, C - R * head.v.y, 3);
    }
  }
  for (const name in used) {
    const v = view(world(CITIES[name]), 1);
    if (v.z > 0.05) dots += circ(C + R * v.x, C - R * v.y, 3.5);
  }
  const z = "M0 0";
  return { continents: continents || z, arrived: arrived || z, transit: transit || z, heads: heads || z, dots: dots || z };
}
