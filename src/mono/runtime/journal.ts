import type { AppearanceSettings } from "@/types/runtime";
import {
	applyAppearanceAttributes,
	clampBackgroundBlur,
	parseTheme,
	readAppearanceSettings,
	resolveTheme,
	writeAppearanceSettings,
} from "@/utils/settings-core";

type SearchEntry = {
	title: string;
	description: string;
	link: string;
};

const root = document.documentElement;
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const dialogReturnFocus = new WeakMap<HTMLDialogElement, HTMLElement>();
let searchIndexPromise: Promise<SearchEntry[]> | null = null;
let searchTimer: number | undefined;

function updateGiscusTheme(colorScheme: "light" | "dark"): void {
	const iframe = document.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
	iframe?.contentWindow?.postMessage(
		{ giscus: { setConfig: { theme: colorScheme } } },
		"https://giscus.app",
	);
}

function syncSettingsControls(settings: AppearanceSettings): void {
	const theme = document.querySelector<HTMLSelectElement>("[data-journal-theme]");
	const visible = document.querySelector<HTMLInputElement>("[data-journal-background-visible]");
	const blur = document.querySelector<HTMLInputElement>("[data-journal-background-blur]");
	const blurValue = document.querySelector<HTMLOutputElement>("[data-journal-background-blur-value]");

	if (theme) theme.value = settings.theme;
	if (visible) visible.checked = settings.backgroundVisible;
	if (blur) blur.value = String(settings.backgroundBlur);
	if (blurValue) blurValue.value = String(settings.backgroundBlur);
}

function syncBackgrounds(settings: AppearanceSettings): void {
	const softenedOpacity = Math.max(0.58, 0.92 - settings.backgroundBlur * 0.014);
	for (const background of document.querySelectorAll<HTMLElement>("[data-blog-background]")) {
		background.dataset.backgroundVisible = String(settings.backgroundVisible);
		background.dataset.backgroundBlur = String(settings.backgroundBlur);
		background.style.setProperty("--journal-background-opacity", String(softenedOpacity));
		const image = background.querySelector<HTMLImageElement>("[data-background-image]");
		if (!settings.backgroundVisible) {
			image?.removeAttribute("src");
			background.dataset.backgroundState = "disabled";
		}
	}
}

function syncBackgroundMode(): void {
	const stage = document.querySelector<HTMLElement>("[data-journal-stage]");
	const background = stage?.querySelector<HTMLElement>(":scope > [data-blog-background]");
	const main = document.querySelector<HTMLElement>("#journal-main[data-journal-background-mode]");
	if (!stage || !background || !main) return;
	const mode = main.dataset.journalBackgroundMode === "cover" ? "cover" : "edge";
	stage.dataset.journalBackgroundMode = mode;
	background.classList.toggle("journal-background--cover", mode === "cover");
	background.classList.toggle("journal-background--edge", mode === "edge");
}

function applySettings(settings: AppearanceSettings, persist = false): void {
	const normalized = persist
		? writeAppearanceSettings(window.localStorage, settings)
		: settings;
	const colorScheme = resolveTheme(normalized.theme, themeMedia.matches);
	applyAppearanceAttributes(root, normalized, themeMedia.matches);
	root.classList.toggle("dark", colorScheme === "dark");
	root.style.colorScheme = colorScheme;
	syncSettingsControls(normalized);
	syncBackgrounds(normalized);
	updateGiscusTheme(colorScheme);
	void window.blogBackground?.initialize(document);
}

function settingsFromControls(): AppearanceSettings {
	const current = readAppearanceSettings(window.localStorage);
	const theme = document.querySelector<HTMLSelectElement>("[data-journal-theme]");
	const visible = document.querySelector<HTMLInputElement>("[data-journal-background-visible]");
	const blur = document.querySelector<HTMLInputElement>("[data-journal-background-blur]");
	return {
		theme: parseTheme(theme?.value || current.theme),
		backgroundVisible: visible?.checked ?? current.backgroundVisible,
		backgroundBlur: clampBackgroundBlur(blur?.value ?? current.backgroundBlur),
	};
}

