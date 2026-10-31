// Confirmed public packages. Operation rates are NOT changed by this migration.
export const TOKEN_PACKAGES = {
	starter: {
		priceEur: 20,
		currency: "EUR",
		tokens: 2000,
		label: "Starter Access",
	},
	professional: {
		priceEur: 100,
		currency: "EUR",
		tokens: 10000,
		label: "Professional Use",
	},
} as const;
export const TOKEN_VALIDITY_MONTHS = 12;
// Card checkout accepts any whole-euro amount in this range (100 tokens per EUR).
export const CARD_MIN_EUR = 20;
export const CARD_MAX_EUR = 2500;
export const TOKENS_PER_EUR = 100;
