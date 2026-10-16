export type AssistantMode =
  | "chat"
  | "writing"
  | "coding"
  | "documents"
  | "summarizer"
  | "translation"
  | "research";

export type ProviderId = "gemini" | "openrouter";

export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ResearchSource = {
  title: string;
  url: string;
  content: string;
};

export type StreamChunk = { text?: string | null };

export interface AIProvider {
  stream(
    messages: ConversationMessage[],
    systemInstruction: string,
  ): Promise<AsyncIterable<StreamChunk>>;
}