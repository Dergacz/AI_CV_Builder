## Overall concept

- GHA workflow run for every new pull request to master
- composite action for the review itself so that main workflov

## Input parameters

- pull request title
- pull request description (?? cost tradeoff)
- git diff

## Code Review Criteria

1) implementation correctness
2) idiomaticity
3) complexity
4) test / risk coverage
5) documentation
6) security and safety

## Parked for later

- business alignment (require broader context)
- architectural fit (require broader context)

## Expected side-effects

- PR comment with summary
- labels: ai-cr:failed (red) OR ai-cripassed

## Expected behavior

- on-demand retry when label ai-cr:review is added
