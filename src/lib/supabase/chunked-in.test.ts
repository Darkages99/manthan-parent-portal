import { describe, expect, it } from "vitest";
import { fetchInChunks } from "./chunked-in";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id${i}`);

describe("fetchInChunks", () => {
  it("makes no query for an empty id list", async () => {
    let calls = 0;
    const rows = await fetchInChunks<string>([], async () => {
      calls++;
      return { data: [], error: null };
    });
    expect(rows).toEqual([]);
    expect(calls).toBe(0);
  });

  it("splits into chunks of at most 200 and concatenates in order", async () => {
    const sizes: number[] = [];
    const rows = await fetchInChunks<string>(ids(450), async (chunk) => {
      sizes.push(chunk.length);
      return { data: chunk, error: null };
    });
    expect(sizes).toEqual([200, 200, 50]);
    expect(rows).toEqual(ids(450));
  });

  it("a single chunk at the boundary stays one query", async () => {
    let calls = 0;
    await fetchInChunks<string>(ids(200), async (c) => {
      calls++;
      return { data: c, error: null };
    });
    expect(calls).toBe(1);
  });

  it("treats null data as no rows", async () => {
    expect(await fetchInChunks<string>(["a"], async () => ({ data: null, error: null }))).toEqual([]);
  });

  it("throws if any chunk errors, rather than returning a partial result", async () => {
    let n = 0;
    await expect(
      fetchInChunks<string>(ids(450), async (c) =>
        ++n === 2 ? { data: null, error: { message: "boom" } } : { data: c, error: null },
      ),
    ).rejects.toThrow("boom");
  });
});
