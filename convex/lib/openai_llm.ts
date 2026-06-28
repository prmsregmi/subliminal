// OpenAI Chat Completions client — the OpenAI side of the LLM provider facade
// (convex/lib/llm.ts). Mirrors the Anthropic transport: forces a single function
// call so every response is validated JSON. Plain fetch (no SDK) for the default
// Convex runtime. Function-calling (not strict json_schema) so the existing
// schemas with optional fields work unchanged.
import type { StructuredCallOpts } from "./anthropic";

const API_URL = "https://api.openai.com/v1/chat/completions";

// gpt-5.x / o-series are reasoning models: their reasoning tokens count toward
// max_completion_tokens on Chat Completions, so add headroom over the caller's
// output budget (a cap only bills tokens actually generated) and bound reasoning
// cost with reasoning_effort — "low" for these small structured calls, override
// via OPENAI_REASONING_EFFORT.
const REASONING_MODEL = /^(gpt-5|o\d)/i;
const REASONING_HEADROOM = 8000;

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) {
    throw new Error("OPENAI_API_KEY not set in Convex env. Run `pnpm run secrets`.");
  }
  return k;
}

export function hasOpenAICreds(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Force one function call and return its validated arguments object. */
export async function callStructured<T = Record<string, unknown>>(
  opts: StructuredCallOpts,
): Promise<T> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const reasoning = REASONING_MODEL.test(opts.model);
  const body = {
    model: opts.model,
    max_completion_tokens: (opts.maxTokens ?? 1024) + (reasoning ? REASONING_HEADROOM : 0),
    ...(reasoning ? { reasoning_effort: process.env.OPENAI_REASONING_EFFORT ?? "low" } : {}),
    messages,
    tools: [
      {
        type: "function",
        function: {
          name: opts.toolName,
          description: opts.toolDescription,
          parameters: opts.schema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: opts.toolName } },
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`[openai] ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: {
        refusal?: string | null;
        tool_calls?: Array<{ function?: { arguments?: string } }>;
      };
    }>;
  };
  const choice = data.choices?.[0];
  const args = choice?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) {
    // Distinguish a refusal / truncation from a genuine empty call. With gpt-5.x
    // reasoning models, reasoning tokens count toward max_completion_tokens — a
    // "length" finish_reason means the budget was too low for both reasoning and
    // the JSON output; raise that role's maxTokens.
    const why = choice?.message?.refusal
      ? `refusal: ${choice.message.refusal}`
      : `finish_reason: ${choice?.finish_reason ?? "unknown"}`;
    throw new Error(`[openai] no function call (${why})`);
  }
  try {
    return JSON.parse(args) as T;
  } catch {
    throw new Error(`[openai] function arguments were not valid JSON: ${args.slice(0, 200)}`);
  }
}
