import "./style.css";
import { mountGlobe } from "./globe.js";
import { drawPixelArt } from "./pixel-art.js";
import { mountDrop } from "./drop.js";

mountGlobe(document.getElementById("globe"));
drawPixelArt();
mountDrop();

// The side list follows the scroll: the lit step is the row that is level with the middle of the list,
// so the colour changes exactly when a row's top line passes the list
const list = document.getElementById("how-nav");
const navItems = [...list.children];
const rows = [...document.querySelectorAll(".how-row")];
let ticking = false;
const lightStep = () => {
  ticking = false;
  const level = list.getBoundingClientRect().top + list.offsetHeight / 2;
  const current = rows.reduce((step, row, i) => (row.getBoundingClientRect().top <= level ? i : step), 0);
  navItems.forEach((li, i) => li.classList.toggle("on", i === current));
};
addEventListener("scroll", () => {
  if (!ticking) { ticking = true; requestAnimationFrame(lightStep); }
}, { passive: true });
addEventListener("resize", lightStep);
lightStep();

const glide = (top) => scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

// A click on a step brings its row level with the list: the row's text starts at the top of the list
// (where the list sticks), and the row's top line sits just under the header
navItems.forEach((li, i) => li.querySelector("button").addEventListener("click", () => {
  const stuckAt = parseFloat(getComputedStyle(list).top), padding = parseFloat(getComputedStyle(rows[i]).paddingTop);
  glide(scrollY + rows[i].getBoundingClientRect().top - (stuckAt - padding));
}));

// Links that go back to the very top of the page, where the drop band is
document.querySelectorAll("[data-to-top]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  glide(0);
}));
