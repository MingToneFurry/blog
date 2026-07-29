import type { LIGHT_DARK_MODE } from "@/types/config";

export type BackgroundLoadState =
	| "disabled"
	| "idle"
	| "loading-primary"
	| "loading-fallback"
	| "ready"
	| "error";

export type AppearanceSettings = {
	theme: LIGHT_DARK_MODE;
	backgroundVisible: boolean;
	backgroundBlur: number;
};

export type BackgroundState = {
	state: BackgroundLoadState;
	source: string | null;
	primarySource: string;
	fallbackSource: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type LifecycleInitializer = () => void | (() => void);
