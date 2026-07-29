import {
	applyAppearanceAttributes,
	readAppearanceSettings,
	writeAppearanceSettings,
} from "@/utils/settings-core";
import {
	bindPageLifecycle,
	runLifecycleModule,
} from "@/utils/lifecycle-core";
import type { AppearanceSettings } from "@/types/runtime";

type SearchRecord = {
	title: string;
	description: string;
	content: string;
	url: string;
};

let started = false;
let searchIndex: Promise<SearchRecord[]> | null = null;
let lastDialogTrigger: HTMLElement | null = null;
let tocObserver: IntersectionObserver | null = null;
let scrollFrame = 0;

const colorSchemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
let statsRuntimeConnected = false;
let backgroundRuntimeConnected = false;

function currentSettings(): AppearanceSettings {
	return readAppearanceSettings(window.localStorage);
}

function applySettings(settings: AppearanceSettings): void {
	const root = document.documentElement;
	applyAppearanceAttributes(root, settings, colorSchemeMedia.matches);
	root.classList.toggle("dark", root.dataset.colorScheme === "dark");
	root.style.setProperty("--glass-background-blur", `${settings.backgroundBlur}px`);

	for (const background of document.querySelectorAll<HTMLElement>("[data-blog-background]")) {
		background.dataset.backgroundVisible = String(settings.backgroundVisible);
		background.style.setProperty("--glass-background-blur", `${settings.backgroundBlur}px`);
	}

	for (const button of document.querySelectorAll<HTMLButtonElement>("[data-glass-theme]")) {
		button.setAttribute("aria-pressed", String(button.dataset.glassTheme === settings.theme));
	}
	for (const input of document.querySelectorAll<HTMLInputElement>("[data-glass-background-visible]")) {
		input.checked = settings.backgroundVisible;
	}
	for (const input of document.querySelectorAll<HTMLInputElement>("[data-glass-background-blur]")) {
		input.value = String(settings.backgroundBlur);
	}
	for (const output of document.querySelectorAll<HTMLOutputElement>("#glass-background-blur-value")) {
		output.value = String(settings.backgroundBlur);
	}

	void window.blogBackground?.initialize(document);
	const giscusTheme = root.dataset.colorScheme === "dark" ? "dark" : "light";
	const frame = document.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
	frame?.contentWindow?.postMessage(
		{ giscus: { setConfig: { theme: giscusTheme } } },
		"https://giscus.app",
	);
}

function saveSettings(next: AppearanceSettings): void {
	applySettings(writeAppearanceSettings(window.localStorage, next));
}

function openDialog(dialog: HTMLDialogElement, trigger: HTMLElement): void {
	lastDialogTrigger = trigger;
	if (!dialog.open) dialog.showModal();
	if (dialog.id === "glass-search-dialog") {
		const input = dialog.querySelector<HTMLInputElement>("#glass-search-input");
		window.setTimeout(() => input?.focus(), 0);
		void ensureSearchIndex();
	}
}

function closeDialog(dialog: HTMLDialogElement): void {
	if (dialog.open) dialog.close();
}

async function loadSearchIndex(): Promise<SearchRecord[]> {
	const response = await fetch("/rss.xml", { headers: { Accept: "application/rss+xml, application/xml" } });
	if (!response.ok) throw new Error(`RSS index returned ${response.status}`);
	const xml = new DOMParser().parseFromString(await response.text(), "text/xml");
	if (xml.querySelector("parsererror")) throw new Error("RSS index could not be parsed");

	return [...xml.querySelectorAll("item")].map((item) => {
		const rawLink = item.querySelector("link")?.textContent?.trim() || "/archive/";
		let itemUrl = rawLink;
		try {
			itemUrl = new URL(rawLink, window.location.origin).pathname;
		} catch {}
		const encoded = item.getElementsByTagNameNS("*", "encoded")[0]?.textContent || "";
		const contentDocument = new DOMParser().parseFromString(encoded, "text/html");
		return {
			title: item.querySelector("title")?.textContent?.trim() || "未命名记录",
			description: item.querySelector("description")?.textContent?.trim() || "",
			content: contentDocument.body.textContent?.trim() || "",
			url: itemUrl,
		};
	});
}

async function ensureSearchIndex(): Promise<SearchRecord[]> {
	const status = document.querySelector<HTMLElement>("#glass-search-status");
	if (!searchIndex) searchIndex = loadSearchIndex();
	status && (status.textContent = "正在载入 RSS 索引…");
	try {
		const records = await searchIndex;
		status && (status.textContent = `索引就绪，共 ${records.length} 篇记录`);
		return records;
	} catch {
		searchIndex = null;
		status && (status.textContent = "RSS 索引暂时不可用；归档与普通导航仍可使用。 ");
		return [];
	}
}

function appendHighlightedText(target: HTMLElement, text: string, query: string): void {
	const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
	if (index < 0) {
		target.textContent = text;
		return;
	}
	target.append(document.createTextNode(text.slice(0, index)));
	const mark = document.createElement("mark");
	mark.textContent = text.slice(index, index + query.length);
	target.append(mark, document.createTextNode(text.slice(index + query.length)));
}

