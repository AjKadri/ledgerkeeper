# LedgerKeeper design plan

Written before building, reviewed against `BRIEF-design.md` and its "avoid" list, then built. Notes on what changed in review are at the end.

## Idea in one line

An accountant's workbook with a drawer you can always see. Rows you still owe an answer on are marked with a highlighter; every answer is filed as a card into the drawer (your Walrus Memory); the second import shows the drawer doing the work.

Primary job: "you only answer once" is visible within 5 seconds of import 2.

## Tokens

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F4F6F8` | `#0F1620` | page |
| `--sheet` | `#FFFFFF` | `#17202C` | working surfaces (ledger, drawer, question cards) |
| `--ink` | `#1C2533` | `#E6ECF2` | text, primary buttons |
| `--muted` | `#4F5D70` | `#9AA9BA` | secondary text (added: the brief has no second text colour) |
| `--rule` | `#CBD6E2` | `#2B3A4D` | the only border colour: ledger lines, dividers, outlines |
| `--green` | `#2E6B4F` | `#6CBE93` | saved, answered, reused from memory |
| `--marker` | `#F3D35B` | `#F3D35B` at 30 % | highlighter swipe behind text, never a big fill |
| `--brick` | `#B4412F` | `#EE8A77` | errors only |
| `--teal` | `#0E5E63` | `#58BBC0` | accountant app accent (replaces ink for its buttons and header rule) |
| `--on-ink` | `#FFFFFF` | `#0F1620` | text on an ink button |

Contrast, computed with `scripts/contrast.mjs` (WCAG, text needs 4.5:1; every pair below passes): light ink on paper 14.2, ink on sheet 15.4, muted on paper 6.2, muted on sheet 6.7, green on sheet 6.3, brick on sheet 5.6, teal on sheet 7.5, ink on marker 10.5, white on teal button 7.5; dark ink on paper 15.3, ink on sheet 13.8, muted on paper 7.6, muted on sheet 6.8, green on sheet 7.4, brick on sheet 6.7, teal on sheet 7.3, ink on the 30 % marker 6.3, dark paper on the ink button 15.3.

Label chips carry a small dot in a quiet hue per category (transfers slate, swaps blue, liquidity violet, staking amber, rewards olive); the label text is what carries the meaning. "unknown" gets the marker swipe.

### Type

Schibsted Grotesk (UI, headings, numbers with `tabular-nums`), JetBrains Mono for addresses, digests and blob ids only. Both self-hosted by `next/font`. Scale 14 / 16 / 20 / 28 / 44, line height 1.5 body and 1.15 display, measure under 75 characters. Sentence case everywhere.

### Shape, space, motion

- Radius 6 px on interactive elements (buttons, inputs, segmented controls) and the rule cards in the drawer. Nothing else is rounded.
- Structure comes from 1 px rule lines and spacing on an 8 px grid, not from boxes or shadows. The only shadow is on the command palette and toast, which float above the page.
- One orchestrated motion (about 1.2 s): the filing sequence. Everything else is a 120 ms colour/opacity change. `prefers-reduced-motion` swaps everything instantly.

## Wireframe

```
Desktop (1024 and up)
┌───────────────────────────────────────────────────────────────────────────┐
│ [mark] LedgerKeeper    0xfee4…1342 (copy)               ⌘K    ◐ theme     │
├───────────────────────────────────────────────┬───────────────────────────┤
│ Hero (start state only)                       │ Memory drawer (sticky)    │
│  Label your Sui history for your accountant.  │  5 rules · 1 outcome      │
│  Answer each question once.                   │  ───────────────────────  │
│  [ 0x… address field, live validation ]       │  rule card  kind  0x6095… │
│  [Import history] [Try the sample wallet]     │   saved 2 min ago · blob  │
├───────────────────────────────────────────────┤  rule card …              │
│ Result                                        │  ───────────────────────  │
│  0 repeat questions        (44 px)            │  Imports                  │
│  2 answered from memory · 3 new               │   ● Import 2  3 asked …   │
│  Memory [ON | OFF]   with memory 0 / without 2│   ● Import 1  5 asked …   │
│  USD of SUI legs ≈ …                          │  ───────────────────────  │
├───────────────────────────────────────────────┤  session lk-… (copy)      │
│ Questions  (J/K move, 1–4 choose, Enter save) │  Read-only / writes status│
│  ▌2 transfers with 0x6095…449b   [marker]     │                           │
│   evidence line                               │                           │
│   (My own wallet)(An exchange)(A person…)(Ign)│                           │
│   Sent ─ Stored on Walrus ─ Searchable        │                           │
├───────────────────────────────────────────────┤                           │
│ Transactions  [filter label ▾] [search] Export CSV                        │
│  date  label  in  out  counterparty  rule  ≈USD   (sticky header)         │
├───────────────────────────────────────────────┴───────────────────────────┤
│ Trust strip (small, one line)                                             │
└───────────────────────────────────────────────────────────────────────────┘

Mobile (375): header · hero/result · question cards · ledger (horizontal scroll inside its own wrapper)
              bottom bar "Memory drawer · 5 rules" opens the drawer as a bottom sheet
```

