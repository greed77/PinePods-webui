// Regenerates src/lib/api/schema.d.ts from a PinePods server's OpenAPI spec.
// Usage: npm run gen:api [-- <server-url-or-openapi.json-path>]
// Defaults to PINEPODS_DEV_SERVER (from .env.local) so types match the server you run against.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

function envServer() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, 'utf8').match(/^PINEPODS_DEV_SERVER=(.+)$/m);
    if (m) return m[1].trim();
  }
}

const src = process.argv[2] || envServer();
if (!src) throw new Error('Pass a server URL or spec path, or set PINEPODS_DEV_SERVER');
const input = /^https?:/.test(src) ? new URL('/api/openapi.json', src) : pathToFileURL(src);

const ast = await openapiTS(input);
const out = 'src/lib/api/schema.d.ts';
fs.mkdirSync('src/lib/api', { recursive: true });
fs.writeFileSync(out, '// Generated from ' + input + ' - do not edit. Run `npm run gen:api`.\n' + astToString(ast));
console.log('Wrote ' + out);
