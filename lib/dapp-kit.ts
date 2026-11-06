"use client";
// One wallet connection for own-memory mode. Mainnet only: Walrus Memory accounts live on mainnet.
import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";

export const dAppKit = createDAppKit({
  networks: ["mainnet"],
  defaultNetwork: "mainnet",
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: "https://fullnode.mainnet.sui.io:443" }),
});

declare module "@mysten/dapp-kit-react" {
  interface Register { dAppKit: typeof dAppKit }
}
