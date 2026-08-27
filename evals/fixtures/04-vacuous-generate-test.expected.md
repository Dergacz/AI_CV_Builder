# 04 - Test That Checks Nothing

The reviewer must notice that the test asserts its own mock. `expect(body.draft).toEqual(FAKE_DRAFT)`
will pass for any route implementation that simply passes the service result through;
`toBeDefined()`, `typeof status === "number"`, `toBeTruthy()`,
`Object.keys(...).length > 0`, and `toHaveBeenCalled()` are not killed by any mutation in
`generate.ts`. The test does not verify status 200, `ok: true`, `generationEventId`, or
that quota was consumed.

No error branch is covered: 401, invalid body, `ok: false` from the service, and exhausted
quota are all missing even though the test is named as a route contract.
