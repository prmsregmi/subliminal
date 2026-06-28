// The Convex function modules are pulled into the app's type program through the
// generated `api`/`dataModel` types. They reference `process.env` (resolved by
// the Convex runtime), so declare just that here — without pulling all of
// @types/node, which would conflict with the DOM lib globals.
declare const process: { env: Record<string, string | undefined> };
