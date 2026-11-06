import { APP_NAME } from "@/lib/config";
import { Header, Trust } from "@/components/Chrome";
import { HeroForm } from "@/components/HeroForm";

export const metadata = {
  title: `${APP_NAME}: Sui records for your accountant, answered once`,
  description: "LedgerKeeper labels your Sui transactions for your accountant and asks each unclear question once. Your answers live in your Walrus Memory, not in one app.",
};

// The text of a real rule, as stored in Walrus Memory by the sample run (see docs/shots/v2).
const RULE_TEXT = "[tax-rule] match=0x60956e40d8f921affde3cb861de91a6a6a0bab28af7cd1c23e029d46b86a449b kind=exchange v=2";

const FAQ: { q: string; a: string }[] = [
  { q: "Is this tax advice?", a: "No. LedgerKeeper labels transactions so that your accountant can work from a tidy record. What each label means for your tax, and whether the labels are right for your situation, is a decision for you and your accountant." },
  { q: "Where do my answers live?", a: "In Walrus Memory on mainnet, as short text rules under your account. They are not locked inside LedgerKeeper. In this demo the memory is visible to the Walrus Memory relayer, so do not use a wallet you want kept private." },
  { q: "Can my accountant see them?", a: "Yes. The accountant view is a separate app that reads the same rules with its own key. Today a delegate key in Walrus Memory cannot be limited to reading, so the accountant key could also write; we have reported that to the Walrus Memory team." },
  { q: "What if I answer wrong?", a: "Change the answer from the drawer. The newest answer wins, the next import uses it, and the earlier answer stays in the history of your memory." },
  { q: "Which chains?", a: "Sui mainnet only. History comes through Tatum from 23 Jan 2026, up to the newest 500 transactions of a wallet." },
  { q: "Is it free?", a: "The demo is free to use. It is a hackathon project with no pricing yet." },
];

