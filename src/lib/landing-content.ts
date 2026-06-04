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

export const defaultLandingLocale = "en" satisfies LandingLocale;

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
        body: "Landing copy is structured for future English, Polish, and Russian UI text without adding the switcher in this slice.",
      },
    ],
  },
} satisfies Partial<Record<LandingLocale, LandingContent>> & Record<typeof defaultLandingLocale, LandingContent>;

export const landingContent = landingContentByLocale[defaultLandingLocale];
