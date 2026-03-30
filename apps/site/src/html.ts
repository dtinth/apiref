import { render } from "preact-render-to-string";
import htm from "htm";
import { h } from "preact";
import type { ComponentChildren } from "preact";

export const html = (htm as any).bind(h);

export function renderHtmlPage(content: unknown): string {
  const rendered = render(content as any);
  return "<!DOCTYPE html>" + rendered;
}

export function respondWithHtml(content: unknown, status: number = 200): Response {
  return new Response(renderHtmlPage(content), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
