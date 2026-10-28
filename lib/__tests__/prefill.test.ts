import { savePrefill, takePrefill, PREFILL_KEY, PREFILL_TTL_MS } from "@/lib/prefill";

// jest runs in node: a minimal sessionStorage stand-in.
function installStorage() {
  const map = new Map<string, string>();
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
  return map;
}

describe("prefill handoff", () => {
  let store: Map<string, string>;
  let now: jest.SpyInstance<number, []>;

  beforeEach(() => {
    store = installStorage();
    now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
  });
  afterEach(() => now.mockRestore());

  it("round-trips the text once, then the key is gone", () => {
    savePrefill("Some pasted text");
    expect(store.has(PREFILL_KEY)).toBe(true);
    expect(takePrefill()).toBe("Some pasted text");
    expect(store.has(PREFILL_KEY)).toBe(false);
    expect(takePrefill()).toBeNull();
  });

  it("ignores and removes text older than 30 minutes", () => {
    savePrefill("old draft");
    now.mockReturnValue(1_000_000 + PREFILL_TTL_MS + 1);
    expect(takePrefill()).toBeNull();
    expect(store.has(PREFILL_KEY)).toBe(false);
  });

  it("keeps text right up to the 30-minute mark", () => {
    savePrefill("recent draft");
    now.mockReturnValue(1_000_000 + PREFILL_TTL_MS);
    expect(takePrefill()).toBe("recent draft");
  });

  it("does not store blank text", () => {
    savePrefill("   ");
    expect(store.size).toBe(0);
  });

  it("drops a legacy plain-string value instead of showing it", () => {
    store.set(PREFILL_KEY, "raw text from an older build");
    expect(takePrefill()).toBeNull();
    expect(store.has(PREFILL_KEY)).toBe(false);
  });

  it("never throws when storage is unavailable", () => {
    (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(() => savePrefill("x y z")).not.toThrow();
    expect(takePrefill()).toBeNull();
  });
});
