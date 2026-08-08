declare namespace App {
  interface Locals {
    locale: import("@/lib/i18n/locales").UiLocale;
    user: import("@supabase/supabase-js").User | null;
    observability: import("@/lib/observability").Identity;
    /**
     * Cloudflare's execution context, injected by @astrojs/cloudflare. This is the Astro 6
     * spelling — `locals.runtime.ctx` was removed. Optional because dev/node has no Worker
     * runtime. Used to keep fire-and-forget observability emits alive past the response.
     */
    cfContext?: { waitUntil?(promise: Promise<unknown>): void };
  }
}
