// Anthropic Messages API client (raw fetch; runs in the default Convex runtime,
// no Node SDK / "use node" needed). We force a single structured tool call so
// every response is validated JSON we can rely on.

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function apiKey(): string {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) {
    throw new Error("ANTHROPIC_API_KEY not set in Convex env. Run `pnpm run secrets`.");
  }
  return k;
}

export interface StructuredCallOpts {
  model: string;
  prompt: string;
  system?: string;
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}

/** Force one tool call and return its validated input object. */
export async function callStructured<T = Record<string, unknown>>(
  opts: StructuredCallOpts,
): Promise<T> {
  const body = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: "user", content: opts.prompt }],
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: opts.schema,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey(),
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`[anthropic] ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; input?: unknown }>;
  };
  const toolBlock = (data.content ?? []).find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.input === undefined) {
    throw new Error("[anthropic] response had no tool_use block");
  }
  return toolBlock.input as T;
}
