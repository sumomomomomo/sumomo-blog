/**
 * RFC 4122 v4 UUID generation that works in insecure contexts.
 *
 * `crypto.randomUUID()` is only exposed on `window.crypto` in secure
 * contexts (HTTPS or localhost). When the site is served over plain HTTP,
 * that method is undefined, so fall back to `crypto.getRandomValues`,
 * which is available everywhere.
 */
export function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
