import { createGeminiProvider } from "./gemini";
import { createOpenRouterProvider } from "./openrouter";
import type { AIProvider, ProviderId } from "./provider";

export type ProviderStatus = {
  id: ProviderId;
  label: string;
  configured: boolean;
  model: string;
  freeTier: boolean;
};

export function getProviderStatuses(): ProviderStatus[] {
  return [
    {
      id: "gemini",
      label: "Google Gemini",
      configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL),
      model: process.env.GEMINI_MODEL || "",
      freeTier: true,
    },
    {
      id: "openrouter",
      label: "OpenRouter",
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      freeTier: true,
    },
  ];
}

export function getDefaultProviderId(): ProviderId {
  const statuses = getProviderStatuses();
  const preferred = process.env.AI_PROVIDER;
  if ((preferred === "gemini" || preferred === "openrouter") && statuses.find((provider) => provider.id === preferred)?.configured) {
    return preferred;
  }
  return statuses.find((provider) => provider.configured)?.id || "gemini";
}

export function createAIProvider(providerId: ProviderId): AIProvider {
  return providerId === "openrouter" ? createOpenRouterProvider() : createGeminiProvider();
}