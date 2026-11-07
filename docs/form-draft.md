# Submission form draft (NOT submitted)

Total Recall, Consumer Finance Apps track. Nothing here is submitted. The author reviews and submits it. Personal fields are left blank on purpose. Re-check every number against the deployed app on the day.

## Personal and team fields (the author fills these)

- Name: 
- Email: 
- Team name / members: 
- Country: 
- Wallet address for any prize: 
- Discord / X / Telegram handle: 

## Project name

LedgerKeeper

## Track

Consumer Finance Apps

## Short description (under 280 characters)

LedgerKeeper labels your Sui transactions for your accountant and asks each unclear question once. Answers are stored as rules in Walrus Memory on mainnet, so the next import and a separate accountant app start from what you already said.

## Long description

Crypto tax tools ask the same question again and again: who is this address? An answer given in one app stays there, so a new tool, or a new tax year, asks them all over.

LedgerKeeper reads a Sui wallet's history through Tatum's Sui GraphQL gateway and labels what it can: transfers, swaps, liquidity, staking and rewards. For the rest it asks one question per counterparty or contract, for example "Who is this? My own wallet, an exchange, a person or business, or ignore". Each answer is saved as a short rule in Walrus Memory on mainnet. After every import it also stores an outcome ("asked 3, answered 3, reused 2"), so the next import can say what changed.

What is shown, with real numbers from the sample wallet (47 transactions): the first import labels 28 of 36 and raises 5 questions. The second import, with memory on, asks 3 questions and none is a repeat; with memory off it asks 5, and 2 of them were already answered. A separate accountant app reads the same memory with its own delegate key and produces a CSV identical to the main app's (47 rows, empty diff). Answers can be changed, and the newest wins.

Beyond the demo memory, a visitor can connect a Sui wallet, create their own Walrus Memory account, register a key made in the browser, and keep their answers in their own account (beta; verified on mainnet with a test wallet). When Walrus Memory cannot be read, the app keeps working from the rules it last read, shows when, and switches saving off.

It is a labelling tool for your accountant, not tax advice. Limits: Sui mainnet only, history from 23 Jan 2026 (the earliest Tatum serves), the newest 500 transactions per wallet, USD values approximate and for SUI legs only. The accountant key can technically write, because delegate keys cannot be scoped yet (reported as walrus-memory#1384).

## Links

- Demo: https://ledgerkeeper.ajkadri.dev (the "Try the sample wallet" button takes about two minutes)
- Repository: https://github.com/AjKadri/ledgerkeeper (Apache-2.0)
- Blog post: [MEDIUM LINK, once published]
- Demo video: [LINK, the author records and uploads this]
- Issues reported to the Walrus Memory team: https://github.com/MystenLabs/walrus-memory/issues/1384 and https://github.com/MystenLabs/walrus-memory/issues/1385, plus comments on #277 and #1125

## Feedback question 1: your experience with Walrus

Walrus Memory did what we needed: short text rules stored per namespace, recalled by a later import and by a second app with its own key. The SDK is small, and the account and delegate-key calls made a "bring your own memory" flow possible, with a wallet creating the account and a browser-made key signing saves.

What cost us time:

- Writes took 15 to 23 seconds on mainnet when alone and up to about 33 seconds with several in flight, plus about 2 more until recall finds the memory. We moved to `remember()` with an idempotency key and polling `getRememberStatus()`. We shared the numbers on #277.
- `health()` succeeds with a key that is not registered on the account, and the first write then fails with a generic 401. We had to read the account object on-chain to find the cause (comment on #1125).
- Delegate keys cannot be scoped, so a read-only "accountant" key can write (#1384).
- `listMemories()` returns metadata but no text, so a completeness check cannot compare content (#1385).
- The relayer sent no CORS header for our site origin (checked 6 Nov), so a browser app needs a same-origin pass-through.

What we would ask for: scoped delegate keys, an SDK pre-flight check for an unregistered key, and CORS for browser use.

## Feedback question 2: your experience with Tatum AI Builder

We did not use Tatum AI Builder, so we have no experience of it to report. We used Tatum's Sui GraphQL gateway (`sui-mainnet.gateway.tatum.io/graphql`) directly, with an API key.

What worked: per-address history with balance changes, events and Move calls, and reading the Cetus SUI/USDC pool at past checkpoints (`object(atCheckpoint)`), which let us build approximate daily USD values without a price API. What we hit: history starts at 23 Jan 2026, a sparse filter without `afterCheckpoint` fails with "requested data below earliest", and the free plan rate-limits (429), so we retry with backoff and serve the demo wallets from a labelled cache. One price endpoint (`rate/history` for the symbol "SUI") returned a different token with the same symbol, with HTTP 200, so we used the on-chain pool instead.

## Checklist before the author submits

- [ ] Demo opens at the URL above, and "Try the sample wallet" works end to end.
- [ ] Re-run `npx tsx scripts/build-prices.ts` on the last day, then redeploy.
- [ ] Blog published and the link filled in.
- [ ] Demo video recorded and the link filled in.
- [ ] Personal fields filled in.