function syncDialogOpenState(): void {
	root.dataset.journalDialogOpen = String(Boolean(document.querySelector("dialog[open]")));
}

function closeMobileMenu(restoreFocus = true): void {
	const menu = document.querySelector<HTMLDetailsElement>("[data-journal-mobile-menu][open]");
	if (!menu) return;
	const summary = menu.querySelector<HTMLElement>("summary");
	menu.removeAttribute("open");
	if (restoreFocus) summary?.focus();
}

function openDialog(dialog: HTMLDialogElement, trigger: HTMLElement): void {
	const current = document.querySelector<HTMLDialogElement>("dialog[open]");
	if (current && current !== dialog) closeDialog(current, false);
	const mobileSummary = trigger.closest<HTMLDetailsElement>("[data-journal-mobile-menu]")?.querySelector<HTMLElement>("summary");
	dialogReturnFocus.set(dialog, mobileSummary || trigger);
	if (typeof dialog.showModal === "function") dialog.showModal();
	else dialog.setAttribute("open", "");
	syncDialogOpenState();
}

function closeDialog(dialog: HTMLDialogElement, restoreFocus = true): void {
	const trigger = dialogReturnFocus.get(dialog);
	if (!restoreFocus) dialogReturnFocus.delete(dialog);
	if (dialog.open && typeof dialog.close === "function") dialog.close();
	else dialog.removeAttribute("open");
	syncDialogOpenState();
	if (restoreFocus) trigger?.focus();
}

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLDialogElement): void {
	const focusable = [...dialog.querySelectorAll<HTMLElement>(
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
	)].filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
	if (focusable.length === 0) {
		event.preventDefault();
		dialog.focus();
		return;
	}

	const first = focusable[0];
	const last = focusable[focusable.length - 1];
	const active = document.activeElement;
	if (event.shiftKey && (active === first || !dialog.contains(active))) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
		event.preventDefault();
		first.focus();
	}
}

function textFromNode(node: Element | null): string {
	return node?.textContent?.replace(/\s+/g, " ").trim() || "";
}

async function loadSearchIndex(): Promise<SearchEntry[]> {
	if (searchIndexPromise) return searchIndexPromise;
	searchIndexPromise = fetch("/rss.xml", {
		headers: { Accept: "application/rss+xml, application/xml;q=0.9" },
	}).then(async (response) => {
		if (!response.ok) throw new Error(`RSS ${response.status}`);
		const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
		if (xml.querySelector("parsererror")) throw new Error("RSS parse error");
		return [...xml.querySelectorAll("item")].map((item) => ({
			title: textFromNode(item.querySelector("title")),
			description: textFromNode(item.querySelector("description")),
			link: new URL(
				textFromNode(item.querySelector("link")),
				window.location.origin,
			).pathname,
		}));
	});
	return searchIndexPromise;
}

function makeSearchResult(entry: SearchEntry, index: number): HTMLLIElement {
	const item = document.createElement("li");
	const link = document.createElement("a");
	const number = document.createElement("span");
	const copy = document.createElement("span");
	const title = document.createElement("strong");
	const description = document.createElement("small");

	link.href = entry.link;
	number.className = "journal-search__number journal-mono";
	number.textContent = String(index + 1).padStart(2, "0");
	title.textContent = entry.title;
	description.textContent = entry.description || "无摘要";
	copy.append(title, description);
	link.append(number, copy);
	item.append(link);
	return item;
}

