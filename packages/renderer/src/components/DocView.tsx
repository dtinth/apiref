import bash from "@shikijs/langs/bash";
import css from "@shikijs/langs/css";
import diff from "@shikijs/langs/diff";
import html from "@shikijs/langs/html";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import jsx from "@shikijs/langs/jsx";
import markdown from "@shikijs/langs/markdown";
import tsx from "@shikijs/langs/tsx";
import typescript from "@shikijs/langs/typescript";
import yaml from "@shikijs/langs/yaml";
import catppuccinMocha from "@shikijs/themes/catppuccin-mocha";
import { Marked, Renderer } from "marked";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { DocNode } from "../viewmodel.ts";
import { useResolveLink } from "./PageContext.tsx";

const SHIKI_THEME = "catppuccin-mocha";

type ShikiLanguage =
  | "bash"
  | "css"
  | "diff"
  | "html"
  | "javascript"
  | "json"
  | "jsx"
  | "markdown"
  | "tsx"
  | "typescript"
  | "yaml";

const shikiLanguageAliases: Record<string, ShikiLanguage> = {
  bash: "bash",
  css: "css",
  diff: "diff",
  html: "html",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  markdown: "markdown",
  md: "markdown",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
  yaml: "yaml",
  yml: "yaml",
  zsh: "bash",
};

const shiki = createHighlighterCoreSync({
  themes: [catppuccinMocha],
  langs: [bash, css, diff, html, javascript, json, jsx, markdown, tsx, typescript, yaml],
  engine: createJavaScriptRegexEngine(),
});

const markdownRenderer = new Renderer();
const renderCodeBlockFallback = markdownRenderer.code.bind(markdownRenderer);

markdownRenderer.code = (token) => {
  const language = resolveShikiLanguage(token.lang);
  if (!language) return renderCodeBlockFallback(token);

  try {
    return shiki.codeToHtml(token.text, {
      lang: language,
      theme: SHIKI_THEME,
    });
  } catch {
    return renderCodeBlockFallback(token);
  }
};

const markdownParser = new Marked({
  renderer: markdownRenderer,
});

/** Extract the first fence token and normalize language aliases before passing them to Shiki. */
function resolveShikiLanguage(language: string | undefined): ShikiLanguage | null {
  const infoString = language?.trim();
  if (!infoString) return null;
  return shikiLanguageAliases[infoString.split(/\s+/, 1)[0].toLowerCase()] ?? null;
}

interface DocViewProps {
  doc: DocNode[];
}

/** Reassemble DocNode[] back into a markdown string, converting link nodes to markdown links. */
function docToMarkdown(doc: DocNode[], resolve: (url: string) => string): string {
  return doc
    .map((node) => {
      switch (node.kind) {
        case "text":
          return node.text;
        case "code":
          return node.text;
        case "link":
          return node.url ? `[${node.text}](${resolve(node.url)})` : node.text;
      }
    })
    .join("");
}

export function DocView({ doc }: DocViewProps) {
  const resolve = useResolveLink();
  if (doc.length === 0) return null;
  const html = markdownParser.parse(docToMarkdown(doc, resolve)) as string;
  return <div class="ar-description" dangerouslySetInnerHTML={{ __html: html }}></div>;
}
