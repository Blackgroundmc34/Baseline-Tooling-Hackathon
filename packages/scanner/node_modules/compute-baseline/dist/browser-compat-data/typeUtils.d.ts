import { Browsers, BrowserStatement, CompatData, CompatStatement, Identifier, MetaBlock } from "@mdn/browser-compat-data";
export declare function isIndexable(o: unknown): o is Record<string, unknown>;
export declare function isCompatData(o: unknown): o is CompatData;
export declare function isFeatureData(o: unknown): o is Identifier;
export declare function isBrowsers(o: unknown): o is Browsers;
export declare function isBrowserStatement(o: unknown): o is BrowserStatement;
export declare function isCompatStatement(o: unknown): o is CompatStatement;
export declare function isMetaBlock(o: unknown): o is MetaBlock;
