import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('showcase contains eight original images with accessible descriptions', () => {
 const source=readFileSync('lib/examples.ts','utf8');
 assert.equal((source.match(/category:/g)||[]).length,8);
 assert.equal((source.match(/alt:/g)||[]).length,8);
 assert.match(readFileSync('app/page.tsx','utf8'), /<ExampleGallery compact/);
 assert.match(readFileSync('app/examples/page.tsx','utf8'), /<ExampleGallery\//);
 assert.match(readFileSync('app/example-gallery.tsx','utf8'), /AI GENERATED/);
});
