import { OpenRouter } from "@openrouter/sdk";
import type { AIProvider, ConversationMessage, StreamChunk } from "./provider";

function isAsyncIterable(value: unknown): value is AsyncIterable<{
  error?: { message?: string };
  choices?: { delta?: { content?: string | null } }[];
}> {
  return typeof value === "object" && value !== null && Symbol.asyncIterator in value;
}

export function createOpenRouterProvider(): AIProvider {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  if (!apiKey) throw new Error("OpenRouter is not configured. Add OPENROUTER_API_KEY to .env.local.");

  const client = new OpenRouter({ apiKey });
  return {
    async stream(messages: ConversationMessage[], systemInstruction: string): Promise<AsyncIterable<StreamChunk>> {
      const response = await client.chat.send({
        chatRequest: {
          model,
          stream: true,
          messages: [
            { role: "system", content: systemInstruction },
            ...messages.map((message) => ({ role: message.role, content: message.content })),
          ],
        },
      });

      if (!isAsyncIterable(response)) throw new Error("OpenRouter returned a non-streaming response.");

      return (async function* () {
        for await (const chunk of response) {
          if (chunk.error) throw new Error(chunk.error.message || "OpenRouter stream failed.");
          const text = chunk.choices?.[0]?.delta?.content;
          if (text) yield { text };
        }
      })();
    },
  };
}