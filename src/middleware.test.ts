import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  safeGetUser: vi.fn(),
  trackEmailConfirmedOnce: vi.fn(),
  resolveRequestIdentity: vi.fn(),
  track: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("astro:middleware", () => ({
  defineMiddleware: (handler: unknown) => handler,
}));

vi.mock("@/lib/supabase", () => ({
  createClient: mocks.createClient,
  safeGetUser: mocks.safeGetUser,
}));

vi.mock("@/lib/observability/funnel", () => ({
  trackEmailConfirmedOnce: mocks.trackEmailConfirmedOnce,
}));

vi.mock("@/lib/observability/identity", () => ({
  resolveRequestIdentity: mocks.resolveRequestIdentity,
}));

// Stub the emit contract (it reads `astro:env/server`, which does not resolve under Vitest) but
// deliberately leave `@/lib/observability/schedule` REAL — the cfContext/waitUntil assertion below
// is a regression test for the scheduler's behavior, and mocking it would make that test vacuous.
vi.mock("@/lib/observability", () => ({
  track: mocks.track,
  reportError: mocks.reportError,
}));

import { onRequest } from "@/middleware";

interface MiddlewareTestContext {
  request: Request;
  url: URL;
  routePattern: string;
  cookies: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  locals: Record<string, unknown>;
  redirect(url: string): Response;
}

type MiddlewareUnderTest = (context: MiddlewareTestContext, next: () => Promise<Response>) => Promise<Response>;

const runMiddleware = onRequest as unknown as MiddlewareUnderTest;

function makeContext(pathname: string, routePattern = pathname): MiddlewareTestContext {
  const url = new URL(`http://localhost${pathname}`);
  return {
    request: new Request(url),
    url,
    routePattern,
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
    },
    locals: {},
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
  };
}

function confirmedUser(email = "ada@example.com") {
  return { id: "user-confirmed", email, email_confirmed_at: "2026-06-15T10:00:00.000Z" };
}

function unconfirmedUser(email = "ada+verify@example.com") {
  return { id: "user-unconfirmed", email, email_confirmed_at: null };
}

beforeEach(() => {
  mocks.createClient.mockReturnValue({ auth: {} });
  mocks.safeGetUser.mockReset();
  mocks.track.mockReset();
  mocks.reportError.mockReset();
  mocks.trackEmailConfirmedOnce.mockResolvedValue(false);
  mocks.resolveRequestIdentity.mockResolvedValue({ distinctId: "identity-test" });
});

describe("middleware protected-route email verification guard", () => {
  it("allows a confirmed user through to protected routes", async () => {
    mocks.safeGetUser.mockResolvedValue(confirmedUser());
    const next = vi.fn(() => Promise.resolve(new Response("next")));

    const response = await runMiddleware(makeContext("/dashboard"), next);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("next");
    expect(next).toHaveBeenCalledOnce();
  });

  it("uses Astro 6 Cloudflare cfContext without reading the removed runtime.ctx getter", async () => {
    mocks.safeGetUser.mockResolvedValue(confirmedUser());
    const next = vi.fn(() => Promise.resolve(new Response("next")));
    const context = makeContext("/dashboard");
    const waitUntil = vi.fn();
    context.locals.cfContext = { waitUntil };
    Object.defineProperty(context.locals, "runtime", {
      value: {
        get ctx(): never {
          throw new Error("Astro.locals.runtime.ctx has been removed");
        },
      },
    });

    const response = await runMiddleware(context, next);

    expect(response.status).toBe(200);
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it("redirects an unconfirmed user on protected routes to confirm-email with their email", async () => {
    mocks.safeGetUser.mockResolvedValue(unconfirmedUser());
    const next = vi.fn(() => Promise.resolve(new Response("next")));

    const response = await runMiddleware(makeContext("/cv"), next);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/auth/confirm-email?email=ada%2Bverify%40example.com");
    expect(next).not.toHaveBeenCalled();
  });

  it("redirects anonymous protected-route requests to signin", async () => {
    mocks.safeGetUser.mockResolvedValue(null);
    const next = vi.fn(() => Promise.resolve(new Response("next")));

    const response = await runMiddleware(makeContext("/dashboard"), next);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/auth/signin");
    expect(next).not.toHaveBeenCalled();
  });

  it("allows unconfirmed users through on non-protected routes", async () => {
    mocks.safeGetUser.mockResolvedValue(unconfirmedUser());
    const next = vi.fn(() => Promise.resolve(new Response("next")));

    const response = await runMiddleware(makeContext("/auth/confirm-email"), next);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("next");
    expect(next).toHaveBeenCalledOnce();
  });
});

/**
 * S-07 catch-all. This is what makes backend coverage rot-proof: routes added later report
 * without opting in, and an unhandled throw can no longer vanish. The load-bearing rule is that
 * Astro's own error handling must be completely unperturbed — so the ORIGINAL value re-throws.
 */
describe("middleware unhandled-error catch-all", () => {
  it("reports a thrown route error and re-throws the original value untouched", async () => {
    mocks.safeGetUser.mockResolvedValue(confirmedUser());
    const thrown = new TypeError("route exploded");
    const next = vi.fn(() => Promise.reject(thrown));

    await expect(runMiddleware(makeContext("/cv/abc-123", "/cv/[id]"), next)).rejects.toBe(thrown);

    expect(mocks.reportError).toHaveBeenCalledOnce();
    const [error, context, identity] = mocks.reportError.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
    // Identity is the same one the rest of the request uses.
    expect(error).toBe(thrown);
    expect(identity).toEqual({ distinctId: "identity-test" });
    expect(context.error_location).toBe("middleware:unhandled");
  });

  it("reports the low-cardinality route pattern, never the raw pathname", async () => {
    mocks.safeGetUser.mockResolvedValue(confirmedUser());
    const next = vi.fn(() => Promise.reject(new Error("boom")));

    // The pathname carries a CV id; the pattern does not. Sending the pathname would put user
    // identifiers into a third-party store, which is exactly what F-01's contract forbids.
    await expect(
      runMiddleware(makeContext("/cv/3f2504e0-4f89-41d3-9a0c-0305e82c3301", "/cv/[id]"), next),
    ).rejects.toThrow();

    const [, context] = mocks.reportError.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(context.route).toBe("/cv/[id]");
    expect(JSON.stringify(context)).not.toContain("3f2504e0");
  });

  it("reports nothing when the request succeeds", async () => {
    mocks.safeGetUser.mockResolvedValue(confirmedUser());
    const next = vi.fn(() => Promise.resolve(new Response("next")));

    await runMiddleware(makeContext("/dashboard"), next);

    expect(mocks.reportError).not.toHaveBeenCalled();
  });
});
