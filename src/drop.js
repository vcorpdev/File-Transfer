// The drop band of the hero: sends a file (several files go as one streamed zip) and shows the one-time link.
// Opened with a link (page + #key), the same band receives the file instead
import { sendFile, receiveFile, isTooLarge, TransferError } from "./transfer.js";
import { zipStream } from "./zip.js";

// The link ends with #<file ID>.<key>. What follows the # stays in the browser: the key never reaches the server
const LINK_FORMAT = /^([0-9a-f]{64})\.([A-Za-z0-9_-]{43})$/;

const $ = (selector) => document.querySelector(selector);
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// A percentage that climbs one by one towards the real progress, faster when it lags behind:
// it never jumps from 15 to 44. reached(n) resolves once n is on screen
function smoothCounter(render) {
  let shown = 0, target = 0, raf = 0, last = 0, waiting = [];
  const tick = (now) => {
    if (shown < target && now - last >= Math.max(12, 300 / (target - shown))) {
      last = now;
      render(++shown);
    }
    if (shown >= target) {
      raf = 0;
      waiting.splice(0).forEach((resolve) => resolve());
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  const set = (value) => {
    target = Math.max(target, Math.min(100, Math.floor(value)));
    // A hidden tab gets no animation frames: show the value right away
    if (document.hidden || reduceMotion()) {
      shown = target;
      render(shown);
    }
    if (!raf) raf = requestAnimationFrame(tick);
  };
  return {
    set,
    reached: (value) => new Promise((resolve) => {
      waiting.push(resolve);
      set(value);
    }),
    reset: () => {
      cancelAnimationFrame(raf);
      raf = 0;
      shown = target = 0;
      render(0);
    },
  };
}

export function mountDrop() {
  const band = $("#drop");
  const input = $("#file-input");
  const status = $("#drop-status");
  const idleText = status.textContent;
  const showStatus = (element, text, isError = false) => {
    element.textContent = text;
    element.classList.toggle("is-error", isError);
    // An error fades in, like everything else in the band
    if (isError && !reduceMotion()) element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease" });
  };

  // Every change of the band is smooth: its height slides to the new size, and the new content fades in
  const morph = (change, fade) => {
    const from = band.offsetHeight;
    change();
    if (reduceMotion()) return;
    const to = band.offsetHeight;
    if (from !== to) band.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 450, easing: "cubic-bezier(.2, .8, .2, 1)" });
    fade?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: "ease" });
  };
  const setState = (state) => {
    if (band.dataset.state === state) return;
    morph(() => (band.dataset.state = state), band.querySelector(`[data-view="${state}"]`));
  };

  // ---------- Sending ----------
  const sending = smoothCounter((n) => ($("#busy-text").textContent = `Encrypting and sending… ${n}%`));
  let busy = false;
  async function start(files) {
    if (busy || band.dataset.state !== "idle" || !files || files.length === 0) return;
    const list = [...files];
    const total = list.reduce((sum, file) => sum + file.size, 0);
    if (isTooLarge(total)) return showStatus(status, `${list.length > 1 ? "These files are" : "This file is"} over the 1 GB free limit.`, true);

    // Progress = bytes really sent to the server. The zip is compressed, so its final size is unknown:
    // it is compared with the size of the files, and stays at 99 % until the end
    const onSent = (sent) => sending.set(Math.min(99, (sent / Math.max(total, 1)) * 100));

    busy = true;
    sending.reset();
    setState("busy");
    try {
      const { idFile, key } = list.length === 1
        ? await sendFile(list[0].stream(), { name: list[0].name, type: list[0].type }, onSent)
        : await sendFile(zipStream(list), { name: "vcorp-files.zip", type: "application/zip" }, onSent);
      $("#link-output").value = `${location.origin}${location.pathname}#${idFile}.${key}`;
      await sending.reached(100);
      setState("ready");
    } catch (error) {
      showStatus(status, error instanceof TransferError ? error.message : "Something went wrong. Please try again.", true);
      setState("idle");
    } finally {
      busy = false;
      input.value = "";
    }
  }

  input.addEventListener("change", () => start(input.files));
  for (const type of ["dragover", "drop"]) addEventListener(type, (e) => e.preventDefault());
  band.addEventListener("dragenter", () => band.dataset.state === "idle" && band.classList.add("is-over"));
  band.addEventListener("dragleave", (e) => { if (!band.contains(e.relatedTarget)) band.classList.remove("is-over"); });
  band.addEventListener("drop", (e) => start(e.dataTransfer?.files ?? null));
  addEventListener("drop", () => band.classList.remove("is-over"));

  const copy = $("#link-copy");
  copy.addEventListener("click", async () => {
    const output = $("#link-output");
    output.select();
    await navigator.clipboard.writeText(output.value).catch(() => document.execCommand("copy"));
    copy.textContent = "Copied";
    setTimeout(() => (copy.textContent = "Copy"), 2000);
  });

  $("#link-again").addEventListener("click", () => {
    $("#link-output").value = "";
    showStatus(status, idleText);
    setState("idle");
  });

  // ---------- Receiving ----------
  // Another link pasted in the same tab: only the # changes, the page does not reload by itself
  addEventListener("hashchange", () => { if (LINK_FORMAT.test(location.hash.slice(1))) location.reload(); });
  const link = location.hash.slice(1).match(LINK_FORMAT);
  if (!link) return;
  const [, idFile, key] = link;

  const title = $("#hero-title"), lead = $("#hero-lead");
  const home = { title: title.innerHTML, lead: lead.textContent };
  title.textContent = "You received a file.";
  lead.textContent = "It was encrypted on the sender’s device. It will be decrypted here, in your browser, and nowhere else.";
  band.dataset.state = "receive";

  const button = $("#receive-button"), receiveStatus = $("#receive-status"), view = band.querySelector('[data-view="receive"]');
  const receiving = smoothCounter((n) => showStatus(receiveStatus, `Downloading and decrypting… ${n}%`));
  // The end (file saved, or no longer there): the key leaves the address, and the visitor can send a file
  const finish = () => {
    history.replaceState(null, "", location.pathname);
    button.hidden = true;
    $("#receive-own").hidden = false;
  };

  button.addEventListener("click", async () => {
    button.disabled = true;
    receiving.reset();
    // Without a size from the server there is no percentage, only the words
    const onProgress = (ratio) => (ratio === null ? showStatus(receiveStatus, "Downloading and decrypting…") : receiving.set(ratio * 100));
    try {
      const received = await receiveFile(idFile, key, onProgress);
      if (!received) {
        showStatus(receiveStatus, "Download cancelled. The file is still available.");
        button.disabled = false;
        return;
      }
      await receiving.reached(100);
      morph(() => {
        $("#receive-heading").textContent = "File saved";
        showStatus(receiveStatus, `${received.name} (${formatSize(received.size)}) is on your device. It has been destroyed from our server.`);
        finish();
      }, view);
    } catch (error) {
      morph(() => {
        showStatus(receiveStatus, error instanceof TransferError ? error.message : "Something went wrong. Please try again.", true);
        button.disabled = false;
        if (error instanceof TransferError && error.message.startsWith("This file no longer exists")) finish();
      }, view);
    }
  });

  // Back to the normal home page, without reloading
  $("#receive-own").addEventListener("click", () => {
    title.innerHTML = home.title;
    lead.textContent = home.lead;
    setState("idle");
  });
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
