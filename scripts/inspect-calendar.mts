/** Dumps a calendar export so its layout can be read before parsing it. */
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: npx tsx scripts/inspect-calendar.mts <file.xlsx>");
  process.exit(1);
}

const book = XLSX.read(readFileSync(path), { type: "buffer" });
console.log("sheets:", book.SheetNames.join(", "), "\n");

for (const name of book.SheetNames) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], {
    header: 1,
    blankrows: false,
    defval: "",
  });
  console.log(`=== ${name} — ${rows.length} rows ===`);
  for (const row of rows.slice(0, 40)) {
    const cells = row.map((c) => String(c ?? "").trim());
    if (cells.some(Boolean)) console.log("  ", cells.join(" | "));
  }
  console.log();
}
