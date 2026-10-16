import { GoogleGenAI } from "@google/genai";
import type { AIProvider, ConversationMessage } from "./provider";

export function createGeminiProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;

  if (!apiKey) throw new Error("Gemini is not configured. Add GEMINI_API_KEY to .env.local.");
  if (!model) throw new Error("Gemini is not configured. Set GEMINI_MODEL to a model enabled for your API project.");

  const client = new GoogleGenAI({ apiKey });

  return {
    stream(messages: ConversationMessage[], systemInstruction: string) {
      return client.models.generateContentStream({
        model,
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        config: { systemInstruction },
      });
    },
  };
}