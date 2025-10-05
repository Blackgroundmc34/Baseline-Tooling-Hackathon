import { compareVersions } from "compare-versions";
import { defaultCompat } from "./compat.js";
import { Release } from "./release.js";
export function browser(id, compat = defaultCompat) {
    let b = compat.browsers.get(id);
    if (b) {
        return b;
    }
    const data = compat.query(`browsers.${id}`);
    b = new Browser(id, data);
    compat.browsers.set(id, b);
    return b;
}
export class Browser {
    id;
    data;
    releases;
    constructor(id, data) {
        this.id = id;
        this.data = data;
        const sortedReleaseData = Object.entries(data.releases).sort(([a], [b]) => compareVersions(a, b));
        const releases = sortedReleaseData.map(([version, data], index) => new Release(this, version, data, index));
        if (this.data.preview_name) {
            releases.push(
            // For Safari TP, "nightly" isn't literally correct, but according to
            // the BCD schema this can be any "current alpha / experimental
            // release".
            new Release(this, "preview", { status: "nightly" }, releases.length));
        }
        this.releases = releases;
    }
    toString() {
        return `[Browser ${this.name}]`;
    }
    get name() {
        return this.data.name;
    }
    current() {
        const curr = this.releases.find((r) => r.data.status === "current");
        if (curr === undefined) {
            throw new Error(`${browser} does not have a "current" release`);
        }
        return curr;
    }
    version(versionString) {
        const result = this.releases.find((r) => r.version === versionString);
        if (result === undefined) {
            throw new Error(`${browser} does not have a '${versionString}' release.`);
        }
        return result;
    }
}
