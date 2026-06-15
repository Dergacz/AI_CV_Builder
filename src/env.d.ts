declare namespace App {
  interface Locals {
    locale: import("@/lib/i18n/locales").UiLocale;
    user: import("@supabase/supabase-js").User | null;
    observability: import("@/lib/observability").Identity;
  }
}
