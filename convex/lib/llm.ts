// LLM provider facade. Call sites pass a ROLE ("classify" | "draft" | "critic")
// instead of a concrete model id; this resolves the model and routes the call to
// Anthropic (default) or OpenAI based on the LLM_PROVIDER env var. Swapping
// providers is a single env flip — no code change.
import { callStructured as anthropicCall, type StructuredCallOpts } from "./anthropic";
import { callStructured as openaiCall } from "./openai_llm";
import { LLM_MODELS, type LlmRole } from "../constants";

export type LlmProvider = "anthropic" | "openai";

export function llmProvider(): LlmProvider {
  return process.env.LLM_PROVIDER === "openai" ? "openai" : "anthropic";
}

// Whether the active provider's key is configured. Drives the mock's live-vs-
// offline path the same way regardless of which provider is selected.
export function hasLLMCreds(): boolean {
  return llmProvider() === "openai"
    ? Boolean(process.env.OPENAI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

// Concrete model id for a role on the active provider. OpenAI ids are overridable
// via OPENAI_MODEL_<ROLE> so you can bump models without a deploy.
export function resolveModel(role: LlmRole): string {
  const provider = llmProvider();
  if (provider === "openai") {
    const override = process.env[`OPENAI_MODEL_${role.toUpperCase()}`];
    if (override) return override;
  }
  return LLM_MODELS[provider][role];
}

export interface RoleCallOpts extends Omit<StructuredCallOpts, "model"> {
  role: LlmRole;
}

export async function callStructured<T = Record<string, unknown>>(
  opts: RoleCallOpts,
): Promise<T> {
  const { role, ...rest } = opts;
  const transportOpts: StructuredCallOpts = { ...rest, model: resolveModel(role) };
  return llmProvider() === "openai"
    ? openaiCall<T>(transportOpts)
    : anthropicCall<T>(transportOpts);
}
