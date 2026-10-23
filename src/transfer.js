// Address of the API: VITE_API_URL at build time (production), otherwise the local API (development)
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Everything is encrypted in the browser: the server only receives noise.
// Sent file = [header: name and type on 1024 bytes] then the file in 4 MiB parts, read as a stream.
// Each part is encrypted with AES-256-GCM (+16 bytes of tag) and sent in its own request
const CHUNK_SIZE = 4 * 1024 * 1024;
const HEADER_SIZE = 1024;
const TAG_SIZE = 16;
const MAX_STORED_SIZE = 1024 * 1024 * 1024;   // API limit: 1 GiB per (encrypted) file

// Without showSaveFilePicker the received file goes through memory: on phones, warn above this size
const MOBILE_WARNING_SIZE = 100 * 1024 * 1024;

export class TransferError extends Error {}

const chunkCount = (size) => Math.max(1, Math.ceil(size / CHUNK_SIZE));

export const isTooLarge = (size) => HEADER_SIZE + TAG_SIZE + size + chunkCount(size) * TAG_SIZE > MAX_STORED_SIZE;

// IV = part number (0 = header): the key is new for every file, so an IV is never used twice.
// The last part is marked: a cut file or swapped parts do not decrypt
function params(index, isLast) {
  const iv = new Uint8Array(12);
  new DataView(iv.buffer).setUint32(8, index);
  return { name: "AES-GCM", iv, additionalData: new Uint8Array([isLast ? 1 : 0]) };
}

// The file ID on the server and the key are drawn apart: the ID tells nothing about the key.
// The link holds both, the server only ever sees the ID
const randomFileId = () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");

