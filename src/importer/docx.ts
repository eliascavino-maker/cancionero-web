/** One line of a document, with the text color of each character (hex like "ff0000", or null). */
export interface DocLine {
  text: string;
  colors: (string | null)[];
}

export function linesFromText(text: string): DocLine[] {
  return text
    .replace(/^﻿/, '')
    .split(/\r\n|\r|\n/)
    .map((t) => ({ text: t, colors: Array.from({ length: t.length }, () => null) }));
}

// ------------------------------------------------------------------ zip

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(data).body!.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Reads one file out of a zip (a .docx is a zip). Supports stored and deflated entries. */
export async function readZipEntry(zip: Uint8Array, name: string): Promise<Uint8Array | null> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // End of central directory: last 0x06054b50 signature.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count && view.getUint32(p, true) === 0x02014b50; n++) {
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const entryName = decoder.decode(zip.subarray(p + 46, p + 46 + nameLen));
    if (entryName === name) {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const data = zip.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRaw(data);
      throw new Error('Formato de compresión no soportado.');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

// ------------------------------------------------------------------ docx

/** Lines of a Word document with each character's color. */
export function linesFromDocumentXml(xml: string): DocLine[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const lines: DocLine[] = [];
  for (const p of Array.from(doc.getElementsByTagName('w:p'))) {
    let line: DocLine = { text: '', colors: [] };
    const push = (text: string, color: string | null) => {
      line.text += text;
      for (let i = 0; i < text.length; i++) line.colors.push(color);
    };
    for (const el of Array.from(p.getElementsByTagName('*'))) {
      const tag = el.tagName;
      if (tag !== 'w:t' && tag !== 'w:tab' && tag !== 'w:br') continue;
      if (tag === 'w:br') {
        lines.push(line);
        line = { text: '', colors: [] };
        continue;
      }
      let color: string | null = null;
      const run = ancestor(el, 'w:r');
      const c = run?.getElementsByTagName('w:rPr')[0]?.getElementsByTagName('w:color')[0]?.getAttribute('w:val');
      if (c && /^[0-9a-f]{6}$/i.test(c)) color = c.toLowerCase();
      push(tag === 'w:tab' ? '\t' : (el.textContent ?? ''), color);
    }
    lines.push(line);
  }
  return lines;
}

function ancestor(el: Element, tag: string): Element | null {
  for (let e = el.parentElement; e; e = e.parentElement) if (e.tagName === tag) return e;
  return null;
}

function bytesOf(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  // Older browsers (and the test DOM).
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

/** Reads an uploaded .docx or .txt file. */
export async function readDocument(file: Blob): Promise<DocLine[]> {
  const buf = new Uint8Array(await bytesOf(file));
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (!isZip) return linesFromText(new TextDecoder().decode(buf));
  const xml = await readZipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('No es un documento de Word (.docx).');
  return linesFromDocumentXml(new TextDecoder().decode(xml));
}