async function renderSearch(query: string): Promise<void> {
	const status = document.querySelector<HTMLElement>("[data-journal-search-status]");
	const results = document.querySelector<HTMLOListElement>("[data-journal-search-results]");
	if (!status || !results) return;
	const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
	results.replaceChildren();

	if (!normalizedQuery) {
		status.textContent = "等待输入。搜索索引来自 /rss.xml。";
		return;
	}

	status.textContent = "正在读取 RSS 索引…";
	try {
		const entries = await loadSearchIndex();
		const matches = entries
			.filter((entry) => `${entry.title} ${entry.description}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery))
			.slice(0, 12);
		status.textContent = matches.length > 0 ? `找到 ${matches.length} 条结果。` : "没有匹配结果，可前往归档继续浏览。";
		results.append(...matches.map(makeSearchResult));
	} catch {
		searchIndexPromise = null;
		status.textContent = "RSS 索引暂时无法读取。搜索可关闭，普通导航与归档仍然可用。";
	}
}

function normalizePathname(value: string): string {
	try {
		const pathname = decodeURIComponent(new URL(value, window.location.origin).pathname)
			.replace(/\/{2,}/g, "/")
			.replace(/\/+$/, "");
		return pathname || "/";
	} catch {
		return value;
	}
}

function syncNavigation(): void {
	const current = normalizePathname(window.location.href);
	for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-journal-nav-link]")) {
		const isCurrent = normalizePathname(link.href) === current;
		if (isCurrent) link.setAttribute("aria-current", "page");
		else link.removeAttribute("aria-current");
	}
}

function syncReadingProgress(): void {
	const scrollable = document.documentElement.scrollHeight - window.innerHeight;
	const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
	root.style.setProperty("--journal-reading-progress", String(progress));
	const backToTop = document.querySelector<HTMLElement>("[data-journal-back-to-top]");
	if (backToTop) backToTop.dataset.visible = String(window.scrollY > 560);
}

function prepareImages(): void {
	for (const image of document.querySelectorAll<HTMLImageElement>(".journal-prose img, .journal-cover-image img")) {
		if (image.dataset.journalImageReady === "true") continue;
		image.dataset.journalImageReady = "true";
		const reveal = () => image.classList.add("is-loaded");
		if (image.complete) reveal();
		else {
			image.addEventListener("load", reveal, { once: true });
			image.addEventListener("error", reveal, { once: true });
		}
	}
}

function initializePage(): void {
	for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog[open]")) {
		closeDialog(dialog, false);
	}
	closeMobileMenu(false);
	syncDialogOpenState();
	syncBackgroundMode();
	const settings = readAppearanceSettings(window.localStorage);
	applySettings(settings);
	syncNavigation();
	syncReadingProgress();
	prepareImages();
	void window.blogStats?.initialize(document);
}

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;

	const searchTrigger = target.closest<HTMLElement>("[data-journal-search-open]");
	if (searchTrigger) {
		const dialog = document.querySelector<HTMLDialogElement>("#journal-search");
		if (!dialog) return;
		closeMobileMenu(false);
		openDialog(dialog, searchTrigger);
		window.setTimeout(() => document.querySelector<HTMLInputElement>("[data-journal-search-input]")?.focus(), 0);
		void loadSearchIndex().catch(() => undefined);
		return;
	}

	const settingsTrigger = target.closest<HTMLElement>("[data-journal-settings-open]");
	if (settingsTrigger) {
		const dialog = document.querySelector<HTMLDialogElement>("#journal-settings");
		if (!dialog) return;
		closeMobileMenu(false);
		syncSettingsControls(readAppearanceSettings(window.localStorage));
		openDialog(dialog, settingsTrigger);
		return;
	}

	const backToTop = target.closest<HTMLElement>("[data-journal-back-to-top]");
	if (backToTop) {
		window.scrollTo({
			top: 0,
			behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
				? "auto"
				: "smooth",
		});
		return;
	}

	const copyButton = target.closest<HTMLButtonElement>(".copy-btn");
	if (copyButton) {
		const code = copyButton.closest("pre")?.querySelector<HTMLElement>("code")?.innerText;
		if (!code) return;
		void navigator.clipboard.writeText(code).then(() => {
			copyButton.classList.add("success");
			window.setTimeout(() => copyButton.classList.remove("success"), 1000);
		});
		return;
	}

	const resultLink = target.closest<HTMLAnchorElement>("[data-journal-search-results] a");
	if (resultLink) {
		const dialog = document.querySelector<HTMLDialogElement>("#journal-search");
		if (dialog?.open) closeDialog(dialog, false);
		return;
	}

	if (target.closest("[data-journal-mobile-menu] a")) closeMobileMenu(false);
});

document.addEventListener("click", (event) => {
	const target = event.target;
	if (!(target instanceof Element)) return;
	if (target instanceof HTMLDialogElement) {
		const bounds = target.getBoundingClientRect();
		const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
		if (outside) closeDialog(target);
	}

	const menu = document.querySelector<HTMLDetailsElement>("[data-journal-mobile-menu][open]");
	if (menu && !menu.contains(target)) closeMobileMenu(false);
});

document.addEventListener("close", (event) => {
	if (!(event.target instanceof HTMLDialogElement)) return;
	const trigger = dialogReturnFocus.get(event.target);
	dialogReturnFocus.delete(event.target);
	syncDialogOpenState();
	trigger?.focus();
}, true);

document.addEventListener("cancel", (event) => {
	if (!(event.target instanceof HTMLDialogElement)) return;
	event.preventDefault();
	closeDialog(event.target);
}, true);

document.addEventListener("submit", (event) => {
	const form = event.target;
	if (!(form instanceof HTMLFormElement) || !form.matches("[data-journal-search-form]")) return;
	event.preventDefault();
	const input = form.querySelector<HTMLInputElement>("[data-journal-search-input]");
	void renderSearch(input?.value || "");
});

document.addEventListener("input", (event) => {
	const input = event.target;
	if (input instanceof HTMLInputElement && input.matches("[data-journal-search-input]")) {
		window.clearTimeout(searchTimer);
		searchTimer = window.setTimeout(() => void renderSearch(input.value), 180);
		return;
	}

	if (input instanceof HTMLInputElement && input.matches("[data-journal-background-blur]")) {
		const output = document.querySelector<HTMLOutputElement>("[data-journal-background-blur-value]");
		if (output) output.value = input.value;
		applySettings(settingsFromControls(), true);
	}
});

document.addEventListener("change", (event) => {
	const control = event.target;
	if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) return;
	if (!control.matches("[data-journal-theme], [data-journal-background-visible], [data-journal-background-blur]")) return;
	applySettings(settingsFromControls(), true);
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Tab") {
		const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
		if (dialog) trapDialogFocus(event, dialog);
		return;
	}

	if (event.key === "Escape") {
		const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
		if (dialog) {
			event.preventDefault();
			closeDialog(dialog);
			return;
		}
		const menu = document.querySelector<HTMLDetailsElement>("[data-journal-mobile-menu][open]");
		if (menu) {
			event.preventDefault();
			closeMobileMenu();
			return;
		}
	}

	if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
	if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
	const direction = event.key === "ArrowLeft" ? "newer" : "older";
	const link = document.querySelector<HTMLAnchorElement>(`[data-journal-article-nav="${direction}"]`);
	if (!link) return;
	event.preventDefault();
	link.click();
});

window.addEventListener("scroll", syncReadingProgress, { passive: true });
window.addEventListener("resize", syncReadingProgress, { passive: true });
themeMedia.addEventListener("change", () => {
	const settings = readAppearanceSettings(window.localStorage);
	if (settings.theme === "auto") applySettings(settings);
});

for (const eventName of ["DOMContentLoaded", "astro:page-load", "astro:after-swap", "content:replace"]) {
	document.addEventListener(eventName, initializePage);
}

type SwupLike = {
	hooks?: { on: (event: string, handler: () => void) => void };
};

function bindSwup(): void {
	if (root.dataset.journalSwupBound === "true") return;
	const swup = window.swup as unknown as SwupLike;
	if (!swup?.hooks) return;
	root.dataset.journalSwupBound = "true";
	swup.hooks.on("page:view", initializePage);
	swup.hooks.on("visit:end", initializePage);
}

if (window.swup) bindSwup();
else document.addEventListener("swup:enable", bindSwup, { once: true });

initializePage();
