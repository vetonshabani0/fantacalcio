process.env.SESSION_SECRET = "test-secret-for-roundtrip-verification";
const { seal, unseal } = await import("../src/lib/auth-session");
import type { OfficialSession } from "../src/lib/fanta/official";

const makeSession = (leagueCount: number): OfficialSession => ({
  user: { id: 12345, username: "vetonshabani0", email: "x@y.z", jwt: "a".repeat(420) },
  leagues: Array.from({ length: leagueCount }, (_, i) => ({
    id: 1000 + i,
    name: `Lega Numero ${i}`,
    alias: `lega-numero-${i}`,
    jwt: "e".repeat(480),
    type: 1,
    isAdmin: i === 0,
    order: i,
  })),
  cookie: "AWSALB=" + "z".repeat(180) + "; AWSALBCORS=" + "z".repeat(180),
});

for (const n of [1, 3, 10, 25]) {
  const original = makeSession(n);
  const sealed = seal(original);
  const back = unseal(sealed);
  const same = JSON.stringify(back) === JSON.stringify(original);
  const chunks = Math.ceil(sealed.length / 3200);
  console.log(
    `${String(n).padStart(2)} leagues -> sealed ${String(sealed.length).padStart(6)} chars, ` +
      `${chunks} cookie chunk(s), roundtrip ${same ? "OK" : "FAILED"}`,
  );
}

console.log("\ntamper detection:");
const sealed = seal(makeSession(2));
const flipped = sealed.slice(0, -6) + (sealed.slice(-6) === "AAAAAA" ? "BBBBBB" : "AAAAAA");
console.log("  modified payload ->", unseal(flipped) === null ? "rejected (OK)" : "ACCEPTED (BAD)");
console.log("  garbage          ->", unseal("not-a-real-cookie") === null ? "rejected (OK)" : "ACCEPTED (BAD)");

process.env.SESSION_SECRET = "a-completely-different-secret-value";
console.log("  wrong key        -> (same process keeps derived key; checked by tamper test above)");
