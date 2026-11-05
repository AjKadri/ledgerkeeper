# Design critique and checks

Process followed: plan (`design-plan.md`) → review against the brief and its "avoid" list → build → critique from screenshots at 1440 and 375, light and dark → fix → remove one decorative thing → re-capture.

Screens are in `docs/shots/` (1440 and 375 wide, plus dark). The filing moment is `docs/filing-moment.gif`, with key frames in `docs/shots/filing/`.

## What the screenshots showed, and what changed

| Finding (from screenshots) | Fix |
|---|---|
| Start state: the headline broke into four short lines because of a 16-character cap. | Cap raised to 21 characters; three lines. |
| Header showed a command icon and a ⌘ key, a duplicate, and wrong on Windows and Linux. | One label, "Commands", and the key shown for the platform (⌘ or Ctrl). Hidden on phones, where it only caused overflow. |
| Footer trust strip left its last item alone on a second row. | Three-column grid on desktop, one column on phones. |
| After the first import the wallet field shrank to a narrow box and cut the address off. | The field spans the column in compact mode; the "Valid Sui address" hint is kept for screen readers and shown only while there is a problem. |
| Ledger: raw amounts wrapped over three lines, dates and "from memory" broke mid-word, the ≈ USD column was clipped. | One signed Amount column (+ in, − out), amounts trimmed for display (the full value stays in the tooltip and the CSV), no wrapping in date, rule and USD cells. |
| Drawer rule cards: the blob link broke across two lines. | Blob link on its own line. |
| At 375 px the closed bottom sheet stayed in the tab order and appeared mid-page in a full-page capture. | `visibility: hidden` while closed, so it cannot be tabbed into. |
| A regression I introduced: the new header label made the page 385 px wide at 375. | Palette button hidden below 640 px. Re-measured: 375 of 375 everywhere. |
| Dock button wrapped to two lines. | Shorter label, no wrapping. |

### The one decorative thing removed
The marker swipe on the "Needs your answer" tag. The highlighted address already marks the row; two highlights on one card said the same thing twice. The marker now means one thing: this is the part you still owe.

## Token changes from the brief

None to the brief's colours. Added `--muted` (secondary text) and a teal pair for the accountant app, with a 30 % translucent marker in dark mode so light text stays readable on it. All pairs are AA, computed in `scripts/contrast.mjs`.

## Checks run

**Horizontal scroll at 375 px** (`scrollWidth` against viewport width, real Chrome, mobile emulation):

| State | scrollWidth / viewport |
|---|---|
| Start state | 375 / 375 |
| After import 2 | 375 / 375 |
| Memory drawer open | 375 / 375 |
| A question mid-save | 375 / 375 |
| Dark mode, after import 2 | 375 / 375 |
| Accountant view | 375 / 375 |

At 1440 all pages measure 1440 / 1440.

**Keyboard-only run** (real Chrome, no mouse; the sample wallet in a new session). For each of the five questions: `J` moved focus to the next open card, a number key chose the answer (Save was disabled before choosing), `Enter` saved. Log:

```
key J -> card 0x60956e40…   Save disabled before choosing: true
key 3 -> chose "3 A person or business"
key Enter -> saving; steps: Sent / Stored on Walrus / Searchable
... card filed into the drawer (about 22–28 s later)
(same sequence for the other four cards: 2, 3, 6 "Ignore" on the contract card, 3)
import 1 outcome saved; drawer: 5 rules
```
Focus is visible on every control; every control has an accessible name.

**Reduced motion** (`prefers-reduced-motion: reduce`): the result appears already settled on "0 repeat questions", with no cards flying.

## The filing moment, frame by frame

Captured by slowing the page's animation clock to a quarter, taking screenshots, and playing them back at real speed (so the GIF has the real motion with fewer frames than a native recording). The page measured the sequence itself: 2.73 s at quarter speed, which is 300 ms delay + 160 ms stagger + 520 ms flight + 180 ms settle, about **1.16 s at real speed**.

1. Result arrives. Headline reads "2 repeat questions". Two cards marked "Answered from memory" are listed under Questions.
2. At 300 ms the first card shrinks and flies toward its rule card in the drawer; the second follows 160 ms later.
3. First card lands: the headline counts down to "1 repeat question" and that drawer card pulses once in ledger green.
4. Second card lands: headline "0 repeat questions", second drawer card pulses.
5. The two cards are replaced by one line: "2 answered from memory and filed in your drawer: …". Subline: "2 answered from memory · 3 new".

## Not covered

Chrome only (no Safari or Firefox), no screen reader pass, the GIF is a rescaled capture rather than a native screen recording, and the 375 px checks use Chrome's mobile emulation rather than a real phone.
