const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const sourceDir = path.join(rootDir, 'web', 'dist');
const targetDir = path.join(rootDir, 'electron', 'renderer', 'dist');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

if (!fs.existsSync(sourceDir)) {
  console.error('[copy-web-dist] Missing web/dist. Run: npm --prefix ../web run build');
  process.exit(1);
}

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}

copyRecursive(sourceDir, targetDir);

// Electron loads index.html via file://, so root-relative assets (/assets/...)
// are not resolvable. Rewrite src/href to relative paths.
const targetIndexPath = path.join(targetDir, 'index.html');
if (fs.existsSync(targetIndexPath)) {
  const html = fs.readFileSync(targetIndexPath, 'utf8');
  const patched = html.replace(/((?:src|href)=["'])\/(?!\/)/g, '$1./');
  if (patched !== html) {
    fs.writeFileSync(targetIndexPath, patched, 'utf8');
  }
}

console.log('[copy-web-dist] Copied web/dist -> electron/renderer/dist');
