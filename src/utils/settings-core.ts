import type { LIGHT_DARK_MODE } from "@/types/config";
import type { AppearanceSettings, StorageLike } from "@/types/runtime";

export const LIGHT_THEME: "light" = "light";
export const DARK_THEME: "dark" = "dark";
export const AUTO_THEME: "auto" = "auto";
export const DEFAULT_APPEARANCE_THEME: typeof AUTO_THEME = AUTO_THEME;

export const APPEARANCE_STORAGE_KEYS = {
	theme: "theme",
	backgroundHidden: "hide-bg",
	backgroundBlur: "bg-blur",
} as const;

export const DEFAULT_BACKGROUND_BLUR = 4;
export const MIN_BACKGROUND_BLUR = 0;
export const MAX_BACKGROUND_BLUR = 24;

const THEMES = new Set<LIGHT_DARK_MODE>([LIGHT_THEME, DARK_THEME, AUTO_THEME]);

function safeGet(
	storage: StorageLike | null | undefined,
	key: string,
): string | null {
	try {
		return storage?.getItem(key) ?? null;
	} catch {
		return null;
	}
}

function safeSet(
	storage: StorageLike | null | undefined,
	key: string,
	value: string,
): void {
	try {
		storage?.setItem(key, value);
	} catch {
		// Storage can be unavailable in private or restricted browsing contexts.
	}
}

export function parseTheme(value: string | null | undefined): LIGHT_DARK_MODE {
	return value && THEMES.has(value as LIGHT_DARK_MODE)
		? (value as LIGHT_DARK_MODE)
		: DEFAULT_APPEARANCE_THEME;
}

export function parseStoredBoolean(
	value: string | null | undefined,
	fallback: boolean,
): boolean {
	if (value === "true") return true;
	if (value === "false") return false;
	return fallback;
}

export function clampBackgroundBlur(value: unknown): number {
	const parsed =
		typeof value === "number" ? value : Number.parseFloat(String(value));
	if (!Number.isFinite(parsed)) return DEFAULT_BACKGROUND_BLUR;
	return Math.min(MAX_BACKGROUND_BLUR, Math.max(MIN_BACKGROUND_BLUR, parsed));
}

export function readAppearanceSettings(
	storage: StorageLike | null | undefined,
): AppearanceSettings {
	return {
		theme: parseTheme(safeGet(storage, APPEARANCE_STORAGE_KEYS.theme)),
		backgroundVisible: !parseStoredBoolean(
			safeGet(storage, APPEARANCE_STORAGE_KEYS.backgroundHidden),
			false,
		),
		backgroundBlur: clampBackgroundBlur(
			safeGet(storage, APPEARANCE_STORAGE_KEYS.backgroundBlur),
		),
	};
}

export function writeAppearanceSettings(
	storage: StorageLike | null | undefined,
	settings: AppearanceSettings,
): AppearanceSettings {
	const normalized: AppearanceSettings = {
		theme: parseTheme(settings.theme),
		backgroundVisible: Boolean(settings.backgroundVisible),
		backgroundBlur: clampBackgroundBlur(settings.backgroundBlur),
	};

	safeSet(storage, APPEARANCE_STORAGE_KEYS.theme, normalized.theme);
	safeSet(
		storage,
		APPEARANCE_STORAGE_KEYS.backgroundHidden,
		String(!normalized.backgroundVisible),
	);
	safeSet(
		storage,
		APPEARANCE_STORAGE_KEYS.backgroundBlur,
		String(normalized.backgroundBlur),
	);

	return normalized;
}

export function resolveTheme(
	theme: LIGHT_DARK_MODE,
	prefersDark: boolean,
): typeof LIGHT_THEME | typeof DARK_THEME {
	if (theme === LIGHT_THEME) return LIGHT_THEME;
	if (theme === DARK_THEME) return DARK_THEME;
	return prefersDark ? DARK_THEME : LIGHT_THEME;
}

export function applyAppearanceAttributes(
	root: Pick<HTMLElement, "dataset">,
	settings: AppearanceSettings,
	prefersDark = false,
): void {
	root.dataset.themePreference = settings.theme;
	root.dataset.colorScheme = resolveTheme(settings.theme, prefersDark);
	root.dataset.backgroundVisible = String(settings.backgroundVisible);
	root.dataset.backgroundBlur = String(
		clampBackgroundBlur(settings.backgroundBlur),
	);
}
