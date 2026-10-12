"use client";

class WalletDialogStore extends EventTarget {
  open = false;
  show() {
    this.open = true;
    this.dispatchEvent(new Event("change"));
  }
  hide() {
    this.open = false;
    this.dispatchEvent(new Event("change"));
  }
}

export const walletDialogStore = new WalletDialogStore();
export const openWallet = () => walletDialogStore.show();
