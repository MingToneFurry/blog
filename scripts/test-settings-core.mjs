import assert from "node:assert/strict";
import { importTypeScript } from "./helpers/import-typescript.mjs";

const core = await importTypeScript(
	new URL("../src/utils/settings-core.ts", import.meta.url),
);

function storage(initial = {}) {
	const values = new Map(Object.entries(initial));
	return {
		values,
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key),
	};
}

const legacy = storage({ theme: "dark", "hide-bg": "true", "bg-blur": "12" });
assert.deepEqual(core.readAppearanceSettings(legacy), {
	theme: "dark",
	backgroundVisible: false,
	backgroundBlur: 12,
});

assert.equal(core.parseTheme("broken"), "auto");
assert.equal(core.clampBackgroundBlur("999"), core.MAX_BACKGROUND_BLUR);
assert.equal(core.clampBackgroundBlur("-3"), core.MIN_BACKGROUND_BLUR);
assert.equal(core.clampBackgroundBlur("broken"), core.DEFAULT_BACKGROUND_BLUR);
assert.equal(core.resolveTheme("auto", true), "dark");
assert.equal(core.resolveTheme("auto", false), "light");

const writable = storage();
const normalized = core.writeAppearanceSettings(writable, {
	theme: "light",
	backgroundVisible: true,
	backgroundBlur: 100,
});
assert.equal(normalized.backgroundBlur, core.MAX_BACKGROUND_BLUR);
assert.equal(writable.values.get("hide-bg"), "false");

const blockedStorage = {
	getItem() {
		throw new Error("blocked");
	},
	setItem() {
		throw new Error("blocked");
	},
	removeItem() {},
};
assert.doesNotThrow(() => core.readAppearanceSettings(blockedStorage));
assert.doesNotThrow(() =>
	core.writeAppearanceSettings(blockedStorage, {
		theme: "auto",
		backgroundVisible: true,
		backgroundBlur: 4,
	}),
);

console.log("Settings core contract tests passed");
