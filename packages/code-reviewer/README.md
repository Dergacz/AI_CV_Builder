# @10x/code-reviewer

Точка входа для AI-ревью кода: **AI SDK 7** + **OpenRouter** + **zod**, TypeScript на Node без сборки.

## Установка

```bash
npm install
cp .env.example .env   # вписать OPENROUTER_API_KEY
```

## Запуск

```bash
npm start -- src/index.ts        # ревью файла
npm start -- src/index.ts --json # машиночитаемый вывод
git diff | npm start -- --json   # ревью диффа со stdin
npm run dev                      # tsx watch
npm run typecheck                # tsc --noEmit
```

Точка входа исполняется и через `tsx`, и через нативный type-stripping Node 22+
(`node src/index.ts`) — в `tsconfig.json` включён `erasableSyntaxOnly`.

## Программное использование

```ts
import { reviewCode, formatReview } from "./src/index.ts";

const { review, usage } = await reviewCode({
  code: await readFile("src/app.ts", "utf8"),
  path: "src/app.ts",
  context: "Astro SSR, zod 4, строгий TS",
});

console.log(review.verdict); // "approve" | "comment" | "request-changes"
console.log(review.findings); // валидированный zod-массив находок
```

`reviewCode` по умолчанию берёт модель из `OPENROUTER_MODEL`. Любую другую
модель (или собственный провайдер) можно передать вторым аргументом:

```ts
import { createProvider } from "./src/index.ts";

const { provider } = createProvider();
await reviewCode(input, { model: provider("openai/gpt-5.6-terra"), temperature: 0 });
```

## Переменные окружения

| Переменная            | Обязательна | По умолчанию              |
| --------------------- | ----------- | ------------------------- |
| `OPENROUTER_API_KEY`  | да          | —                         |
| `OPENROUTER_MODEL`    | нет         | `google/gemini-3.7-flash` |
| `OPENROUTER_APP_NAME` | нет         | `10x-code-reviewer`       |
| `OPENROUTER_APP_URL`  | нет         | —                         |

Валидация — zod (`src/env.ts`), при ошибке процесс падает с понятным сообщением.

## Файлы

| Файл                | Назначение                                                     |
| ------------------- | -------------------------------------------------------------- |
| `src/index.ts`      | публичные экспорты + CLI                                        |
| `src/review.ts`     | zod-схема ревью и `reviewCode()` (`generateText` + `Output.object`) |
| `src/openrouter.ts` | провайдер OpenRouter и модель по умолчанию                      |
| `src/env.ts`        | схема и загрузка окружения                                      |

## Заметки по версиям

AI SDK 7 — ESM-only, Node ≥ 22. `system` переименован в `instructions`,
структурированный вывод делается через `generateText` + `Output.object()`
(вместо старого `generateObject`). Актуальные доки лежат в
`node_modules/ai/docs/` и всегда совпадают с установленной версией.
