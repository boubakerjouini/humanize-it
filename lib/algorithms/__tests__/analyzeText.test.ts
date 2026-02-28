// ===========================================================
// HumanizeIt — analyzeText() Tests
// ===========================================================

import { analyzeText } from "../analyzeText";

// ---- Fixtures ----

const AI_TEXT = `
In today's rapidly evolving landscape, it is important to note that the paradigm of artificial intelligence
has shifted significantly. This comprehensive analysis delves into the multifaceted nature of the technology,
providing a nuanced understanding of its intricate mechanisms. Furthermore, this framework underscores the
pivotal role that innovative approaches play in fostering technological advancement.

This approach is particularly relevant because it facilitates a holistic understanding. This robust
methodology moreover allows us to leverage synergies across multiple ecosystems. This analysis
encompasses a multifaceted exploration of the dynamic interplay between various factors.

However, one must consider the nuanced perspective on these matters. Nevertheless, the overarching
framework remains comprehensive. Consequently, the multifaceted nature of this paradigm requires
careful consideration. Subsequently, these innovative elements underscore the intricate tapestry of progress.

In conclusion, as we have seen, this comprehensive exploration of the pivotal paradigm shift underscores
the multifaceted and nuanced nature of the landscape. Moving forward, it is essential to leverage these
fundamental insights to navigate the evolving ecosystem effectively.
`.trim();

const HUMAN_TEXT = `
Last Tuesday I drove my kid to soccer practice and spent the whole ride arguing about whether pineapple
belongs on pizza. She's twelve and absolutely convinced it does. I'm wrong, apparently.

The coach was late, so we sat on the bleachers eating granola bars I'd panic-bought at the gas station.
Three other parents showed up late too. One guy had mud on his boots from what looked like an actual
construction site — he'd clearly come straight from work. Another mom was still on a call, pacing
back and forth near the parking lot.

We didn't talk much. It was 6 PM on a Tuesday. Everyone was tired.

My daughter scored two goals. She was terrible the week before — missed every shot — so this felt
good. She didn't celebrate. Just jogged back to her position like it was nothing. I cheered too loud.
A dad nearby gave me the "settle down" look.

We stopped for tacos on the way home. She got one with just cheese and beans — nothing else. Twelve
years old and pickier than ever. I got the spicy one and regretted it immediately.

That's about it. Normal night.
`.trim();

// ---- Main Score Tests ----

