import { afterEach, describe, expect, it, vi } from "vitest";
import { postPhotosToTikTok, waitForTikTokPublishComplete } from "./postPhotos";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("postPhotosToTikTok", () => {
  it("uses creator settings and sends a private Photo Mode direct post", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { privacy_level_options: ["SELF_ONLY"], comment_disabled: false }, error: { code: "ok" } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { publish_id: "photo-123" }, error: { code: "ok" } }), { status: 200 })
      );
    global.fetch = fetchMock as typeof fetch;

    await expect(
      postPhotosToTikTok({
        accessToken: "token",
        photoUrls: ["https://karouselmaker.com/one.png", "https://karouselmaker.com/two.png"],
        title: "Test carousel",
        description: "A private test.",
        privacyLevel: "SELF_ONLY",
      })
    ).resolves.toEqual({ publishId: "photo-123" });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("creator_info/query");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("content/init");
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      media_type: "PHOTO",
      post_mode: "DIRECT_POST",
      post_info: { privacy_level: "SELF_ONLY", brand_content_toggle: false, brand_organic_toggle: false },
      source_info: { source: "PULL_FROM_URL", photo_cover_index: 0 },
    });
  });
});

describe("waitForTikTokPublishComplete", () => {
  it("marks complete only after TikTok finishes downloading", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { status: "PROCESSING_DOWNLOAD" }, error: { code: "ok" } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { status: "PUBLISH_COMPLETE" }, error: { code: "ok" } }), { status: 200 })
      );
    global.fetch = fetchMock as typeof fetch;

    await expect(
      waitForTikTokPublishComplete({
        accessToken: "token",
        publishId: "photo-123",
        intervalMs: 1,
        timeoutMs: 1_000,
      })
    ).resolves.toEqual({ status: "complete" });
  });

  it("maps photo pull failures", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: { status: "FAILED", fail_reason: "photo_pull_failed" }, error: { code: "ok" } }),
        { status: 200 }
      )
    ) as typeof fetch;

    await expect(
      waitForTikTokPublishComplete({
        accessToken: "token",
        publishId: "photo-123",
        intervalMs: 1,
        timeoutMs: 1_000,
      })
    ).resolves.toMatchObject({ status: "failed", error: expect.stringContaining("download") });
  });
});
