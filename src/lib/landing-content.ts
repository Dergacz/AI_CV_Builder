import { defaultUiLocale, type UiLocale } from "@/lib/i18n/locales";

export const landingLocales = ["en", "pl", "ru"] as const;

export type LandingLocale = (typeof landingLocales)[number];

export interface LandingContent {
  nav: {
    productName: string;
    signIn: string;
    dashboard: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: {
      signedOut: string;
      signedIn: string;
    };
    secondaryCta: {
      signedOut: string;
      signedIn: string;
    };
  };
  preview: {
    label: string;
    name: string;
    role: string;
    summary: string;
    sections: string[];
  };
  process: {
    step: string;
    title: string;
    body: string;
  }[];
  trustNotes: {
    title: string;
    body: string;
  }[];
}

export const defaultLandingLocale = defaultUiLocale satisfies LandingLocale;

export const landingContentByLocale = {
  en: {
    nav: {
      productName: "AI CV Builder",
      signIn: "Sign in",
      dashboard: "Workspace",
    },
    hero: {
      eyebrow: "For the blank-page moment",
      title: "Turn simple answers into a professional CV draft",
      body: "AI CV Builder helps you describe your experience in everyday words, then organizes those answers into a clean CV you can edit and export.",
      primaryCta: {
        signedOut: "Start your CV",
        signedIn: "Continue to workspace",
      },
      secondaryCta: {
        signedOut: "Sign in",
        signedIn: "Open workspace",
      },
    },
    preview: {
      label: "CV draft preview",
      name: "Your name",
      role: "Professional summary",
      summary: "A concise CV draft based on your answers, ready for section-by-section review before you export it.",
      sections: ["Experience", "Education", "Skills", "Languages"],
    },
    process: [
      {
        step: "01",
        title: "Answer simple questions",
        body: "Start from scratch with prompts written in plain language, not resume jargon.",
      },
      {
        step: "02",
        title: "Review an AI-structured draft",
        body: "The app improves wording and organization while keeping the facts grounded in what you provided.",
      },
      {
        step: "03",
        title: "Edit sections and export",
        body: "Keep the flow focused: adjust named CV sections, save your work, and export a clean PDF later in the MVP.",
      },
    ],
    trustNotes: [
      {
        title: "No invented career facts",
        body: "The draft should rephrase and organize your answers, not create employers, schools, dates, or achievements you did not provide.",
      },
      {
        title: "One focused template",
        body: "The MVP stays away from complex layout editing so the first CV can be finished quickly.",
      },
      {
        title: "Ready for lightweight i18n",
        body: "Landing copy is structured for English, Polish, and Russian UI text without changing the route shape.",
      },
    ],
  },
  pl: {
    nav: {
      productName: "AI CV Builder",
      signIn: "Zaloguj się",
      dashboard: "Przestrzeń",
    },
    hero: {
      eyebrow: "Na moment pustej strony",
      title: "Zamień proste odpowiedzi w profesjonalny szkic CV",
      body: "AI CV Builder pomaga opisać doświadczenie codziennym językiem, a potem układa odpowiedzi w czyste CV gotowe do edycji i eksportu.",
      primaryCta: {
        signedOut: "Rozpocznij CV",
        signedIn: "Przejdź do przestrzeni",
      },
      secondaryCta: {
        signedOut: "Zaloguj się",
        signedIn: "Otwórz przestrzeń",
      },
    },
    preview: {
      label: "Podgląd szkicu CV",
      name: "Twoje imię i nazwisko",
      role: "Podsumowanie zawodowe",
      summary:
        "Zwięzły szkic CV oparty na Twoich odpowiedziach, gotowy do przejrzenia sekcja po sekcji przed eksportem.",
      sections: ["Doświadczenie", "Edukacja", "Umiejętności", "Języki"],
    },
    process: [
      {
        step: "01",
        title: "Odpowiedz na proste pytania",
        body: "Zacznij od zera z podpowiedziami napisanymi prostym językiem, bez żargonu CV.",
      },
      {
        step: "02",
        title: "Przejrzyj szkic ułożony przez AI",
        body: "Aplikacja poprawia brzmienie i strukturę, ale trzyma się faktów podanych przez Ciebie.",
      },
      {
        step: "03",
        title: "Edytuj sekcje i eksportuj",
        body: "Pracuj w skupionym przepływie: popraw sekcje CV, zapisz pracę i wyeksportuj czysty PDF.",
      },
    ],
    trustNotes: [
      {
        title: "Bez wymyślonych faktów",
        body: "Szkic powinien przeredagować i uporządkować odpowiedzi, a nie tworzyć pracodawców, szkół, dat ani osiągnięć, których nie podałeś.",
      },
      {
        title: "Jeden skupiony szablon",
        body: "MVP unika złożonej edycji układu, żeby pierwsze CV można było skończyć szybko.",
      },
      {
        title: "Interfejs w trzech językach",
        body: "Teksty interfejsu są dostępne po angielsku, polsku i rosyjsku bez zmiany adresów URL.",
      },
    ],
  },
  ru: {
    nav: {
      productName: "AI CV Builder",
      signIn: "Войти",
      dashboard: "Пространство",
    },
    hero: {
      eyebrow: "Когда перед вами пустая страница",
      title: "Превратите простые ответы в профессиональный черновик CV",
      body: "AI CV Builder помогает описать опыт обычными словами, а затем организует ответы в аккуратное CV, которое можно редактировать и экспортировать.",
      primaryCta: {
        signedOut: "Начать CV",
        signedIn: "Перейти в пространство",
      },
      secondaryCta: {
        signedOut: "Войти",
        signedIn: "Открыть пространство",
      },
    },
    preview: {
      label: "Предпросмотр черновика CV",
      name: "Ваше имя",
      role: "Профессиональное резюме",
      summary: "Краткий черновик CV на основе ваших ответов, готовый к проверке по разделам перед экспортом.",
      sections: ["Опыт", "Образование", "Навыки", "Языки"],
    },
    process: [
      {
        step: "01",
        title: "Ответьте на простые вопросы",
        body: "Начните с нуля с подсказками на обычном языке, без резюме-жаргона.",
      },
      {
        step: "02",
        title: "Проверьте структурированный AI черновик",
        body: "Приложение улучшает формулировки и структуру, но опирается на факты, которые вы указали.",
      },
      {
        step: "03",
        title: "Редактируйте разделы и экспортируйте",
        body: "Сохраняйте фокус: правьте разделы CV, сохраняйте работу и экспортируйте аккуратный PDF.",
      },
    ],
    trustNotes: [
      {
        title: "Без вымышленных фактов о карьере",
        body: "Черновик должен переформулировать и упорядочить ваши ответы, а не придумывать работодателей, учебные заведения, даты или достижения.",
      },
      {
        title: "Один понятный шаблон",
        body: "MVP избегает сложного редактирования макета, чтобы первое CV можно было закончить быстро.",
      },
      {
        title: "Интерфейс на трёх языках",
        body: "Тексты интерфейса доступны на английском, польском и русском без изменения URL.",
      },
    ],
  },
} satisfies Record<LandingLocale, LandingContent>;

export const landingContent = landingContentByLocale[defaultLandingLocale];

export function getLandingContent(locale: UiLocale): LandingContent {
  return landingContentByLocale[locale];
}
