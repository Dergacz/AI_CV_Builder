import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * S-08 phase 2: the account-deletion island.
 *
 * Three properties, none of which a browser test would catch earlier or more cheaply:
 *
 *   1. **The unavailable state.** With no `SUPABASE_SECRET_KEY` the route can only ever 503, so a
 *      delete button must not render at all. Rendered here through `react-dom/server` — the suite
 *      has no DOM, and this component's unconfigured branch needs none.
 *   2. **Transport-only client reporting** (the S-07 rule): a request that never completes is a
 *      client-side defect worth reporting; a non-ok envelope was already reported server-side with
 *      a precise location, and a confirmation mismatch is user input, not a defect at all.
 *   3. **One confirmation gate, not two.** Asserted statically, on the import graph: the browser
 *      and the server must both call `confirmationMatches` from the same module. Interactive
 *      typing lives in the Playwright spec (phase 3) — what cannot be proven there is that the two
 *      sides share an implementation rather than agreeing by coincidence.
 */

const mocks = vi.hoisted(() => ({
  reportErrorClient: vi.fn(),
}));

vi.mock("@/lib/observability/client.browser", () => ({
  reportErrorClient: mocks.reportErrorClient,
  trackClient: vi.fn(),
}));

import DeleteAccountPanel, { postAccountDelete } from "@/components/account/DeleteAccountPanel";
import { getMessages } from "@/lib/i18n/messages";

type FetchSignature = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function stubJson(payload: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn<FetchSignature>(() => Promise.resolve({ json: () => Promise.resolve(payload) } as unknown as Response)),
  );
}

function stubTransportFailure(error: Error = new TypeError("Failed to fetch")): void {
  vi.stubGlobal(
    "fetch",
    vi.fn<FetchSignature>(() => Promise.reject(error)),
  );
}

beforeEach(() => {
  mocks.reportErrorClient.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeleteAccountPanel rendering", () => {
  const copy = getMessages("en").account;

  it("renders the unavailable state and no delete control when the admin path is unconfigured", () => {
    const html = renderToStaticMarkup(
      createElement(DeleteAccountPanel, { accountEmail: "ada@example.com", configured: false, locale: "en" }),
    );

    expect(html).toContain(copy.danger.unavailable);
    expect(html).not.toContain(copy.danger.deleteCta);
    expect(html).not.toContain("<button");
  });

  it("renders the delete control when configured", () => {
    const html = renderToStaticMarkup(
      createElement(DeleteAccountPanel, { accountEmail: "ada@example.com", configured: true, locale: "en" }),
    );

    expect(html).toContain(copy.danger.deleteCta);
    expect(html).not.toContain(copy.danger.unavailable);
    // The dialog — and with it the confirmation field — exists only after the trigger is clicked.
    expect(html).not.toContain(copy.dialog.emailLabel);
  });

  it("localizes the unavailable state", () => {
    const html = renderToStaticMarkup(
      createElement(DeleteAccountPanel, { accountEmail: "ada@example.com", configured: false, locale: "pl" }),
    );

    expect(html).toContain(getMessages("pl").account.danger.unavailable);
  });
});

describe("postAccountDelete", () => {
  it("reports once when the request never completes", async () => {
    stubTransportFailure();

    expect(await postAccountDelete("ada@example.com")).toBeNull();
    expect(mocks.reportErrorClient).toHaveBeenCalledOnce();
    const [, context] = mocks.reportErrorClient.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(context.error_location).toBe("client:account-delete");
  });

  it("reports nothing for a mismatch or server-failure envelope", async () => {
    stubJson({ ok: false, error: "confirmation_mismatch", message: "no" });
    await postAccountDelete("wrong@example.com");

    stubJson({ ok: false, error: "delete_failed", message: "boom" });
    await postAccountDelete("ada@example.com");

    expect(mocks.reportErrorClient).not.toHaveBeenCalled();
  });

  it("sends the typed confirmation and nothing else", async () => {
    stubJson({ ok: true, redirectTo: "/?deleted=1" });

    await postAccountDelete("ada@example.com");

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { body: string }];
    expect(url).toBe("/api/account/delete");
    expect(init.method).toBe("POST");
    // No user id, no email field of its own: the account deleted is whichever one the server's
    // verified session names. Pinned on the client side too, so a "helpful" addition here fails.
    expect(JSON.parse(init.body)).toEqual({ confirmation: "ada@example.com" });
  });
});

describe("confirmation gate sharing", () => {
  const gateModule = "@/lib/account-deletion-confirmation";

  it("has the browser and the server import the same gate module", () => {
    const panel = readFileSync("src/components/account/DeleteAccountPanel.tsx", "utf-8");
    const service = readFileSync("src/lib/services/account-deletion.ts", "utf-8");

    expect(panel).toContain(`from "${gateModule}"`);
    expect(service).toContain(`from "${gateModule}"`);
  });
});
