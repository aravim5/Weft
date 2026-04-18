// AI-optional: see PERSONAL_CLAUDE_BUILD_PLAN.md §3
// Four-provider abstraction so the tool runs fully offline at work (AI_MODE=disabled)
// and uses Claude directly at home (AI_MODE=anthropicDirect).

import { z } from "zod";

export interface AIJob<T> {
  name: string;
  systemPrompt: string;
  buildUserPrompt: (input: unknown) => string;
  responseSchema: z.ZodSchema<T>;
  model: "haiku" | "sonnet";
}

export interface ModelProvider {
  name: string;
  available: boolean;
  call<T>(job: AIJob<T>, input: unknown): Promise<T>;
}

// disabled — returns a stub so UI can show "Enter manually"
const disabledProvider: ModelProvider = {
  name: "disabled",
  available: false,
  async call<T>(_job: AIJob<T>, _input: unknown): Promise<T> {
    throw new Error("AI provider is disabled. Set AI_MODE in .env.local to enable.");
  },
};

// anthropicDirect — calls api.anthropic.com via fetch (no SDK import at top level)
const anthropicDirectProvider: ModelProvider = {
  name: "anthropicDirect",
  available: true,
  async call<T>(job: AIJob<T>, input: unknown): Promise<T> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const modelId =
      job.model === "haiku" ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 4096,
        system: job.systemPrompt,
        messages: [{ role: "user", content: job.buildUserPrompt(input) }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    // Parse JSON from the response
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ?? text.match(/(\{[\s\S]*\})/);
    const raw = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(text);

    return job.responseSchema.parse(raw);
  },
};

// clipboard — generates prompt text, stores for dialog, resolves when user pastes response
const clipboardProvider: ModelProvider = {
  name: "clipboard",
  available: false, // Set to true when clipboard bridge UI is built
  async call<T>(_job: AIJob<T>, _input: unknown): Promise<T> {
    throw new Error("Clipboard provider not yet implemented.");
  },
};

// bedrock — stub for future AWS Bedrock access
const bedrockProvider: ModelProvider = {
  name: "bedrock",
  available: false,
  async call<T>(_job: AIJob<T>, _input: unknown): Promise<T> {
    throw new Error(
      "Bedrock provider not yet configured — see docs/BEDROCK_UPGRADE.md"
    );
  },
};

export function getProvider(): ModelProvider {
  const mode = (process.env.AI_MODE ?? "disabled") as
    | "disabled"
    | "clipboard"
    | "anthropicDirect"
    | "bedrock";

  const providers: Record<string, ModelProvider> = {
    disabled: disabledProvider,
    clipboard: clipboardProvider,
    anthropicDirect: anthropicDirectProvider,
    bedrock: bedrockProvider,
  };

  return providers[mode] ?? disabledProvider;
}
