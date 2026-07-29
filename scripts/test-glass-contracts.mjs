import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
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

const builtAssets = globSync("dist/_astro/*.{js,css}", { nodir: true });
const builtAssetNames = builtAssets.map((file) => basename(file));
for (const legacyAsset of [
	/^Layout\./,
	/^Search\./,
	/^DisplaySettings\./,
	/^setting-utils\./,
	/overlayscrollbars/i,
	/fancybox/i,
]) {
	assert.equal(
		builtAssetNames.some((name) => legacyAsset.test(name)),
		false,
		`GLASS dist still contains a legacy UI asset matching ${legacyAsset}`,
	);
}

const builtAssetSource = builtAssets.map(read).join("\n");
for (const legacyBundleMarker of ["OverlayScrollbars", "Fancybox", "card-base", "btn-regular"]) {
	assert.equal(
		builtAssetSource.includes(legacyBundleMarker),
		false,
		`GLASS dist still embeds the legacy UI marker ${legacyBundleMarker}`,
	);
}

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
assert.equal(count(home, '>--</span>'), 18, "every home stat value must start at --");
assert.match(home, /data-blog-background/, "home must expose the background state-machine root");
assert.match(home, /id="glass-search-dialog"/, "home must retain RSS search");
assert.match(home, /data-glass-theme="light"/, "home must expose light theme selection");
assert.match(home, /data-glass-context-drawer/, "home must expose the persistent context rail contract");
assert.match(
	home,
	/<details[^>]*class="glass-context-drawer"[^>]*\sopen(?:\s|>)/,
	"desktop context rail must render as a genuinely open details element",
);
assert.match(home, /<aside[^>]*aria-label="页面上下文"/, "context rail must expose its outer complementary landmark");
assert.match(
	home,
	/<div[^>]*class="glass-context-panel"[^>]*role="complementary"[^>]*aria-modal="false"[^>]*aria-label="观测站概览"/,
	"desktop context panel must expose the named complementary landmark seen by assistive technology",
);
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
assert.equal(/border-radius:\s*50%/.test(glassStyles), false, "GLASS styles must use the named radius scale");
assert.equal(/backdrop-filter/.test(glassStyles), false, "GLASS surfaces must not become a site-wide frosted stack");

const glassTokens = read("src/styles/glass/tokens.css");
for (const requiredToken of [
	"--glass-canvas: #f8f8fc",
	"--glass-surface: #ffffff",
	"--glass-ink: #0a0a0a",
	"--glass-muted: #6b7280",
	"--glass-accent: #0080ff",
	"--glass-accent-hover: #3a7bc8",
	"--glass-canvas: #0a0a0a",
	"--glass-surface: #161616",
	"--glass-ink: #fafafa",
	"--glass-accent: #3b82f6",
	"--glass-accent-hover: #2563eb",
	"--glass-success: #22c55e",
	"--glass-warning: #f59e0b",
	"--glass-danger: #ef4444",
	"--glass-radius-xs: 4px",
	"--glass-radius-sm: 6px",
	"--glass-radius-md: 10px",
	"--glass-radius-lg: 16px",
	"--glass-radius-pill: 999px",
	"--glass-progress: linear-gradient(to right, #6ba3e8, #8fbcf0)",
]) {
	assert.ok(glassTokens.includes(requiredToken), `GLASS token drifted from ArcTower: ${requiredToken}`);
}
assert.equal(
	count(glassStyles, "999px"),
	1,
	"the raw pill radius must be declared once as a semantic token and consumed by name",
);
assert.match(glassStyles, /animation:\s*glass-dialog-in 250ms/, "dialog entry must use the specified 250ms timing");
assert.match(glassStyles, /transition:\s*width 400ms var\(--glass-ease\)/, "progress motion must use the specified 400ms easing");
assert.match(glassStyles, /letter-spacing:\s*-0\.04em/, "display headings must retain ArcTower compact tracking");
assert.match(glassStyles, /letter-spacing:\s*0\.2em/, "metadata labels must retain ArcTower expanded tracking");
assert.equal(/background(?:-color)?:\s*#000(?:000)?\b/i.test(glassStyles), false, "GLASS must not use a pure-black surface");
assert.match(glassStyles, /\.glass-switch-track::after/, "background visibility must use an explicit ArcTower switch thumb");
assert.match(glassStyles, /\.glass-switch input:checked \+ \.glass-switch-track::after/, "the custom switch must expose a checked thumb state");
assert.match(glassStyles, /\.glass-switch input:focus-visible \+ \.glass-switch-track/, "the custom switch must expose a visible keyboard focus state");
const compactBar = read("src/glass/components/CompactBar.astro");
assert.match(compactBar, /class="glass-switch-track"/, "the settings UI must render a portable explicit switch track");
assert.match(
	compactBar,
	/class="glass-mobile-drawer"[\s\S]*?data-glass-drawer-panel/,
	"the mobile navigation dialog must expose the shared focus-trap panel contract",
);
assert.match(home, /class="glass-switch-track"/, "the final home document must retain the explicit switch track");

const shell = read("src/glass/layouts/GlassShell.astro");
for (const runtime of ["/js/umami-share.js", "/js/blog-stats.js", "/js/blog-background.js"]) {
	assert.match(shell, new RegExp(runtime.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `shell must load ${runtime}`);
}

const observatoryRuntime = read("src/glass/runtime/observatory.ts");
assert.match(
	observatoryRuntime,
	/if \(event\.key === "Escape"\) \{\s*const dialog = document\.querySelector<HTMLDialogElement>\("dialog\[open\]"\);\s*if \(dialog\) \{\s*event\.preventDefault\(\);\s*closeDialog\(dialog\);\s*return;/,
	"Escape must explicitly close an open native dialog before handling drawers and popovers",
);
assert.match(
	observatoryRuntime,
	/const panel = openDrawer\.querySelector<HTMLElement>\("\[data-glass-drawer-panel\]"\);[\s\S]*?focusableWithin\(panel\)/,
	"mobile Tab trapping must remain inside the modal drawer panel rather than its external summary trigger",
);
assert.match(
	observatoryRuntime,
	/querySelector<HTMLElement>\("\[data-glass-drawer-panel\] \[data-glass-drawer-close\]"\)[\s\S]*?\.focus\(\)/,
	"opening a mobile drawer must move focus to its in-panel close control",
);

console.log(`GLASS contracts passed: ${htmlFiles.length} HTML documents, 8 home post stats roots, article feature matrix intact.`);
