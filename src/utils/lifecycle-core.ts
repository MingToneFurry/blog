import type { LifecycleInitializer } from "@/types/runtime";

const cleanups = new Map<string, () => void>();

export function runLifecycleModule(
	key: string,
	initialize: LifecycleInitializer,
): () => void {
	cleanups.get(key)?.();

	let cleanup: void | (() => void);
	try {
		cleanup = initialize();
	} catch (error) {
		console.error(`[blog lifecycle] ${key} failed`, error);
	}

	const safeCleanup = () => {
		try {
			cleanup?.();
		} catch (error) {
			console.error(`[blog lifecycle] ${key} cleanup failed`, error);
		}
		if (cleanups.get(key) === safeCleanup) cleanups.delete(key);
	};

	cleanups.set(key, safeCleanup);
	return safeCleanup;
}

export function cleanupLifecycleModule(key: string): void {
	cleanups.get(key)?.();
}

export function cleanupAllLifecycleModules(): void {
	for (const cleanup of [...cleanups.values()]) cleanup();
}

export function bindPageLifecycle(
	target: Pick<Document, "addEventListener" | "removeEventListener">,
	initialize: () => void,
): () => void {
	const events = [
		"DOMContentLoaded",
		"astro:page-load",
		"astro:after-swap",
		"swup:contentReplaced",
		"content:replace",
	] as const;

	for (const eventName of events)
		target.addEventListener(eventName, initialize);
	initialize();

	return () => {
		for (const eventName of events)
			target.removeEventListener(eventName, initialize);
	};
}
