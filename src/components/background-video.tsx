"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Spielt Hintergrundvideos stumm ab. Mehrere Quellen → zufällige Reihenfolge,
 * nacheinander in Endlosschleife. Eine Quelle → einfacher Loop.
 */
export function BackgroundVideo({
  sources,
  className,
}: {
  sources: string[];
  className?: string;
}) {
  // einmalige zufällige Reihenfolge pro Mount
  const order = useMemo(() => [...sources].sort(() => Math.random() - 0.5), [sources]);
  const [i, setI] = useState(0);

  if (order.length === 0) return null;
  const single = order.length === 1;

  return (
    <video
      key={order[i]}
      className={cn("size-full object-cover", className)}
      autoPlay
      muted
      playsInline
      loop={single}
      onEnded={() => {
        if (!single) setI((x) => (x + 1) % order.length);
      }}
    >
      <source src={order[i]} />
    </video>
  );
}
