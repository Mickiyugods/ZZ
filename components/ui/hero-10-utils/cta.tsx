"use client";

// The 21st.dev "hero-10" block references this file but doesn't ship it —
// reconstructed from how Hero10 calls it (cta.variant/size feed straight
// into Button's own variant/size props).

import * as React from "react";
import Link from "next/link";
import { Button, type ButtonProps } from "@/components/ui/button";

export interface CtaProps {
  ctaEnabled?: boolean;
  text: string;
  link: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

export function Cta({ cta }: { cta: CtaProps }) {
  return (
    <Button asChild variant={cta.variant} size={cta.size}>
      <Link href={cta.link || "#"}>{cta.text}</Link>
    </Button>
  );
}
