# Гейт AI-ревью: требования

Что гейт получает на вход, что делает наружу и по чему судит. Реализация живёт в
`.github/workflows/ai-review.yml` и `.github/actions/ai-review/`.

## Overall concept

- GHA workflow run for every new pull request to master
- composite action for the review itself, so that the main workflow only prepares the
  diff and enforces the verdict, and the review step can be reused from another
  workflow (or run on demand) without copying its logic

## Input parameters

- pull request title
- pull request description (?? cost tradeoff)
- git diff

Диффом всё не ограничивается: агент дочитывает связанные контракты из репозитория сам
(`readRelatedContracts`), потому что расхождение zod-схемы с миграцией по одному диффу
физически не видно. Заведено после прогона 2026-08-27, где фикстуры 02 и 05 брала
только самая дорогая модель.

## Code Review Criteria

**Источник правды — [`context/review-criteria.md`](../../review-criteria.md).**

Здесь список не дублируется намеренно. Пять критериев оттуда генерируются в
`packages/code-reviewer/src/criteria.generated.ts` (`npm run criteria:build`), рубрики
1–10 уезжают в схему вывода как описания полей, а `npm run criteria:check` роняет сборку,
если документ и код разошлись. Второй список критериев в этом файле стал бы третьим
описанием одного и того же — ровно тот дефект, который ловит критерий 1.

Раньше здесь лежали шесть измерений (correctness / idiomaticity / complexity / test
coverage / documentation / security) из курсового примера. Они не описывали этот проект
и ни одним исполняемым файлом не читались; заменены ссылкой 2026-08-27.

## Expected side-effects

- PR comment with summary
- labels: `ai-cr:failed` (red) OR `ai-cr:passed`

Комментарий переписывается на месте по маркеру, а не добавляется новый на каждый прогон.
Оба лейбла взаимоисключающие: action снимает противоположный. Лейблы должны существовать
в репозитории заранее — action их не создаёт, а пишет `::warning::`.

## Expected behavior

- on-demand retry when label `ai-cr:review` is added

Лейбл снимается в `always()`-шаге после прогона: повторное добавление уже висящего
лейбла события не порождает, и без снятия PR застрял бы после первого ретрая.

Гейт роняет проверку только на вердикте `request-changes` (вход `fail-on`). Сам action
при этом завершается успешно и лишь выставляет output — падает отдельный шаг
`Enforce verdict`, чтобы отличать «ревью прошло и забраковало» от «ревью не отработало».
