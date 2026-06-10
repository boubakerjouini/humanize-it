/**
 * Generate a labeled AI corpus for the detector eval, using the real Anthropic
 * model (representative of what users actually paste). Saves .txt fixtures to
 * tests/fixtures/detector/ai/. Run once:
 *
 *   npx tsx scripts/gen-corpus.ts
 */

import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set (.env.local)");
const client = new Anthropic({ apiKey });
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

const OUT = join(__dirname, "..", "tests", "fixtures", "detector", "ai");
mkdirSync(OUT, { recursive: true });

const TOPICS = [
  ["essay", "Write a ~280-word essay on whether remote work is good for society."],
  ["blog", "Write a ~280-word blog post with tips for staying productive while working from home."],
  ["email", "Write a ~200-word professional email politely declining a partnership proposal."],
  ["product", "Write a ~220-word product description for a premium stainless-steel coffee maker."],
  ["explainer", "Explain in ~260 words how photosynthesis works, for a high-school audience."],
  ["story", "Write the ~260-word opening of a literary short story about a woman returning to her childhood home."],
];

// Two styles: default, and an adversarial "sound human" prompt (the hard case).
const STYLES: { key: string; system: string }[] = [
  { key: "default", system: "You are a helpful writing assistant. Write clean, well-structured prose. Output only the text." },
  { key: "humanlike", system: "You are a writing assistant. Write so it sounds like a real human wrote it: vary sentence length a lot, use contractions, a casual personal voice, the occasional fragment, and avoid clichés. Output only the text." },
];

async function gen(prompt: string, system: string): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    temperature: 1,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content[0];
  return block && block.type === "text" ? block.text.trim() : "";
}

async function main() {
  let n = 0;
  for (const [genre, prompt] of TOPICS) {
    for (const style of STYLES) {
      const text = await gen(prompt, style.system);
      if (text.length < 100) { console.log(`! short/empty: ${genre}-${style.key}`); continue; }
      const file = join(OUT, `${genre}-${style.key}.txt`);
      writeFileSync(file, text + "\n");
      n++;
      console.log(`✓ ${genre}-${style.key}  (${text.split(/\s+/).length} words)`);
    }
  }
  console.log(`\nWrote ${n} AI samples to ${OUT}`);
}

main().catch((e) => { console.error("✗", e instanceof Error ? e.message : e); process.exit(1); });
