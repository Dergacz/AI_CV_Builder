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

  // `usage.include` is a per-model setting, not a provider one. It makes OpenRouter
  // report what it actually charged under `providerMetadata.openrouter.usage.cost` —
  // the vendor's own accounting rather than a price table that goes stale.
  return { env, provider, model: provider(env.OPENROUTER_MODEL, { usage: { include: true } }) };
}

/**
 * A model handle for one specific model id, on the configured key.
 *
 * Exists so callers outside this package (the eval harness) can pick a model
 * without importing `@openrouter/ai-sdk-provider` themselves — it lives in this
 * package's node_modules, and a sibling directory cannot resolve it.
 */
export function createModel(modelId: string, env: Env = loadEnv()): LanguageModel {
  return createProvider(env).provider(modelId, { usage: { include: true } });
}
