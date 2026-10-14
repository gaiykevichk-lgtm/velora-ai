import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(p,'utf8');
test('public pages use the agreed navigation and canonical legal routes',()=>{
 const s=source('app/site-content.tsx');
 for(const route of ['/services','/pricing','/about','/contacts','/faq','/terms-and-conditions','/privacy-policy']) assert.ok(s.includes(route));
 assert.doesNotMatch(s,/Field Guide|human-assisted|Visa|Mastercard|Priority GPU|Dedicated API/);
});
test('home sections follow reference order without additional model marketing',()=>{
 const s=source('app/page.tsx');const order=['v-hero','ExampleGallery compact','id="why"','id="features"','id="services"','<ContactForm','v-feedback','<FaqSection'];
 let previous=-1;for(const marker of order){const at=s.indexOf(marker);assert.ok(at>previous,marker);previous=at;}
 assert.match(s,/Type your imagination/);assert.match(s,/action="\/studio"/);assert.doesNotMatch(s,/500|3 AI Engines|2K HD Motion|human precision/);
});
test('packages are EUR prepaid only and registration has no free credits',()=>{
 const s=source('lib/commerce.ts');assert.match(s,/priceEur: 20,[\s\S]*?tokens: 2000/);assert.match(s,/priceEur: 100,[\s\S]*?tokens: 10000/);assert.doesNotMatch(s,/priceUsd/);
 assert.match(source('app/api/auth/route.ts'),/VALUES \(\$1,\$2,\$3,0\)/);
 assert.doesNotMatch(source('app/workspace.tsx'),/500 free|500 Tokens|\$10|\$20|\$50|\$100|simulation/);
});
test('payment and legal gaps are explicitly disclosed, not mocked',()=>{
 const s=source('app/site-content.tsx');assert.match(s,/Release draft/);assert.match(s,/CNIL/);assert.match(s,/withdrawal/);assert.match(s,/not connected yet/);
 assert.match(source('app/api/tokens/route.ts'),/operationRatesVerified: false/);
 assert.match(source('app/public-controls.tsx'),/message has not been sent/);
});
