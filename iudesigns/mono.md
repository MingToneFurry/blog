# MONO 设计规范 — Nothing but signal.

> 灵感来源：Vercel / xAI。纯黑白、发丝级线条、以排版为核心。
> 关键词：**精确 · 克制 · 信息即装饰**

## 1. 设计哲学

MONO 拒绝一切装饰性元素。界面只由三种材料构成：**文字、线条、留白**。
色彩被移除后，层次只能靠灰度、字重与间距建立 —— 这迫使每个像素都必须有存在的理由。

## 2. 设计约束（硬性规则）

| # | 约束 | 说明 |
|---|------|------|
| C1 | **禁止任何彩色** | 除语义色（danger/success/warning）外，UI 只允许黑白灰；且不用纯黑 #000 / 纯白 #fff 极值，墨色收敛降对比。品牌强调 = 黑白反转 |
| C2 | **圆角恒为 0** | 所有 radius = 0px，一切元素直角 —— 包括头像、开关、Badge，没有任何曲线 |
| C3 | **无投影，只有边框** | 平面深度用 1px 边框（`#212121` → `#3a3a3a`）表达；仅浮层（Dialog/Dropdown）允许一层环境阴影 |
| C4 | **边框恒为 1px** | 任何状态下不允许加粗边框；hover/focus 通过提升边框灰度表达 |
| C5 | **禁止渐变、模糊、纹理** | 表面必须是纯色 |
| C6 | **排版字距收紧** | 展示级标题 `letter-spacing: -0.04em`；数据一律等宽字体 |
| C7 | **动效不做 overshoot** | 高刚度高阻尼弹簧，位移 ≤ 8px，时长 ≤ 320ms |
| C8 | **暗 / 亮双模式** | 同一几何，墨色反转；暗色为默认。`[data-mode="light"]` 切换 |

## 3. Design Tokens

### 3.1 色彩（dark / light）

| Token | Dark（默认） | Light | 用途 |
|-------|-------------|-------|------|
| `--ui-bg` | `#0a0a0a` | `#fcfcfc` | 页面背景 |
| `--ui-surface` | `#111111` | `#f7f7f7` | 卡片 / 输入框 |
| `--ui-surface-2` | `#1a1a1a` | `#efefef` | hover 表面 |
| `--ui-fg` | `#e4e4e4` | `#1a1a1a` | 主文字 |
| `--ui-fg-muted` | `#a1a1a1` | `#5c5c5c` | 次级文字 |
| `--ui-fg-subtle` | `#737373` | `#909090` | 辅助文字 / 占位符 |
| `--ui-accent` | `#ededed` | `#171717` | 强调（反转色） |
| `--ui-accent-fg` | `#0a0a0a` | `#fcfcfc` | 强调上的文字 |
| `--ui-line` | `#212121` | `#e6e6e6` | 默认边框 |
| `--ui-line-strong` | `#3a3a3a` | `#cccccc` | hover / 激活边框 |
| `--ui-danger / success / warning` | `#ff453a / #32d74b / #ffd60a` | `#e5484d / #18794e / #b98900` | 语义色 |

### 3.2 形状 & 深度

| Token | 值 |
|-------|-----|
| `--ui-radius-*` | `0px`（全部，含 pill） |
| `--ui-shadow-sm` | `0 0 0 1px var(--ui-line)` |
| `--ui-shadow-md` | `0 0 0 1px var(--ui-line-strong)` |
| `--ui-shadow-lg` | `0 8px 30px rgb(0 0 0 / 0.6)`（仅浮层） |
| `--ui-blur` | `0px` |

### 3.3 动效

| Token | 值 |
|-------|-----|
| spring | `stiffness: 500, damping: 40, mass: 0.6` |
| tap | `scale: 0.98` |
| hover | `y: -1px` |
| enter | `opacity 0→1, y 8→0` |
| `--ui-dur-fast/base/slow` | `120 / 200 / 320ms` |
| `--ui-ease` | `cubic-bezier(0.25, 0.1, 0.25, 1)` |

## 4. 组件规则（`src/systems/mono/components.tsx`）

- **Button**：primary = 反转色块；secondary = 透明底 + 1px 边框；hover 只改变边框灰度，不放大。
- **Badge**：`[BRACKET]` 式方括号包裹的等宽小字（签名细节），无底色。
- **Card**：1px 边框 + 四角 `+` 刻度标记（签名细节）；interactive hover 边框提亮 + 上移 1px。
- **Input**：始终 1px 边框，focus 时边框升为 `--ui-line-strong` + 1px 反转色 outline（offset 2px）。
- **Switch**：方形轨道 + 方形滑块，全直角。
- **Tabs**：下划线式（底部 2px 反转色指示线，layout 动画），非激活纯文字。
- **Table**：表头全大写 11px + 字距加宽；行 hover 表面色。
- **Dialog**：直角浮层，分隔线切出 header/footer，1px 边框 + 环境阴影，进场 scale 0.98→1（无弹跳）。
- **Toast**：直角条 + 左侧 2px 反转色竖线。

## 5. 排版

| 层级 | 规格 |
|------|------|
| Display | Geist Sans, 600, -0.04em, clamp(3rem, 8vw, 7rem) |
| Heading | Geist Sans, 600, -0.02em |
| Body | Geist Sans, 400, 14px/1.6 |
| Data/Code | Geist Mono, 400, 12–13px |

## 6. 禁用清单（Never）

- 彩色图标、彩色插画、渐变按钮
- 任何圆角与曲线、双层边框
- 弹跳/overshoot 动画、视差滚动
- 磨砂玻璃、噪点纹理
