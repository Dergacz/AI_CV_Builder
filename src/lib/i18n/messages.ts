import type { UiLocale } from "@/lib/i18n/locales";
import type { AuthErrorCode } from "@/lib/i18n/auth-errors";

export interface SignInFormCopy {
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submit: string;
  submitting: string;
  validation: {
    emailRequired: string;
    emailInvalid: string;
    passwordRequired: string;
  };
  passwordToggle: {
    show: string;
    hide: string;
  };
}

export interface SignUpFormCopy extends SignInFormCopy {
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  validation: SignInFormCopy["validation"] & {
    passwordTooShort: (minimum: number) => string;
    confirmPasswordRequired: string;
    passwordsMismatch: string;
    consentRequired: string;
  };
  passwordHint: (remaining: number) => string;
  /** Consent gate copy. The label is assembled as: prefix + Terms link + conjunction + Privacy link + suffix. */
  consent: {
    prefix: string;
    termsLabel: string;
    conjunction: string;
    privacyLabel: string;
    suffix: string;
  };
}

interface AuthPanelCopy {
  title: string;
  eyebrow: string;
  heading: string;
  description: string;
  formTitle: string;
  formDescription: string;
  alternatePrompt: string;
  alternateLink: string;
}

interface ConfirmEmailStateCopy {
  title: string;
  eyebrow: string;
  description: string;
  linkText: string;
}

interface ConfirmEmailPendingCopy extends ConfirmEmailStateCopy {
  resendButton: string;
  resendSent: string;
  resendError: string;
}

interface QuestionnaireStepCopy {
  label: string;
  title: string;
  body: string;
}

interface LegalCopy {
  terms: {
    title: string;
  };
  privacy: {
    title: string;
  };
  versionLabel: string;
  lastUpdatedLabel: string;
  reviewNotice: string;
  englishNote: string;
  backLabel: string;
}

interface FooterCopy {
  termsLabel: string;
  privacyLabel: string;
  rights: (year: number) => string;
}

export interface QuestionnaireCopy {
  ariaLabel: string;
  progressAriaLabel: string;
  versionLabel: string;
  stepProgress: (current: number, total: number) => string;
  steps: {
    basics: QuestionnaireStepCopy;
    experienceEducation: QuestionnaireStepCopy;
    skillsLanguages: QuestionnaireStepCopy;
    extraContext: QuestionnaireStepCopy;
    review: QuestionnaireStepCopy;
  };
  basics: {
    fullNameLabel: string;
    fullNamePlaceholder: string;
    targetRoleLabel: string;
    targetRolePlaceholder: string;
    outputLanguageLegend: string;
  };
  experienceStep: {
    experienceLabel: string;
    experiencePlaceholder: string;
    educationLabel: string;
    educationPlaceholder: string;
  };
  skillsStep: {
    skillsLabel: string;
    skillsPlaceholder: string;
    spokenLanguagesLabel: string;
    spokenLanguagesPlaceholder: string;
  };
  extraContext: {
    label: string;
    placeholder: string;
    note: string;
  };
  /** Display names of the CV output languages, expressed in the interface locale. */
  outputLanguageNames: Record<UiLocale, string>;
  review: {
    intro: string;
    sparseNotesAriaLabel: string;
    sparseTitle: string;
    editButton: string;
    emptyValue: string;
    labels: {
      name: string;
      targetRole: string;
      outputLanguage: string;
      experience: string;
      education: string;
      skills: string;
      spokenLanguages: string;
      additionalContext: string;
    };
  };
  loadingText: string;
  errorRetrySuffix: string;
  validation: {
    fullNameRequired: string;
    targetRoleRequired: string;
  };
  sparseWarnings: {
    experience: string;
    education: string;
    skills: string;
    spokenLanguages: string;
  };
  buttons: {
    back: string;
    next: string;
    reviewAnswers: string;
    generate: string;
    building: string;
    tryAgain: string;
  };
}

