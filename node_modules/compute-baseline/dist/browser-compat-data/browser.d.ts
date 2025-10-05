import { BrowserName, BrowserStatement } from "@mdn/browser-compat-data";
import { Release } from "./release.js";
export declare function browser(id: string, compat?: import("./compat.js").Compat): Browser;
export declare class Browser {
    id: BrowserName;
    data: BrowserStatement;
    releases: ReadonlyArray<Release>;
    constructor(id: BrowserName, data: BrowserStatement);
    toString(): string;
    get name(): string;
    current(): Release;
    version(versionString: string): Release;
}
