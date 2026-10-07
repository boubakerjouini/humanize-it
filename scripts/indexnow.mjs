/**
 * Submit every URL in the live sitemap to IndexNow (Bing, Yandex, Seznam,
 * Naver and the other participating engines share submissions).
 *
 * Bing is the engine actually sending us traffic, and an IndexNow ping gets
 * changed pages recrawled in hours instead of whenever Bingbot comes back.
 * Run it after a deploy that changes content.
 *
 * The key is the single public/<32 hex chars>.txt file: it is served at
 * https://humanizeit.app/<key>.txt, which is how IndexNow checks we own the
 * host. The middleware skips .txt files, so the key is always reachable.
 *
 * Submit:
 *   npm run seo:indexnow
 * Dry run (fetch the sitemap and list the URLs, submit nothing):
 *   npm run seo:indexnow -- --dry-run
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOST = "humanizeit.app";
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
// Protocol limit per POST.
const MAX_URLS_PER_REQUEST = 10_000;

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** The IndexNow key, read from the one public/<key>.txt file (which must contain the key itself). */
export function readKey(dir = PUBLIC_DIR) {
  const files = readdirSync(dir).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (files.length !== 1) {
    throw new Error(`expected exactly one key file (public/<32 hex chars>.txt), found ${files.length}`);
  }
  const key = readFileSync(join(dir, files[0]), "utf8").trim();
  if (`${key}.txt` !== files[0]) throw new Error(`public/${files[0]} must contain its own key`);
  return key;
}

/** Unique <loc> URLs on our host, in sitemap order. */
export function extractLocs(xml) {
  const urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  return [...new Set(urls)].filter((u) => new URL(u).host === HOST);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const key = readKey();

  const res = await fetch(SITEMAP_URL);
  if (!res.ok) throw new Error(`GET ${SITEMAP_URL} -> HTTP ${res.status}`);
  const urlList = extractLocs(await res.text());
  if (urlList.length === 0) throw new Error(`no <loc> URLs for ${HOST} in ${SITEMAP_URL}`);
  console.log(`${urlList.length} URLs in ${SITEMAP_URL}`);

  if (dryRun) {
    for (const url of urlList) console.log(`  ${url}`);
    return;
  }

  for (let i = 0; i < urlList.length; i += MAX_URLS_PER_REQUEST) {
    const batch = urlList.slice(i, i + MAX_URLS_PER_REQUEST);
    const submit = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: batch }),
    });
    // 200 = accepted; 202 = accepted, key verification still pending.
    // 403 = key file not reachable/mismatched, 422 = URL not on host, 429 = slow down.
    if (submit.status !== 200 && submit.status !== 202) {
      throw new Error(`IndexNow -> HTTP ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
    }
    console.log(`Submitted ${batch.length} URLs (HTTP ${submit.status}).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`indexnow: ${err.message}`);
    process.exit(1);
  });
}
