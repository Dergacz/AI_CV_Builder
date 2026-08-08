import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  safeGetUser: vi.fn(),
  trackEmailConfirmedOnce: vi.fn(),
  resolveRequestIdentity: vi.fn(),
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
  track: vi.fn(),
  reportError: vi.fn(),
}));

import { onRequest } from "@/middleware";

interface MiddlewareTestContext {
  request: Request;
  url: URL;
  cookies: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  locals: Record<string, unknown>;
  redirect(url: string): Response;
}

type MiddlewareUnderTest = (context: MiddlewareTestContext, next: () => Promise<Response>) => Promise<Response>;

const runMiddleware = onRequest as unknown as MiddlewareUnderTest;

function makeContext(pathname: string): MiddlewareTestContext {
  const url = new URL(`http://localhost${pathname}`);
  return {
    request: new Request(url),
    url,
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
