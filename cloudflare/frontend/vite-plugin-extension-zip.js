import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

// Bundles the browser extension (repo-root extension/) into the Vite build
// output as a real, valid zip, plus a small version json.
//
// Why a plugin and not a shell `zip` step: Cloudflare Pages builds the site by
// running Vite, but we can't rely on the Pages build image having the `zip`
// binary, nor on it invoking a specific npm script. Doing the zip inside the
// Vite build (pure JS via jszip) makes the download artifact deterministic on
// every build, regardless of the host. The file lands in dist/ and is served
// as a static asset (taking precedence over the SPA _redirects fallback).
export function extensionZip(opts = {}) {
  const outName = opts.outName || 'tsundoku-extension.zip';
  const versionName = opts.versionName || 'extension-version.json';

  let root = process.cwd();
  let outDir = 'dist';

  return {
    name: 'tsundoku-extension-zip',
    apply: 'build',
    configResolved(cfg) {
      root = cfg.root;
      outDir = cfg.build.outDir;
    },
    async closeBundle() {
      const extDir = opts.extensionDir
        ? path.resolve(root, opts.extensionDir)
        : path.resolve(root, '../../extension');

      if (!fs.existsSync(extDir)) {
        this.warn(`[extension-zip] extension dir not found at ${extDir}; skipping`);
        return;
      }

      const zip = new JSZip();
      let fileCount = 0;
      const walk = (dir, rel) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name === '.DS_Store' || entry.name.startsWith('.git')) continue;
          const abs = path.join(dir, entry.name);
          const relPath = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) walk(abs, relPath);
          else { zip.file(relPath, fs.readFileSync(abs)); fileCount++; }
        }
      };
      walk(extDir, '');

      const absOut = path.resolve(root, outDir);
      fs.mkdirSync(absOut, { recursive: true });

      const buf = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
      fs.writeFileSync(path.join(absOut, outName), buf);

      let version = '0.0.0';
      try {
        version = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8')).version || version;
      } catch { /* keep default */ }
      fs.writeFileSync(
        path.join(absOut, versionName),
        JSON.stringify({ version, built_at: new Date().toISOString() }),
      );

      // eslint-disable-next-line no-console
      console.log(`[extension-zip] wrote ${outName} (${fileCount} files, ${buf.length} bytes) + ${versionName}`);
    },
  };
}
