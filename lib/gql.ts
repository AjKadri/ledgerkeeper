// Tatum Sui GraphQL helper + one normalised transaction shape used by every script.

export const GQL = "https://sui-mainnet.gateway.tatum.io/graphql";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function gql(query: string, variables: Record<string, unknown> = {}, tries = 5): Promise<any> {
  for (let i = 1; i <= tries; i++) {
    const res = await fetch(GQL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.TATUM_API_KEY! },
      body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* handled below */ }

    const retryable = res.status === 429 || res.status >= 500 || !json || json.data == null && !json.errors;
    if (retryable && i < tries) {
      const wait = Number(process.env.GQL_RETRY_BASE_MS ?? 1500) * 2 ** (i - 1);
      process.stdout.write(` [HTTP ${res.status}, retry in ${wait / 1000}s]`);
      await sleep(wait);
      continue;
    }
    if (!json) throw new Error(`HTTP ${res.status}, not JSON: ${text.slice(0, 500)}`);
    if (json.errors?.length) throw new Error(`GraphQL: ${JSON.stringify(json.errors).slice(0, 800)}`);
    if (json.data == null) throw new Error(`HTTP ${res.status}, no data: ${text.slice(0, 500)}`);
    await sleep(process.env.GQL_RETRY_BASE_MS ? Math.min(250, Number(process.env.GQL_RETRY_BASE_MS)) : 250); // stay polite to the free-plan rate limit
    return json.data;
  }
}

export type Tx = {
  digest: string;
  timestamp: string | null;
  sender: string | null;
  calls: string[];           // "0xpkg::module::function"
  balanceChanges: { owner: string | null; coinType: string; amount: string }[];
  events: string[];          // event type strings
};

// Fields fetched for every transaction
export const TX_FIELDS = `
  digest
  sender { address }
  effects {
    timestamp
    balanceChanges(first: 50) { nodes { owner { address } coinType { repr } amount } }
    events(first: 20) { nodes { contents { type { repr } } } }
  }
  kind {
    __typename
    ... on ProgrammableTransaction {
      commands(first: 50) { nodes { __typename ... on MoveCallCommand { function { fullyQualifiedName } } } }
    }
  }`;

export function normalise(n: any): Tx {
  return {
    digest: n.digest,
    timestamp: n.effects?.timestamp ?? null,
    sender: n.sender?.address ?? null,
    calls: (n.kind?.commands?.nodes ?? [])
      .filter((c: any) => c.__typename === "MoveCallCommand")
      .map((c: any) => c.function.fullyQualifiedName),
    balanceChanges: (n.effects?.balanceChanges?.nodes ?? []).map((b: any) => ({
      owner: b.owner?.address ?? null, coinType: b.coinType?.repr ?? "?", amount: b.amount,
    })),
    events: (n.effects?.events?.nodes ?? []).map((e: any) => e.contents?.type?.repr ?? "?"),
  };
}

// Newest-first paging over transactions matching a filter
export async function fetchTxs(filter: Record<string, unknown>, max = 500, onPage?: (n: number) => void): Promise<Tx[]> {
  const out: Tx[] = [];
  let before: string | null = null;
  do {
    const d: any = await gql(
      `query($f: TransactionFilter, $b: String) {
         transactions(last: 50, before: $b, filter: $f) {
           pageInfo { hasPreviousPage startCursor }
           nodes { ${TX_FIELDS} }
         }
       }`,
      { f: filter, b: before },
    );
    const conn = d.transactions;
    out.push(...conn.nodes.map(normalise).reverse());
    onPage?.(out.length);
    before = conn.pageInfo.hasPreviousPage ? conn.pageInfo.startCursor : null;
  } while (before && out.length < max);
  return out;
}