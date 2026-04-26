// POST /api/chat — stream a chat response, save to ChatMessage table
// DELETE /api/chat — clear all chat history
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { assembleContext } from "@/lib/chat/assemble-context";
import { buildSystemPrompt, CHAT_MODEL, CHAT_MAX_TOKENS, CHAT_TEMPERATURE } from "@/lib/prompts/answer-query";
import { getProvider } from "@/lib/ai/provider";

const Body = z.object({ message: z.string().min(1).max(4000) });

export async function GET() {
  const messages = await db.chatMessage.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ data: messages });
}

export async function DELETE() {
  await db.chatMessage.deleteMany({});
  return NextResponse.json({ status: "cleared" });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const { message } = parsed.data;

  const provider = getProvider();
  if (!provider.available) {
    return NextResponse.json({
      error: "AI disabled. Enable AI_MODE=anthropicDirect in .env.local to use chat.",
      aiDisabled: true,
    }, { status: 503 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  // Assemble team context
  const { snapshotText } = await assembleContext();
  const systemPrompt = buildSystemPrompt(snapshotText);

  // Load conversation history
  const history = await db.chatMessage.findMany({
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  const messages = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  // Save user message immediately
  await db.chatMessage.create({
    data: { role: "user", content: message, citations: "[]" },
  });

  // Call Anthropic with stream: true
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      temperature: CHAT_TEMPERATURE,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!anthropicRes.ok || !anthropicRes.body) {
    const err = await anthropicRes.text();
    return NextResponse.json({ error: `Anthropic error: ${err}` }, { status: 500 });
  }

  // Collect full text while streaming to client
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body!.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const event = JSON.parse(data);
              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                const text = event.delta.text as string;
                fullText += text;
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            } catch { /* skip malformed SSE lines */ }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Extract citations from the completed response
      const citationPattern = /\[([a-z-]+):([a-zA-Z0-9]+)\]/g;
      const citations: { entityType: string; entityId: string }[] = [];
      let match;
      while ((match = citationPattern.exec(fullText)) !== null) {
        citations.push({ entityType: match[1], entityId: match[2] });
      }

      // Save assistant message
      await db.chatMessage.create({
        data: {
          role: "assistant",
          content: fullText,
          citations: JSON.stringify(citations),
        },
      }).catch(console.error);

      // Send citations as final SSE event
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true, citations })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
