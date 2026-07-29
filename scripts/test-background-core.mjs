import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { importTypeScript } from "./helpers/import-typescript.mjs";

const stateCore = await importTypeScript(
	new URL("../src/utils/background-core.ts", import.meta.url),
);
let state = stateCore.createBackgroundState(true);
assert.equal(state.state, "idle");
state = stateCore.startBackgroundLoad(state);
assert.equal(state.state, "loading-primary");
assert.equal(state.source, "https://api.furry.ist/furry-img");
state = stateCore.handleBackgroundLoadFailure(state);
assert.equal(state.state, "loading-fallback");
assert.equal(state.source, "https://sni-api.furry.ist/furry-img");
state = stateCore.handleBackgroundLoadFailure(state);
assert.equal(state.state, "error");
assert.equal(state.source, null);
assert.equal(stateCore.setBackgroundEnabled(state, true).state, "idle");

const runtimeSource = fs.readFileSync(
	new URL("../public/js/blog-background.js", import.meta.url),
	"utf8",
);

class FakeImage {
	constructor(results = []) {
		this.results = [...results];
		this.dataset = {};
		this.currentSrc = "";
		this.srcValues = [];
		this.listeners = new Map();
	}
	set src(value) {
		this.currentSrc = value;
		this.srcValues.push(value);
		const result = this.results.shift();
		queueMicrotask(() => {
			const eventName = result instanceof Error ? "error" : "load";
			this.listeners.get(eventName)?.();
		});
	}
	get src() {
		return this.currentSrc;
	}
	async decode() {
		return undefined;
	}
	addEventListener(name, listener) {
		this.listeners.set(name, listener);
	}
	removeEventListener(name, listener) {
		if (this.listeners.get(name) === listener) this.listeners.delete(name);
	}
	removeAttribute(name) {
		if (name === "src") this.currentSrc = "";
	}
}

function makeRoot(image, visible = true) {
	const background = {
		dataset: { backgroundVisible: String(visible), backgroundState: "idle" },
		querySelector: () => image,
	};
	return { querySelectorAll: () => [background], background };
}

const window = {};
vm.runInNewContext(runtimeSource, {
	window,
	document: {},
	HTMLImageElement: FakeImage,
	Promise,
	Error,
});

const successImage = new FakeImage([undefined]);
const successRoot = makeRoot(successImage);
await Promise.all([
	window.blogBackground.initialize(successRoot),
	window.blogBackground.initialize(successRoot),
]);
assert.equal(successRoot.background.dataset.backgroundState, "ready");
assert.deepEqual(successImage.srcValues, ["https://api.furry.ist/furry-img"]);

const recoveredImage = new FakeImage([new Error("cached primary"), undefined]);
const recoveredRoot = makeRoot(recoveredImage);
await window.blogBackground.initialize(recoveredRoot);
assert.equal(recoveredRoot.background.dataset.backgroundState, "ready");
assert.deepEqual(recoveredImage.srcValues, [
	"https://api.furry.ist/furry-img",
	"https://sni-api.furry.ist/furry-img",
]);

window.blogBackground.reset();
const fallbackImage = new FakeImage([new Error("primary"), undefined]);
const fallbackRoot = makeRoot(fallbackImage);
await window.blogBackground.initialize(fallbackRoot);
assert.equal(fallbackRoot.background.dataset.backgroundState, "ready");
assert.deepEqual(fallbackImage.srcValues, [
	"https://api.furry.ist/furry-img",
	"https://sni-api.furry.ist/furry-img",
]);

window.blogBackground.reset();
const errorImage = new FakeImage([new Error("primary"), new Error("fallback")]);
const errorRoot = makeRoot(errorImage);
await window.blogBackground.initialize(errorRoot);
assert.equal(errorRoot.background.dataset.backgroundState, "error");
assert.equal(errorImage.currentSrc, "");

const hiddenImage = new FakeImage();
const hiddenRoot = makeRoot(hiddenImage, false);
await window.blogBackground.initialize(hiddenRoot);
assert.equal(hiddenRoot.background.dataset.backgroundState, "disabled");
assert.deepEqual(hiddenImage.srcValues, []);

const listeners = new Map();
const lifecycleDocument = new StatsLikeDocument();
function StatsLikeDocument() {
	this.querySelectorAll = () => [];
	this.addEventListener = (name, listener) => listeners.set(name, listener);
	this.removeEventListener = (name, listener) => {
		if (listeners.get(name) === listener) listeners.delete(name);
	};
}
const unbind = window.blogBackground.bindLifecycle(lifecycleDocument);
assert.ok(listeners.has("astro:page-load"));
unbind();
assert.equal(listeners.size, 0);

console.log("Background core tests passed");
