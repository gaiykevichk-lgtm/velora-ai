import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseReceipt } from '../lib/purchase-receipt.mjs';
const paid = {status:'credited', invoiceNumber:'INV-2026-000123', email:'buyer@example.com', buyerName:'A <Buyer>', invoiceUrl:'https://example.com/studio?invoice=123&kind=bank', date:'2026-11-05', method:'Bank transfer', amount:20, tokens:2000};
test('receipt uses credited order values and escapes HTML', () => { const r=purchaseReceipt(paid); assert.match(r.subject,/INV-2026-000123/); assert.match(r.text,/2,000 tokens/); assert.match(r.text,/€20\.00/); assert.match(r.html,/A &lt;Buyer&gt;/); assert.match(r.html,/&amp;kind=bank/); });
test('uncredited or incomplete orders cannot generate a paid receipt', () => { assert.throws(()=>purchaseReceipt({...paid,status:'pending'})); assert.throws(()=>purchaseReceipt({...paid,invoiceNumber:''})); assert.throws(()=>purchaseReceipt({...paid,invoiceUrl:'javascript:alert(1)'})); });
