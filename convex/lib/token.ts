// Unique, unguessable action-link token. Uses Web Crypto (available in the
// Convex runtime) rather than Math.random.
export function newToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
