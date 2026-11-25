#!/usr/bin/env node
/**
 * Zero-dependency bundler that combines web/index.html, web/styles.css, and
 * all src/**\/*.js ES modules in topological order into a single standalone
 * HTML file (dist/vgc-standings.html) ready to paste into a GitHub Gist.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Topological dependency order matching the ES module graph.
const MODULE_ORDER = [
  'src/core/validation.js',
  'src/core/pokemon-names.js',
  'src/core/regulations.js',
  'src/core/schema.js',
  'src/core/pokepaste.js',
  'src/core/csv-parser.js',
  'src/core/layout.js',
  'src/adapters/storage.js',
  'src/adapters/api.js',
  'src/adapters/themes.js',
  'src/adapters/presets.js',
  'src/renderer/canvas-renderer.js',
  'src/app.js',
];

function stripModuleSyntax(source, relPath) {
  let out = source
    // Remove multi-line or single-line ES import statements
    .replace(/^\s*import\s+(?:[\s\S]*?from\s+)?['"][^'"]+['"];?\s*$/gm, '')
    // Convert `export default ` to nothing (none expected, defensive)
    .replace(/^\s*export\s+default\s+/gm, '')
    // Convert `export const/let/var/function/async function/class` to plain declarations
    .replace(/^\s*export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, '')
    // Remove `export { ... };` re-export blocks
    .replace(/^\s*export\s*\{[\s\S]*?\};?\s*$/gm, '');

  return `// --- ${relPath} ---\n${out.trim()}\n`;
}

function build() {
  const htmlTemplate = fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'web/styles.css'), 'utf8');

  const bundledModules = MODULE_ORDER.map((relPath) => {
    const absPath = path.join(ROOT, relPath);
    const src = fs.readFileSync(absPath, 'utf8');
    return stripModuleSyntax(src, relPath);
  }).join('\n');

  const bundleJs = `(() => {\n'use strict';\n\n${bundledModules}\n})();\n`;

  // Verify the bundled JS has zero syntax errors using Node's vm.Script
  new vm.Script(bundleJs, { filename: 'vgc-standings-bundle.js' });

  // Escape any accidental </script> sequence inside the JS bundle
  const safeBundleJs = bundleJs.replace(/<\/script>/gi, '<\\/script>');

  const singleFileHtml = htmlTemplate
    .replace(
      /<link\s+rel="stylesheet"\s+href="styles\.css"\s*\/?>/i,
      () => `<style>\n${css}\n  </style>`,
    )
    .replace(
      /<script\s+type="module"\s+src="\.\.\/src\/app\.js"\s*><\/script>/i,
      () => `<script>\n${safeBundleJs}\n  </script>`,
    );

  const distDir = path.join(ROOT, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const outPath = path.join(distDir, 'vgc-standings.html');
  fs.writeFileSync(outPath, singleFileHtml, 'utf8');
  const pagesPath = path.join(ROOT, 'index.html');
  fs.writeFileSync(pagesPath, singleFileHtml, 'utf8');

  const kb = (Buffer.byteLength(singleFileHtml, 'utf8') / 1024).toFixed(1);
  console.log(`Built single-file app: ${path.relative(ROOT, outPath)} and ${path.relative(ROOT, pagesPath)} (${kb} KB)`);
}

build();
