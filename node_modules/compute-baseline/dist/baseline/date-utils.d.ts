import { Temporal } from "@js-temporal/polyfill";
export declare function toHighDate(lowDate: Parameters<typeof Temporal.PlainDate.from>[0]): Temporal.PlainDate;
/**
 * Format a `Temporal.PlainDate` as a string, with a ≤ range specifier as
 * needed.
 */
export declare function toRangedDateString(date: Temporal.PlainDate, ranged?: boolean): string;
/**
 * Parse a potentially ranged date string (e.g., "≤2024-01-01") to a
 * `Temporal.PlainDate` and a boolean value for ranged or unranged.
 */
export declare function parseRangedDateString(dateSpec: string): [date: Temporal.PlainDate, ranged: boolean];
