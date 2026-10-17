"use client";

import { useSyncExternalStore } from "react";
import { wallet } from "./wallet";

function subscribe(cb: () => void) {
  wallet.addEventListener("change", cb);
  return () => wallet.removeEventListener("change", cb);
}

export function useWallet() {
  useSyncExternalStore(
    subscribe,
    () => `${wallet.address}:${wallet.chainId}:${wallet.ready}:${wallet.demo}`,
    () => "ssr",
  );
  return wallet;
}
