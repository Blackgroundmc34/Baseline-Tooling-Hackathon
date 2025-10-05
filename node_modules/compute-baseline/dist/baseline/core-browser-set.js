export const identifiers = [
    "chrome",
    "chrome_android",
    "edge",
    "firefox",
    "firefox_android",
    "safari",
    "safari_ios",
];
export function browsers(compat) {
    return identifiers.map((b) => compat.browser(b));
}