const toBase64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function fromBase64Url(text) {
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

// XMLHttpRequest rather than fetch: only it reports the upload progress, byte by byte
function post(idFile, done, body, onSent) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_URL}/upload`);
    request.setRequestHeader("idfile", idFile);
    request.setRequestHeader("done", String(done));
    request.upload.onprogress = (event) => onSent(event.loaded);
    request.onload = () => resolve(request.status);
    request.onerror = () => reject(new TransferError("Connection lost. Please try again."));
    request.send(body);
  });
}

async function upload(idFile, done, body = null, onSent = () => {}) {
  // 503 = too many uploads on the server right now: try again a little later
  for (let attempt = 1; ; attempt++) {
    const status = await post(idFile, done, body, onSent);
    if (status >= 200 && status < 300) return;
    if (status !== 503 || attempt === 5) {
      if (status === 413) throw new TransferError("This file is over the 1 GB free limit.");
      if (status === 507) throw new TransferError("Our server is full right now. Please try again later.");
      if (status === 503) throw new TransferError("Our server is busy right now. Please try again in a minute.");
      throw new TransferError("Upload failed. Please try again.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

// Encrypts and sends the stream, returns the file ID and the key to put in the link. onSent = bytes already sent to the server
export async function sendFile(stream, header, onSent) {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const idFile = randomFileId();

  // Name and type are encrypted in the header, padded to 1024 bytes (the name length does not show)
  let { name, type } = header;
  while (new TextEncoder().encode(JSON.stringify({ name, type })).length > HEADER_SIZE) name = name.slice(0, -1);
  const headerBytes = new Uint8Array(HEADER_SIZE).fill(0x20);
  headerBytes.set(new TextEncoder().encode(JSON.stringify({ name, type })));
  await upload(idFile, false, await crypto.subtle.encrypt(params(0, false), key, headerBytes));

  // A part is the last one when nothing follows it: read the next one before sending the current one
  const blocks = blockReader(stream);
  let current = await blocks.read(CHUNK_SIZE);
  let sent = 0;
  for (let index = 1; ; index++) {
    const next = current.length === CHUNK_SIZE ? await blocks.read(CHUNK_SIZE) : new Uint8Array(0);
    const isLast = next.length === 0;
    const encrypted = await crypto.subtle.encrypt(params(index, isLast), key, current);
    await upload(idFile, false, encrypted, (bytes) => onSent(sent + bytes));
    sent += encrypted.byteLength;
    if (isLast) break;
    current = next;
  }

  await upload(idFile, true);
  return { idFile, key: toBase64Url(keyBytes) };
}

// Reads the stream in blocks of an exact size (the network delivers pieces of any size).
// onBytes is called for every piece that arrives, for a smooth progress
function blockReader(stream, onBytes = () => {}) {
  const reader = stream.getReader();
  let pieces = [];
  let length = 0;

  return {
    async read(size) {
      while (length < size) {
        const { done, value } = await reader.read();
        if (done) break;
        onBytes(value.length);
        pieces.push(value);
        length += value.length;
      }
      const all = new Uint8Array(length);
      let offset = 0;
      for (const piece of pieces) {
        all.set(piece, offset);
        offset += piece.length;
      }
      const rest = all.subarray(size);
      pieces = rest.length ? [rest] : [];
      length = rest.length;
      return all.slice(0, size);
    },
    cancel: () => reader.cancel(),
  };
}

// Downloads (the server destroys the file once it has sent it whole), decrypts and saves it.
// onProgress: share of the file received (0 to 1), or null if the server gave no size.
// Returns { name, size }, or null if the download was cancelled
export async function receiveFile(idFile, keyText, onProgress) {
  const keyBytes = fromBase64Url(keyText);
  if (!keyBytes || keyBytes.length !== 32) throw new TransferError("This link is incomplete. Check that you copied it entirely.");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);

  const response = await fetch(`${API_URL}/download`, { headers: { idfile: idFile } }).catch(() => {
    throw new TransferError("Connection lost. Please try again.");
  });
  if (response.status === 404) throw new TransferError("This file no longer exists. It was already downloaded, or it expired after 48 hours.");
  if (response.status === 429) throw new TransferError("Too many attempts. Wait a second and try again.");
  if (!response.ok || !response.body) throw new TransferError("Download failed. Please try again.");

  // Without showSaveFilePicker the file goes through memory: on phones, ask first when it is large
  const total = Number(response.headers.get("Content-Length"));
  if (!("showSaveFilePicker" in window) && isMobile() && total > MOBILE_WARNING_SIZE) {
    const sizeMb = Math.round(total / (1024 * 1024));
    if (!confirm(`This file is ${sizeMb} MB. It may be too large for your phone's memory. Continue?`)) {
      await response.body.cancel();   // download cancelled: the file stays on the server
      return null;
    }
  }

  let received = 0;
  const blocks = blockReader(response.body, (bytes) => {
    received += bytes;
    onProgress(total > 0 ? Math.min(received / total, 1) : null);
  });
  const decrypt = (index, isLast, data) =>
    crypto.subtle.decrypt(params(index, isLast), key, data).catch(() => {
      throw new TransferError("The file could not be decrypted. It may be damaged.");
    });

  const header = JSON.parse(new TextDecoder().decode(await decrypt(0, false, await blocks.read(HEADER_SIZE + TAG_SIZE))));

  // As when sending: a part is the last one when nothing follows it. The first part is only read
  // on demand, so the save dialog opens right after the click
  const full = CHUNK_SIZE + TAG_SIZE;
  let current = null;
  let index = 1;
  let size = 0;
  const plain = new ReadableStream({
    async pull(controller) {
      current ??= await blocks.read(full);
      const next = current.length === full ? await blocks.read(full) : new Uint8Array(0);
      const isLast = next.length === 0;
      const data = new Uint8Array(await decrypt(index, isLast, current));
      size += data.length;
      controller.enqueue(data);
      if (isLast) controller.close();
      current = next;
      index++;
    },
    cancel: () => blocks.cancel(),
  });

  // Chrome and Edge on computers: written straight to disk, without going through memory
  if ("showSaveFilePicker" in window) {
    let handle = null;
    try {
      handle = await window.showSaveFilePicker({ suggestedName: header.name });
    } catch (error) {
      if (error.name === "AbortError") {
        await plain.cancel();   // dialog closed: download cancelled, the file stays on the server
        return null;
      }
      // Any other refusal (click too old...): go through memory, like the other browsers
    }
    if (handle) {
      await plain.pipeTo(await handle.createWritable());
      return { name: header.name, size };
    }
  }

  const blob = await new Response(plain).blob();
  const link = document.createElement("a");
  // Generic type: Safari on iPhone downloads the file instead of opening it in a new tab
  link.href = URL.createObjectURL(new Blob([blob], { type: "application/octet-stream" }));
  link.download = header.name;
  link.click();
  return { name: header.name, size };
}

function isMobile() {
  if (navigator.userAgentData) return navigator.userAgentData.mobile;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));   // recent iPads
}
