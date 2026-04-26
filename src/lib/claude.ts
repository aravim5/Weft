// Anthropic SDK wrapper — server-side only. Never import this from client components.
// Use getProvider() from ai/provider.ts in route handlers instead.
import Anthropic from "@anthropic-ai/sdk";
import type { ZodSchema } from "zod";

export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
export const MODEL_SONNET = "claude-sonnet-4-6";

// ── Cost tracker (in-memory, resets on server restart) ─────────────────────────
interface CostEntry {
  jobName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  calledAt: Date;
}

const COST_LOG: CostEntry[] = [];

// Approximate pricing per million tokens (as of 2025)
const PRICE_PER_M_IN: Record<string, number> = {
  [MODEL_HAIKU]: 0.80,
  [MODEL_SONNET]: 3.00,
};
const PRICE_PER_M_OUT: Record<string, number> = {
  [MODEL_HAIKU]: 4.00,
  [MODEL_SONNET]: 15.00,
};

function trackCost(jobName: string, model: string, inputTokens: number, outputTokens: number) {
  const inCost = (inputTokens / 1_000_000) * (PRICE_PER_M_IN[model] ?? 3.0);
  const outCost = (outputTokens / 1_000_000) * (PRICE_PER_M_OUT[model] ?? 15.0);
  const entry: CostEntry = { jobName, model, inputTokens, outputTokens, estimatedCostUsd: inCost + outCost, calledAt: new Date() };
  COST_LOG.push(entry);
  console.log(`[claude] ${jobName} | ${model} | in=${inputTokens} out=${outputTokens} | ~$${(inCost + outCost).toFixed(5)}`);
  return entry;
}

export function getCostLog(): CostEntry[] {
  return [...COST_LOG];
}

// ── Client singleton ────────────────────────────────────────────────────────────
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// ── Core call helpers ───────────────────────────────────────────────────────────

interface CallOptions {
  jobName: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

interface ToolCallOptions<T> extends CallOptions {
  toolName: string;
  toolDescription: string;
  toolSchema: Record<string, unknown>; // JSON Schema for the tool input
  responseSchema: ZodSchema<T>;
}

/** Call Claude and parse the response via tool use — for structured extraction jobs. */
export async function callWithTool<T>(
  model: string,
  opts: ToolCallOptions<T>
): Promise<T> {
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.2,
    system: opts.system,
    tools: [{
      name: opts.toolName,
      description: opts.toolDescription,
      input_schema: { type: "object" as const, ...opts.toolSchema },
    }],
    tool_choice: { type: "tool" as const, name: opts.toolName },
    messages: [{ role: "user", content: opts.user }],
  });

  trackCost(opts.jobName, model, response.usage.input_tokens, response.usage.output_tokens);

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(`[${opts.jobName}] No tool_use block in response`);
  }

  const parsed = opts.responseSchema.safeParse(toolBlock.input);
  if (!parsed.success) {
    console.error(`[${opts.jobName}] Zod validation failed:`, parsed.error.issues);
    console.error("Raw input:", JSON.stringify(toolBlock.input, null, 2));
    throw new Error(`[${opts.jobName}] Response schema validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}

/** Call Claude and return plain text — for read-only/streaming jobs (briefs, chat). */
export async function callText(
  model: string,
  opts: CallOptions
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.4,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  trackCost(opts.jobName, model, response.usage.input_tokens, response.usage.output_tokens);

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}

// ── Convenience wrappers ────────────────────────────────────────────────────────

export async function callHaiku<T>(
  jobName: string,
  system: string,
  user: string,
  toolOpts: { toolName: string; toolDescription: string; toolSchema: Record<string, unknown>; responseSchema: ZodSchema<T> },
  temperature = 0.1,
): Promise<T> {
  return callWithTool(MODEL_HAIKU, { jobName, system, user, temperature, ...toolOpts });
}

export async function callSonnet<T>(
  jobName: string,
  system: string,
  user: string,
  toolOpts: { toolName: string; toolDescription: string; toolSchema: Record<string, unknown>; responseSchema: ZodSchema<T> },
  temperature = 0.3,
): Promise<T> {
  return callWithTool(MODEL_SONNET, { jobName, system, user, temperature, ...toolOpts });
}

export async function callSonnetText(
  jobName: string,
  system: string,
  user: string,
  temperature = 0.4,
): Promise<string> {
  return callText(MODEL_SONNET, { jobName, system, user, temperature });
}
