import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("toCsv", () => {
  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });

  it("uses the first row's keys as the header and CRLF between rows", () => {
    expect(toCsv([{ a: 1, b: "x" }, { a: 2, b: "y" }])).toBe("a,b\r\n1,x\r\n2,y");
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCsv([{ a: null, b: undefined, c: 0 }])).toBe("a,b,c\r\n,,0");
  });

  it("quotes cells containing commas, quotes or newlines, doubling inner quotes", () => {
    expect(toCsv([{ v: "a,b" }])).toBe('v\r\n"a,b"');
    expect(toCsv([{ v: 'say "hi"' }])).toBe('v\r\n"say ""hi"""');
    expect(toCsv([{ v: "line1\nline2" }])).toBe('v\r\n"line1\nline2"');
  });

  describe("formula injection", () => {
    it.each(["=1+1", "+1", "-1", "@SUM(A1)", "\tcmd", "\rcmd"])("neutralises a cell starting with %j", (cell) => {
      const out = toCsv([{ v: cell }]).split("\r\n").slice(1).join("\r\n");
      // The cell must no longer begin with the dangerous character.
      expect(out.replace(/^"/, "").startsWith("'")).toBe(true);
    });

    it("leaves ordinary text and mid-string symbols alone", () => {
      expect(toCsv([{ v: "Asha = great" }])).toBe("v\r\nAsha = great");
      expect(toCsv([{ v: "a-b" }])).toBe("v\r\na-b");
    });

    it("also neutralises dangerous header names", () => {
      expect(toCsv([{ "=evil": 1 }]).split("\r\n")[0]).toBe("'=evil");
    });

    it("prefixes before quoting so a formula with a comma stays inert", () => {
      expect(toCsv([{ v: '=HYPERLINK("x","y")' }])).toBe('v\r\n"\'=HYPERLINK(""x"",""y"")"');
    });
  });
});

describe("parseCsv", () => {
  it("splits header and rows, accepting LF and CRLF", () => {
    expect(parseCsv("a,b\n1,2\r\n3,4\n")).toEqual({ header: ["a", "b"], rows: [["1", "2"], ["3", "4"]] });
  });

  it("handles quoted commas, escaped quotes and embedded newlines", () => {
    const { rows } = parseCsv('h\n"a,b"\n"say ""hi"""\n"l1\nl2"\n');
    expect(rows).toEqual([["a,b"], ['say "hi"'], ["l1\nl2"]]);
  });

  it("trims header cells but not data cells", () => {
    expect(parseCsv(" a , b \n x , y ")).toEqual({ header: ["a", "b"], rows: [[" x ", " y "]] });
  });

  it("skips fully blank lines but keeps rows with some empty cells", () => {
    expect(parseCsv("a,b\n\n1,\n,\n,2").rows).toEqual([["1", ""], ["", "2"]]);
  });

  it("returns an empty header for empty input", () => {
    expect(parseCsv("")).toEqual({ header: [], rows: [] });
  });

  it("round-trips toCsv output for ordinary data", () => {
    const rows = [
      { name: "Asha, K", note: 'says "hi"', n: "7" },
      { name: "Ravi", note: "line1\nline2", n: "" },
    ];
    const { header, rows: parsed } = parseCsv(toCsv(rows));
    expect(header).toEqual(["name", "note", "n"]);
    expect(parsed).toEqual(rows.map((r) => [r.name, r.note, r.n]));
  });
});
