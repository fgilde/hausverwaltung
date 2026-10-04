"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

// Unterschriftsfeld (#55): mit Maus, Finger oder Stift zeichnen. Liefert die
// Unterschrift als JPEG-data-URL im Formularfeld `name` (JPEG lässt sich direkt
// ins PDF einbetten). Leer = keine Unterschrift.
export function SignaturePad({ name }: { name: string }) {
  const t = useTranslations("leases");
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [value, setValue] = useState("");

  function reset() {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    setValue("");
  }
  useEffect(reset, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  }

  return (
    <div className="space-y-1.5">
      <div className="relative overflow-hidden rounded-lg border border-input bg-white">
        <canvas
          ref={canvas}
          width={600}
          height={180}
          aria-label={t("wgSignature")}
          className="block h-36 w-full cursor-crosshair touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const ctx = canvas.current!.getContext("2d")!;
            const p = point(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = canvas.current!.getContext("2d")!;
            const p = point(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }}
          onPointerUp={() => {
            drawing.current = false;
            setValue(canvas.current!.toDataURL("image/jpeg", 0.85));
          }}
        />
        {!value && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
            {t("wgSignHere")}
          </span>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!value}>
          <Eraser className="size-4" /> {t("wgSignClear")}
        </Button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
