// OrangeSlice (enrichly) REST client — the domain-enrichment engine.
//
// Replicates the SDK transport (Bearer auth, inlineWaitMs, async polling) with
// plain fetch so it runs in the default Convex runtime with no Node deps.
// Endpoints/payloads verified from the bundled SDK source (dist/api.js et al).

const DEFAULT_BASE_URL = "https://enrichly-production.up.railway.app";
const POLL_TIMEOUT_MS = 120000;
const DEFAULT_POLL_INTERVAL_MS = 1500;

function baseUrl(): string {
  return (process.env.ORANGESLICE_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

function apiKey(): string {
  const k = process.env.ORANGESLICE_API_KEY;
  if (!k) {
    throw new Error(
      "ORANGESLICE_API_KEY not set in Convex env. Run `pnpm run secrets` (or `npx convex env set ORANGESLICE_API_KEY osk_...`).",
    );
  }
  return k;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isPending(data: unknown): data is { pending: true } & Record<string, unknown> {
  return !!data && typeof data === "object" && (data as { pending?: unknown }).pending === true;
}

async function poll(endpoint: string, pending: Record<string, unknown>): Promise<unknown> {
  const requestId = pending.requestId as string | undefined;
  const pollUrlRaw = pending.pollUrl as string | undefined;
  if (!requestId && !pollUrlRaw) {
    throw new Error(`[orangeslice] ${endpoint}: pending response missing requestId`);
  }
  const pollUrl = pollUrlRaw
    ? new URL(pollUrlRaw, baseUrl()).toString()
    : `${baseUrl()}/function/result/${requestId}`;

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let interval =
    typeof pending.pollAfterMs === "number" && pending.pollAfterMs > 0
      ? (pending.pollAfterMs as number)
      : DEFAULT_POLL_INTERVAL_MS;

  while (Date.now() < deadline) {
    await sleep(interval);
    const res = await fetch(pollUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const data = await readBody(res);
    if (res.status === 202 || isPending(data)) {
      const next = (data as { pollAfterMs?: number })?.pollAfterMs;
      interval = typeof next === "number" && next > 0 ? next : DEFAULT_POLL_INTERVAL_MS;
      continue;
    }
    if (!res.ok) {
      throw new Error(
        `[orangeslice] ${endpoint}: ${res.status} ${typeof data === "string" ? data : JSON.stringify(data)}`,
      );
    }
    return data;
  }
  throw new Error(`[orangeslice] ${endpoint}: polling timed out after ${POLL_TIMEOUT_MS}ms`);
}

async function osPost(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${baseUrl()}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ ...payload, inlineWaitMs: 5000 }),
  });
  if (!res.ok) {
    const data = await readBody(res);
    throw new Error(
      `[orangeslice] ${endpoint}: ${res.status} ${typeof data === "string" ? data : JSON.stringify(data)}`,
    );
  }
  let data = await readBody(res);
  if (isPending(data)) data = await poll(endpoint, data);
  const err = (data as { error?: unknown })?.error;
  if (typeof err === "string") {
    throw new Error(`[orangeslice] ${endpoint}: ${err}`);
  }
  return data;
}

// ---- High-level helpers (the enrichment surface we use) ----

export interface ScrapeResult {
  markdown?: string;
  links?: string[];
  data?: Array<{ markdown?: string; links?: string[] }>;
}

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  return (await osPost("/execute/firecrawl", {
    url,
    limit: 1,
    scrapeOptions: {
      formats: ["markdown", "links"],
      onlyMainContent: true,
      blockAds: true,
      removeBase64Images: true,
      timeout: 30000,
    },
  })) as ScrapeResult;
}

export interface WebSearchResult {
  title: string;
  link: string;
  displayed_link?: string;
  snippet?: string;
}
export interface WebSearchResponse {
  results: WebSearchResult[];
  knowledgeGraph?: { description?: string; title?: string };
}

export async function webSearch(
  query: string,
  opts: { domain?: string } = {},
): Promise<WebSearchResponse> {
  return (await osPost("/execute/serp", {
    query,
    ...(opts.domain ? { domain: opts.domain } : {}),
  })) as WebSearchResponse;
}

export async function generateObject<T = Record<string, unknown>>(
  prompt: string,
  schema: Record<string, unknown>,
  opts: { system?: string; intelligence?: "low" | "medium" } = {},
): Promise<T> {
  const data = (await osPost("/execute/llm", {
    mode: "object",
    prompt,
    schemaJson: schema,
    intelligence: opts.intelligence ?? "low",
    ...(opts.system ? { system: opts.system } : {}),
  })) as { object?: T };
  return (data && data.object !== undefined ? data.object : (data as unknown)) as T;
}
