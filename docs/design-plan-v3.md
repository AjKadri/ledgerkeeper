# Design plan v3: one language for `/`, `/app` and `/accountant`

> **Revision, 9 Nov afternoon (overrides everything below where they differ):** palette A, so night sections and dark mode are **navy** (night #1C2533, floor #0F1620; dark mode uses the v2 values paper #0F1620, sheet #17202C, ink #E6ECF2, muted #9AA9BA, rule #2B3A4D, rule-strong #5F7088 for controls). Green (#2E6B4F / dark #6CBE93) only means saved, answered or from memory. Accountant band: teal family (#0A4A4E light, #0A3D41 dark). Demo glow: navy to marker. Ledger columns and the flat lit column are re-tinted for navy. See section 11.
>
> **Approved 9 Nov with changes (these override the text below):**
> 1. Ledger columns are crisp 1px vertical rules plus one thin horizontal header rule. The lit column is a flat, even tint (marker or green at low opacity), like a highlighted spreadsheet column: no glow, no fade, no bloom.
> 2. Type: **Schibsted Grotesk stays** (UI and display); JetBrains Mono for addresses. Plus Jakarta Sans is not used.
> 3. Preview: the three keys are added to Preview for all branches and Preview `MEMORY_WRITES_ENABLED=true` until the merge decision. M3 runs locally against `next start` on the branch.
> 4. `reason: "no_recent_activity"` approved (additive only).
> 5. "See how it's stored" links only to something that already exists; no new claims.
> 6. The demo's accountant frame is a simulation from sample data; its caption must not imply a live read with key B.

Branch `redesign-v3`, preview only. Builds on BRIEF-design-v3.md. Production stays on the v2 design until the user approves the preview; if v3 isn't clearly better by 16:00 Lagos, we keep v2.

Nothing in this plan changes a number, claim, honest label, API field, the product name or the licence. The filing moment, own memory (beta), the outage banner ("Memory unavailable, using your rules as last read at <time>.") and the kill-switch read-only mode keep their behaviour and wording.

## 1. Tokens

### Light (warm paper with green night sections)
| Token | Hex | Use | Contrast (text tokens) |
|---|---|---|---|
| `--paper` | `#F6F4EF` | page (warm; replaces cool `#F4F6F8`) | |
| `--sheet` | `#FFFFFF` | soft cards, inputs, demo frames | |
| `--ink` | `#1C2533` | text, dark pill buttons | 14.0 on paper |
| `--muted` | `#4F5D70` | captions, secondary text | 6.1 on paper, 6.7 on sheet |
| `--rule` | `#DDD6C9` | dividers and ledger lines (decorative) | |
| `--rule-strong` | `#8C8576` | input and control borders (needs 3:1 as a UI boundary) | checked at build |
| `--green` | `#2E6B4F` | saved, answered, from-memory | 5.7 on paper |
| `--night` | `#12352A` | dark green section background | |
| `--night-2` | `#0C271F` | the darker floor of night sections, the accountant band | |
| `--on-night` | `#EEF3EF` | text on night | 11.9 on night |
| `--on-night-muted` | `#A9C2B5` | captions on night | 7.1 on night |
| `--marker` | `#F3D35B` | the swipe, the one highlight (never a large fill) | ink on marker 10.5; marker on night 9.1 |
| `--brick` | `#B4412F` | errors only (icons and short text, never rules or fills) | 5.1 on paper |
| `--teal` | `#0E5E63` | accountant accent (buttons, links) | 6.8 on paper |

Label chip colours (`--c-*`) stay as they are; they're re-checked against the warm paper at build.

### Dark ("green night" throughout)
| Token | Hex | Contrast |
|---|---|---|
| `--paper` | `#0B2019` | ink 14.8, muted 8.4 |
| `--sheet` | `#133229` | ink 12.1, muted 6.8 |
| `--ink` | `#EAF1EC` | |
| `--muted` | `#A3BCAF` | |
| `--rule` | `#24493C` (decorative), `--rule-strong` `#5E8576` (controls) | |
| `--green` | `#7CCBA0` | 7.2 on sheet |
| `--night` | `#061510` (night sections stay darker than the dark page so the rhythm survives) | muted 9.2 |
| `--marker-swipe` | marker at 30% over sheet | ink on it 5.7 |
| `--brick` | `#F09482` | 6.1 on sheet |
| `--teal` | `#5CC2C6` | 6.6 on sheet |

The numbers above come from a scratch run of the same formula as `scripts/contrast.mjs`. At build, `scripts/contrast.mjs` is updated to these tokens, extended with the night pairs, and its output pasted into the report. The theme toggle and `prefers-color-scheme` stay as they are.

## 2. Type
- **UI and display: Plus Jakarta Sans** (variable, self-hosted through `next/font/google`, subsets latin; the same mechanism we use now, so there's no runtime CDN). Why: the brief asks for a geometric grotesk. Plus Jakarta is geometric (round o, flat terminals), stays calm at 14px and looks confident at 56px, and has tabular figures, which the ledger needs. It also isn't the face in the reference.
- **We drop Schibsted Grotesk.** It's a newspaper grotesk: narrow and editorial. Next to big, centred, pill-heavy statements it reads as a second voice. One family keeps the "weight, not colour" rule from v1.
- **JetBrains Mono stays** for addresses, digests, blob IDs and the stored rule text only.
- Scale: 14 / 16 / 20 / 28 / 40 / 56 (56 only for the `/` hero and night statements; it clamps down to 34 at 375px). Line height 1.5 for body, 1.1 for display, weight 700 for display and 600 for headings. Body lines stay under ~70 characters. Sentence case, no all-caps eyebrows.
- **Build check:** confirm `font-variant-numeric: tabular-nums` really switches figures in Plus Jakarta (by measuring the width of "111" vs "000"). If it doesn't, fall back to Manrope (also geometric, also has tnum) and say so in the report.

## 3. Our motif: ledger columns + one marker swipe
- **Ledger columns** (instead of the reference's light curtains): night sections carry a background of thin vertical rule lines, about 1px wide every 96px (64px on mobile), like a ledger page turned dark. One or two columns are "lit": a soft vertical gradient of `--green` at about 18% opacity, about 96px wide, fading out top and bottom, as if a lamp sits over that column. It's CSS only (`repeating-linear-gradient` plus one or two absolutely positioned gradient strips), with no images and no animation. The columns sit behind the content and never under body text without the night colour between.
- **Marker swipe:** one per section at most, behind a short phrase. Never on a single headline word (v1 rule), so not on "once" in the hero. It marks the *answer*: the stored rule's `kind=exchange` on the night card, "0 questions you'd have answered again" in `/app`, and question titles as today. It's a skewed `--marker` band behind the text, 0.9em tall, with rough ends from a clip-path.
- **The filing moment stays the only orchestrated motion.** Nothing on `/` animates on scroll.

## 4. Radius, shadow, pills
- **Pills (radius 999px):** all buttons, segmented controls, tabs, status chips ("Saved", "From memory", "Collecting"-style job states: "Sent", "Stored on Walrus", "Searchable"), the nav bar and the address field on `/`.
- **Soft cards (radius 16px):** question cards, result headline, drawer column, rule cards inside the drawer (12px when nested), FAQ items, how-it-works cards, the no-activity card, the demo frames (20px).
- **Shadow (one token):** `--shadow: 0 1px 2px rgba(28,37,51,.04), 0 8px 24px -12px rgba(28,37,51,.12)`. Dark mode drops the shadow and uses a 1px `--rule` border instead. No gradient washes on cards.
- **Glow (one place only):** the active frame of the side-by-side demo gets a soft gradient border (green → marker at low alpha, 1.5px, with a blurred copy behind at 20%). Our colours, and used only there.
- **The ledger table keeps square rule lines.** Rows aren't cards.

## 5. `/` section order
1. **Floating pill nav** (sticky, centred, max 920px, `--sheet` at 80% with backdrop blur): logo mark + wordmark, "How it works", "Memory", "FAQ", and a dark pill "Open the app". At 375px: logo + the pill button only (the section links move into the page; no hamburger).
2. **Hero (light, centred):** H1 "Label your Sui history for your accountant. Answer each question once." The current lead line. The address field and "Try the sample wallet" as pills (HeroForm, unchanged behaviour). A small caption with the existing honest labels (history from 23 Jan 2026, not tax advice).
3. **Side-by-side live demo (light):** pill tabs "Your app / Accountant / Memory". Desktop shows two frames joined by an arrow: left = your app (a question card for the sample's exchange counterparty, real `QuestionCard` + `Segmented`), right = the accountant view (the real `Ledger` rows for the sample with the label your pick produces). Picking an answer on the left re-labels the right side instantly. "Memory" shows the rule text your pick would store. The caption reads "Interactive demo with sample data. Nothing is saved." **Nothing is saved for real:** the demo is a client component fed from a static sample snapshot (fixture rows from `fixtures/`, built at build time) and calls no API at all. No `fetch`, no `remember`. A unit test asserts that the demo module imports nothing from `lib/memory`, `lib/rules` or the API routes, and at acceptance the network log for `/` shows no `/api/*` POST. At 375px the tabs switch between single frames.
4. **Night statement:** "Your answers aren't stuck in one app." Two sentences, the real stored rule text (`RULE_TEXT`, mono) in a quiet card on the ledger columns with the swipe on `kind=exchange`, and one pill button "See how it's stored" (goes to the README's memory section or `#memory` details; decided at build, no new claims).
5. **Light: how it works.** Three soft cards, numbered 1 to 3 (a real sequence): Import → Answer once → Hand over. Each has a real product crop from `docs/shots`, re-shot in v3.
6. **Night: what the memory learns.** The outcome timeline ("Jan–Jun: answered 5 of 5 · Jul–Aug: 3 new, 2 from memory") as a vertical timeline on the columns, plus the one sentence on newest-wins corrections. All text is the existing copy.
7. **Light:** Built on (Tatum, Walrus Memory: plain text names) · Honest limits · FAQ as an accordion of soft cards (`<details>`). The existing FAQ text is unchanged.
8. **Night closing CTA:** "See it in two minutes" + the sample pill button. Then the **footer** on paper: trust strip, GitHub, Apache-2.0, "Not affiliated with Ledger SAS."

The current "The same questions, again" problem section folds into the demo's intro line (its numbers stay word for word) so the page keeps one idea per section.

## 6. `/app`
- The same pill nav (wordmark, "Demo session · Start over", theme, ⌘K) on warm paper.
- **Memory source** as a pill segmented control: "Demo memory / Use my own memory" (own memory beta panel unchanged inside).
- Address field and Import as pills; the guided-sample stepper becomes a thin progress bar with three labelled pill steps.
- **Result headline** in a soft card: the big number with the marker swipe, the "With your memory / Without it" pill segmented control, and the compact two numbers.
- **Question cards** as soft cards: answer choices as pill radio buttons (same 1–4 / Enter / J-K keys), and Save as a dark pill. Save steps become pill chips with a thin progress bar: Sent → Stored on Walrus → Searchable.
- **Drawer:** a sticky soft-card column on desktop, a bottom sheet on mobile (same component, restyled). The filing moment targets the same rule cards, so the motion is unchanged.
- **Banners** (outage, read-only, incomplete recall): soft cards with a small icon, wording unchanged. Brick is used only for the icon and the title text of real errors.
- **No-activity state (priority 1):** when the import says the wallet holds funds but has no activity since 23 Jan 2026, show a calm soft card, not the red-rule error:
  - title "No activity we can read yet"
  - body "This wallet hasn't moved since before 23 Jan 2026, the earliest history available. Try a wallet you've used since February, or the sample wallet."
  - pill buttons "Try another address" (clears and focuses the field) and "Try the sample wallet"
  - brick only on a small icon.

  Detection: the server already returns this case as a distinct message from `emptyMessage()`. I'll add one *additive* field (`reason: "no_recent_activity"`) next to the existing error text, so the UI doesn't parse prose. No existing field changes. The truly-empty wallet message (no funds) keeps its current wording in the same calm card style, with its own title "Nothing to import yet".
- The ledger table keeps its square rule lines, sticky header, chips, "≈" USD and filters. Only the controls above it become pills.

## 7. `/accountant`
- The same pill nav, then a **deep green header band** (`--night-2` with the ledger columns, no lit column): "LedgerKeeper for accountants · reads with its own key", the demo account ID (mono, copyable), and "Rules from the owner's memory: N" as a pill chip.
- The teal accent stays for its buttons and links, so it still reads as a *different app*.
- Table first, on a soft card. One "Download CSV" dark-teal pill. No questions anywhere.
- The outage banner and "reads the demo memory only" note are unchanged in wording.
- The print stylesheet drops the band colour, shadows and pills (plain report as today).

## 8. Taken from the reference vs ours

| Taken from the reference (language only) | Ours |
|---|---|
| Light page alternating with full-bleed dark green sections | **Colours:** our tokens. Warm paper `#F6F4EF`, Ink `#1C2533`, Ledger green deepened to `#12352A`, Marker `#F3D35B` as the only accent, Brick for errors, teal for the accountant |
| A floating, translucent pill nav with one dark pill button | **Motif:** vertical *ledger columns* with one lit column, plus the marker swipe. No light curtains or aurora |
| Big centred statement headlines with a short paragraph and one pill button | **Story:** you answer once → the accountant's app reads the same rules with its own key → the memory learns (outcome timeline, newest wins) |
| A live product demo of two windows joined by an arrow, one with a glowing frame, pill tabs and a small caption | **Demo content:** our real components (QuestionCard, Ledger, rule text) with the public sample wallet; tabs "Your app / Accountant / Memory" |
| Soft 16px cards, a very soft shadow, pill buttons, pill segmented controls | **Copy:** all text is ours (existing v2 copy plus the brief's new lines). No text, icons, illustrations or section order taken one for one |
| Quiet small captions, thin progress bars, status chips | **Logo and favicon:** our Logo A (marker-swiped ledger row), unchanged. **Type:** Plus Jakarta Sans (not the reference's face) + JetBrains Mono |
| Geometric grotesk typography | **Moments:** the filing animation, the no-activity card, the read-only and outage states |

The reference frames stay in `../design-ref/`. Nothing from them is copied into the repo, committed or uploaded, and `git ls-files | grep -i design-ref` is checked at the end.

## 9. Build order (if time runs short)
1. No-activity state. 2. `/app`. 3. `/accountant`. 4. `/` with the live demo. Checkpoint preview at 13:30 Lagos.

## 10. Risks and decisions for the user
- **Preview keys:** the Vercel project has no connected Git repository, so `vercel env add NAME preview redesign-v3` is refused ("does not have a connected Git repository"). Nothing was added. Also, the Preview `MEMORY_WRITES_ENABLED` is currently `"false"` (left from the 6 Nov kill-switch test).
- **Preview protection:** previews redirect unauthenticated requests to Vercel login (302), so the M3 script can't run against a preview URL without changing protection. Plan: run M3 against `next start` locally on the branch.


## 11. Revision (9 Nov afternoon)
**Colour (palette A).** Navy night and navy dark mode as above; marker and brick unchanged; `scripts/contrast.mjs` checks all text pairs for AA and control borders for 3:1.

**Declutter.** One headline and at most one sentence visible per block. Longer text moves, nothing disappears:
- Hero: H1, one line, the field, two pills, and three fact chips ("History from 23 Jan 2026", "Not tax advice", "Sample: public wallet, fictional owner").
- "The same questions, again": one sentence plus a "Why?" disclosure.
- Stored rule: headline, the rule card with a Copy pill, two short lines, an "About this rule" disclosure, and the button.
- How it works: title and one sentence per card.
- Honest limits: short titles that open to the full sentences.
- `/app`: the keyboard hint shows once above the list; the result card has a "How we count" disclosure; the drawer has one info tooltip and an "Imports and changes" disclosure.
- `/accountant`: a "Details" disclosure.
- Spacing: 128px between sections on desktop (72px on mobile); body lines up to 60ch.

**Motion (`/` only, `components/Motion.tsx`).** Each effect plays once and nothing loops. Under `prefers-reduced-motion` nothing runs, and the server-rendered HTML is already the final state.
- Sections fade up 8px over 400ms.
- The marker swipe on night sections draws left to right over 500ms.
- The timeline's marker line draws down and "2 reused from memory" counts up from 0 to 2.
- The demo plays itself: after 2s in view with no interaction it picks "An exchange" and flashes the relabelled rows once. Any interaction stops it, and a Replay pill appears. It makes no network calls.

**Extras.**
- The nav shadow appears after scrolling, and on `/` the nav marks the current section.
- `/sample.csv` ("Sample CSV") is generated at build time from the sample fixture with `lib/export.ts` and the stored rule shown on the page. A test checks it equals the accountant export for the same rule set.
- Hover and press states (120ms), the FAQ and limits open animation, and a copy button on the stored rule.
