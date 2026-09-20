/**
 * CSRF helper.
 *
 * Reads the XSRF-TOKEN cookie (as set by the Spring backend) and returns its
 * decoded value. The value must never be stored in React state or browser
 * storage; it is read fresh from the cookie on each use.
 */
export const XSRF_COOKIE_NAME = "XSRF-TOKEN";
export const XSRF_HEADER_NAME = "X-XSRF-TOKEN";

export function readCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${XSRF_COOKIE_NAME}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return trimmed.slice(prefix.length);
      }
    }
  }
  return null;
}

export function csrfHeaders(): Record<string, string> {
  const token = readCsrfToken();
  return token === null ? {} : { [XSRF_HEADER_NAME]: token };
}
