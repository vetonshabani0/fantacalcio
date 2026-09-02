import { writeFileSync } from "node:fs";
import { login } from "../src/lib/fanta/official";

const s = await login(process.env.FC_USER!, process.env.FC_PASS!);
const l = s.leagues[0];
const H = {
  app_key: "ICiELOObd5DF5uJEATi77CRvHiiRuMU0",
  cookie: s.cookie,
  authorization: `Bearer ${l.jwt}`,
  "user-agent": "Mozilla/5.0",
  accept: "application/json",
};

// getMatch(competitionId, matchweek, realMatchweek, teamA, teamB)
const url = `https://apileague.fantacalcio.it/gaming/v1/teamLineup/282277/1/1/19087856/19041868`;
const r = await fetch(url, { headers: H, cache: "no-store" });
console.log("status:", r.status);
const body = r.ok ? await r.json() : await r.text();
const str = JSON.stringify(body);
console.log("bytes:", str.length);
if (r.ok) {
  writeFileSync("/tmp/match.json", JSON.stringify(body, null, 1));
  console.log("top keys:", Object.keys(body as object).join(", "));
  console.log(str.slice(0, 900));
} else console.log(str.slice(0, 300));
