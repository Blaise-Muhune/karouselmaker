import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn(),
  pathname: null as string | null,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name === "x-pathname" || name === "next-url" ? mocks.pathname : null),
  }),
}));
import { getUser, getOptionalUser } from "./getUser";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = null;
  mocks.redirect.mockImplementation(() => { throw new Error("LOGIN_REDIRECT"); });
});

describe("verified session handling", () => {
  it("returns the verified user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    await expect(getUser()).resolves.toEqual({ user: { id: "user-1" } });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([
    new AuthSessionMissingError(),
    new AuthApiError("Expired session", 401, undefined),
    new AuthApiError("Invalid refresh token", 400, "refresh_token_not_found"),
  ])("redirects for a missing or invalid session: %s", async (error) => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error });
    await expect(getUser()).rejects.toThrow("LOGIN_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    await expect(getOptionalUser()).resolves.toEqual({ user: null });
  });

  it("preserves a safe Digilaine next path on login redirect", async () => {
    mocks.pathname = "/from/digilaine/continue";
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    await expect(getUser()).rejects.toThrow("LOGIN_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=%2Ffrom%2Fdigilaine%2Fcontinue");
  });

  it("does not pass an unsafe next path", async () => {
    mocks.pathname = "/projects";
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
    await expect(getUser()).rejects.toThrow("LOGIN_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it.each([
    new AuthRetryableFetchError("Network unavailable", 503),
    new AuthApiError("Rate limited", 429, undefined),
    new AuthApiError("Service unavailable", 500, undefined),
  ])("does not treat a service failure as logout: %s", async (error) => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error });
    await expect(getUser()).rejects.toBe(error);
    await expect(getOptionalUser()).rejects.toBe(error);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
