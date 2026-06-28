// OpenAI embeddings client (text-embedding-3-small, 1536-d). Optional: when
// OPENAI_API_KEY is unset, RAG retrieval degrades to Convex full-text search —
// mirroring the Reddit→mock graceful-fallback pattern elsewhere in this backend.
// Plain fetch so it runs in the default Convex runtime (no Node deps).

const MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

// Whether semantic (vector) RAG is available. When false, subreddit matching
// falls back to lexical full-text search over descriptions.
export function hasEmbeddingCreds(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Embed a batch of strings in one request. OpenAI returns results out of order
// under load, so we re-sort by `index` before mapping back.
export async function embed(inputs: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set in Convex env.");
  if (inputs.length === 0) return [];
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: MODEL, input: inputs, encoding_format: "float" }),
  });
  if (!res.ok) {
    throw new Error(`[embeddings] ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data?: Array<{ embedding: number[]; index: number }>;
  };
  return (data.data ?? [])
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((r) => r.embedding);
}

export async function embedOne(text: string): Promise<number[]> {
  const [vec] = await embed([text]);
  return vec;
}
