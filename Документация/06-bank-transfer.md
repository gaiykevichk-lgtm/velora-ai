# Bank transfer (IBAN) — working notes, not legal text

## Scope in this version
- Buyer flow: amount €1–€2,500, buyer type person/company, confirm order, receive IBAN instructions.
- Admin flow: mark paid, mark reviewing, mark cancelled, mark reported, refund bookkeeping, upload signed contract.
- Buyer receipt email exists but may be log-only when SMTP is absent; admin sees delivery state.
- PDF downloads are plain-text PDF documents generated without dependencies; bank files can be attached/uploaded and exported in the dossier.
- Unknown sender/amount/payment goes to manual review; one transfer is tied to one order.
- Final commercial launch needs: real IBAN/BIC, terms text, accrual deadline, accounting numbering/VAT rules, backups, authorized access.

## Environment
BANK_TRANSFER_ENABLED=true enables the buyer route.
BANK_SELLER_* holds seller display details + IBAN/BIC.
BANK_TERMS_VERSION and BANK_TERMS_TEXT freeze the accepted copy per order.
BANK_TOKEN_VALIDITY_MONTHS and BANK_CREDIT_DAYS_AFTER_RECEIPT are shown everywhere from one source.
Evidence upload dir must be writable by the app.

## Data model
bank_buyers: latest reusable profile per user.
bank_orders: one snapshot per order, immutable buyer/seller payload, public order number, kind/person/company payload, terms version/text, confirmation timestamp, status history via bank_order_events.
bank_payments: 0..n receipts per order; every manual credit stores sender/amount/currency/date/reference/raw reference/reason/match basis; repeat confirmation is rejected by unique bank operation id.
bank_refunds: manual refund records; token correction is only stored when specified.
bank_evidence: attached files with sha256; DB stores only metadata, files live under BANK_EVIDENCE_DIR.
bank_mail_log: rendered order email, send time, provider message id, delivery state.
bank_order_documents: numbered order confirmation/invoice/payment receipt; versioned corrections.
bank_audit_log: who did what to which order and when.

## Guarantees
- Amount/tokens/order number come only from the server.
- Order confirmation is idempotent per client request id.
- Credit is idempotent per bank operation id and per order; concurrent credits race on FOR UPDATE.
- Partial payments accumulate; full amount credits once; overpay does not mint tokens.
- Email failures never change paid state and stay visible to admin.
- Terms/profile edits do not rewrite old orders because orders embed their own snapshot.
- Missing reference, mismatch, partial, and non-EUR findings stay on manual review.
