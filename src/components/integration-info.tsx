"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plug, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="size-8 shrink-0"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  );
}

function UrlRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 text-xs">{value}</code>
      <CopyBtn value={value} />
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  );
}

export function IntegrationInfo({ baseUrl }: { baseUrl: string }) {
  const t = useTranslations("apiInfo");
  const restUrl = `${baseUrl}/api/v1`;
  const mcpUrl = `${baseUrl}/api/mcp`;
  const refUrl = `${baseUrl}/api-reference`;

  // Claude Desktop / MCP-Client Config (Streamable HTTP)
  const mcpConfig = JSON.stringify(
    { mcpServers: { havewa: { url: mcpUrl, headers: { Authorization: "Bearer DEIN_TOKEN" } } } },
    null,
    2,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="size-4" /> {t("title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("howto")}</p>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="space-y-2">
          <UrlRow label={t("rest")} value={restUrl} />
          <UrlRow label={t("reference")} value={refUrl} href={refUrl} />
          <UrlRow label={t("mcp")} value={mcpUrl} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{t("mcpConfigTitle")}</span>
            <CopyBtn value={mcpConfig} />
          </div>
          <p className="text-xs text-muted-foreground">{t("mcpConfigHint")}</p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">{mcpConfig}</pre>
        </div>
      </CardContent>
    </Card>
  );
}
