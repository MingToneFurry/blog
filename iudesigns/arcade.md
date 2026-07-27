# ARCADE 设计规范 — Cut every corner.

> 灵感来源：游戏官网 / 电竞 HUD（Valorant、Cyberpunk 风格谱系）。
> 关键词：**斜切 · 冲击 · 张力**

## 1. 设计哲学

ARCADE 的世界里没有圆角 —— 所有角都是**切**出来的。
碳黑底、电光黄强调、硬边缘、大字距标题，配合带 overshoot 的入场动画，
让每个组件都像 HUD 元素一样带着能量出现。克制点在于：色彩只有一个电光黄 + 一个警示红，永不同时大面积出现。

## 2. 设计约束（硬性规则）

| # | 约束 | 说明 |
|---|------|------|
| C1 | **禁止圆角** | 所有 radius = 0；斜角一律用 `clip-path` 切出 |
| C2 | **切角分级** | 每类组件切法不同：卡片 14px / 按钮 10px / 小控件 6px（均左上+右下）；徽章只切右下 5px；标签只切右上 8px；输入框只切左下 8px |
| C3 | **强调色唯一** | 电光黄 `#e8ff2e` 是唯一品牌强调；红 `#ff3d5a` 仅用于危险/对抗语义 |
| C4 | **深度 = 硬 offset 阴影** | hover/激活用 `4px 4px 0` 硬阴影（低透明度黄），禁止柔和弥散阴影 |
| C5 | **标题必须加宽字距 + 大写** | display 级 `letter-spacing: 0.06em`、uppercase；正文保持常规 |
| C6 | **动效允许 overshoot** | 弹簧低阻尼（damping ≈ 18–22），进场带 skew/位移冲击；但单次动画 ≤ 520ms |
| C7 | **装饰限定为斜线/编号/角括号** | 允许 45° 斜线纹理、`001` 式编号、L 形角括号；禁止发光渐变滥用 |
| C8 | **暗 / 亮双模式** | 暗为默认；亮模式换纸白底 `#f2f2ee`，黄色加深为 `#dff000` 保持可读 |

## 3. Design Tokens

### 3.1 色彩（dark / light）

| Token | Dark（默认） | Light | 用途 |
|-------|-------------|-------|------|
| `--ui-bg` | `#08090c` | `#f2f2ee` | 画布 |
| `--ui-surface` | `#12141b` | `#ffffff` | 面板 |
| `--ui-surface-2` | `#1a1d27` | `#e8e8e2` | hover 面板 |
| `--ui-fg` | `#f2f4f8` | `#16181c` | 主文字 |
| `--ui-fg-muted` | `#9aa0ae` | `#4e5460` | 次级文字 |
| `--ui-accent` | `#e8ff2e` | `#dff000` | 电光黄（唯一强调） |
| `--ui-accent-fg` | `#08090c` | `#101207` | 黄底上的文字 |
| `--ui-accent-2` | `#ff3d5a` | `#e11d48` | 对抗红（语义） |
| `--ui-line` | `#232734` | `#d8dae0` | 边框 |
| `--ui-line-strong` | `#3a4052` | `#a9adb8` | hover 边框 |

### 3.2 形状 & 深度

| Token | 值 |
|-------|-----|
| `--ui-radius-*` | `0px`（全部） |
| `--ui-clip` | 14px 对角切（左上+右下）—— 卡片 / 面板 |
| `--ui-clip-btn` | 10px 对角切 —— 按钮 |
| `--ui-clip-sm` | 6px 对角切 —— 小控件 |
| `--ui-clip-chip` | 仅右下 5px —— Badge / 进度条 |
| `--ui-clip-tab` | 仅右上 8px —— Tab 板块 |
| `--ui-clip-input` | 仅左下 8px —— 输入框 |
| `--ui-shadow-md` | `4px 4px 0 0 rgb(232 255 46 / 0.14)` |
| `--ui-shadow-lg` | `8px 8px 0 0 rgb(232 255 46 / 0.18)` |
| `--ui-blur` | `0px` |

### 3.3 动效

| Token | 值 |
|-------|-----|
| spring | `stiffness: 420, damping: 18, mass: 0.8`（明显 overshoot） |
| tap | `scale: 0.94`（重按压感） |
| hover | `x: +2, y: -2`（向斜上方顶起） |
| enter | `opacity 0→1, x -32→0, skewX -6°→0`（斜切入场） |
| `--ui-dur-fast/base/slow` | `140 / 260 / 520ms` |
| `--ui-ease` | `cubic-bezier(0.68, -0.3, 0.32, 1.3)` |

## 4. 组件规则（`src/systems/arcade/components.tsx`）

- **Button**：10px 切（`--ui-clip-btn`），primary = 电光黄块，hover 向斜上顶起；文字大写 + 加宽字距。
- **Card**：14px 深切（`--ui-clip`）+ 右上 L 形黄色角括号（签名细节）。
- **Badge**：仅右下 5px 单切（`--ui-clip-chip`），等宽字全大写。
- **Tabs**：板块式，仅右上 8px 单切（`--ui-clip-tab`），激活为黄块。
- **Input / Select / Textarea**：仅左下 8px 单切（`--ui-clip-input`），focus 黄边。
- **Switch / Checkbox**：6px 小切（`--ui-clip-sm`），滑块为方块。
- **Progress**：chip 切外框，填充为电光黄 45° 斜纹。
- **Slider**：拇指旋转 45° 成菱形。
- **Dialog**：14px 深切，从侧向带 scale 冲入（1.06→1, x -12→0），遮罩纯黑。
- **Table**：表头黄色下划线；行 hover 左侧出现 2px 黄色指示条。
- **Toast**：斜切条，带 `OK_` 等宽前缀。

## 5. 排版

| 层级 | 规格 |
|------|------|
| Display | Geist Sans, 800, +0.06em, UPPERCASE, clamp(2.5rem, 8vw, 7rem) |
| Heading | Geist Sans, 700, +0.04em, UPPERCASE |
| Body | Geist Sans, 400, 14px/1.6 |
| HUD 数据 | Geist Mono, 11–12px, +0.08em |

## 6. 禁用清单（Never）

- 任何圆角、任何柔和弥散阴影
- 磨砂玻璃、半透明表面
- 黄红两色同时大面积出现
- 无冲击感的淡入淡出（fade-only）动画
- 所有组件用同一种切角（切角必须分级）
