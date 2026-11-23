import { test } from "node:test";
import { strict as assert } from "node:assert";
import { makeZip } from "../src/features/funnelworks/carouselZip";

function readU16(b: Uint8Array, p: number) { return b[p] | (b[p + 1] << 8); }
function readU32(b: Uint8Array, p: number) { return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0; }

test("FunnelWorks ZIP contains seven distinct PNG entries and valid central directory", () => {
  const files = Array.from({ length: 7 }, (_, i) => ({
    name: `slide-${String(i + 1).padStart(2, "0")}.png`,
    data: new Uint8Array([137, 80, 78, 71, i])
  }));
  const zip = makeZip(files);
  const footer = zip.length - 22;
  assert.equal(readU32(zip, footer), 0x06054b50);
  assert.equal(readU16(zip, footer + 10), 7);
  const centralOffset = readU32(zip, footer + 16);
  let offset = centralOffset;
  const names: string[] = [];
  for (let i = 0; i < 7; i++) {
    assert.equal(readU32(zip, offset), 0x02014b50);
    const nameLength = readU16(zip, offset + 28);
    const extraLength = readU16(zip, offset + 30);
    const commentLength = readU16(zip, offset + 32);
    names.push(new TextDecoder().decode(zip.subarray(offset + 46, offset + 46 + nameLength)));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.deepEqual(names, files.map(f => f.name));
  assert.equal(offset, footer);
});

test("FunnelWorks ZIP supports an empty archive", () => {
  const zip = makeZip([]);
  assert.equal(zip.length, 22);
  assert.equal(readU32(zip, 0), 0x06054b50);
});
