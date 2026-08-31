# FantaLive

Live fantacalcio for your own league: standings, the head-to-head score, and the
bench substitutions, all recomputed while the Serie A matches are being played.

## Where the data comes from

There is **no public API for private fantacalcio leagues**. Both of Leghe
Fantacalcio's own backends are fully authenticated:

| Endpoint | Without credentials |
| --- | --- |
| `https://apileague.fantacalcio.it/{service}/v1/…` | `401 ATH008 — Bearer token missing` |
| `https://leghe.fantacalcio.it/servizi/v1_leghe…` | `AD05 — non hai le credenziali` |

Their web client authenticates with an `app_key` header plus a per-league bearer
token obtained from a user login, so league rosters and standings simply are not
readable without that user's own account.

What *is* public is the live match data. Leghe Fantacalcio publishes each
matchweek to an unauthenticated CloudFront bucket, and its own client polls it
during matches:

```
https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/dati/live/{seasonId}/live_{matchweek}.json
```

No key, no rate limit, one small JSON per matchweek. It carries, for every Serie
A player: the match rating, every bonus/malus event with its minute, who came on
for whom, and the live score and status of all ten fixtures. Season `21` is
2026/27.

FantaLive is built on that feed. You bring the league — teams and rosters — and
everything else is derived live. `src/lib/fanta/decode.ts` documents the wire
format, which was reverse engineered from the official client bundle.

### Feed quirks worth knowing

- A rating above `10` is a sentinel, not a score: `56` means no vote, `55` means
  the player appeared but was left *senza voto*. Valid ratings are `<= 10`.
- The **sign of an event's minute encodes the half**: negative is the first half,
  positive the second. `-48` is 45+3, `96` is 90+6.
- `pp` is the probable-lineup percentage. After kickoff, `pp === 100` identifies
  exactly the players who started.
- The bucket denies listing, so a matchweek that does not exist returns `403`
  rather than `404`.

## What it computes

Fantacalcio Classic rules, all configurable per league in `src/lib/fanta/rules.ts`:

- **Fantavoto** — rating plus bonus/malus (gol +3, assist +1, rigore parato +3,
  rigore sbagliato −3, autogol −2, giallo −0.5, rosso −1, gol subito −1).
- **Automatic substitutions** — a starter left without a vote is replaced by the
  first bench player of the same role who does have one, in the manager's bench
  order, up to the league's cap. Slots that cannot be filled score nothing.
- **Modificatore difesa** — the goalkeeper's rating averaged with the best three
  defenders', bonuses excluded, looked up in the league's bands. It does not
  apply unless at least four defenders were rated.
- **Goal conversion** — 66 fantapunti for the first goal, then one every 6.
- **Standings** — 3/1/0, ordered by points, goal difference, goals scored, then
  total fantapunti.

Lineups you have not set are filled automatically, ranked by the probable-lineup
percentage and never by the rating a player ended up with. Picking by rating
would be hindsight and the bench would never be needed.

## Running it

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>. "Prova con una lega dimostrativa" drafts a
league from real Serie A players and drops you straight into a live dashboard.

Leagues are stored as JSON under `.data/leagues/`, one file per league code.

```bash
pnpm check:feed      # fetch the live feed and print scores, votes and subs
pnpm check:calendar  # verify round-robin generation
pnpm build           # production build
```

## Design notes

Mobile first, in the literal sense: the phone layout is the one that was
designed, and the desktop layout is the same thing given more room. Navigation
sits in a bottom tab bar within thumb reach; squads, standings and head-to-heads
switch sides with a segmented control rather than sitting in two columns; match
detail opens in a drag-to-dismiss sheet.

Two rules shaped the motion:

1. **Entrances are CSS, interactions are JS.** A `requestAnimationFrame`-driven
   entrance leaves content stranded at `opacity: 0` if a frame never arrives —
   a throttled background tab, a paused animation, a device under load. Every
   entrance is therefore a CSS keyframe with `animation-fill-mode: both`, and
   the collapse on a head-to-head is a `grid-template-rows: 0fr → 1fr`
   transition rather than an animated height. Framer Motion is reserved for
   things a user gesture triggers, where a visible page is guaranteed: the
   sheet drag, the segmented pill, tab crossfades, and the springing score
   counters.
2. **Reduced motion lands on the finished state**, never the initial one.

The pitch view is the one piece of real information design here: the eleven are
placed by the actual module, tinted by live fantavoto, with a badge on anyone
the bench engine brought on.

## How live updates work

One server-side poller (`src/lib/live-hub.ts`) fetches the bucket for everyone:
every 10s while a match is in play, 20s near kickoff, 120s otherwise. It
fingerprints the payload and only bumps a version counter when something
actually changed. Clients subscribe over SSE at `/api/live/stream` and refetch
their own view on a version change, so scores flash green or red as they move
and idle tabs stay silent between matchweeks.

## Not affiliated

Independent project. Not affiliated with or endorsed by Fantacalcio®, Leghe
Fantacalcio or Lega Serie A.
