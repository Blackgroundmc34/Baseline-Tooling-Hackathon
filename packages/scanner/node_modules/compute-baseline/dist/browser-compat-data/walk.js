import { query } from "./query.js";
import { isBrowserStatement, isFeatureData } from "./typeUtils.js";
import { descendantKeys } from "./walkUtils.js";
function* lowLevelWalk(data, path, depth = Infinity) {
    if (path !== undefined) {
        const next = {
            path,
            data,
        };
        if (isBrowserStatement(data)) {
            next.browser = data;
        }
        else if (isFeatureData(data)) {
            next.compat = data.__compat;
        }
        yield next;
    }
    if (depth > 0) {
        for (const key of descendantKeys(data, path)) {
            // TODO: can anything be done about this "as"?
            yield* lowLevelWalk(data[key], joinPath(path, key), depth - 1);
        }
    }
}
function joinPath(...pathItems) {
    return pathItems.filter((item) => item !== undefined).join(".");
}
export function* walk(entryPoints, data) {
    const walkers = [];
    if (entryPoints === undefined) {
        walkers.push(lowLevelWalk(data));
    }
    else {
        entryPoints = Array.isArray(entryPoints) ? entryPoints : [entryPoints];
        walkers.push(...entryPoints.map((entryPoint) => {
            const queryResult = query(entryPoint, data);
            if (isFeatureData(queryResult)) {
                return lowLevelWalk(queryResult, entryPoint);
            }
            throw new Error("Unhandled traverse target");
        }));
    }
    for (const walker of walkers) {
        for (const step of walker) {
            if (step.compat) {
                yield step;
            }
        }
    }
}
