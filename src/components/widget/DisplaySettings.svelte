<script lang="ts">
import { AUTO_MODE, DARK_MODE, LIGHT_MODE } from "@constants/constants";
import Icon from "@iconify/svelte";
import {
	getBgBlur,
	getDevMode,
	getDevServer,
	getHideBg,
	getStoredTheme,
	setBgBlur,
	setDevMode,
	setDevServer,
	setHideBg,
	setTheme,
} from "@utils/setting-utils";

let theme = getStoredTheme();
let bgBlur = getBgBlur();
let hideBg = getHideBg();
let isDevMode = getDevMode();
let devServer = getDevServer();

function switchTheme(newTheme: string) {
	theme = newTheme;
	setTheme(newTheme);
}

function toggleHideBg() {
	hideBg = !hideBg;
	setHideBg(hideBg);
}

function updateBlur() {
	setBgBlur(bgBlur);
}

function toggleDevMode() {
	isDevMode = !isDevMode;
	setDevMode(isDevMode);
}

function updateDevServer() {
	setDevServer(devServer);
}
</script>

<div id="display-setting" class="settings-hud float-panel float-panel-closed absolute transition-all w-80 right-4 px-4 py-4" role="dialog" aria-label="显示设置">
	<section class="setting-section">
		<div class="setting-title"><span>01</span>显示模式</div>
		<div class="mode-grid" aria-label="主题模式">
			<button aria-label="浅色模式" class:active={theme === LIGHT_MODE} on:click={() => switchTheme(LIGHT_MODE)}>
				<Icon icon="material-symbols:wb-sunny-outline" />
				<span>LIGHT</span>
			</button>
			<button aria-label="深色模式" class:active={theme === DARK_MODE} on:click={() => switchTheme(DARK_MODE)}>
				<Icon icon="material-symbols:dark-mode-outline" />
				<span>DARK</span>
			</button>
			<button aria-label="跟随系统" class:active={theme === AUTO_MODE} on:click={() => switchTheme(AUTO_MODE)}>
				<Icon icon="material-symbols:hdr-auto" />
				<span>AUTO</span>
			</button>
		</div>
	</section>

	<section class="setting-section">
		<div class="setting-title"><span>02</span>背景图层</div>
		<label class="setting-row">
			<span>隐藏动态背景</span>
			<input aria-label="隐藏动态背景" type="checkbox" class="toggle-switch" checked={hideBg} on:change={toggleHideBg} />
		</label>
		<label class="setting-slider">
			<span>模糊强度 <strong>{bgBlur}px</strong></span>
			<input aria-label="背景模糊" type="range" min="0" max="20" bind:value={bgBlur} on:input={updateBlur} style="--value-percent: {bgBlur / 20 * 100}%" />
		</label>
	</section>

	<section class="setting-section">
		<div class="setting-title"><span>03</span>诊断通道</div>
		<label class="setting-row">
			<span>开发节点</span>
			<input aria-label="开发模式" type="checkbox" class="toggle-switch" checked={isDevMode} on:change={toggleDevMode} />
		</label>
		{#if isDevMode}
			<label class="setting-input">
				<span>SERVER_ID</span>
				<input aria-label="访问节点" type="text" bind:value={devServer} on:input={updateDevServer} placeholder="cloudflare" />
			</label>
		{/if}
	</section>

	<p class="accent-lock">ACCENT_LOCK // ELECTRIC_YELLOW</p>
</div>

<style>
	.settings-hud {
		max-height: calc(100vh - 6rem);
		overflow-y: auto;
	}

	.setting-section {
		padding: 0.8rem 0;
		border-bottom: 1px solid var(--ui-line);
	}

	.setting-title {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-bottom: 0.75rem;
		color: var(--ui-fg);
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.setting-title span {
		display: grid;
		place-items: center;
		width: 1.65rem;
		height: 1.65rem;
		background: var(--ui-accent);
		color: var(--ui-accent-fg);
		clip-path: var(--ui-cut-chip);
		font: 800 0.625rem/1 "JetBrains Mono Variable", monospace;
	}

	.mode-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.4rem;
	}

	.mode-grid button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		min-height: 3.5rem;
		padding: 0.5rem;
		background: var(--ui-surface-2);
		color: var(--ui-fg-muted);
		font: 700 0.6rem/1 "JetBrains Mono Variable", monospace;
	}

	.mode-grid button.active {
		background: var(--ui-accent);
		color: var(--ui-accent-fg) !important;
		border-color: var(--ui-accent);
	}

	.mode-grid :global(svg) {
		font-size: 1.2rem;
	}

	.setting-row,
	.setting-slider,
	.setting-input {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.65rem;
		color: var(--ui-fg-muted);
		font-size: 0.8rem;
	}

	.setting-slider {
		align-items: stretch;
		flex-direction: column;
	}

	.setting-slider strong {
		color: var(--ui-accent);
		font-family: "JetBrains Mono Variable", monospace;
	}

	input[type="range"] {
		appearance: none;
		height: 1rem;
		background: linear-gradient(to right, var(--ui-accent) 0 var(--value-percent), var(--ui-line) var(--value-percent) 100%);
		clip-path: var(--ui-cut-chip);
		cursor: pointer;
	}

	input[type="range"]::-webkit-slider-thumb {
		appearance: none;
		width: 0.8rem;
		height: 0.8rem;
		background: var(--ui-accent-fg);
		border: 2px solid var(--ui-accent);
		transform: rotate(45deg);
	}

	.toggle-switch {
		appearance: none;
		width: 3rem;
		height: 1.5rem;
		border: 1px solid var(--ui-line-strong);
		background: var(--ui-surface-2);
		position: relative;
		cursor: pointer;
	}

	.toggle-switch::after {
		content: "";
		position: absolute;
		top: 0.2rem;
		left: 0.2rem;
		width: 0.95rem;
		height: 0.95rem;
		background: var(--ui-fg-muted);
		transition: transform var(--ui-dur-base) var(--ui-ease), background-color var(--ui-dur-fast) ease;
	}

	.toggle-switch:checked {
		background: var(--ui-accent);
	}

	.toggle-switch:checked::after {
		transform: translateX(1.45rem);
		background: var(--ui-accent-fg);
	}

	.setting-input {
		align-items: stretch;
		flex-direction: column;
		font: 700 0.625rem/1 "JetBrains Mono Variable", monospace;
		letter-spacing: 0.08em;
	}

	.setting-input input {
		min-height: 2.5rem;
		padding: 0.55rem 0.75rem;
	}

	.accent-lock {
		margin-top: 0.85rem;
		color: var(--ui-accent);
		font: 700 0.6rem/1 "JetBrains Mono Variable", monospace;
		letter-spacing: 0.08em;
	}
</style>
