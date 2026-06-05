import { describe, it, expect } from "vitest";
import { normalizeEmail, tidyText, cleanForwardedEmail } from "../lib/normalize";

describe("cleanForwardedEmail", () => {
  it("keeps forwarded body but drops headers, footers and tracking URLs", () => {
    const out = cleanForwardedEmail(
      [
        "Hi, forwarding this.",
        "",
        "---------- Forwarded message ---------",
        "From: Spa <book@spa.test>",
        "Date: Mon, 1 Jun 2026",
        "Subject: Booking confirmation",
        "To: me@gmail.com",
        "",
        "Your party is booked for 14 June at 2pm.",
        "Pay the £40 balance by 7 June.",
        "",
        "Unsubscribe here https://spa.test/unsub?t=abc123",
      ].join("\n"),
    );
    expect(out).toContain("Your party is booked for 14 June");
    expect(out).toContain("Pay the £40 balance by 7 June.");
    expect(out).not.toMatch(/From:|Subject:|To:|Forwarded message/i);
    expect(out).not.toContain("Unsubscribe");
    expect(out).not.toContain("https://");
  });

  it("truncates a quoted reply chain", () => {
    const out = cleanForwardedEmail(
      [
        "Can you bring snacks on Friday?",
        "On Tue, 3 Jun 2026 at 10:00, A <a@b.test> wrote:",
        "> earlier message we don't want",
      ].join("\n"),
    );
    expect(out).toBe("Can you bring snacks on Friday?");
  });

  it("caps very long input", () => {
    const out = cleanForwardedEmail("x ".repeat(5000), 100);
    expect(out.length).toBeLessThanOrEqual(101);
  });
});

describe("tidyText", () => {
  it("collapses blank-line runs and trailing whitespace", () => {
    expect(tidyText("a   \n\n\n\nb")).toBe("a\n\nb");
  });
  it("normalizes CRLF and nbsp", () => {
    expect(tidyText("a\r\nb c")).toBe("a\nb c");
  });
});

describe("normalizeEmail", () => {
  it("keeps the subject and drops the quoted reply chain", () => {
    const out = normalizeEmail({
      subject: "Trip payment",
      text: [
        "Please pay £15 by Monday.",
        "",
        "On Tue, 3 Jun 2026 at 10:00, School <office@school.test> wrote:",
        "> Original message here",
        "> more quoted text",
      ].join("\n"),
    });
    expect(out).toContain("Subject: Trip payment");
    expect(out).toContain("Please pay £15 by Monday.");
    expect(out).not.toContain("Original message here");
    expect(out).not.toContain("wrote:");
  });

  it("drops a signature after the -- delimiter", () => {
    const out = normalizeEmail({
      text: ["Body line.", "--", "Adam", "Sent from my iPhone"].join("\n"),
    });
    expect(out).toContain("Body line.");
    expect(out).not.toContain("Sent from my iPhone");
  });

  it("falls back to stripping HTML when no text part", () => {
    const out = normalizeEmail({
      html: "<p>Pay <b>£15</b> by Monday.</p><p>Thanks</p>",
    });
    expect(out).toContain("Pay £15 by Monday.");
    expect(out).toContain("Thanks");
    expect(out).not.toContain("<p>");
  });
});
