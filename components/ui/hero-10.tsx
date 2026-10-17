"use client";

// Ported from a 21st.dev "hero-10" block, adapted for this project:
// - `motion/react` -> `framer-motion` (already a dependency here, same API)
// - `aspect-4/5` -> `aspect-[4/5]` (bare fraction aspect-ratio utilities are
//   Tailwind v4; this project is still on v3)
// - `font-serif` -> `font-display` (ZEEP's headline font token, not a
//   generic serif)

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import Balancer from "react-wrap-balancer";

import { cn } from "@/lib/utils";

import { Cta, type CtaProps } from "@/components/ui/hero-10-utils/cta";

export interface Hero10Props {
  title: string;
  titleLine2Prefix?: string;
  titleHighlight?: string;
  description: string;
  socialProof?: string;
  images?: string[];
  imageAlts?: string[];
  /** Custom media (e.g. a bespoke showcase) in place of the default 3-image fan. */
  mediaSlot?: React.ReactNode;
  /** Optional CSS background image for the section itself (cover/center, with
   * a fade-to-black at the bottom so it blends into the rest of a black
   * page) — separate from `images`/`mediaSlot`, which are foreground content. */
  backgroundImage?: string;
  animation?: "none" | "subtle";
  primaryCTA: CtaProps;
  secondaryCTA?: CtaProps;
  variant?: "standard" | "compact";
  /** "stack": centered, media below text (original layout). "split": text
   * left / media right on large screens, media drops below text on smaller
   * ones — used for a compact side-by-side showcase. */
  layout?: "stack" | "split";
}

const variantStyles = {
  standard: {
    section: "py-20 sm:py-28",
    title: "text-3xl sm:text-4xl md:text-5xl",
    description: "max-w-lg text-sm sm:text-base",
    header: "gap-5",
    content: "gap-8 sm:gap-10",
    fan: "max-w-3xl",
    fanCard: "aspect-[4/5]",
  },
  compact: {
    section: "py-14 sm:py-20",
    title: "text-2xl sm:text-3xl md:text-4xl",
    description: "max-w-md text-sm",
    header: "gap-4",
    content: "gap-6 sm:gap-8",
    fan: "max-w-2xl",
    fanCard: "aspect-[4/5]",
  },
} as const;

const fanSlots = [
  { width: "w-[38%]", layout: "-mr-8 z-10", rotate: -6, x: 48, ty: 24 },
  { width: "w-[42%]", layout: "z-20", rotate: 0, x: 0, ty: -8 },
  { width: "w-[38%]", layout: "-ml-8 z-10", rotate: 6, x: -48, ty: 24 },
];

const fanContainer: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      delay: 0.4,
      delayChildren: 0.5,
      staggerChildren: 0.1,
    },
  },
};

