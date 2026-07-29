((global) => {
	const PRIMARY_SOURCE = "https://api.furry.ist/furry-img";
	const FALLBACK_SOURCE = "https://sni-api.furry.ist/furry-img";
	const pendingLoads = new WeakMap();
	let resolvedSource = null;
	let lifecycleTarget = null;
	let lifecycleCleanup = null;

	function setState(root, state) {
		root.dataset.backgroundState = state;
	}

	function isVisible(root) {
		return root.dataset.backgroundVisible !== "false";
	}

	function waitForImage(image, source) {
		return new Promise((resolve, reject) => {
			const cleanup = () => {
				image.removeEventListener("load", handleLoad);
				image.removeEventListener("error", handleError);
			};
			const handleLoad = async () => {
				try {
					if (typeof image.decode === "function") await image.decode();
					cleanup();
					resolve();
				} catch (error) {
					cleanup();
					reject(error);
				}
			};
			const handleError = () => {
				cleanup();
				reject(new Error(`Background image failed: ${source}`));
			};

			image.addEventListener("load", handleLoad, { once: true });
			image.addEventListener("error", handleError, { once: true });
			image.src = source;
		});
	}

	async function performLoad(root, image) {
		if (!isVisible(root)) {
			image.removeAttribute("src");
			setState(root, "disabled");
			return;
		}

		if (root.dataset.backgroundState === "ready" && image.currentSrc) return;

		const candidates = [...new Set([resolvedSource, PRIMARY_SOURCE, FALLBACK_SOURCE])].filter(Boolean);

		for (let index = 0; index < candidates.length; index += 1) {
			const source = candidates[index];
			setState(root, source === PRIMARY_SOURCE ? "loading-primary" : "loading-fallback");
			try {
				await waitForImage(image, source);
				if (!isVisible(root)) {
					image.removeAttribute("src");
					setState(root, "disabled");
					return;
				}
				resolvedSource = source;
				setState(root, "ready");
				return;
			} catch {
				// Continue to the fallback candidate.
			}
		}

		image.removeAttribute("src");
		setState(root, "error");
	}

	function load(root, image) {
		if (pendingLoads.has(root)) return pendingLoads.get(root);
		const pending = performLoad(root, image).finally(() => {
			if (pendingLoads.get(root) === pending) pendingLoads.delete(root);
		});
		pendingLoads.set(root, pending);
		return pending;
	}

	async function initialize(root = document) {
		const backgrounds = root.querySelectorAll("[data-blog-background]");
		await Promise.all(
			[...backgrounds].map(async (background) => {
				const image = background.querySelector("[data-background-image]");
				if (image instanceof HTMLImageElement) await load(background, image);
			}),
		);
	}

	function bindLifecycle(target = document) {
		if (lifecycleTarget === target && lifecycleCleanup) return lifecycleCleanup;
		lifecycleCleanup?.();
		const initializePage = () => {
			void initialize(target);
		};
		const events = [
			"DOMContentLoaded",
			"astro:page-load",
			"astro:after-swap",
			"swup:contentReplaced",
			"content:replace",
		];
		for (const eventName of events) target.addEventListener(eventName, initializePage);
		initializePage();
		lifecycleTarget = target;
		lifecycleCleanup = () => {
			for (const eventName of events) target.removeEventListener(eventName, initializePage);
			if (lifecycleTarget === target) lifecycleTarget = null;
			lifecycleCleanup = null;
		};
		return lifecycleCleanup;
	}

	global.blogBackground = {
		initialize,
		bindLifecycle,
		reset() {
			resolvedSource = null;
		},
	};
})(window);
