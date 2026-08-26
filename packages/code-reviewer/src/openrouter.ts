import { createOpenRouter, type OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

import { loadEnv, type Env } from "./env.ts";

export interface ProviderBundle {
  /** Validated configuration this provider was built from. */
  env: Env;
  /** OpenRouter provider instance — use it for other models, embeddings, etc. */
  provider: OpenRouterProvider;
  /** The model configured via `OPENROUTER_MODEL`. */
  model: LanguageModel;
}

/**
 * Builds the OpenRouter provider and the default model.
 * Pass `env` explicitly to bypass `process.env` (tests, multi-tenant callers).
 */
export function createProvider(env: Env = loadEnv()): ProviderBundle {
  const provider = createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    // `strict` is correct when talking to OpenRouter itself (not a proxy).
    compatibility: "strict",
    appName: env.OPENROUTER_APP_NAME,
    ...(env.OPENROUTER_APP_URL ? { appUrl: env.OPENROUTER_APP_URL } : {}),
  });

  return { env, provider, model: provider(env.OPENROUTER_MODEL) };
}
