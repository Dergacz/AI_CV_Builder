import type { UiLocale } from "@/lib/i18n/locales";

export interface UiMessages {
  shell: {
    languageSwitcher: {
      label: string;
      current: string;
      switchTo: Record<UiLocale, string>;
    };
    configBanner: {
      warningPrefix: string;
      docsFallback: string;
      messages: Record<string, string>;
    };
  };
}

export const messagesByLocale = {
  en: {
    shell: {
      languageSwitcher: {
        label: "Interface language",
        current: "Current interface language",
        switchTo: {
          en: "Switch interface to English",
          pl: "Switch interface to Polish",
          ru: "Switch interface to Russian",
        },
      },
      configBanner: {
        warningPrefix: "Warning:",
        docsFallback: "Configuration guide",
        messages: {
          Supabase: "Supabase is not configured - authentication features are disabled.",
        },
      },
    },
  },
  pl: {
    shell: {
      languageSwitcher: {
        label: "Język interfejsu",
        current: "Aktualny język interfejsu",
        switchTo: {
          en: "Przełącz interfejs na angielski",
          pl: "Przełącz interfejs na polski",
          ru: "Przełącz interfejs na rosyjski",
        },
      },
      configBanner: {
        warningPrefix: "Uwaga:",
        docsFallback: "Instrukcja konfiguracji",
        messages: {
          Supabase: "Supabase nie jest skonfigurowany - funkcje uwierzytelniania są wyłączone.",
        },
      },
    },
  },
  ru: {
    shell: {
      languageSwitcher: {
        label: "Язык интерфейса",
        current: "Текущий язык интерфейса",
        switchTo: {
          en: "Переключить интерфейс на английский",
          pl: "Переключить интерфейс на польский",
          ru: "Переключить интерфейс на русский",
        },
      },
      configBanner: {
        warningPrefix: "Внимание:",
        docsFallback: "Инструкция по настройке",
        messages: {
          Supabase: "Supabase не настроен - функции входа и регистрации отключены.",
        },
      },
    },
  },
} satisfies Record<UiLocale, UiMessages>;

export function getMessages(locale: UiLocale): UiMessages {
  return messagesByLocale[locale];
}
