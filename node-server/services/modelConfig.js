// node-server/services/modelConfig.js
// Shared model weight constants used by both the smart router and the points billing system.

// Points cost multiplier per raw token.
// Higher weight = more expensive per token used.
const MODEL_WEIGHTS = {
    "llama3.2:3b":                          0.5,   // cheapest — fast local model
    "llama3:8b":                            1.0,   // baseline
    "phi-4":                                1.5,   // mid-tier local reasoning
    "deepseek/deepseek-r1-0528-qwen3-8b":  2.0,   // heavy local reasoning
    "gemini-2.5-flash":                     3.0,   // cloud API — most expensive
};

// Default daily points granted to every new user on registration and on each daily reset.
const DEFAULT_DAILY_POINTS = 1000;

// Points-to-tokens exchange rate.
// 1 point spent = TOKENS_PER_POINT bonus tokens added to the user's daily token limit.
// Example: spending 100 points → +100,000 tokens (1 lakh)
const TOKENS_PER_POINT = 1000;

module.exports = { MODEL_WEIGHTS, DEFAULT_DAILY_POINTS, TOKENS_PER_POINT };
