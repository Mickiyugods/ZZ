import { walletIdentity } from "@/lib/identity";
import { cn } from "@/lib/utils";

/** The connected wallet's ZEEP avatar (see lib/identity.ts). Decorative: the
 * name/address next to it carries the meaning, so alt is empty. */
export function WalletAvatar({ address, size = 32, className }: { address: string; size?: number; className?: string }) {
  const { avatar } = walletIdentity(address);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatar}
      alt=""
      width={size}
      height={size}
      decoding="async"
      style={{ width: size, height: size }}
      className={cn("shrink-0 rounded-full border border-[var(--border)] bg-black object-cover", className)}
    />
  );
}
