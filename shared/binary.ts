import { Document, Packer } from 'docx';

export async function packDocxBinary(doc: Document): Promise<Uint8Array> {
  if (typeof window !== 'undefined' && typeof Packer.toBlob === 'function') {
    const blob = await Packer.toBlob(doc);
    return new Uint8Array(await blob.arrayBuffer());
  }
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

export function base64ToUint8(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
