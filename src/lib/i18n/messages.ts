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
  };
  passwordHint: (remaining: number) => string;
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
      emailConfirmation: ConfirmEmailStateCopy;
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
          },
          passwordToggle: {
            show: "Show password",
            hide: "Hide password",
          },
          passwordHint: (remaining) => `${remaining} more character${remaining === 1 ? "" : "s"} needed`,
        },
      },
      errors: {
        auth_unavailable: "Account access is temporarily unavailable. Please try again later.",
        signin_failed: "We couldn't sign you in. Check your email and password, then try again.",
        signup_failed: "We couldn't create your account. Check your details, then try again.",
        rate_limited: "Too many account attempts right now. Please wait a bit and try again.",
      },
    },
    dashboard: {
      title: "CV Workspace",
      brand: "AI CV Builder",
      signedInAs: "Signed in as",
      signOut: "Sign out",
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
          },
          passwordToggle: {
            show: "Pokaż hasło",
            hide: "Ukryj hasło",
          },
          passwordHint: (remaining) => `Brakuje znaków: ${remaining}`,
        },
      },
      errors: {
        auth_unavailable: "Dostęp do konta jest chwilowo niedostępny. Spróbuj ponownie później.",
        signin_failed: "Nie udało się zalogować. Sprawdź e-mail i hasło, a potem spróbuj ponownie.",
        signup_failed: "Nie udało się utworzyć konta. Sprawdź dane i spróbuj ponownie.",
        rate_limited: "Zbyt wiele prób dostępu do konta. Poczekaj chwilę i spróbuj ponownie.",
      },
    },
    dashboard: {
      title: "Przestrzeń CV",
      brand: "AI CV Builder",
      signedInAs: "Zalogowano jako",
      signOut: "Wyloguj się",
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
          },
          passwordToggle: {
            show: "Показать пароль",
            hide: "Скрыть пароль",
          },
          passwordHint: (remaining) => `Осталось символов: ${remaining}`,
        },
      },
      errors: {
        auth_unavailable: "Доступ к аккаунту временно недоступен. Попробуйте позже.",
        signin_failed: "Не удалось войти. Проверьте e-mail и пароль, затем попробуйте снова.",
        signup_failed: "Не удалось создать аккаунт. Проверьте данные и попробуйте снова.",
        rate_limited: "Слишком много попыток доступа к аккаунту. Подождите немного и попробуйте снова.",
      },
    },
    dashboard: {
      title: "Рабочее пространство CV",
      brand: "AI CV Builder",
      signedInAs: "Вы вошли как",
      signOut: "Выйти",
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
  },
} satisfies Record<UiLocale, UiMessages>;

export function getMessages(locale: UiLocale): UiMessages {
  return messagesByLocale[locale];
}