export default function Product() {
  return (
    <>
      <Header nav={<nav className="sitenav" aria-label="Page sections"><a href="#how">How it works</a><a href="#memory">Memory</a><a href="#faq">FAQ</a><a className="btn btn--quiet" href="/app">Open the app</a></nav>} />
      <main id="top">
        <section className="pp pp--hero">
          <div className="shell">
            <h1>Label your Sui history for your accountant. Answer each question once.</h1>
            <p className="lead">LedgerKeeper asks about each unclear counterparty one time and keeps the answer in your Walrus Memory. The next import, and your accountant&rsquo;s app, start from what you already said.</p>
            <HeroForm />
          </div>
        </section>

        <section className="pp" aria-labelledby="problem">
          <div className="shell pp__grid">
            <div className="pp__text">
              <h2 id="problem">The same questions, again</h2>
              <p>The sample wallet has 47 transactions. The first import raises five questions. The next import runs into two of the same counterparties again. An answer kept inside one app stays there, so a new tool, or a new year, asks them all over.</p>
            </div>
            <figure className="shot">
              <img src="/product/ledger-marked.png" width="824" height="560" loading="lazy" alt="A transaction ledger of the sample wallet. Rows the app could not label are marked in yellow." />
              <figcaption>The sample wallet&rsquo;s ledger. Yellow marks the rows that need an answer.</figcaption>
            </figure>
          </div>
        </section>

        <section className="pp" id="how" aria-labelledby="how-h">
          <div className="shell">
            <h2 id="how-h">How it works</h2>
            <ol className="steps3">
              <li>
                <img src="/product/step-import.png" width="824" height="383" loading="lazy" alt="Step 1 of the guided sample: LedgerKeeper labelled 28 of 36 transactions, 5 need you." />
                <h3><span>1</span> Import</h3>
                <p>Paste a Sui address. LedgerKeeper reads the history through Tatum and labels what it can: transfers, swaps, liquidity, staking.</p>
              </li>
              <li>
                <img src="/product/step-answer.png" width="824" height="206" loading="lazy" alt="A question card asking who a counterparty is, with four answers to choose from." />
                <h3><span>2</span> Answer once</h3>
                <p>Each unclear counterparty or contract is one question. Your answer is saved as a rule and is never asked again.</p>
              </li>
              <li>
                <img src="/product/step-hand.png" width="1208" height="320" loading="lazy" alt="The accountant view with a labelled ledger and a Download CSV button." />
                <h3><span>3</span> Hand over</h3>
                <p>Send a labelled CSV, or open the accountant view, which reads your rules with its own key.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="pp pp--tint" id="memory" aria-labelledby="mem-h">
          <div className="shell">
            <h2 id="mem-h">Your answers are not stuck in one app</h2>
            <p className="pp__lead">Each answer is a short rule stored in Walrus Memory on mainnet. Any app you give a key can read it. Here is a stored rule, and the accountant view reading it.</p>
            <div className="pp__two">
              <div>
                <h3 className="pp__cap">What is stored</h3>
                <pre className="rule-text" tabIndex={0}><code>{RULE_TEXT}</code></pre>
                <p className="small muted">One memory per answer: the counterparty, what it is, and a format version. Change an answer and a newer rule is stored; the newest wins.</p>
                <p className="small muted">Written by LedgerKeeper with one delegate key. Read by the accountant app with a second delegate key. Neither holds your wallet keys.</p>
              </div>
              <figure className="shot">
                <img src="/product/accountant.png" width="1440" height="760" loading="lazy" alt="The accountant app showing the rules it read from the owner's memory and the labelled ledger." />
                <figcaption>The accountant view: a different app, a different key, the same rules.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="pp" aria-labelledby="learn-h">
          <div className="shell pp__grid">
            <div className="pp__text">
              <h2 id="learn-h">What the memory learns</h2>
              <p>After each import LedgerKeeper stores how it went. The second import of the sample wallet asked three new questions and reused two answers from memory. If you change an answer, the newest one wins.</p>
            </div>
            <figure className="shot shot--narrow">
              <img src="/product/timeline.png" width="330" height="477" loading="lazy" alt="Memory drawer timeline: the import up to 30 Jun asked 5 and answered 5; the import of 1 Jul to 31 Aug asked 3, answered 3 and reused 2." />
              <figcaption>Up to 30 Jun: 5 asked, 5 answered. Then Jul–Aug: 3 asked, 3 answered, 2 reused from memory.</figcaption>
            </figure>
          </div>
        </section>

        <section className="pp pp--tint" aria-labelledby="built-h">
          <div className="shell">
            <h2 id="built-h">Built on</h2>
            <ul className="built">
              <li><b>Tatum</b><span>Sui GraphQL gateway: transaction history, balances and on-chain prices.</span></li>
              <li><b>Walrus Memory</b><span>Mainnet. Stores the rules and the import outcomes.</span></li>
            </ul>
          </div>
        </section>

        <section className="pp" aria-labelledby="limits-h">
          <div className="shell">
            <h2 id="limits-h">Honest limits</h2>
            <ul className="limits">
              <li>History starts on 23 Jan 2026, the earliest Tatum serves for Sui, and covers a wallet&rsquo;s newest 500 transactions.</li>
              <li>Labels are for your accountant. This is not tax advice.</li>
              <li>The demo memory is visible to the Walrus Memory relayer.</li>
              <li>Labelling was hand-checked on small samples from three wallets, not on large ones.</li>
              <li>USD values are approximate, for SUI legs only, from a Cetus pool price.</li>
            </ul>
          </div>
        </section>

        <section className="pp" id="faq" aria-labelledby="faq-h">
          <div className="shell">
            <h2 id="faq-h">Questions</h2>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="pp pp--cta">
          <div className="shell">
            <h2>See it in two minutes</h2>
            <p>The sample wallet walks you through all three steps.</p>
            <a className="btn btn--primary" href="/app?sample=1">Try the sample wallet</a>
          </div>
        </section>
      </main>

      <Trust />
      <footer className="pp-foot">
        <div className="shell">
          <a href="https://github.com/AjKadri/ledgerkeeper" rel="noreferrer">GitHub</a>
          <span>Apache-2.0</span>
        </div>
      </footer>
    </>
  );
}