Accountant app (separate look): header "LedgerKeeper for accountants · reads with its own key" with a teal rule under it, no questions anywhere, table first (full ledger), a panel "Rules from the owner's memory: 5" with the rules and blob links, Export CSV, a print stylesheet that turns the page into a clean report.

## The one bold moment: filing

With memory ON, the questions memory already answers are listed first as cards marked "answered from memory". After 300 ms each card shrinks and flies (a clone animated with the Web Animations API) to its rule card in the drawer, which pulses once in ledger green, while the big number counts down to "0 repeat questions". Total about 1.2 s. On mobile the clone flies to the memory bar. Reduced motion: no flight, the final state appears at once.

The same flight is reused when a newly answered card is saved (card to drawer), so there is one motion language.

## Interaction details

- Address field: validates while typing ("Valid Sui address", or the exact problem and how many characters are missing).
- Loading: skeleton rows for the ledger, no spinners.
- Answering: segmented choices (radiogroup), keys 1–4 choose, Enter saves, J/K move between cards, shown quietly under the section heading.
- Saving: three steps from the real job states. Sent (job accepted), Stored on Walrus (job reports uploaded or done), Searchable (the rule appears in a fresh recall). Failure keeps the card with "Not saved. Retry." using the same answer id.
- Ledger: sticky header, tabular numbers, label chips, "from memory" tag that jumps to the rule card, a "≈" USD column with a tooltip, filter by label, search by address or digest, Export CSV.
- Corrections: from the rule card in the drawer; the timeline says "Updated from An exchange to My own wallet".
- Command palette (⌘K or Ctrl+K): import sample wallet, new session, export CSV, open accountant view, toggle memory, switch theme.
- Footer trust strip with every honest label from the current build.
- Favicon and Open Graph image: a filed card with a check.

## Review against the brief and the "avoid" list

| Check | Result |
|---|---|
| Cream background, serif, terracotta | No. Cool paper, grotesk, ink. |
| Near-black page with one neon accent | No. Dark mode is a blue-black paper with the same restrained green and marker. |
| SaaS card kit: identical rounded cards, grey shadow, gradient washes | Avoided: sections are separated by rule lines and space; radius only on controls and rule cards; no gradients; the only shadows are on floating layers. |
| All-caps eyebrow labels | None. Sentence case, including the footer. |
| "→" on links | None. |
| 01/02/03 markers on non-sequences | None. The three save steps and the import timeline are real sequences and use words and dots. |
| Emoji, stock illustrations, fake charts, fake testimonials, made-up stats | None. Every number on screen comes from the API. |
| Marker used as a fill | Planned as a swipe only behind the short address and the "Needs your answer" text in a question card, and behind "unknown" label chips. It is never a card or section background. To re-check against screenshots. |
| Honest labels kept | Cached-at, live-from-Tatum, approximate USD, history from 23 Jan 2026, not tax advice, not affiliated with Ledger SAS, relayer sees demo memory, read-only banner, "Memory returned fewer items" warning. |

## What changed from the brief while planning

1. Added `--muted` for secondary text and a `--teal` token pair for the accountant app (brief gave the idea, not values).
2. Dark-mode marker is a 30 % tint so light text stays readable on it (a solid yellow swipe behind light text fails contrast).
3. "Searchable" is shown when a fresh recall returns the rule, not only when the job says done, because the earlier measurements showed a short gap between the two.
4. The brief's drawer needs timestamps, a timeline of rule changes and the answered-from-memory list, so the API now also returns rule times, an event list, the answered-from-memory questions and the ledger rows. No existing number or field changed.
5. Animation uses the Web Animations API and CSS instead of a library; the command palette is hand-built. No new runtime dependency.

## After the build

The critique from screenshots, the fixes, the one decorative thing removed and the checks are in `design-critique.md`. Token changes from the brief: none to its colours; `--muted`, the teal pair and the translucent dark marker were added at planning time.
