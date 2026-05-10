#!/usr/bin/env node
/**
 * validate-functions.js — pre-commit check
 *
 * Scans all Netlify functions for `require()` calls and verifies
 * each non-core module is listed in package.json dependencies.
 *
 * Exit 0 = all good
 * Exit 1 = missing dependency found
 */

const fs = require('fs');
const path = require('path');

const FUNCTIONS_DIR = path.join(__dirname, '..', 'netlify', 'functions');
const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');

// Node.js built-in modules that don't need to be in package.json
const CORE_MODULES = new Set([
  'crypto', 'fs', 'path', 'url', 'http', 'https', 'stream', 'buffer',
  'util', 'querystring', 'events', 'os', 'timers', 'child_process',
  'net', 'dgram', 'dns', 'tls', 'zlib', 'string_decoder', 'punycode',
  'readline', 'repl', 'vm', 'module', 'process', 'console', 'assert',
  'async_hooks', 'inspector', 'perf_hooks', 'trace_events', 'worker_threads',
  'cluster', 'domain', 'v8', 'wasi'
]);

function extractRequires(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const requires = new Set();
  const regex = /require\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const mod = match[1];
    // Skip relative imports and core modules
    if (mod.startsWith('.')) continue;
    // Handle scoped packages: @scope/pkg should stay as @scope/pkg
    const baseName = mod.startsWith('@') ? mod.split('/').slice(0, 2).join('/') : mod.split('/')[0];
    if (CORE_MODULES.has(baseName)) continue;
    requires.add(baseName);
  }
  return requires;
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  const deps = new Set(Object.keys(pkg.dependencies || {}));
  const devDeps = new Set(Object.keys(pkg.devDependencies || {}));

  const functionFiles = fs.readdirSync(FUNCTIONS_DIR).filter(f => f.endsWith('.js'));
  const missing = [];

  for (const file of functionFiles) {
    const filePath = path.join(FUNCTIONS_DIR, file);
    const requires = extractRequires(filePath);
    for (const mod of requires) {
      // Check if module or its scoped base is in deps
      const isInDeps = deps.has(mod) || [...deps].some(d => mod.startsWith(d + '/'));
      const isInDevDeps = devDeps.has(mod) || [...devDeps].some(d => mod.startsWith(d + '/'));
      if (!isInDeps && !isInDevDeps) {
        missing.push(`  ${file}: missing "${mod}" in package.json`);
      }
    }
  }

  if (missing.length > 0) {
    console.error('❌ Function dependency validation failed:\n');
    missing.forEach(m => console.error(m));
    console.error('\n→ Add the missing package(s) to package.json before committing.');
    process.exit(1);
  }

  console.log('✅ All function dependencies verified.');
  process.exit(0);
}

main();
