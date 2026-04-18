// TODO: Phase N — implement this prompt
// See AI_JOB_SPECS.md for full specification.
import { z } from "zod";
import { getProvider } from "@/lib/ai/provider";

export const systemPrompt = "TODO: implement system prompt for generate-cycle-review";

export function buildUserPrompt(input: unknown): string {
  return JSON.stringify(input);
}

export const responseSchema = z.object({}).passthrough();

export async function run(input: unknown) {
  const provider = getProvider();
  if (!provider.available) throw new Error("AI provider is disabled");
  return provider.call(
    { name: "generate-cycle-review", systemPrompt, buildUserPrompt, responseSchema, model: "sonnet" },
    input
  );
}
