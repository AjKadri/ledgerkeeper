# Rules for the coding agent

- No task is reported done without pasting the acceptance check's output.
- Secrets only in `.env` / host env vars. `.env`, `BUILD-PLAN.md`, `HANDOFF.md`, `BRIEF-*.md` and agent notes are in `.gitignore`.
- Commits: Conventional Commits. No Co-Authored-By or any other Claude/AI attribution trailers.
- After each milestone: update `HANDOFF.md` (state, decisions, checks run and results, deferred checks, next steps), then propose a commit.
- Product name: LedgerKeeper (one constant, `lib/config.ts`). Licence: Apache-2.0. Ask the user before changing either.
- Never print or log key values.
- README and site footer say: "Not affiliated with Ledger SAS."
