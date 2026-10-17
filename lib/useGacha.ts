"use client";

// Wallet-signing glue for the gacha flow. Ties Privy's Solana wallet (signing a
// base64 transaction as raw bytes — no @solana/web3.js needed) to the
// Collector Crypt purchase+open sequence in lib/gacha.ts.

import * as React from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignTransaction } from "@privy-io/react-auth/solana";
import { generatePack, submitTransaction, openPack, type OpenPackResult } from "@/lib/gacha";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000; // avoid call-stack overflow on big arrays
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GachaPhase = "idle" | "paying" | "opening" | "won" | "error";

export function useGacha() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets(); // Solana wallets only (from the /solana entrypoint)
  const { signTransaction } = useSignTransaction();
  const solana = wallets[0] ?? null;

  const [phase, setPhase] = React.useState<GachaPhase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<OpenPackResult | null>(null);

  const reset = React.useCallback(() => {
    setPhase("idle");
    setError(null);
    setResult(null);
  }, []);

  // Poll openPack: the win is minted asynchronously, so the first calls come
  // back WAITING_FOR_WEBHOOK (or briefly 404 "purchase not confirmed on-chain").
  const pollOpen = React.useCallback(async (memo: string): Promise<OpenPackResult> => {
    for (let i = 0; i < 40; i++) {
      try {
        const r = await openPack(memo);
        if (r.code === "WAITING_FOR_WEBHOOK") {
          await sleep(1200);
          continue;
        }
        return r;
      } catch (e) {
        // purchase not yet seen on-chain — keep waiting a bit
        if (i < 10 && /confirm|404|not yet/i.test(String(e))) {
          await sleep(1200);
          continue;
        }
        throw e;
      }
    }
    throw new Error("Pack took too long to open — check your winners feed.");
  }, []);

  const crackPack = React.useCallback(
    async (packType: string) => {
      setError(null);
      setResult(null);

      if (!solana) {
        // No Solana wallet connected yet — open Privy's connect modal.
        if (ready && !authenticated) login();
        setError("Connect a Solana wallet to crack a pack.");
        return;
      }

      try {
        setPhase("paying");
        const { memo, transaction } = await generatePack(solana.address, packType);
        const { signedTransaction } = await signTransaction({
          transaction: b64ToBytes(transaction),
          wallet: solana,
        });
        await submitTransaction(bytesToB64(signedTransaction));

        setPhase("opening");
        const won = await pollOpen(memo);
        setResult(won);
        setPhase("won");
      } catch (e) {
        setError((e as Error).message || "Something went wrong cracking the pack.");
        setPhase("error");
      }
    },
    [solana, ready, authenticated, login, signTransaction, pollOpen],
  );

  return {
    ready,
    solanaAddress: solana?.address ?? null,
    connect: login,
    phase,
    error,
    result,
    crackPack,
    reset,
  };
}
