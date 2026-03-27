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

const SHIKI_THEME = catppuccinMocha;

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

let shikiHighlighter: ReturnType<typeof createHighlighterCoreSync> | undefined;

function getShiki() {
  shikiHighlighter ??= createHighlighterCoreSync({
    themes: [SHIKI_THEME],
    langs: [bash, css, diff, html, javascript, json, jsx, markdown, tsx, typescript, yaml],
    engine: createJavaScriptRegexEngine(),
  });
  return shikiHighlighter;
}

const markdownRenderer = new Renderer();
const renderCodeBlockFallback = markdownRenderer.code.bind(markdownRenderer);

markdownRenderer.code = (token) => {
  const language = resolveShikiLanguage(token.lang);
  if (!language) return renderCodeBlockFallback(token);

  try {
    return getShiki().codeToHtml(token.text, {
      lang: language,
      theme: SHIKI_THEME.name,
    });
  } catch {
    return renderCodeBlockFallback(token);
  }
};

const markdownParser = new Marked({
  renderer: markdownRenderer,
});

/** Extract only the first language token from a fence info string, ignoring extra metadata, and normalize aliases for Shiki. */
function resolveShikiLanguage(language: string | undefined): ShikiLanguage | undefined {
  const infoString = language?.trim();
  if (!infoString) return undefined;
  return shikiLanguageAliases[infoString.split(/\s+/, 1)[0].toLowerCase()];
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
