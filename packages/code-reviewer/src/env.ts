import { z } from "zod";

/**
 * Runtime configuration. Everything except the API key has a sane default so
 * the package can be embedded without a full env setup.
 */
export const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  /** Any model id from https://openrouter.ai/models */
  OPENROUTER_MODEL: z.string().min(1).default("anthropic/claude-sonnet-5"),
  /** Shown on the OpenRouter dashboard (X-OpenRouter-Title header). */
  OPENROUTER_APP_NAME: z.string().min(1).default("10x-code-reviewer"),
  /** Shown on the OpenRouter dashboard (HTTP-Referer header). */
  OPENROUTER_APP_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Parses and validates env vars, turning zod issues into one readable error. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}
