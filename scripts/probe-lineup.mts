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
const get = async (p: string) => {
  const r = await fetch(`https://apileague.fantacalcio.it${p}`, { headers: H, cache: "no-store" });
  return { status: r.status, body: r.ok ? await r.json() : await r.text() };
};

for (const mw of [1, 2, 3]) {
  const r = await get(`/gaming/v1/teamLineup/visualizza/282277/${mw}`);
  const str = JSON.stringify(r.body);
  console.log(`=== matchweek ${mw}: ${r.status}, ${str.length} bytes ===`);
  if (r.status === 200) {
    writeFileSync(`/tmp/lineup-${mw}.json`, JSON.stringify(r.body, null, 1));
    console.log(str.slice(0, 700));
  } else console.log(str.slice(0, 200));
  console.log();
}