describe("analyzeText() — Overall Score", () => {
  test("known AI text should score > 60", () => {
    const result = analyzeText(AI_TEXT);
    expect(result.score).toBeGreaterThan(60);
  });

  test("known human text should score < 40", () => {
    const result = analyzeText(HUMAN_TEXT);
    expect(result.score).toBeLessThan(40);
  });

  test("returns valid result shape", () => {
    const result = analyzeText(AI_TEXT);
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("patterns");
    expect(result).toHaveProperty("stats");
    expect(result).toHaveProperty("wordCount");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ---- Vocabulary Pattern Tests ----

describe("Vocabulary patterns (1–3)", () => {
  test("detects Tier 1 AI vocabulary", () => {
    const text =
      "We must delve into this tapestry of ideas, navigating the landscape with nuanced and intricate analysis.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "ai-vocab-t1");
    expect(hit).toBeDefined();
    expect(hit!.hits).toBeGreaterThan(0);
  });

  test("detects Tier 2 AI vocabulary", () => {
    const text =
      "This crucial and robust framework will leverage significant and innovative solutions to streamline operations.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "ai-vocab-t2");
    expect(hit).toBeDefined();
  });

  test("detects Tier 3 AI vocabulary", () => {
    const text =
      "We can enhance and optimize the methodology to utilize a holistic ecosystem framework.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "ai-vocab-t3");
    expect(hit).toBeDefined();
  });

  test("no false positive for plain human text", () => {
    const text = "I went to the store and bought milk. It was cold outside.";
    const result = analyzeText(text);
    const hit1 = result.patterns.find((p) => p.id === "ai-vocab-t1");
    const hit2 = result.patterns.find((p) => p.id === "ai-vocab-t2");
    expect(hit1).toBeUndefined();
    expect(hit2).toBeUndefined();
  });
});

// ---- Phrase Pattern Tests ----

describe("Phrase patterns (4–8)", () => {
  test("detects sycophantic phrases", () => {
    const text = "That's a great question! Certainly, I'd be happy to help you.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "sycophantic");
    expect(hit).toBeDefined();
    expect(hit!.hits).toBeGreaterThan(0);
  });

  test("detects filler phrases", () => {
    const text =
      "It's important to note that when it comes to AI, it's worth mentioning that progress is rapid.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "filler");
    expect(hit).toBeDefined();
  });

  test("detects generic conclusions", () => {
    const text = "In conclusion, to sum up, as we have seen, this is clear.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "generic-conclusion");
    expect(hit).toBeDefined();
    expect(hit!.hits).toBeGreaterThanOrEqual(3);
  });

  test("detects hedging language", () => {
    const text =
      "It could be argued that one might say this is generally accepted to some extent.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "hedging");
    expect(hit).toBeDefined();
  });

  test("detects transition overuse", () => {
    const text =
      "However, the results are clear. Nevertheless, we must consider more. Consequently, action is needed. Subsequently, changes will follow.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "transition-overuse");
    expect(hit).toBeDefined();
    expect(hit!.hits).toBeGreaterThanOrEqual(3);
  });
});

// ---- Structural Pattern Tests ----

describe("Structural patterns (9–14)", () => {
  test("detects repetitive sentence starters", () => {
    const text =
      "This is the first point. This is the second point. This is the third point. This is the fourth. Something else here.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "repetitive-starters");
    expect(hit).toBeDefined();
    expect(hit!.hits).toBeGreaterThan(0);
  });

  test("does not flag varied sentence starters", () => {
    const text =
      "He went to the store. She called her friend. They met for coffee. We discussed the plan.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "repetitive-starters");
    expect(hit).toBeUndefined();
  });

  test("detects list-heavy structure", () => {
    const text = `Here are the points:
- First item
- Second item
- Third item
- Fourth item
- Fifth item
Summary line.`;
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "list-heavy");
    expect(hit).toBeDefined();
  });

  test("detects uniform paragraph length", () => {
    const uniform = [
      "The first paragraph has exactly ten words here today.",
      "The second paragraph has exactly ten words here today.",
      "The third paragraph has exactly ten words here today.",
      "The fourth paragraph has exactly ten words here today.",
    ].join("\n\n");
    const result = analyzeText(uniform);
    const hit = result.patterns.find((p) => p.id === "uniform-paragraphs");
    expect(hit).toBeDefined();
  });

  test("detects perfect grammar (no contractions)", () => {
    const longFormalText = Array(15)
      .fill(
        "The organization has implemented a comprehensive strategy to facilitate the achievement of its primary objectives."
      )
      .join(" ");
    const result = analyzeText(longFormalText);
    const hit = result.patterns.find((p) => p.id === "perfect-grammar");
    expect(hit).toBeDefined();
  });

  test("does not flag text with contractions", () => {
    const text = Array(10)
      .fill("I don't think that's the right approach. We can't ignore it.")
      .join(" ");
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "perfect-grammar");
    expect(hit).toBeUndefined();
  });

  test("detects formulaic introduction", () => {
    const text =
      "In today's rapidly evolving landscape, it is important to understand the role of technology. This affects everyone.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "formulaic-intro");
    expect(hit).toBeDefined();
  });

  test("detects formulaic conclusion", () => {
    const text =
      "Some context here.\n\nIn conclusion, as we have seen, moving forward it is clear that everything works out.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "formulaic-conclusion");
    expect(hit).toBeDefined();
  });
});

// ---- Semantic Pattern Tests ----

describe("Semantic patterns (15–19)", () => {
  test("detects over-explanation", () => {
    const text =
      "The API (also known as Application Programming Interface) allows communication, which means data can flow between systems, defined as a software bridge.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "over-explanation");
    expect(hit).toBeDefined();
  });

  test("detects excessive qualifiers", () => {
    const text =
      "This is very extremely highly particularly especially important. It is incredibly absolutely utterly remarkably significant.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "excessive-qualifiers");
    expect(hit).toBeDefined();
  });

  test("detects balanced viewpoint overuse", () => {
    // Dense use of balancing words: > 1 per 100 words total
    const sentence =
      "However, while this is true, although that applies, nevertheless we see it. On the other hand, while considering this, however the outcome differs. Nevertheless, while examining results, however data shows otherwise. Although patterns emerge, while trends continue, however conclusions remain. Nevertheless, while the evidence suggests, although results vary, however we note.";
    const result = analyzeText(sentence);
    const hit = result.patterns.find((p) => p.id === "balanced-viewpoint");
    expect(hit).toBeDefined();
  });

  test("detects no-personality in long impersonal text", () => {
    // Long text with no ?, !, —, (), or first-person
    const personalitylessText = Array(15)
      .fill(
        "The system processes requests and returns appropriate responses. The output depends on the input parameters provided."
      )
      .join(" ");
    const result = analyzeText(personalitylessText);
    const hit = result.patterns.find((p) => p.id === "no-personality");
    expect(hit).toBeDefined();
  });

  test("does not flag personality-rich text", () => {
    const text =
      "I love this! Isn't it amazing? My favorite part is the design — especially (and I can't stress this enough) the color scheme.";
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "no-personality");
    expect(hit).toBeUndefined();
  });
});

// ---- Statistical Pattern Tests ----

describe("Statistical patterns (20–24)", () => {
  test("detects low burstiness on uniform sentences", () => {
    // All sentences ~same length
    const text = [
      "This sentence has exactly seven words here.",
      "Another sentence with exactly seven words here.",
      "Yet another with exactly seven words here.",
      "One more with exactly seven words count.",
      "This one also has seven words here.",
      "And this one too has seven words.",
    ].join(" ");
    const result = analyzeText(text);
    // Burstiness should be low for uniform sentences
    expect(result.stats.burstiness).toBeLessThan(0.4);
  });

  test("detects low perplexity with predictable starters", () => {
    const text = [
      "The first thing to consider is the context.",
      "This means we need to evaluate the options.",
      "In many cases the answer is straightforward.",
      "When considering the factors involved in this decision.",
      "The outcome depends on several important variables.",
      "This approach is commonly used in practice.",
      "In some situations the result may differ.",
      "The analysis shows that the trend continues.",
      "This pattern is observed across multiple datasets.",
      "The conclusion follows naturally from the evidence.",
    ].join(" ");
    const result = analyzeText(text);
    const hit = result.patterns.find((p) => p.id === "low-perplexity");
    expect(hit).toBeDefined();
  });

  test("stats object has all required fields", () => {
    const result = analyzeText(AI_TEXT);
    expect(result.stats).toHaveProperty("burstiness");
    expect(result.stats).toHaveProperty("typeTokenRatio");
    expect(result.stats).toHaveProperty("avgSentenceLength");
    expect(result.stats).toHaveProperty("fleschReadingEase");
    expect(typeof result.stats.burstiness).toBe("number");
    expect(typeof result.stats.typeTokenRatio).toBe("number");
  });
});

// ---- New Pattern Tests ----

describe("New patterns", () => {
  it("detects em dash overuse", () => {
    const text = "The solution — which was remarkable — provided value — and more — in ways unprecedented.";
    const result = analyzeText(text);
    expect(result.patterns.some(p => p.id === "em-dash-overuse")).toBe(true);
  });

  it("detects passive voice excess", () => {
    const text = "The document was written by the team. The results were analyzed. The findings were presented. The conclusions were drawn. The report was submitted.";
    const result = analyzeText(text);
    expect(result.patterns.some(p => p.id === "passive-voice")).toBe(true);
  });

  it("scores ChatGPT-typical text above 70", () => {
    const text = `In today's rapidly evolving landscape — it is important to note that artificial intelligence has become a pivotal and transformative force. Furthermore, this nuanced and comprehensive approach underscores the multifaceted nature of modern technology. Moreover, leveraging these robust and scalable solutions can seamlessly streamline workflows and holistically foster innovation. The groundbreaking advancements in this space are truly unprecedented. As we look to the future, the possibilities are endless.`;
    const result = analyzeText(text);
    expect(result.score).toBeGreaterThan(70);
  });

  it("scores casual human text below 30", () => {
    const text = `I've been thinking about this a lot lately. Honestly? I don't know what to do. My friend called me yesterday (we hadn't talked in months) and we just... talked. About nothing really. She said something that stuck with me: "sometimes the best thing you can do is nothing." Maybe she's right. I'm still not sure.`;
    const result = analyzeText(text);
    expect(result.score).toBeLessThan(30);
  });

  it("penalizes — em dashes heavily", () => {
    const shortText = "This solution — which is innovative — provides value — beyond expectations.";
    const result = analyzeText(shortText);
    expect(result.patterns.some(p => p.id === "em-dash-overuse")).toBe(true);
  });
});

// ---- Edge Cases ----

describe("Edge cases", () => {
  test("handles very short text", () => {
    const result = analyzeText("Hello world.");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  test("handles text with only one sentence", () => {
    const result = analyzeText("The quick brown fox jumps over the lazy dog.");
    expect(result.wordCount).toBeGreaterThan(0);
  });

  test("word count is accurate", () => {
    const text = "One two three four five.";
    const result = analyzeText(text);
    expect(result.wordCount).toBe(5);
  });

  test("pattern examples are strings", () => {
    const result = analyzeText(AI_TEXT);
    for (const pattern of result.patterns) {
      expect(Array.isArray(pattern.examples)).toBe(true);
      for (const ex of pattern.examples) {
        expect(typeof ex).toBe("string");
      }
    }
  });
});
