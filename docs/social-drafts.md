# Social drafts (NOT posted)

Nothing here is posted. Each text needs the author's explicit "post it" first. Replace `[MEDIUM LINK]` once the blog is published.

## X post

Attach: `docs/filing-moment.gif` (the filing moment: answers memory already holds fly into the drawer).

```text
I built LedgerKeeper for the Total Recall hackathon: it labels your Sui transactions for your accountant and asks each unclear question once.

Every answer is stored as a rule in @WalrusFoundation Memory on mainnet. The next import and a separate accountant app reuse it: on the sample wallet, 0 repeat questions instead of 2.

Chain data comes from @Tatum_io's Sui GraphQL gateway.

Demo: https://ledgerkeeper.ajkadri.dev
Write-up: [MEDIUM LINK]
```

(447 characters with the two links counted in full; X counts a link as 23.)

## LinkedIn post

```text
I just finished LedgerKeeper, my entry for the Total Recall hackathon (Consumer Finance Apps track).

The problem: crypto tax tools ask you the same question over and over. Who is this address? You answer it once, and next quarter, or in the next tool, you answer it again.

LedgerKeeper reads a Sui wallet's history through Tatum's GraphQL gateway, labels what it can, and asks about the rest, one question per counterparty or contract. Each answer is saved as a short rule in Walrus Memory on mainnet. The next import starts from those rules, and so does a second app, an accountant view that reads the same memory with its own key.

On the sample wallet, the second import asks 3 questions, none of them a repeat. With memory off it asks 5, and 2 of those I had already answered.

Some things did not go smoothly, and I wrote them down: mainnet writes took 15 to 23 seconds each, so saving became asynchronous with polling; the "read-only" accountant key could in fact write; and a browser cannot call the relayer directly. I reported what I found to the Walrus Memory team.

It is a labelling tool for your accountant, not tax advice. Try the sample wallet (about two minutes): https://ledgerkeeper.ajkadri.dev
Write-up: [MEDIUM LINK]

#Sui #Walrus #BuildInPublic
```

(216 words, 3 hashtags.)
