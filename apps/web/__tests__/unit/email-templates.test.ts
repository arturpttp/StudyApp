import { describe, it, expect } from "vitest";
import { verificationEmailHtml } from "@/lib/email/templates";

describe("verificationEmailHtml", () => {
  it("contains the verification URL", () => {
    const url = "https://example.com/verify?token=abc";
    const html = verificationEmailHtml(url);
    expect(html).toContain(url);
  });

  it("contains Portuguese text", () => {
    const html = verificationEmailHtml("https://example.com");
    expect(html).toContain("Confirme seu e-mail");
  });
});
