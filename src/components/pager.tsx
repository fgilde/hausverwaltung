import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/** Seitenweise blättern (Audit-Log, Finanzen #53). `href(p)` liefert die URL für Seite p. */
export async function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const t = await getTranslations();
  return (
    <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
      <span>{t("audit.pageOf", { page, pages })}</span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" disabled={page <= 1} render={page <= 1 ? <span /> : <Link href={href(page - 1)} />}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="icon" disabled={page >= pages} render={page >= pages ? <span /> : <Link href={href(page + 1)} />}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
