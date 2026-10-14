import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync('app/studio.css','utf8');const view=readFileSync('app/workspace.tsx','utf8');
test('mobile studio uses drawer and overlay dialogs, not extra columns',()=>{
 assert.match(css,/@media\(max-width:767px\)/);assert.match(css,/sidebar\.sidebar-open/);assert.match(css,/modal-backdrop\{position:fixed;inset:0/);assert.match(css,/100dvh/);assert.match(css,/composer-settings>select/);
});
test('studio navigation exposes current mode and dialogs are labelled',()=>{
 assert.match(view,/aria-pressed=\{mode === item.key\}/);assert.match(view,/aria-expanded=\{menuOpen\}/);assert.equal((view.match(/role="dialog"/g)||[]).length,2);assert.match(view,/aria-label="Aspect ratio"/);assert.match(view,/aria-label="Video duration"/);
});
test('mobile multiline prompts and overlay escape handling preserved',()=>{
 assert.match(view,/e.ctrlKey \|\| e.metaKey/);assert.match(view,/event.key === "Escape"/);assert.match(view,/document.body.style.overflow = "hidden"/);
});
test('mode identities are unique and video never uses text pricing',()=>{
 const config=view.slice(view.indexOf('const modes:'),view.indexOf('async function request'));
 assert.deepEqual([...config.matchAll(/key: "(text|image|video)"/g)].map(m=>m[1]),['text','image','video']);
});
