import * as XLSX from "xlsx";
import { parseCalendarWorkbook } from "../src/lib/fanta/calendar-import";

const teams = [
  { id: 19041868, name: "Grinta FC" },
  { id: 19042426, name: "Blaugrana FC" },
  { id: 19042786, name: "FlorianF2" },
  { id: 19087691, name: "La Xhokatore Di Ardit Shehi" },
  { id: 19087856, name: "KoloKolo" },
  { id: 19087870, name: "gonxheramosaj" },
];

// Shapes the real export plausibly takes, to check the parser is not brittle.
const layouts: Record<string, unknown[][]> = {
  "headers + home/away columns": [
    ["Calendario Shkupi Fantacalcio 2026/27"],
    [],
    ["1ª giornata - 1ª Serie A"],
    ["KoloKolo", "3 - 3", "Grinta FC"],
    ["Blaugrana FC", "1 - 2", "FlorianF2"],
    ["gonxheramosaj", "2 - 1", "La Xhokatore Di Ardit Shehi"],
    [],
    ["2ª giornata - 2ª Serie A"],
    ["FlorianF2", "2 - 2", "KoloKolo"],
    ["La Xhokatore Di Ardit Shehi", "2 - 2", "Blaugrana FC"],
    ["Grinta FC", "3 - 0", "gonxheramosaj"],
  ],
  "matchweek in its own column": [
    ["Giornata", "Casa", "Ospite"],
    ["Giornata 1", "KoloKolo", "Grinta FC"],
    ["Giornata 1", "Blaugrana FC", "FlorianF2"],
    ["Giornata 2", "FlorianF2", "KoloKolo"],
  ],
  "upper case and stray spacing": [
    ["3° GIORNATA"],
    ["  kolokolo ", "VS", "LA XHOKATORE DI ARDIT SHEHI"],
    ["BLAUGRANA FC", "VS", "GONXHERAMOSAJ"],
  ],
};

for (const [label, rows] of Object.entries(layouts)) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Calendario");
  const buf = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  const result = parseCalendarWorkbook(buf, teams);
  const name = new Map(teams.map((t) => [t.id, t.name]));
  console.log(`=== ${label} ===`);
  console.log(`  ${result.fixtures.length} fixtures across ${result.matchweeks} matchweeks`);
  for (const f of result.fixtures) {
    console.log(`    MW${f.matchweek}  ${name.get(f.homeTeamId)}  vs  ${name.get(f.awayTeamId)}`);
  }
  if (result.warnings.length) console.log("  warnings:", result.warnings.join(" / "));
  console.log();
}
