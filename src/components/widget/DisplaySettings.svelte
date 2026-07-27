<script lang="ts">
import { AUTO_MODE, DARK_MODE, LIGHT_MODE } from "@constants/constants";
import Icon from "@iconify/svelte";
import {
	getHideBg,
	getStoredTheme,
	setHideBg,
	setTheme,
} from "@utils/setting-utils";

let theme = getStoredTheme();
let hideBg = getHideBg();

function switchTheme(newTheme: string) {
	theme = newTheme;
	setTheme(newTheme);
}

function toggleHideBg() {
	hideBg = !hideBg;
	setHideBg(hideBg);
}
</script>

<div id="display-setting" class="float-panel float-panel-closed absolute w-80 right-4 p-4">
    <div class="mono-section-head -mx-4 -mt-4 mb-4">
        <h2>Display system</h2>
        <span class="mono-badge">MONO</span>
    </div>

    <fieldset class="mono-setting-group">
        <legend>[MODE] 明暗主题</legend>
        <div class="mono-segmented" aria-label="主题模式">
            <button aria-label="Light Mode" class:active={theme === LIGHT_MODE} on:click={() => switchTheme(LIGHT_MODE)}>
                <Icon icon="material-symbols:wb-sunny-outline" /> <span>Light</span>
            </button>
            <button aria-label="Dark Mode" class:active={theme === DARK_MODE} on:click={() => switchTheme(DARK_MODE)}>
                <Icon icon="material-symbols:dark-mode-outline" /> <span>Dark</span>
            </button>
            <button aria-label="Auto Mode" class:active={theme === AUTO_MODE} on:click={() => switchTheme(AUTO_MODE)}>
                <Icon icon="material-symbols:hdr-auto" /> <span>Auto</span>
            </button>
        </div>
    </fieldset>

    <div class="mono-setting-row">
        <div>
            <strong>[IMAGE] 动态背景</strong>
            <p>灰度显示 api.furry.ist 图像</p>
        </div>
        <label class="mono-switch">
            <input aria-label="显示动态背景" type="checkbox" checked={!hideBg} on:change={toggleHideBg} />
            <span aria-hidden="true"></span>
        </label>
    </div>

    <p class="mono-footnote">色彩、渐变与背景模糊在 MONO 系统中固定关闭。</p>
</div>

<style>
    .mono-setting-group {
        margin: 0 0 1rem;
        padding: 0;
        border: 0;
    }

    legend {
        display: block;
        margin-bottom: .5rem;
        color: var(--ui-fg-muted);
        font-family: "JetBrains Mono Variable", ui-monospace, monospace;
        font-size: .625rem;
        letter-spacing: .07em;
        text-transform: uppercase;
    }

    .mono-segmented {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border: 1px solid var(--ui-line);
    }

    .mono-segmented button {
        display: flex;
        min-height: 2.5rem;
        align-items: center;
        justify-content: center;
        gap: .35rem;
        border: 0;
        border-right: 1px solid var(--ui-line);
        background: transparent;
        color: var(--ui-fg-muted);
        font-family: "JetBrains Mono Variable", ui-monospace, monospace;
        font-size: .625rem;
        letter-spacing: .04em;
        text-transform: uppercase;
    }

    .mono-segmented button:last-child { border-right: 0; }
    .mono-segmented button:hover { background: var(--ui-surface-2); color: var(--ui-fg); }
    .mono-segmented button.active { background: var(--ui-accent); color: var(--ui-accent-fg); }

    .mono-setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: .875rem 0;
        border-top: 1px solid var(--ui-line);
    }

    .mono-setting-row strong {
        display: block;
        font-family: "JetBrains Mono Variable", ui-monospace, monospace;
        font-size: .6875rem;
        font-weight: 500;
        letter-spacing: .04em;
        text-transform: uppercase;
    }

    .mono-setting-row p,
    .mono-footnote {
        margin: .15rem 0 0;
        color: var(--ui-fg-subtle);
        font-size: .6875rem;
    }

    .mono-switch input { position: absolute; opacity: 0; pointer-events: none; }
    .mono-switch span {
        position: relative;
        display: block;
        width: 2.75rem;
        height: 1.5rem;
        border: 1px solid var(--ui-line-strong);
        background: transparent;
        cursor: pointer;
    }
    .mono-switch span::after {
        position: absolute;
        top: .1875rem;
        left: .1875rem;
        width: 1rem;
        height: 1rem;
        background: var(--ui-fg-muted);
        content: "";
        transition: transform var(--ui-dur-fast) var(--ui-ease), background var(--ui-dur-fast) var(--ui-ease);
    }
    .mono-switch input:checked + span::after { transform: translateX(1.25rem); background: var(--ui-accent); }
    .mono-switch input:focus-visible + span { outline: 1px solid var(--ui-accent); outline-offset: 3px; }

    .mono-footnote { padding-top: .75rem; border-top: 1px solid var(--ui-line); }
</style>