const fanCard: Variants = {
  hidden: (slot: (typeof fanSlots)[number]) => ({
    x: slot.x,
    rotate: slot.rotate,
    y: slot.ty,
  }),
  visible: (slot: (typeof fanSlots)[number]) => ({
    x: 0,
    rotate: slot.rotate,
    y: slot.ty,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

function Reveal({
  active,
  variants,
  className,
  children,
}: Readonly<{
  active: boolean;
  variants?: Variants;
  className?: string;
  children: React.ReactNode;
}>) {
  if (!active) return <div className={className}>{children}</div>;

  return (
    <motion.div variants={variants ?? item} className={className}>
      {children}
    </motion.div>
  );
}

function ImageFan({
  images,
  imageAlts,
  cardAspect,
  animate,
}: Readonly<{
  images: string[];
  imageAlts?: string[];
  cardAspect: string;
  animate: boolean;
}>) {
  return (
    <motion.div
      className="relative flex w-full items-center justify-center"
      variants={fanContainer}
      initial={animate ? "hidden" : false}
      whileInView={animate ? "visible" : undefined}
      animate={animate ? undefined : "visible"}
      viewport={{ once: true, margin: "-80px" }}
    >
      {images.slice(0, 3).map((src, i) => {
        const slot = fanSlots[i] ?? fanSlots[1];
        return (
          <motion.div
            key={src}
            custom={slot}
            variants={fanCard}
            className={cn(
              "relative shrink-0 overflow-hidden rounded-xl shadow-xl outline outline-black/10 dark:outline-white/10",
              cardAspect,
              slot.width,
              slot.layout,
            )}
          >
            <img src={src} alt={imageAlts?.[i] ?? ""} decoding="async" loading="eager" className="size-full object-cover" />
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export function Hero10({
  title,
  titleLine2Prefix,
  titleHighlight,
  description,
  socialProof,
  images,
  imageAlts,
  mediaSlot,
  animation = "none",
  primaryCTA,
  secondaryCTA,
  variant = "standard",
  layout = "stack",
  backgroundImage,
}: Readonly<Hero10Props>) {
  const reduce = useReducedMotion();
  const animate = animation === "subtle" && !reduce;
  const vs = variantStyles[variant];

  // The source image is a wide panoramic strip (two planets near its far
  // left/right edges, ~3:1 aspect). `bg-cover` on a short/wide desktop hero
  // shows it properly; on the stacked mobile/tablet layout the hero is much
  // taller relative to its width, so `cover` zooms into the image's empty
  // black center and crops both planets out entirely. Rather than ship that
  // accidentally-blank result, only render the background at the `lg`
  // breakpoint — the same one `layout="split"` switches to side-by-side at,
  // which is the composition this image was actually made for. Narrower
  // screens fall back to the page's own plain black, which this spec's own
  // brief allows ("a simpler dark background treatment on narrow screens").
  const backgroundLayer = backgroundImage && (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 hidden lg:block">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  );

  const titleElement = title && (
    <h1 className={cn("font-display font-bold tracking-[-0.02em] text-balance text-foreground", vs.title)}>
      <Balancer>{title}</Balancer>
      {(titleLine2Prefix || titleHighlight) && (
        <>
          <br />
          <Balancer>
            {titleLine2Prefix && <span>{titleLine2Prefix} </span>}
            {titleHighlight && <span className="text-primary">{titleHighlight}</span>}
          </Balancer>
        </>
      )}
    </h1>
  );

  const descriptionElement = description && (
    <p className={cn("text-muted-foreground", vs.description)}>
      <Balancer>{description}</Balancer>
    </p>
  );

  const ctasElement = (primaryCTA?.ctaEnabled || secondaryCTA?.ctaEnabled) && (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
      {primaryCTA?.ctaEnabled && <Cta cta={primaryCTA} />}
      {secondaryCTA?.ctaEnabled && <Cta cta={{ ...secondaryCTA, variant: secondaryCTA.variant ?? "outline" }} />}
    </div>
  );

  const socialProofElement = socialProof && <p className="text-xs font-medium text-muted-foreground">{socialProof}</p>;

  const mediaElement =
    mediaSlot ?? (images?.length ? <ImageFan images={images} imageAlts={imageAlts} cardAspect={vs.fanCard} animate={animate} /> : null);

  if (layout === "split") {
    return (
      <section className="relative isolate w-full overflow-hidden bg-background">
        {backgroundLayer}
        <motion.div
          className={cn("relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8", vs.section)}
          variants={animate ? container : undefined}
          initial={animate ? "hidden" : false}
          whileInView={animate ? "visible" : undefined}
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className={cn("flex w-full max-w-2xl flex-col items-center text-center lg:items-start lg:text-left", vs.content)}>
            <Reveal active={animate} className={cn("flex w-full flex-col items-center lg:items-start", vs.header)}>
              {titleElement}
              {descriptionElement}
            </Reveal>
            <Reveal active={animate} className="flex flex-col items-center gap-4 lg:items-start">
              {ctasElement}
              {socialProofElement}
            </Reveal>
          </div>

          {mediaElement && (
            <div className="flex w-full justify-center lg:w-auto lg:shrink-0 lg:justify-end">{mediaElement}</div>
          )}
        </motion.div>
      </section>
    );
  }

  return (
    <section className="relative isolate w-full overflow-hidden bg-background">
      {backgroundLayer}
      <motion.div
        className={cn("relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 text-center", vs.section, vs.content)}
        variants={animate ? container : undefined}
        initial={animate ? "hidden" : false}
        whileInView={animate ? "visible" : undefined}
        viewport={{ once: true, margin: "-80px" }}
      >
        <Reveal active={animate} className={cn("flex w-full max-w-2xl flex-col items-center", vs.header)}>
          {titleElement}
          {descriptionElement}
        </Reveal>

        <Reveal active={animate} className="flex flex-col items-center gap-4">
          {ctasElement}
          {socialProofElement}
        </Reveal>

        <div className={cn("mx-auto w-full", vs.fan)}>{mediaElement}</div>
      </motion.div>
    </section>
  );
}

export default Hero10;
