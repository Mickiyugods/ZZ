"use client";

class MobileSidebarStore extends EventTarget {
  open = false;
  show() {
    this.open = true;
    this.dispatchEvent(new Event("change"));
  }
  hide() {
    this.open = false;
    this.dispatchEvent(new Event("change"));
  }
  toggle() {
    this.open = !this.open;
    this.dispatchEvent(new Event("change"));
  }
}

export const mobileSidebarStore = new MobileSidebarStore();
