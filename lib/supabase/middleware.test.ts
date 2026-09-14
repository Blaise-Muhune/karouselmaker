import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
import { middleware } from "../../middleware";

afterEach(() => vi.unstubAllEnvs());

it("passes rotated tokens to the current render and the browser, including cookie deletions", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  const request = new NextRequest("https://example.com/projects", {
    headers: { cookie: "session=expired; session.1=old-chunk" },
  });
  mocks.createServerClient.mockImplementation((_url, _key, { cookies }) => ({
    auth: { getUser: async () => {
      cookies.setAll([
        { name: "session", value: "refreshed", options: { path: "/", httpOnly: true } },
        { name: "session.1", value: "", options: { path: "/", maxAge: 0 } },
      ]);
      return { data: { user: { id: "user-1" } }, error: null };
    } },
  }));

  const response = await middleware(request);
  expect(request.cookies.get("session")?.value).toBe("refreshed");
  expect(response.headers.get("x-middleware-request-cookie")).toContain("session=refreshed");
  expect(response.headers.get("x-middleware-request-cookie")).not.toContain("expired");
  expect(response.cookies.get("session")).toMatchObject({ value: "refreshed", httpOnly: true, path: "/" });
  expect(response.cookies.get("session.1")).toMatchObject({ value: "", maxAge: 0 });
});
