import assert from "node:assert/strict";
import { importTypeScript } from "./helpers/import-typescript.mjs";

const core = await importTypeScript(
	new URL("../src/utils/content-core.ts", import.meta.url),
);
const urls = await importTypeScript(
	new URL("../src/utils/url-utils.ts", import.meta.url),
);

function post(slug, published, data = {}) {
	return {
		slug,
		data: {
			title: slug,
			published: new Date(published),
			description: "",
			image: "",
			tags: [],
			lang: "",
			pinned: false,
			draft: false,
			...data,
		},
	};
}

const input = [
	post("same-b", "2026-01-01T00:00:00Z"),
	post("featured", "2025-01-01T00:00:00Z", { featured: 3 }),
	post("pinned", "2024-01-01T00:00:00Z", { pinned: true }),
	post("same-a", "2026-01-01T00:00:00Z"),
	post("draft", "2027-01-01T00:00:00Z", { draft: true }),
];
const snapshot = structuredClone(input);
const visible = core.filterPosts(input, false);
const sorted = core.sortPosts(visible);

assert.deepEqual(
	sorted.map(({ slug }) => slug),
	["pinned", "featured", "same-a", "same-b"],
);
assert.deepEqual(
	input,
	snapshot,
	"sorting and filtering must not mutate collection entries",
);
assert.equal(core.filterPosts(input, true).length, 5);

const legacy = core.withLegacyNavigation(sorted);
assert.notEqual(legacy[0], sorted[0]);
assert.notEqual(legacy[0].data, sorted[0].data);
assert.equal(legacy[1].data.nextSlug, "pinned");
assert.equal(legacy[1].data.prevSlug, "same-a");
assert.deepEqual(
	input,
	snapshot,
	"legacy compatibility must clone instead of mutating",
);

assert.deepEqual(core.getPostNavigation(sorted, "featured"), {
	newer: { slug: "pinned", title: "pinned", url: "/posts/pinned/" },
	older: { slug: "same-a", title: "same-a", url: "/posts/same-a/" },
});
assert.deepEqual(core.getPostNavigation(sorted, "missing"), {
	newer: null,
	older: null,
});

const summary = core.toPostSummary(post("plain", "2026-01-01T00:00:00Z"));
assert.equal(summary.category, core.DEFAULT_POST_CATEGORY);
assert.equal(summary.type, core.DEFAULT_POST_TYPE);
assert.equal(summary.series, undefined);
assert.equal(summary.featuredWeight, 0);

assert.equal(
	urls.normalizePathname("/posts/中文标题/?q=1#x"),
	"/posts/中文标题/",
);
assert.equal(
	urls.normalizePathname("/posts/%E4%B8%AD%E6%96%87"),
	"/posts/中文/",
);
assert.equal(urls.normalizePathname("posts//example"), "/posts/example/");
assert.equal(urls.normalizePathname("/"), "/");

console.log("Content core tests passed");
