# FantaLive

Live fantacalcio for your own league: standings, the head-to-head score, and the
bench substitutions, all recomputed while the Serie A matches are being played.

## Where the data comes from

Two sources, both public, neither needing an account.

### Real leagues, without signing in

Most of the authenticated API refuses anonymous callers — `apileague.fantacalcio.it`
answers `ATH008 Bearer token missing`, and most of `/servizi/v1_leghe*` answers
`AD05`. It is tempting to conclude that league data is unreachable without
credentials. It is not.

The legacy web pages are still served, and two of them are public:

| Page | What it gives away |
| --- | --- |
| `/{alias}/squadre` | the entire competition as JSON in a `currentCompetition` config block — **the full standings** — plus every team's name, manager and badge, base64-encoded in `__.s('lt', __.dp('…'))` |
| `/{alias}/info-squadra?t={id}` | one team's name and badge, in OpenGraph meta tags. Only a fallback now |
| `/{alias}/classifica` | nothing — it redirects to the login wall |

So the standings come from the page that appears to be about squads. The team
names look absent from it, because the page renders its cards client-side from
Handlebars templates and the markup carries only ids — but the data those
templates consume is on the page all along, in the encoded blob. The same blob
that carries the names has its `cal` roster field blanked for anonymous callers,
which is the one deliberate redaction.

A handful of legacy services also answer on the app key their own JavaScript
ships, with no session behind it:

| Service | What it returns |
| --- | --- |
| `V1_LegheStatistiche/Statistiche` | a line per **owned player** for one team — the roster, spelled as season statistics |
| `V1_LegheStatistiche/Confronto` | per-matchweek points and fantapoints for a team |
| `v1_leghe/leghepubbliche` | the site's own public-league directory, searchable by name |

Leagues are discoverable two ways. The directory above covers leagues that opted
into being listed; everything else is guessed, since an alias is a slug of the
league's name and `/{alias}/classifica` redirects to `/{alias}` for a league that
exists and to `/404` for one that does not — a credential-free existence check.

`src/lib/fanta/public-league.ts` implements all of this.

### Live Serie A data

Leghe Fantacalcio publishes each matchweek to an unauthenticated CloudFront
bucket, and its own client polls it during matches:

```
https://d2lhpso9w1g8dk.cloudfront.net/web/risorse/dati/live/{seasonId}/live_{matchweek}.json
```

No key, no rate limit. It carries, for every Serie A player: the match rating,
every bonus/malus event with its minute, who came on for whom, and the live score
and status of all ten fixtures. Season `21` is 2026/27. `src/lib/fanta/decode.ts`
documents the wire format, reverse engineered from the official client bundle.

Signing in with your own account remains supported. It is the only way to read a
league that exposes nothing publicly, and the only way to see what each player
cost and who actually played whom.

### The live score of a round nobody has calculated yet

Two things stay behind the login wall, verified endpoint by endpoint: the
**calendar** (`v1_legheCompetizione/calendario`, `ClassificaGiornate`, the Excel
export and the `apileague` calendar all answer `AD05`/`ATH008`) and the
**lineups** (`V1_LegheFormazioni/*`, and `V1_LegheLive/*` with them). A league's
in-progress matchweek therefore has no public figures at all.

It can be rebuilt anyway. The squads are public, the Serie A ratings are public,
and `src/lib/fanta/public-live.ts` puts them together: it fields each squad the
way the site fields one nobody set — ranked by the feed's probable-lineup
percentage, ties broken by season form, never by the rating a player ended up
with — then applies the substitution rules and the defence modifier.

The result is an estimate and is labelled as one everywhere it appears. Against
a league whose matchweeks the site had already calculated, it lands a mean
absolute error of **4–6 fantapunti** — under one fantasy goal, which needs 6.
`pnpm check:estimate` re-runs that comparison against any league you point it at.

### The table, mid-round

Knowing what everyone is scoring is only half of it. What a manager actually
wants at 4pm on a Sunday is *where they stand now* and *what it would take to
win*, and `src/lib/fanta/live-table.ts` folds the round in progress into the
settled table to answer both.

How exact that is depends on one input, and the app says which it is rather than
blurring them:

- **Fantapoints are always live.** They are additive and belong to a team
  regardless of who it faces, so a cumulative fantapoints ranking is real even
  mid-round.
- **Standings points need the fixtures.** 3/1/0 comes from beating a particular
  opponent — without the calendar nobody, the official site included, can say
  what a round in progress is worth. With a calendar imported the table shows
  where each team would finish if the round ended now, with movement against the
  position it started from, the live head-to-head score, and the number that
  matters most: **how many fantapunti away from going ahead** you are.

Without a calendar the points column stays frozen at its official value and the
panel says so, rather than inventing positions.

`pnpm check:table` proves the arithmetic separately from the guessing: fed the
figures the league itself published for a settled round, it reproduces that
league's own table exactly — points, W/D/L, fantapoints and order.

`pnpm check:midround` asks the harder question — not whether the estimate is
right once everything has been played, but how it reads at 21:00 on a Saturday
with two matches gone and eight to come. It rewinds a finished round to each
kickoff in turn and re-runs the estimate at every moment. Totals climb towards
the final figure, and substitutions churn in the middle before settling at zero,
because a starter who has not played yet is indistinguishable from one who did
not play at all until the round ends — the same provisional swap the official
live view makes.

That replay is also why a team with nothing rated yet is labelled as not started
rather than shown a deficit: early on a Saturday, half the league sits at zero
because their players kick off tomorrow, and a live table that reads it as
losing would be worse than no table.

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
would be hindsight and the bench would never be needed. When a lineup is being
guessed rather than filled — reconstructing a real league's live score — season
form breaks ties within a role, which is also knowable before kickoff and cuts
the error by about a third.

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
pnpm check:public    # read a real league with no sign-in
pnpm check:estimate  # score the public squads and compare with what the league recorded
pnpm check:table     # fold a round into the table and check it against the official one
pnpm check:midround  # replay a finished round as if it were still being played
pnpm build           # production build
```

## Deployment

Two builds come out of this repo, and they are deliberately not the same thing.

`pnpm build` produces the full app: API routes, the shared SSE poller, the
file-backed local leagues and the authenticated real-league pages. It needs a
Node host (`pnpm start`, or any platform that runs Next.js).

`node scripts/build-static.mjs` produces a static export for GitHub Pages. Pages
serves files, not servers, so that build drops every server route and keeps only
the live Serie A board — which works because the live bucket answers with
`access-control-allow-origin: *`, letting the browser read the same feed and do
the decoding and scoring itself.

The league features cannot be made static at any price: `apileague.fantacalcio.it`
returns `access-control-allow-origin: https://leghe.fantacalcio.it` and requires
credentials, so a browser on another domain is refused before the request is even
sent. Reading a real league needs a server to proxy the login.

Live static site: <https://vetonshabani0.github.io/fantacalcio/>

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
