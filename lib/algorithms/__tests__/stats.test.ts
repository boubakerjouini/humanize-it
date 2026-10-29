// splitSentences(): the sentence boundaries every rhythm statistic depends on.

import { splitSentences } from "../stats";

describe("splitSentences()", () => {
  test("splits on terminal punctuation followed by space, keeping closing quotes", () => {
    expect(splitSentences('He said "stop." Then he left! Why?')).toEqual(['He said "stop', "Then he left", "Why"]);
  });

  test("does not split decimals, abbreviations, initials or URLs", () => {
    expect(splitSentences("Prices rose 3.5 percent, e.g. in rent. Dr. Smith and J. R. Tolkien agree. See example.com/a.b for more.")).toEqual([
      "Prices rose 3.5 percent, e.g. in rent",
      "Dr. Smith and J. R. Tolkien agree",
      "See example.com/a.b for more",
    ]);
  });

  test("treats list items and headings as their own sentences and joins hard-wrapped lines", () => {
    const md = "# Sleep tips\n\nSome reasons to ignore a guideline:\n\n1. When applying it would make\n   the code less readable.\n2. To stay consistent\n- Keep a schedule\n* No screens";
    expect(splitSentences(md)).toEqual([
      "Sleep tips",
      "Some reasons to ignore a guideline:",
      "When applying it would make the code less readable",
      "To stay consistent",
      "Keep a schedule",
      "No screens",
    ]);
  });

  test("drops pieces with no letters or digits", () => {
    expect(splitSentences("... !!! ??")).toEqual([]);
  });
});
