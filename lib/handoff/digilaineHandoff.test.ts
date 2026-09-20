import { describe, expect, it } from "vitest";
import {
  findProjectForDigilaineProductId,
  parseDigilaineGenCookie,
  signDigilaineKarouselHandoff,
  uniqueProjectName,
  verifyDigilaineKarouselHandoff,
} from "./digilaineHandoff";

const secret = "test-handoff-secret-16";
const productId = "33333333-3333-4333-8333-333333333333";

describe("Digilaine handoff token", () => {
  const payload = {
    v: 1 as const,
    topic: "The launch post that never converts",
    is_marketing: true,
    angle: "Teach the miss first",
    product_title: "Launch notes",
    product_brief: "A workbook for first product launches.",
    product_url: "https://example.com/i/launch-notes",
    product_id: productId,
    exp: 1_700_000_000 + 20 * 60,
  };

  it("verifies a valid token", () => {
    const token = signDigilaineKarouselHandoff(payload, secret);
    const verified = verifyDigilaineKarouselHandoff(token, secret, 1_700_000_000);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.payload.topic).toBe(payload.topic);
  });

  it("rejects an expired token", () => {
    const token = signDigilaineKarouselHandoff(payload, secret);
    const verified = verifyDigilaineKarouselHandoff(token, secret, 1_700_000_000 + 21 * 60);
    expect(verified.ok).toBe(false);
  });

  it("rejects a bad signature", () => {
    const token = signDigilaineKarouselHandoff(payload, secret);
    expect(verifyDigilaineKarouselHandoff(`${token}nope`, secret, 1_700_000_000).ok).toBe(false);
  });
});

describe("project match from Digilaine product id", () => {
  it("finds the project tagged with digilaine_product_id", () => {
    const hit = findProjectForDigilaineProductId(
      [
        { id: "a", project_rules: { digilaine_product_id: "other" } },
        { id: "b", project_rules: { digilaine_product_id: productId } },
      ],
      productId,
    );
    expect(hit?.id).toBe("b");
  });

  it("returns a unique name when the title is taken", () => {
    expect(uniqueProjectName("Launch notes", ["Launch notes"])).toBe("Launch notes (Digilaine)");
  });
});

describe("new-post prefill cookie", () => {
  it("reads topic, marketing lock, and angle", () => {
    const parsed = parseDigilaineGenCookie(
      JSON.stringify({
        topic: "The launch post that never converts",
        is_marketing: true,
        angle: "Teach the miss first",
      }),
    );
    expect(parsed).toEqual({
      topic: "The launch post that never converts",
      is_marketing: true,
      angle: "Teach the miss first",
    });
  });
});
