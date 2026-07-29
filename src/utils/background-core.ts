import type { BackgroundState } from "@/types/runtime";

export const BACKGROUND_PRIMARY_SOURCE = "https://api.furry.ist/furry-img";
export const BACKGROUND_FALLBACK_SOURCE = "https://sni-api.furry.ist/furry-img";

export function createBackgroundState(enabled: boolean): BackgroundState {
	return {
		state: enabled ? "idle" : "disabled",
		source: null,
		primarySource: BACKGROUND_PRIMARY_SOURCE,
		fallbackSource: BACKGROUND_FALLBACK_SOURCE,
	};
}

export function startBackgroundLoad(state: BackgroundState): BackgroundState {
	if (state.state === "disabled") return state;
	return {
		...state,
		state: "loading-primary",
		source: state.primarySource,
	};
}

export function handleBackgroundLoadFailure(
	state: BackgroundState,
): BackgroundState {
	if (state.state === "loading-primary") {
		return {
			...state,
			state: "loading-fallback",
			source: state.fallbackSource,
		};
	}

	if (state.state === "loading-fallback") {
		return { ...state, state: "error", source: null };
	}

	return state;
}

export function handleBackgroundLoadSuccess(
	state: BackgroundState,
): BackgroundState {
	if (state.state !== "loading-primary" && state.state !== "loading-fallback") {
		return state;
	}
	return { ...state, state: "ready" };
}

export function setBackgroundEnabled(
	state: BackgroundState,
	enabled: boolean,
): BackgroundState {
	if (!enabled) return { ...state, state: "disabled", source: null };
	if (state.state === "disabled" || state.state === "error") {
		return { ...state, state: "idle", source: null };
	}
	return state;
}
