// Streamed zip: each file is read, compressed and added to the zip as it goes,
// never loaded whole in memory. A file's size and CRC are only known once it has been read:
// they are written right after its data (data descriptor)

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(crc, data) {
  let c = crc ^ 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Two files with the same name in the zip: the second one becomes "name (2).ext"
function uniqueName(name, used) {
  const dot = name.lastIndexOf(".") > 0 ? name.lastIndexOf(".") : name.length;
  let candidate = name;
  for (let i = 2; used.has(candidate); i++) candidate = `${name.slice(0, dot)} (${i})${name.slice(dot)}`;
  used.add(candidate);
  return candidate;
}

export function zipStream(files) {
  const parts = zipParts(files);
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await parts.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
  });
}

async function* zipParts(files) {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const used = new Set();
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = new TextEncoder().encode(uniqueName(file.name, used));

    // Local header: method 8 = deflate, flag 0x0808 = sizes after the data + UTF-8 name
    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0808, true);
    l.setUint16(8, 8, true);
    l.setUint16(10, time, true);
    l.setUint16(12, date, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);
    yield local;

    let crc = 0;
    let size = 0;
    let compressedSize = 0;
    const reader = file.stream()
      .pipeThrough(new TransformStream({
        transform(chunk, controller) {
          crc = crc32(crc, chunk);
          size += chunk.length;
          controller.enqueue(chunk);
        },
      }))
      .pipeThrough(new CompressionStream("deflate-raw"))
      .getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      compressedSize += value.length;
      yield value;
    }

    const descriptor = new Uint8Array(16);
    const d = new DataView(descriptor.buffer);
    d.setUint32(0, 0x08074b50, true);
    d.setUint32(4, crc, true);
    d.setUint32(8, compressedSize, true);
    d.setUint32(12, size, true);
    yield descriptor;

    // Entry of the central directory (written at the end of the zip)
    const entry = new Uint8Array(46 + name.length);
    const e = new DataView(entry.buffer);
    e.setUint32(0, 0x02014b50, true);
    e.setUint16(4, 20, true);
    e.setUint16(6, 20, true);
    e.setUint16(8, 0x0808, true);
    e.setUint16(10, 8, true);
    e.setUint16(12, time, true);
    e.setUint16(14, date, true);
    e.setUint32(16, crc, true);
    e.setUint32(20, compressedSize, true);
    e.setUint32(24, size, true);
    e.setUint16(28, name.length, true);
    e.setUint32(42, offset, true);
    entry.set(name, 46);
    central.push(entry);

    offset += local.length + compressedSize + descriptor.length;
  }

  let centralSize = 0;
  for (const entry of central) {
    centralSize += entry.length;
    yield entry;
  }

  const end = new Uint8Array(22);
  const z = new DataView(end.buffer);
  z.setUint32(0, 0x06054b50, true);
  z.setUint16(8, central.length, true);
  z.setUint16(10, central.length, true);
  z.setUint32(12, centralSize, true);
  z.setUint32(16, offset, true);
  yield end;
}