export interface UiMessages {
  shell: {
    primaryNavLabel: string;
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
  auth: {
    brand: string;
    signin: AuthPanelCopy;
    signup: AuthPanelCopy;
    confirmEmail: {
      autoConfirmed: ConfirmEmailStateCopy;
      emailConfirmation: ConfirmEmailPendingCopy;
    };
    form: {
      signin: SignInFormCopy;
      signup: SignUpFormCopy;
    };
    errors: Record<AuthErrorCode, string>;
  };
  dashboard: {
    title: string;
    brand: string;
    signedInAs: string;
    signOut: string;
    signOutError: string;
    hero: {
      eyebrow: string;
      heading: string;
      description: string;
      startCta: string;
      overviewCta: string;
    };
    status: {
      ariaLabel: string;
      title: string;
      accountAccess: string;
      accountActive: string;
      questionnaire: string;
      questionnaireReady: string;
      savedCvs: string;
      savedCount: (count: number) => string;
      unavailable: string;
    };
    library: {
      ariaLabel: string;
      title: string;
      description: string;
      loadErrorTitle: string;
      loadErrorBody: string;
      startCta: string;
    };
  };
  cvPages: {
    new: {
      title: string;
      backToWorkspace: string;
      eyebrow: string;
      heading: string;
      description: string;
    };
    saved: {
      backToWorkspace: string;
      eyebrow: string;
      description: string;
    };
  };
  legal: LegalCopy;
  footer: FooterCopy;
  questionnaire: QuestionnaireCopy;
}

export const messagesByLocale = {
  en: {
    shell: {
      primaryNavLabel: "Primary navigation",
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
    auth: {
      brand: "AI CV Builder",
      signin: {
        title: "Sign in",
        eyebrow: "Account access",
        heading: "Sign in to your CV workspace",
        description: "Continue from your protected workspace and prepare for the guided CV flow.",
        formTitle: "Sign in",
        formDescription: "Use the email and password for your AI CV Builder account.",
        alternatePrompt: "Don't have an account?",
        alternateLink: "Sign up",
      },
      signup: {
        title: "Sign up",
        eyebrow: "Start your account",
        heading: "Create your CV workspace",
        description: "Set up account access first. The guided CV questionnaire comes next.",
        formTitle: "Create account",
        formDescription: "Use an email you can access for your CV workspace.",
        alternatePrompt: "Already have an account?",
        alternateLink: "Sign in",
      },
      confirmEmail: {
        autoConfirmed: {
          title: "Registration successful",
          eyebrow: "Account ready",
          description: "Your account is ready. Sign in to open your CV workspace.",
          linkText: "Go to sign in",
        },
        emailConfirmation: {
          title: "Check your email",
          eyebrow: "Confirm your account",
          description: "We've sent a confirmation link to your email address. Open it to activate your CV workspace.",
          linkText: "Back to sign in",
          resendButton: "Resend confirmation email",
          resendSent: "We sent a new confirmation email. Check your inbox.",
          resendError: "We could not resend the confirmation email. Please check the address and try again.",
        },
      },
      form: {
        signin: {
          emailLabel: "Email",
          emailPlaceholder: "you@example.com",
          passwordLabel: "Password",
          passwordPlaceholder: "Your password",
          submit: "Sign in",
          submitting: "Signing in...",
          validation: {
            emailRequired: "Email is required",
            emailInvalid: "Enter a valid email address",
            passwordRequired: "Password is required",
          },
          passwordToggle: {
            show: "Show password",
            hide: "Hide password",
          },
        },
        signup: {
          emailLabel: "Email",
          emailPlaceholder: "you@example.com",
          passwordLabel: "Password",
          passwordPlaceholder: "Min. 6 characters",
          confirmPasswordLabel: "Confirm password",
          confirmPasswordPlaceholder: "Re-enter your password",
          submit: "Create account",
          submitting: "Creating account...",
          validation: {
            emailRequired: "Email is required",
            emailInvalid: "Enter a valid email address",
            passwordRequired: "Password is required",
            passwordTooShort: (minimum) => `Password must be at least ${minimum} characters`,
            confirmPasswordRequired: "Please confirm your password",
            passwordsMismatch: "Passwords do not match",
            consentRequired: "Please accept the Terms of Service and Privacy Policy to continue",
          },
          passwordToggle: {
            show: "Show password",
            hide: "Hide password",
          },
          passwordHint: (remaining) => `${remaining} more character${remaining === 1 ? "" : "s"} needed`,
          consent: {
            prefix: "I agree to the ",
            termsLabel: "Terms of Service",
            conjunction: " and ",
            privacyLabel: "Privacy Policy",
            suffix: ".",
          },
        },
      },
      errors: {
        auth_unavailable: "Account access is temporarily unavailable. Please try again later.",
        signin_failed: "We couldn't sign you in. Check your email and password, then try again.",
        signup_failed: "We couldn't create your account. Check your details, then try again.",
        consent_required: "Please accept the Terms of Service and Privacy Policy to create your account.",
        rate_limited: "Too many account attempts right now. Please wait a bit and try again.",
        email_not_confirmed: "Your email is not verified yet. Check your inbox or resend the confirmation email.",
      },
    },
    dashboard: {
      title: "CV Workspace",
      brand: "AI CV Builder",
      signedInAs: "Signed in as",
      signOut: "Sign out",
      signOutError: "Sign-out failed. Please try again.",
      hero: {
        eyebrow: "Your CV workspace",
        heading: "Start from a calm place, then build the CV step by step",
        description:
          "This protected workspace is ready for your CV flow. Start with the guided questionnaire, then save and reopen your CVs from the library below.",
        startCta: "Start CV",
        overviewCta: "Back to overview",
      },
      status: {
        ariaLabel: "Workspace status",
        title: "Workspace status",
        accountAccess: "Account access",
        accountActive: "Active",
        questionnaire: "Guided questionnaire",
        questionnaireReady: "Ready to start",
        savedCvs: "Saved CVs",
        savedCount: (count) => `${count} saved`,
        unavailable: "Unavailable",
      },
      library: {
        ariaLabel: "Saved CV library",
        title: "Your saved CVs",
        description: "Open a saved CV to keep editing, or start a new one.",
        loadErrorTitle: "Saved CVs could not be loaded",
        loadErrorBody: "Your CVs are still safe. Refresh the page or try again in a little while.",
        startCta: "Start a new CV",
      },
    },
    cvPages: {
      new: {
        title: "Start CV",
        backToWorkspace: "Back to workspace",
        eyebrow: "Guided questionnaire",
        heading: "Build your CV from simple answers",
        description:
          "Answer in everyday language, review what you provided, then generate your CV draft. From there you can edit each section, save it to your account, and export a clean PDF.",
      },
      saved: {
        backToWorkspace: "Back to workspace",
        eyebrow: "Saved CV",
        description: "Edit any section and save your changes. Updates overwrite this saved CV.",
      },
    },
    legal: {
      terms: {
        title: "Terms of Service",
      },
      privacy: {
        title: "Privacy Policy",
      },
      versionLabel: "Policy version",
      lastUpdatedLabel: "Last updated",
      reviewNotice: "Draft pending legal review. This content is provided for launch-readiness validation.",
      englishNote: "The binding document body is provided in English while localized legal translations are deferred.",
      backLabel: "Back",
    },
    footer: {
      termsLabel: "Terms of Service",
      privacyLabel: "Privacy Policy",
      rights: (year) => `© ${year} AI CV Builder. All rights reserved.`,
    },
    questionnaire: {
      ariaLabel: "CV questionnaire",
      progressAriaLabel: "Questionnaire progress",
      versionLabel: "Questionnaire",
      stepProgress: (current, total) => `Step ${current} of ${total}`,
      steps: {
        basics: {
          label: "Basics",
          title: "Start with the essentials",
          body: "Add only the anchors the future draft needs before everything else stays optional.",
        },
        experienceEducation: {
          label: "Experience",
          title: "Describe what you have done",
          body: "Use everyday language. Informal, volunteer, school, or early work experience all count.",
        },
        skillsLanguages: {
          label: "Skills",
          title: "List skills, tools, and languages",
          body: "Share practical abilities and spoken languages without worrying about CV formatting.",
        },
        extraContext: {
          label: "Context",
          title: "Add anything useful",
          body: "Include details that did not fit elsewhere. The review step comes next.",
        },
        review: {
          label: "Review",
          title: "Review your answers",
          body: "Check what you provided, then generate your CV draft.",
        },
      },
      basics: {
        fullNameLabel: "What name should appear on your CV?",
        fullNamePlaceholder: "e.g. Anna Kowalska",
        targetRoleLabel: "What role, job, or direction are you aiming for?",
        targetRolePlaceholder:
          "e.g. I want an entry-level customer support role where I can use English and help people.",
        outputLanguageLegend: "CV output language",
      },
      experienceStep: {
        experienceLabel: "What work, volunteering, projects, or responsibilities have you had?",
        experiencePlaceholder: "Write short notes. Dates, places, and exact job titles are optional.",
        educationLabel: "What education, courses, certificates, or training should be included?",
        educationPlaceholder: "Mention schools, programs, courses, certificates, or what you studied.",
      },
      skillsStep: {
        skillsLabel: "What skills, tools, or strengths should the CV mention?",
        skillsPlaceholder: "e.g. customer communication, spreadsheets, Canva, teamwork, organizing tasks.",
        spokenLanguagesLabel: "Which languages do you know?",
        spokenLanguagesPlaceholder: "e.g. Polish native, English B1/B2, Russian conversational.",
      },
      extraContext: {
        label: "Anything else we should know before creating your draft?",
        placeholder:
          "Add preferences, achievements, constraints, career change context, or anything that feels relevant.",
        note: "Next, you will review these answers. They stay only in this page while you move between steps.",
      },
      outputLanguageNames: { en: "English", pl: "Polish", ru: "Russian" },
      review: {
        intro:
          "Review your answers below, then generate your CV draft. You can edit each section, save it, and export a PDF next.",
        sparseNotesAriaLabel: "Sparse answer notes",
        sparseTitle: "Before generation, keep in mind",
        editButton: "Edit",
        emptyValue: "Skipped for now",
        labels: {
          name: "Name",
          targetRole: "Target role or goal",
          outputLanguage: "CV output language",
          experience: "Experience",
          education: "Education",
          skills: "Skills and tools",
          spokenLanguages: "Spoken languages",
          additionalContext: "Additional context",
        },
      },
      loadingText: "Building your draft… this can take up to 30 seconds.",
      errorRetrySuffix: " You can try again — your answers are kept.",
      validation: {
        fullNameRequired: "Enter your name so the CV draft has a clear identity.",
        targetRoleRequired: "Add a role, direction, or goal so the draft knows what to aim for.",
      },
      sparseWarnings: {
        experience:
          "Experience is empty, so the future draft may keep that section conservative or ask you to review it.",
        education: "Education is empty; the future draft should not invent schools, courses, or dates.",
        skills: "Skills and tools are empty, so the future draft may have fewer concrete strengths to work with.",
        spokenLanguages:
          "Spoken languages are empty; the selected CV output language will not be treated as a claimed skill.",
      },
      buttons: {
        back: "Back",
        next: "Next",
        reviewAnswers: "Review answers",
        generate: "Generate draft",
        building: "Building your draft…",
        tryAgain: "Try again",
      },
    },
  },
  pl: {
    shell: {
      primaryNavLabel: "Główna nawigacja",
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
    auth: {
      brand: "AI CV Builder",
      signin: {
        title: "Logowanie",
        eyebrow: "Dostęp do konta",
        heading: "Zaloguj się do swojej przestrzeni CV",
        description: "Wróć do chronionej przestrzeni roboczej i kontynuuj przygotowanie CV.",
        formTitle: "Zaloguj się",
        formDescription: "Użyj adresu e-mail i hasła do konta AI CV Builder.",
        alternatePrompt: "Nie masz konta?",
        alternateLink: "Zarejestruj się",
      },
      signup: {
        title: "Rejestracja",
        eyebrow: "Utwórz konto",
        heading: "Utwórz swoją przestrzeń CV",
        description: "Najpierw skonfiguruj dostęp do konta. Później przejdziesz do ankiety CV.",
        formTitle: "Utwórz konto",
        formDescription: "Użyj adresu e-mail, do którego masz dostęp.",
        alternatePrompt: "Masz już konto?",
        alternateLink: "Zaloguj się",
      },
      confirmEmail: {
        autoConfirmed: {
          title: "Rejestracja zakończona",
          eyebrow: "Konto gotowe",
          description: "Twoje konto jest gotowe. Zaloguj się, aby otworzyć przestrzeń CV.",
          linkText: "Przejdź do logowania",
        },
        emailConfirmation: {
          title: "Sprawdź pocztę",
          eyebrow: "Potwierdź konto",
          description: "Wysłaliśmy link potwierdzający na Twój adres e-mail. Otwórz go, aby aktywować konto.",
          linkText: "Wróć do logowania",
          resendButton: "Wyślij link potwierdzający ponownie",
          resendSent: "Wysłaliśmy nowy e-mail potwierdzający. Sprawdź pocztę.",
          resendError: "Nie udało się ponownie wysłać e-maila potwierdzającego. Sprawdź adres i spróbuj ponownie.",
        },
      },
      form: {
        signin: {
          emailLabel: "E-mail",
          emailPlaceholder: "ty@example.com",
          passwordLabel: "Hasło",
          passwordPlaceholder: "Twoje hasło",
          submit: "Zaloguj się",
          submitting: "Logowanie...",
          validation: {
            emailRequired: "E-mail jest wymagany",
            emailInvalid: "Wpisz poprawny adres e-mail",
            passwordRequired: "Hasło jest wymagane",
          },
          passwordToggle: {
            show: "Pokaż hasło",
            hide: "Ukryj hasło",
          },
        },
        signup: {
          emailLabel: "E-mail",
          emailPlaceholder: "ty@example.com",
          passwordLabel: "Hasło",
          passwordPlaceholder: "Min. 6 znaków",
          confirmPasswordLabel: "Potwierdź hasło",
          confirmPasswordPlaceholder: "Wpisz hasło ponownie",
          submit: "Utwórz konto",
          submitting: "Tworzenie konta...",
          validation: {
            emailRequired: "E-mail jest wymagany",
            emailInvalid: "Wpisz poprawny adres e-mail",
            passwordRequired: "Hasło jest wymagane",
            passwordTooShort: (minimum) => `Hasło musi mieć co najmniej ${minimum} znaków`,
            confirmPasswordRequired: "Potwierdź hasło",
            passwordsMismatch: "Hasła nie są takie same",
            consentRequired: "Zaakceptuj Regulamin i Politykę prywatności, aby kontynuować",
          },
          passwordToggle: {
            show: "Pokaż hasło",
            hide: "Ukryj hasło",
          },
          passwordHint: (remaining) => `Brakuje znaków: ${remaining}`,
          consent: {
            prefix: "Akceptuję ",
            termsLabel: "Regulamin",
            conjunction: " i ",
            privacyLabel: "Politykę prywatności",
            suffix: ".",
          },
        },
      },
      errors: {
        auth_unavailable: "Dostęp do konta jest chwilowo niedostępny. Spróbuj ponownie później.",
        signin_failed: "Nie udało się zalogować. Sprawdź e-mail i hasło, a potem spróbuj ponownie.",
        signup_failed: "Nie udało się utworzyć konta. Sprawdź dane i spróbuj ponownie.",
        consent_required: "Zaakceptuj Regulamin i Politykę prywatności, aby utworzyć konto.",
        rate_limited: "Zbyt wiele prób dostępu do konta. Poczekaj chwilę i spróbuj ponownie.",
        email_not_confirmed: "Twój e-mail nie jest jeszcze potwierdzony. Sprawdź pocztę albo wyślij link ponownie.",
      },
    },
    dashboard: {
      title: "Przestrzeń CV",
      brand: "AI CV Builder",
      signedInAs: "Zalogowano jako",
      signOut: "Wyloguj się",
      signOutError: "Wylogowanie nie powiodło się. Spróbuj ponownie.",
      hero: {
        eyebrow: "Twoja przestrzeń CV",
        heading: "Zacznij spokojnie, a potem buduj CV krok po kroku",
        description:
          "Ta chroniona przestrzeń jest gotowa na Twój proces CV. Zacznij od ankiety, a potem zapisuj i otwieraj CV z biblioteki poniżej.",
        startCta: "Rozpocznij CV",
        overviewCta: "Wróć do opisu",
      },
      status: {
        ariaLabel: "Status przestrzeni roboczej",
        title: "Status przestrzeni",
        accountAccess: "Dostęp do konta",
        accountActive: "Aktywny",
        questionnaire: "Ankieta CV",
        questionnaireReady: "Gotowa do rozpoczęcia",
        savedCvs: "Zapisane CV",
        savedCount: (count) => `Zapisane: ${count}`,
        unavailable: "Niedostępne",
      },
      library: {
        ariaLabel: "Biblioteka zapisanych CV",
        title: "Twoje zapisane CV",
        description: "Otwórz zapisane CV, aby je edytować, albo rozpocznij nowe.",
        loadErrorTitle: "Nie udało się wczytać zapisanych CV",
        loadErrorBody: "Twoje CV nadal są bezpieczne. Odśwież stronę albo spróbuj ponownie za chwilę.",
        startCta: "Rozpocznij nowe CV",
      },
    },
    cvPages: {
      new: {
        title: "Rozpocznij CV",
        backToWorkspace: "Wróć do przestrzeni",
        eyebrow: "Ankieta CV",
        heading: "Zbuduj CV z prostych odpowiedzi",
        description:
          "Odpowiadaj prostym językiem, przejrzyj swoje informacje, a potem wygeneruj szkic CV. Następnie możesz edytować sekcje, zapisać CV na koncie i wyeksportować czysty PDF.",
      },
      saved: {
        backToWorkspace: "Wróć do przestrzeni",
        eyebrow: "Zapisane CV",
        description: "Edytuj dowolną sekcję i zapisz zmiany. Aktualizacje nadpiszą to zapisane CV.",
      },
    },
    legal: {
      terms: {
        title: "Regulamin",
      },
      privacy: {
        title: "Polityka prywatności",
      },
      versionLabel: "Wersja polityk",
      lastUpdatedLabel: "Ostatnia aktualizacja",
      reviewNotice: "Wersja robocza oczekuje na przegląd prawny. Treść służy walidacji gotowości do uruchomienia.",
      englishNote: "Wiążąca treść dokumentu jest dostępna po angielsku; lokalizacje prawne są odłożone na później.",
      backLabel: "Wstecz",
    },
    footer: {
      termsLabel: "Regulamin",
      privacyLabel: "Polityka prywatności",
      rights: (year) => `© ${year} AI CV Builder. Wszelkie prawa zastrzeżone.`,
    },
    questionnaire: {
      ariaLabel: "Ankieta CV",
      progressAriaLabel: "Postęp ankiety",
      versionLabel: "Ankieta",
      stepProgress: (current, total) => `Krok ${current} z ${total}`,
      steps: {
        basics: {
          label: "Podstawy",
          title: "Zacznij od najważniejszego",
          body: "Dodaj tylko niezbędne podstawy, których potrzebuje przyszły szkic; reszta pozostaje opcjonalna.",
        },
        experienceEducation: {
          label: "Doświadczenie",
          title: "Opisz, czym się zajmowałeś",
          body: "Używaj codziennego języka. Liczy się także doświadczenie nieformalne, wolontariat, szkoła i pierwsze prace.",
        },
        skillsLanguages: {
          label: "Umiejętności",
          title: "Wypisz umiejętności, narzędzia i języki",
          body: "Podaj praktyczne umiejętności i znane języki, nie martwiąc się o formatowanie CV.",
        },
        extraContext: {
          label: "Kontekst",
          title: "Dodaj cokolwiek przydatnego",
          body: "Dodaj szczegóły, które nie pasowały gdzie indziej. Następny jest krok przeglądu.",
        },
        review: {
          label: "Przegląd",
          title: "Przejrzyj swoje odpowiedzi",
          body: "Sprawdź, co podałeś, a następnie wygeneruj szkic CV.",
        },
      },
      basics: {
        fullNameLabel: "Jakie imię i nazwisko ma pojawić się w Twoim CV?",
        fullNamePlaceholder: "np. Anna Kowalska",
        targetRoleLabel: "O jakie stanowisko, pracę lub kierunek się starasz?",
        targetRolePlaceholder:
          "np. Chcę pracy na poziomie podstawowym w obsłudze klienta, gdzie wykorzystam angielski i pomogę ludziom.",
        outputLanguageLegend: "Język CV",
      },
      experienceStep: {
        experienceLabel: "Jaką pracę, wolontariat, projekty lub obowiązki miałeś?",
        experiencePlaceholder: "Pisz krótkie notatki. Daty, miejsca i dokładne nazwy stanowisk są opcjonalne.",
        educationLabel: "Jakie wykształcenie, kursy, certyfikaty lub szkolenia należy uwzględnić?",
        educationPlaceholder: "Wymień szkoły, kierunki, kursy, certyfikaty lub to, czego się uczyłeś.",
      },
      skillsStep: {
        skillsLabel: "Jakie umiejętności, narzędzia lub mocne strony powinno wymienić CV?",
        skillsPlaceholder:
          "np. komunikacja z klientem, arkusze kalkulacyjne, Canva, praca zespołowa, organizacja zadań.",
        spokenLanguagesLabel: "Jakie języki znasz?",
        spokenLanguagesPlaceholder: "np. polski ojczysty, angielski B1/B2, rosyjski komunikatywny.",
      },
      extraContext: {
        label: "Czy jest coś jeszcze, co powinniśmy wiedzieć przed utworzeniem szkicu?",
        placeholder:
          "Dodaj preferencje, osiągnięcia, ograniczenia, kontekst zmiany kariery lub cokolwiek, co wydaje się istotne.",
        note: "Następnie przejrzysz te odpowiedzi. Pozostają tylko na tej stronie, gdy przechodzisz między krokami.",
      },
      outputLanguageNames: { en: "angielski", pl: "polski", ru: "rosyjski" },
      review: {
        intro:
          "Przejrzyj swoje odpowiedzi poniżej, a następnie wygeneruj szkic CV. Następnie możesz edytować każdą sekcję, zapisać ją i wyeksportować PDF.",
        sparseNotesAriaLabel: "Uwagi o brakujących odpowiedziach",
        sparseTitle: "Przed wygenerowaniem pamiętaj",
        editButton: "Edytuj",
        emptyValue: "Pominięte na razie",
        labels: {
          name: "Imię i nazwisko",
          targetRole: "Docelowe stanowisko lub cel",
          outputLanguage: "Język CV",
          experience: "Doświadczenie",
          education: "Wykształcenie",
          skills: "Umiejętności i narzędzia",
          spokenLanguages: "Znane języki",
          additionalContext: "Dodatkowy kontekst",
        },
      },
      loadingText: "Tworzenie szkicu… to może potrwać do 30 sekund.",
      errorRetrySuffix: " Możesz spróbować ponownie — Twoje odpowiedzi są zachowane.",
      validation: {
        fullNameRequired: "Podaj swoje imię i nazwisko, aby szkic CV miał wyraźną tożsamość.",
        targetRoleRequired: "Dodaj stanowisko, kierunek lub cel, aby szkic wiedział, do czego dążyć.",
      },
      sparseWarnings: {
        experience:
          "Doświadczenie jest puste, więc przyszły szkic może zachować tę sekcję ostrożnie lub poprosić o jej przejrzenie.",
        education: "Wykształcenie jest puste; przyszły szkic nie powinien wymyślać szkół, kursów ani dat.",
        skills: "Umiejętności i narzędzia są puste, więc przyszły szkic może mieć mniej konkretnych mocnych stron.",
        spokenLanguages: "Znane języki są puste; wybrany język CV nie będzie traktowany jako deklarowana umiejętność.",
      },
      buttons: {
        back: "Wstecz",
        next: "Dalej",
        reviewAnswers: "Przejrzyj odpowiedzi",
        generate: "Wygeneruj szkic",
        building: "Tworzenie szkicu…",
        tryAgain: "Spróbuj ponownie",
      },
    },
  },
  ru: {
    shell: {
      primaryNavLabel: "Основная навигация",
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
    auth: {
      brand: "AI CV Builder",
      signin: {
        title: "Вход",
        eyebrow: "Доступ к аккаунту",
        heading: "Войдите в рабочее пространство CV",
        description: "Вернитесь в защищённое рабочее пространство и продолжите подготовку CV.",
        formTitle: "Войти",
        formDescription: "Используйте e-mail и пароль от аккаунта AI CV Builder.",
        alternatePrompt: "Нет аккаунта?",
        alternateLink: "Зарегистрироваться",
      },
      signup: {
        title: "Регистрация",
        eyebrow: "Создайте аккаунт",
        heading: "Создайте рабочее пространство CV",
        description: "Сначала настройте доступ к аккаунту. Затем откроется анкета для CV.",
        formTitle: "Создать аккаунт",
        formDescription: "Используйте e-mail, к которому у вас есть доступ.",
        alternatePrompt: "Уже есть аккаунт?",
        alternateLink: "Войти",
      },
      confirmEmail: {
        autoConfirmed: {
          title: "Регистрация завершена",
          eyebrow: "Аккаунт готов",
          description: "Ваш аккаунт готов. Войдите, чтобы открыть рабочее пространство CV.",
          linkText: "Перейти ко входу",
        },
        emailConfirmation: {
          title: "Проверьте почту",
          eyebrow: "Подтвердите аккаунт",
          description: "Мы отправили ссылку подтверждения на ваш e-mail. Откройте её, чтобы активировать аккаунт.",
          linkText: "Вернуться ко входу",
          resendButton: "Отправить письмо подтверждения ещё раз",
          resendSent: "Мы отправили новое письмо подтверждения. Проверьте почту.",
          resendError: "Не удалось отправить письмо подтверждения повторно. Проверьте адрес и попробуйте снова.",
        },
      },
      form: {
        signin: {
          emailLabel: "E-mail",
          emailPlaceholder: "you@example.com",
          passwordLabel: "Пароль",
          passwordPlaceholder: "Ваш пароль",
          submit: "Войти",
          submitting: "Вход...",
          validation: {
            emailRequired: "E-mail обязателен",
            emailInvalid: "Введите корректный e-mail",
            passwordRequired: "Пароль обязателен",
          },
          passwordToggle: {
            show: "Показать пароль",
            hide: "Скрыть пароль",
          },
        },
        signup: {
          emailLabel: "E-mail",
          emailPlaceholder: "you@example.com",
          passwordLabel: "Пароль",
          passwordPlaceholder: "Минимум 6 символов",
          confirmPasswordLabel: "Подтвердите пароль",
          confirmPasswordPlaceholder: "Введите пароль ещё раз",
          submit: "Создать аккаунт",
          submitting: "Создание аккаунта...",
          validation: {
            emailRequired: "E-mail обязателен",
            emailInvalid: "Введите корректный e-mail",
            passwordRequired: "Пароль обязателен",
            passwordTooShort: (minimum) => `Пароль должен содержать минимум ${minimum} символов`,
            confirmPasswordRequired: "Подтвердите пароль",
            passwordsMismatch: "Пароли не совпадают",
            consentRequired: "Примите Условия использования и Политику конфиденциальности, чтобы продолжить",
          },
          passwordToggle: {
            show: "Показать пароль",
            hide: "Скрыть пароль",
          },
          passwordHint: (remaining) => `Осталось символов: ${remaining}`,
          consent: {
            prefix: "Я принимаю ",
            termsLabel: "Условия использования",
            conjunction: " и ",
            privacyLabel: "Политику конфиденциальности",
            suffix: ".",
          },
        },
      },
      errors: {
        auth_unavailable: "Доступ к аккаунту временно недоступен. Попробуйте позже.",
        signin_failed: "Не удалось войти. Проверьте e-mail и пароль, затем попробуйте снова.",
        signup_failed: "Не удалось создать аккаунт. Проверьте данные и попробуйте снова.",
        consent_required: "Примите Условия использования и Политику конфиденциальности, чтобы создать аккаунт.",
        rate_limited: "Слишком много попыток доступа к аккаунту. Подождите немного и попробуйте снова.",
        email_not_confirmed: "Ваш e-mail ещё не подтверждён. Проверьте почту или отправьте письмо повторно.",
      },
    },
    dashboard: {
      title: "Рабочее пространство CV",
      brand: "AI CV Builder",
      signedInAs: "Вы вошли как",
      signOut: "Выйти",
      signOutError: "Не удалось выйти. Попробуйте ещё раз.",
      hero: {
        eyebrow: "Ваше рабочее пространство CV",
        heading: "Начните спокойно, затем соберите CV шаг за шагом",
        description:
          "Это защищённое пространство готово для работы над CV. Начните с анкеты, затем сохраняйте и открывайте CV из библиотеки ниже.",
        startCta: "Начать CV",
        overviewCta: "Вернуться к обзору",
      },
      status: {
        ariaLabel: "Статус рабочего пространства",
        title: "Статус пространства",
        accountAccess: "Доступ к аккаунту",
        accountActive: "Активен",
        questionnaire: "Анкета CV",
        questionnaireReady: "Готова к началу",
        savedCvs: "Сохранённые CV",
        savedCount: (count) => `Сохранено: ${count}`,
        unavailable: "Недоступно",
      },
      library: {
        ariaLabel: "Библиотека сохранённых CV",
        title: "Ваши сохранённые CV",
        description: "Откройте сохранённое CV для редактирования или начните новое.",
        loadErrorTitle: "Не удалось загрузить сохранённые CV",
        loadErrorBody: "Ваши CV всё ещё в безопасности. Обновите страницу или попробуйте чуть позже.",
        startCta: "Начать новое CV",
      },
    },
    cvPages: {
      new: {
        title: "Начать CV",
        backToWorkspace: "Вернуться в пространство",
        eyebrow: "Анкета CV",
        heading: "Соберите CV из простых ответов",
        description:
          "Отвечайте обычным языком, проверьте введённые данные, а затем сгенерируйте черновик CV. После этого можно редактировать разделы, сохранить CV в аккаунте и экспортировать аккуратный PDF.",
      },
      saved: {
        backToWorkspace: "Вернуться в пространство",
        eyebrow: "Сохранённое CV",
        description: "Редактируйте любой раздел и сохраняйте изменения. Обновления перезапишут это CV.",
      },
    },
    legal: {
      terms: {
        title: "Условия использования",
      },
      privacy: {
        title: "Политика конфиденциальности",
      },
      versionLabel: "Версия политик",
      lastUpdatedLabel: "Последнее обновление",
      reviewNotice: "Черновик ожидает юридической проверки. Текст опубликован для проверки готовности к запуску.",
      englishNote:
        "Юридически значимый текст документа доступен на английском; локализованные юридические версии отложены.",
      backLabel: "Назад",
    },
    footer: {
      termsLabel: "Условия использования",
      privacyLabel: "Политика конфиденциальности",
      rights: (year) => `© ${year} AI CV Builder. Все права защищены.`,
    },
    questionnaire: {
      ariaLabel: "Анкета CV",
      progressAriaLabel: "Ход анкеты",
      versionLabel: "Анкета",
      stepProgress: (current, total) => `Шаг ${current} из ${total}`,
      steps: {
        basics: {
          label: "Основное",
          title: "Начните с главного",
          body: "Добавьте только то основное, что нужно будущему черновику; остальное остаётся необязательным.",
        },
        experienceEducation: {
          label: "Опыт",
          title: "Опишите, чем вы занимались",
          body: "Используйте обычный язык. Подходят и неформальный опыт, волонтёрство, учёба и первая работа.",
        },
        skillsLanguages: {
          label: "Навыки",
          title: "Перечислите навыки, инструменты и языки",
          body: "Укажите практические умения и языки, не заботясь о форматировании CV.",
        },
        extraContext: {
          label: "Контекст",
          title: "Добавьте всё полезное",
          body: "Добавьте детали, которые не подошли в другие разделы. Дальше — шаг проверки.",
        },
        review: {
          label: "Проверка",
          title: "Проверьте свои ответы",
          body: "Проверьте указанное, затем сгенерируйте черновик CV.",
        },
      },
      basics: {
        fullNameLabel: "Какое имя должно появиться в вашем CV?",
        fullNamePlaceholder: "напр. Анна Ковальская",
        targetRoleLabel: "На какую должность, работу или направление вы нацелены?",
        targetRolePlaceholder:
          "напр. Хочу начальную должность в поддержке клиентов, где смогу использовать английский и помогать людям.",
        outputLanguageLegend: "Язык CV",
      },
      experienceStep: {
        experienceLabel: "Какую работу, волонтёрство, проекты или обязанности вы выполняли?",
        experiencePlaceholder: "Пишите короткие заметки. Даты, места и точные названия должностей необязательны.",
        educationLabel: "Какое образование, курсы, сертификаты или обучение нужно включить?",
        educationPlaceholder: "Упомяните учебные заведения, программы, курсы, сертификаты или что вы изучали.",
      },
      skillsStep: {
        skillsLabel: "Какие навыки, инструменты или сильные стороны должно упомянуть CV?",
        skillsPlaceholder: "напр. общение с клиентами, таблицы, Canva, работа в команде, организация задач.",
        spokenLanguagesLabel: "Какими языками вы владеете?",
        spokenLanguagesPlaceholder: "напр. польский родной, английский B1/B2, русский разговорный.",
      },
      extraContext: {
        label: "Что ещё нам следует знать перед созданием черновика?",
        placeholder: "Добавьте предпочтения, достижения, ограничения, контекст смены карьеры или что-либо важное.",
        note: "Дальше вы проверите эти ответы. Они остаются только на этой странице, пока вы переходите между шагами.",
      },
      outputLanguageNames: { en: "английский", pl: "польский", ru: "русский" },
      review: {
        intro:
          "Проверьте свои ответы ниже, затем сгенерируйте черновик CV. Далее можно редактировать каждый раздел, сохранить его и экспортировать PDF.",
        sparseNotesAriaLabel: "Заметки о неполных ответах",
        sparseTitle: "Перед генерацией учтите",
        editButton: "Изменить",
        emptyValue: "Пока пропущено",
        labels: {
          name: "Имя",
          targetRole: "Целевая должность или цель",
          outputLanguage: "Язык CV",
          experience: "Опыт",
          education: "Образование",
          skills: "Навыки и инструменты",
          spokenLanguages: "Языки",
          additionalContext: "Дополнительный контекст",
        },
      },
      loadingText: "Создание черновика… это может занять до 30 секунд.",
      errorRetrySuffix: " Можно попробовать снова — ваши ответы сохранены.",
      validation: {
        fullNameRequired: "Укажите своё имя, чтобы у черновика CV была чёткая идентичность.",
        targetRoleRequired: "Добавьте должность, направление или цель, чтобы черновик знал, к чему стремиться.",
      },
      sparseWarnings: {
        experience:
          "Раздел опыта пуст, поэтому будущий черновик может оставить его сдержанным или попросить вас его проверить.",
        education: "Раздел образования пуст; будущий черновик не должен придумывать учебные заведения, курсы или даты.",
        skills: "Навыки и инструменты пусты, поэтому у будущего черновика будет меньше конкретных сильных сторон.",
        spokenLanguages: "Раздел языков пуст; выбранный язык CV не будет считаться заявленным навыком.",
      },
      buttons: {
        back: "Назад",
        next: "Далее",
        reviewAnswers: "Проверить ответы",
        generate: "Сгенерировать черновик",
        building: "Создание черновика…",
        tryAgain: "Попробовать снова",
      },
    },
  },
} satisfies Record<UiLocale, UiMessages>;

export function getMessages(locale: UiLocale): UiMessages {
  return messagesByLocale[locale];
}
