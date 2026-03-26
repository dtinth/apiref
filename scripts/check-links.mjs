#!/usr/bin/env node
/**
 * Check for dead links in the rendered site.
 * Parses all HTML files and verifies that all href targets exist.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.join(__dirname, "..", "_site");

// Collect all HTML files in the site
function getAllHtmlFiles(dir) {
  const files = [];
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  return files;
}

// Extract base href and all href links from an HTML file
function extractLinksWithBase(htmlPath, content) {
  let baseHref = "./";
  // Match <base href="..." or <base href='...'
  const baseMatch = /<base\s+href=["']([^"']+)["']/i.exec(content);
  if (baseMatch) {
    baseHref = baseMatch[1];
  }

  const links = [];
  // Match href="..." or href='...'
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;
  while ((match = hrefRegex.exec(content)) !== null) {
    links.push({
      href: match[1],
      file: htmlPath,
      baseHref: baseHref,
    });
  }
  return links;
}

// Resolve a link with base href applied
function resolveLinkTarget(sourceFile, href, baseHref) {
  // Skip absolute URLs and fragments-only
  if (href.startsWith("http") || href.startsWith("//")) {
    return null;
  }

  // Split off fragment
  const [pathPart] = href.split("#");
  if (!pathPart) {
    return null; // Just a fragment, skip
  }

  // Apply base href first
  const sourceDir = path.dirname(sourceFile);
  const baseDir = path.resolve(sourceDir, baseHref);
  const targetPath = path.resolve(baseDir, pathPart);
  return targetPath;
}

// Main
console.log(`Checking links in ${siteDir}...\n`);

const htmlFiles = getAllHtmlFiles(siteDir);
console.log(`Found ${htmlFiles.length} HTML files\n`);

const deadLinks = [];
const checkedLinks = new Set();

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, "utf-8");
  const links = extractLinksWithBase(file, content);

  for (const link of links) {
    const targetPath = resolveLinkTarget(file, link.href, link.baseHref);
    if (!targetPath) continue;

    const linkKey = `${file}→${link.href}`;
    if (checkedLinks.has(linkKey)) continue;
    checkedLinks.add(linkKey);

    if (!fs.existsSync(targetPath)) {
      const relativePath = path.relative(siteDir, file);
      const targetRelative = path.relative(siteDir, targetPath);
      deadLinks.push({
        source: relativePath,
        href: link.href,
        resolves_to: targetRelative,
      });
    }
  }
}

if (deadLinks.length === 0) {
  console.log("✅ All links are valid!");
} else {
  console.log(`❌ Found ${deadLinks.length} dead link(s):\n`);
  for (const dead of deadLinks) {
    console.log(`  📄 ${dead.source}`);
    console.log(`     └─ ${dead.href}`);
    console.log(`        → ${dead.resolves_to} (does not exist)\n`);
  }
  process.exit(1);
}
