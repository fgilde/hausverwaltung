/**
 * Lesbare Vordergrundfarbe (Text) für eine Hintergrundfarbe (#RRGGBB).
 * Ohne passenden Kontrast wirken Buttons je nach Brand-Farbe "ausgegraut".
 * Relative Luminanz (sRGB); heller Hintergrund → dunkler Text, sonst weiß.
 */
export function readableForeground(hex: string | null | undefined): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? "").trim());
  if (!m) return "#ffffff";
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}
