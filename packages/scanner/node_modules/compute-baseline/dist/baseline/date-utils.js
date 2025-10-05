import { Temporal } from "@js-temporal/polyfill";
import { BASELINE_LOW_TO_HIGH_DURATION } from "./index.js";
export function toHighDate(lowDate) {
    const startDate = Temporal.PlainDate.from(lowDate);
    return startDate.add(BASELINE_LOW_TO_HIGH_DURATION);
}
/**
 * Format a `Temporal.PlainDate` as a string, with a ≤ range specifier as
 * needed.
 */
export function toRangedDateString(date, ranged) {
    return `${ranged ? "≤" : ""}${date.toString().slice(0, 10)}`;
}
/**
 * Parse a potentially ranged date string (e.g., "≤2024-01-01") to a
 * `Temporal.PlainDate` and a boolean value for ranged or unranged.
 */
export function parseRangedDateString(dateSpec) {
    const ranged = dateSpec.startsWith("≤");
    return [
        Temporal.PlainDate.from(ranged ? dateSpec.slice(1) : dateSpec),
        ranged,
    ];
}
