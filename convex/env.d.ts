// The Convex runtime exposes server-side environment variables via `process.env`
// (set with `npx convex env set`). Declare just that, rather than pulling all of
// @types/node (which conflicts with the DOM lib globals fetch/Response/URL).
declare const process: { env: Record<string, string | undefined> };