async function search(query: string): Promise<void> {
	const results = document.querySelector<HTMLElement>("#glass-search-results");
	const status = document.querySelector<HTMLElement>("#glass-search-status");
	if (!results || !status) return;
	results.replaceChildren();
	const normalized = query.trim().toLocaleLowerCase();
	if (!normalized) {
		status.textContent = "输入关键词以搜索标题、摘要、正文或路径";
		return;
	}

	const records = await ensureSearchIndex();
	const matches = records.filter((record) =>
		`${record.title} ${record.description} ${record.content} ${record.url}`
			.toLocaleLowerCase()
			.includes(normalized),
	);
	status.textContent = matches.length > 0 ? `找到 ${matches.length} 条观测记录` : "没有匹配记录";

	for (const record of matches.slice(0, 20)) {
		const link = document.createElement("a");
		link.href = record.url;
		const title = document.createElement("strong");
		appendHighlightedText(title, record.title, query.trim());
		const path = document.createElement("span");
		path.textContent = record.url;
		const excerpt = document.createElement("p");
		const source = record.description || record.content.slice(0, 180);
		appendHighlightedText(excerpt, source, query.trim());
		link.append(title, path, excerpt);
		results.append(link);
	}
}

function updateCategoryFilter(button: HTMLButtonElement): void {
	const filter = button.dataset.glassFilter || "all";
	for (const candidate of document.querySelectorAll<HTMLButtonElement>("[data-glass-filter]")) {
		const active = candidate === button;
		candidate.setAttribute("aria-pressed", String(active));
	}
	for (const row of document.querySelectorAll<HTMLElement>("[data-glass-post-category]")) {
		row.hidden = filter !== "all" && row.dataset.glassPostCategory !== filter;
	}
	const count = [...document.querySelectorAll<HTMLElement>("[data-glass-post-category]")].filter(
		(row) => !row.hidden,
	).length;
	const output = document.querySelector<HTMLElement>("[data-glass-filter-count]");
	if (output) output.textContent = String(count).padStart(2, "0");
}

function closeDrawer(details: HTMLDetailsElement): void {
	details.open = false;
	details.querySelector<HTMLElement>("summary")?.focus();
}

function focusableWithin(root: HTMLElement): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
	)].filter((element) => !element.hasAttribute("hidden"));
}

