import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { getUser, getOptionalUser } from "./getUser";

beforeEach(() => {
  vi.clearAllMocks();
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
