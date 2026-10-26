import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(p,'utf8');
test('public pages use the agreed navigation and canonical legal routes',()=>{
 const s=source('app/site-content.tsx');
 for(const route of ['/services','/pricing','/about','/contacts','/faq','/terms-and-conditions','/privacy-policy']) assert.ok(s.includes(route));
 assert.doesNotMatch(s,/Field Guide|human-assisted|Visa|Mastercard|Priority GPU|Dedicated API/);
 assert.match(s,/Omnix21/);assert.match(s,/COMPANY\.registration/);assert.match(s,/COMPANY\.email/);assert.match(s,/COMPANY\.phone/);assert.match(s,/TokenEstimator/);assert.doesNotMatch(s,/ORIA|oria\.com\.im|34637558778|108 261 926/);
 const c=source('lib/company.ts');assert.match(c,/107 643 348 R\.C\.S\. Paris/);assert.match(c,/contact@omnix-21\.com/);assert.match(c,/\+33 6 87 35 58 25/);
});
test('home sections follow reference order without additional model marketing',()=>{
 const s=source('app/page.tsx');const order=['v-hero','ExampleGallery compact','id="why"','id="features"','id="services"','<ContactForm','v-feedback','<FaqSection'];
 let previous=-1;for(const marker of order){const at=s.indexOf(marker);assert.ok(at>previous,marker);previous=at;}
 assert.match(s,/Type your imagination/);assert.match(s,/action="\/studio"/);assert.doesNotMatch(s,/500|3 AI Engines|2K HD Motion|human precision/);
});
test('packages are EUR prepaid only and registration has no free credits',()=>{
 const s=source('lib/commerce.ts');assert.match(s,/priceEur: 20,[\s\S]*?tokens: 2000/);assert.match(s,/priceEur: 100,[\s\S]*?tokens: 10000/);assert.doesNotMatch(s,/priceUsd/);
 assert.match(source('app/api/auth/route.ts'),/VALUES \(\$1,\$2,\$3,0,false\)/);
 assert.doesNotMatch(source('app/workspace.tsx'),/500 free|500 Tokens|\$10|\$20|\$50|\$100|simulation/);
});
test('legal pages are final published terms, not drafts',()=>{
 const s=source('app/site-content.tsx');
 assert.doesNotMatch(s,/Release draft|draft|must be confirmed|pending implementation|will be confirmed/i);
 assert.match(s,/CNIL/);assert.match(s,/withdrawal|14 days/);assert.match(s,/refund/i);
 assert.match(s,/12 months/);
 assert.match(source('app/api/tokens/route.ts'),/expiryTrackingEnabled: true/);
 assert.match(source('app/public-controls.tsx'),/message has not been sent/);
});