function handleKeydown(event: KeyboardEvent): void {
	if (event.key === "Escape") {
		const openDrawer = document.querySelector<HTMLDetailsElement>("[data-glass-drawer][open]");
		if (openDrawer) {
			event.preventDefault();
			closeDrawer(openDrawer);
			return;
		}
		for (const popover of document.querySelectorAll<HTMLDetailsElement>("[data-glass-popover][open]")) {
			popover.open = false;
			popover.querySelector<HTMLElement>("summary")?.focus();
		}
	}

	if (event.key === "Tab") {
		const openDrawer = document.querySelector<HTMLDetailsElement>("[data-glass-drawer][open]");
		if (!openDrawer || window.matchMedia("(min-width: 901px)").matches) return;
		const focusable = focusableWithin(openDrawer);
		if (focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
}

function activateToc(): void {
	tocObserver?.disconnect();
	tocObserver = null;
	const nav = document.querySelector<HTMLElement>("[data-glass-toc]");
	if (!nav) return;
	const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
	const headingPairs = links
		.map((link) => {
			const id = decodeURIComponent(link.hash.slice(1));
			return { link, heading: document.getElementById(id) };
		})
		.filter((pair): pair is { link: HTMLAnchorElement; heading: HTMLElement } => pair.heading instanceof HTMLElement);
	if (headingPairs.length === 0) return;

	tocObserver = new IntersectionObserver(
		(entries) => {
			const visible = entries
				.filter((entry) => entry.isIntersecting)
				.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
			if (!visible) return;
			for (const pair of headingPairs) pair.link.removeAttribute("aria-current");
			headingPairs.find((pair) => pair.heading === visible.target)?.link.setAttribute("aria-current", "location");
		},
		{ rootMargin: "-18% 0px -68%", threshold: [0, 1] },
	);
	for (const pair of headingPairs) tocObserver.observe(pair.heading);
}

function updateScrollState(): void {
	scrollFrame = 0;
	const documentHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
	const progress = Math.min(1, Math.max(0, window.scrollY / documentHeight));
	for (const meter of document.querySelectorAll<HTMLElement>("[data-reading-progress]")) {
		meter.style.setProperty("--glass-reading-progress", `${progress * 100}%`);
	}
	for (const button of document.querySelectorAll<HTMLElement>("[data-glass-backtop]")) {
		button.toggleAttribute("data-visible", window.scrollY > 560);
	}
}

function scheduleScrollUpdate(): void {
	if (scrollFrame) return;
	scrollFrame = window.requestAnimationFrame(updateScrollState);
}

function initializePage(): void {
	applySettings(currentSettings());
	activateToc();
	updateScrollState();
	const activeFilter = document.querySelector<HTMLButtonElement>('[data-glass-filter][aria-pressed="true"]');
	if (activeFilter) updateCategoryFilter(activeFilter);
	void window.blogStats?.initialize(document);
	void window.blogBackground?.initialize(document);
}

function connectCoreRuntimes(): boolean {
	const dataset = document.documentElement.dataset;
	if (!statsRuntimeConnected && window.blogStats) {
		window.blogStats.configure({
			baseUrl: dataset.statsBaseUrl,
			shareId: dataset.statsShareId,
			timezone: dataset.statsTimezone,
			concurrency: 4,
			retryDelays: [250, 750],
		});
		window.blogStats.bindLifecycle(document);
		statsRuntimeConnected = true;
	}
	if (!backgroundRuntimeConnected && window.blogBackground) {
		window.blogBackground.bindLifecycle(document);
		backgroundRuntimeConnected = true;
	}
	initializePage();
	return statsRuntimeConnected && backgroundRuntimeConnected;
}

async function waitForCoreRuntimes(maxAttempts = 50, interval = 100): Promise<void> {
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		if (connectCoreRuntimes()) return;
		await new Promise((resolve) => window.setTimeout(resolve, interval));
	}
}

export function startObservatory(): void {
	if (started) return;
	started = true;

	runLifecycleModule("glass-observatory", () => {
		const lifecycleCleanup = bindPageLifecycle(document, initializePage);
		const click = (event: MouseEvent) => {
			const target = event.target instanceof Element ? event.target : null;
			if (!target) return;

			const openButton = target.closest<HTMLElement>("[data-glass-dialog-open]");
			if (openButton) {
				const dialog = document.getElementById(openButton.dataset.glassDialogOpen || "");
				if (dialog instanceof HTMLDialogElement) openDialog(dialog, openButton);
				return;
			}
			const closeButton = target.closest<HTMLElement>("[data-glass-dialog-close]");
			if (closeButton) {
				const dialog = closeButton.closest("dialog");
				if (dialog instanceof HTMLDialogElement) closeDialog(dialog);
				return;
			}
			const themeButton = target.closest<HTMLButtonElement>("[data-glass-theme]");
			if (themeButton) {
				const theme = themeButton.dataset.glassTheme;
				if (theme === "light" || theme === "dark" || theme === "auto") {
					saveSettings({ ...currentSettings(), theme });
				}
				return;
			}
			const filterButton = target.closest<HTMLButtonElement>("[data-glass-filter]");
			if (filterButton) {
				updateCategoryFilter(filterButton);
				return;
			}
			if (target.closest("[data-glass-backtop]")) {
				window.scrollTo({ top: 0, behavior: reducedMotionMedia.matches ? "auto" : "smooth" });
				return;
			}
			const drawerClose = target.closest("[data-glass-drawer-close]");
			if (drawerClose) {
				const details = drawerClose.closest("details");
				if (details instanceof HTMLDetailsElement) closeDrawer(details);
				return;
			}
			const drawerLink = target.closest<HTMLAnchorElement>("[data-glass-drawer][open] a");
			if (drawerLink) {
				const details = drawerLink.closest("details");
				if (details instanceof HTMLDetailsElement) details.open = false;
			}
			const copyButton = target.closest<HTMLElement>(".copy-btn");
			if (copyButton) {
				const code = copyButton.closest(".expressive-code")?.querySelector("code")?.textContent || "";
				void navigator.clipboard?.writeText(code).then(() => {
					copyButton.dataset.copied = "true";
					window.setTimeout(() => delete copyButton.dataset.copied, 1200);
				});
			}
		};

		const input = (event: Event) => {
			const target = event.target;
			if (!(target instanceof HTMLInputElement)) return;
			if (target.matches("[data-glass-background-blur]")) {
				saveSettings({ ...currentSettings(), backgroundBlur: Number(target.value) });
			} else if (target.id === "glass-search-input") {
				void search(target.value);
			}
		};

		const change = (event: Event) => {
			const target = event.target;
			if (target instanceof HTMLInputElement && target.matches("[data-glass-background-visible]")) {
				saveSettings({ ...currentSettings(), backgroundVisible: target.checked });
			}
		};

		const close = (event: Event) => {
			if (event.target instanceof HTMLDialogElement) lastDialogTrigger?.focus();
		};

		document.addEventListener("click", click);
		document.addEventListener("input", input);
		document.addEventListener("change", change);
		document.addEventListener("keydown", handleKeydown);
		document.addEventListener("close", close, true);
		window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
		window.addEventListener("resize", scheduleScrollUpdate);
		colorSchemeMedia.addEventListener("change", initializePage);

		void waitForCoreRuntimes();

		return () => {
			lifecycleCleanup();
			tocObserver?.disconnect();
			document.removeEventListener("click", click);
			document.removeEventListener("input", input);
			document.removeEventListener("change", change);
			document.removeEventListener("keydown", handleKeydown);
			document.removeEventListener("close", close, true);
			window.removeEventListener("scroll", scheduleScrollUpdate);
			window.removeEventListener("resize", scheduleScrollUpdate);
			colorSchemeMedia.removeEventListener("change", initializePage);
		};
	});
}
