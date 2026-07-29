import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { globSync } from "glob";

const read = (file) => readFileSync(file, "utf8");
const count = (text, needle) => text.split(needle).length - 1;

assert.ok(existsSync("dist/index.html"), "Run pnpm build before the GLASS contract test");

assert.equal(globSync("src/components/**/*", { nodir: true }).length, 0, "legacy component files must be retired");
for (const legacyPath of ["src/layouts/Layout.astro", "src/layouts/MainGridLayout.astro"]) {
	assert.equal(existsSync(legacyPath), false, `legacy view path must be retired: ${legacyPath}`);
}

const routeSources = globSync("src/pages/**/*.{astro,md}").map(read).join("\n");
for (const legacyMarker of ["MainGridLayout", "PostCard", "PostMeta", "Profile.astro", "post-pageviews"]) {
	assert.equal(routeSources.includes(legacyMarker), false, `route source still references ${legacyMarker}`);
}

const htmlFiles = globSync("dist/**/*.html");
assert.equal(htmlFiles.length, 36, "GLASS build should retain the 36-page HTML baseline");

for (const file of htmlFiles) {
	const html = read(file);
	assert.match(html, /<main(?:\s|>)/, `${file} is missing the Swup main container`);
	assert.match(html, /id="toc"/, `${file} is missing the Swup #toc container`);
	assert.equal(html.includes("post-pageviews"), false, `${file} contains the legacy post stats marker`);
	assert.equal(html.includes("fetchUmamiStats("), false, `${file} contains a legacy inline stats request`);
	for (const anchor of html.match(/<a\b[^>]*target="_blank"[^>]*>/g) || []) {
		assert.match(anchor, /rel="[^"]*noopener[^"]*"/, `${file} has an external target without noopener`);
		assert.match(anchor, /rel="[^"]*noreferrer[^"]*"/, `${file} has an external target without noreferrer`);
	}
}

const home = read("dist/index.html");
assert.equal(count(home, 'data-stats-scope="site"'), 1, "home must expose one site lifetime stats root");
assert.equal(count(home, 'data-stats-scope="post"'), 8, "home must expose one stats root for each of eight posts");
assert.equal(count(home, 'data-stats-value="pageviews"'), 9, "home must expose PV for site and every post");
assert.equal(count(home, 'data-stats-value="visitors"'), 9, "home must expose UV for site and every post");
assert.equal(count(home, 'data-stats-state="idle" aria-live="polite">--</span>'), 18, "every home stat value must start at --");
assert.match(home, /data-blog-background/, "home must expose the background state-machine root");
assert.match(home, /id="glass-search-dialog"/, "home must retain RSS search");
assert.match(home, /data-glass-theme="light"/, "home must expose light theme selection");
assert.match(home, /data-glass-theme="dark"/, "home must expose dark theme selection");
assert.match(home, /data-glass-theme="auto"/, "home must expose automatic theme selection");

const postFiles = htmlFiles.filter((file) => file.includes("/posts/") || file.includes("\\posts\\"));
const postFile = postFiles[0];
assert.ok(postFile, "at least one generated article is required");
const post = read(postFile);
assert.ok(count(post, 'data-stats-scope="post"') >= 2, "article must expose cumulative PV+UV in header and context rail");
assert.ok(count(post, 'data-stats-value="pageviews"') >= 2, "article must expose PV in both reading contexts");
assert.ok(count(post, 'data-stats-value="visitors"') >= 2, "article must expose UV in both reading contexts");
assert.match(post, /giscus\.app\/client\.js/, "article must retain Giscus");
assert.match(post, /CONTENT LICENSE/, "article must retain the license panel");
assert.match(post, /编辑本文/, "article must retain the GitHub edit action");
assert.match(post, /data-reading-progress/, "article must retain reading progress");
assert.ok(postFiles.some((file) => read(file).includes("data-glass-toc")), "articles with headings must retain a table of contents");

const glassStyles = globSync("src/styles/glass/*.css").map(read).join("\n");
assert.match(glassStyles, /prefers-reduced-motion:\s*reduce/, "GLASS styles must include reduced-motion behavior");
assert.equal(/transition:\s*all\b/.test(glassStyles), false, "GLASS styles must not use transition: all");
assert.equal(/border-radius:\s*(?:999px|50%)/.test(glassStyles), false, "GLASS styles must use only the approved radius scale");
assert.equal(/backdrop-filter/.test(glassStyles), false, "GLASS surfaces must not become a site-wide frosted stack");

const shell = read("src/glass/layouts/GlassShell.astro");
for (const runtime of ["/js/umami-share.js", "/js/blog-stats.js", "/js/blog-background.js"]) {
	assert.match(shell, new RegExp(runtime.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `shell must load ${runtime}`);
}

console.log(`GLASS contracts passed: ${htmlFiles.length} HTML documents, 8 home post stats roots, article feature matrix intact.`);
