"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Link2Off, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// WYSIWYG-Editor für ausgehende E-Mails (#56), Tiptap (ProseMirror). Bewusst nur
// Formatierungen, die in Mails zuverlässig ankommen; der Server bereinigt das HTML
// zusätzlich (server/mail-sanitize.ts). Liefert das HTML im Formularfeld `name`.
export function RichTextEditor({
  name,
  initialHtml = "",
  id,
}: {
  name: string;
  initialHtml?: string;
  id?: string;
}) {
  const t = useTranslations("editor");
  const [html, setHtml] = useState(initialHtml);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");

  const editor = useEditor({
    immediatelyRender: false, // SSR: erst im Browser rendern (sonst Hydration-Fehler)
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: { openOnClick: false, autolink: true, protocols: ["mailto"], defaultProtocol: "https" },
      }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: "mail-html min-h-36 max-h-80 overflow-y-auto px-3 py-2 text-sm outline-none",
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      underline: e?.isActive("underline") ?? false,
      bullet: e?.isActive("bulletList") ?? false,
      ordered: e?.isActive("orderedList") ?? false,
      quote: e?.isActive("blockquote") ?? false,
      link: e?.isActive("link") ?? false,
    }),
  });

  const tool = (label: string, on: boolean | undefined, run: () => void, Icon: typeof Bold) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      aria-pressed={!!on}
      className={cn("size-8", on && "bg-muted text-foreground")}
      onMouseDown={(e) => e.preventDefault()} // Auswahl im Editor behalten
      onClick={run}
    >
      <Icon className="size-4" />
    </Button>
  );

  function applyLink() {
    if (!editor) return;
    const href = url.trim();
    if (href) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
    setUrl("");
  }

  return (
    <div className="rounded-lg border border-input shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
        {tool(t("bold"), active?.bold, () => editor?.chain().focus().toggleBold().run(), Bold)}
        {tool(t("italic"), active?.italic, () => editor?.chain().focus().toggleItalic().run(), Italic)}
        {tool(t("underline"), active?.underline, () => editor?.chain().focus().toggleUnderline().run(), Underline)}
        <span className="mx-1 h-5 w-px bg-border" />
        {tool(t("bulletList"), active?.bullet, () => editor?.chain().focus().toggleBulletList().run(), List)}
        {tool(t("orderedList"), active?.ordered, () => editor?.chain().focus().toggleOrderedList().run(), ListOrdered)}
        {tool(t("quote"), active?.quote, () => editor?.chain().focus().toggleBlockquote().run(), Quote)}
        <span className="mx-1 h-5 w-px bg-border" />
        {active?.link
          ? tool(t("unlink"), true, () => editor?.chain().focus().extendMarkRange("link").unsetLink().run(), Link2Off)
          : tool(t("link"), false, () => {
              setUrl(editor?.getAttributes("link").href ?? "");
              setLinkOpen((o) => !o);
            }, Link2)}
      </div>
      {linkOpen && (
        <div className="flex items-center gap-2 border-b px-2 py-1.5">
          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setLinkOpen(false);
            }}
            placeholder="https://…"
            className="h-8"
          />
          <Button type="button" size="sm" onClick={applyLink}>
            {t("applyLink")}
          </Button>
        </div>
      )}
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
