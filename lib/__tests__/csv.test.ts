import { CSV_BOM, csvCell, toCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("leaves plain values alone", () => {
    expect(csvCell("Ada")).toBe("Ada");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(true)).toBe("true");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("a\r\nb")).toBe('"a\r\nb"');
  });

  it.each(["=SUM(A1:A2)", "+1 555", "-2+3", "@cmd", "\tx", "\rx"])("prefixes a quote to the formula-like cell %j", (raw) => {
    const out = csvCell(raw);
    expect(out.replace(/^"/, "").startsWith("'")).toBe(true);
  });

  it("guards a formula that also needs quoting", () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
  });

  it("does not touch negative numbers passed as numbers", () => {
    expect(csvCell(-5)).toBe("-5");
  });

  it("joins arrays and formats dates as ISO", () => {
    expect(csvCell(["tips", "extension_launch"])).toBe("tips; extension_launch");
    expect(csvCell(new Date("2026-10-06T08:00:00Z"))).toBe("2026-10-06T08:00:00.000Z");
    expect(csvCell(new Date("nope"))).toBe("");
  });
});

describe("toCsv", () => {
  it("writes a BOM, a header and CRLF rows", () => {
    const csv = toCsv(
      [
        { email: "a@example.com", name: "=evil()" },
        { email: "b@example.com", name: "Bo, Jr." },
      ],
      [
        { header: "email", value: (r) => r.email },
        { header: "name", value: (r) => r.name },
      ]
    );
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.slice(1)).toBe('email,name\r\na@example.com,\'=evil()\r\nb@example.com,"Bo, Jr."\r\n');
  });

  it("writes only the header for no rows", () => {
    expect(toCsv([], [{ header: "id", value: () => "" }])).toBe(`${CSV_BOM}id\r\n`);
  });
});
