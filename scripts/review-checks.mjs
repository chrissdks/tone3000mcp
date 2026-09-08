// Read-only review of application behavior; mock upstream calls and disposable profiles.
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { ProfileStore } from '../dist/src/profile/store.js';
import { Tone3000Client } from '../dist/src/tone3000/client.js';
import { recommendToneChain } from '../dist/src/recommendation/engine.js';

const directory = await mkdtemp(path.join(tmpdir(), 'tone3000-review-'));
const storePath = path.join(directory, 'profiles.json');
const store = new ProfileStore(storePath);
await store.save({ guitars: ['test'] }, '__proto__');
console.log('Reserved profile key persisted:', Object.hasOwn(JSON.parse(await readFile(storePath, 'utf8')), '__proto__'));
const outcomes = await Promise.allSettled([
  store.save({ guitars: ['A'] }, 'alice'),
  store.save({ guitars: ['B'] }, 'bob'),
]);
console.log('Concurrent saves:', outcomes.map(x => x.status));
try {
  console.log('Final profile keys:', Object.keys(JSON.parse(await readFile(storePath, 'utf8'))));
} catch {
  console.log('Concurrent saves corrupted the profile JSON.');
}

const malformed = new Tone3000Client({ baseUrl: 'https://example.invalid', secretKey: 'mock-only',
  fetchImpl: async () => new Response('{"unexpected":true}', { status: 200 }) });
const response = await malformed.searchTones({ query: 'test' });
console.log('Malformed API shape accepted:', response);

let calls=0;
const mock = new Tone3000Client({ baseUrl: 'https://example.invalid', secretKey: 'mock-only',
  fetchImpl: async () => { calls++; return new Response(JSON.stringify({ data: [], page: 1, total: 0 }), { status: 200 }); } });
await recommendToneChain(mock, { target: 'clean', preferredWorkflow: 'amplitube' });
console.log('External calls for AmpliTube-only:', calls);
assert.equal(calls, 1);

const listener = createServer();
await new Promise(resolve => listener.listen(0, resolve));
console.log('Node listen(port) bound address:', listener.address().address);
await new Promise(resolve => listener.close(resolve));
console.log('Disposable review evidence:', directory);
