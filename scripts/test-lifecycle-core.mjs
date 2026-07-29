import assert from "node:assert/strict";
import { importTypeScript } from "./helpers/import-typescript.mjs";

const core = await importTypeScript(
	new URL("../src/utils/lifecycle-core.ts", import.meta.url),
);

let initialized = 0;
let cleaned = 0;
core.runLifecycleModule("module", () => {
	initialized += 1;
	return () => {
		cleaned += 1;
	};
});
core.runLifecycleModule("module", () => {
	initialized += 1;
	return () => {
		cleaned += 1;
	};
});
assert.equal(initialized, 2);
assert.equal(
	cleaned,
	1,
	"reinitializing the same key must clean the old instance",
);
core.cleanupLifecycleModule("module");
assert.equal(cleaned, 2);

const listeners = new Map();
const target = {
	addEventListener(name, listener) {
		listeners.set(name, listener);
	},
	removeEventListener(name, listener) {
		if (listeners.get(name) === listener) listeners.delete(name);
	},
};
let pageInitializations = 0;
const unbind = core.bindPageLifecycle(target, () => {
	pageInitializations += 1;
});
assert.equal(pageInitializations, 1);
assert.ok(listeners.has("DOMContentLoaded"));
assert.ok(listeners.has("astro:page-load"));
assert.ok(listeners.has("swup:contentReplaced"));
listeners.get("astro:page-load")();
assert.equal(pageInitializations, 2);
unbind();
assert.equal(listeners.size, 0);

console.log("Lifecycle core contract tests passed");
