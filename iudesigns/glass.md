# GLASS · 设计规范（ArcTower 语言）

> 一座克制、精密、向上的「塔」—— 技术控制台美学，而非营销落地页。
> 参考坐标系：Vercel / Linear / Apple 档的轻量控制台风格。
> 本系统直接落地 ArcTower Design System v1.0 的组件语言。

## 1. 哲学

扁平表面叠在 1px 发丝描边上，投影归零；圆角收敛在 4/6/10/16px；
全站只有一种蓝在起强调作用；大量留白（呼吸感）是品牌的一部分。
画布 = 素色底 + 点阵纹理（禁止渐变背景）：亮模式 `#f8f8fc`，
暗模式 `#0a0a0a` 中性灰底。二者共用同一套 token。

## 2. 设计约束（硬性规则）

| # | 约束 | 说明 |
|---|------|------|
| C1 | **单一强调蓝** | 一个视图里只能有一种蓝起强调作用（按钮/链接/进度/指示点）；金色等仅语义点缀 |
| C2 | **圆角体系 xs4 / sm6 / md10 / lg16** | 主圆角 10px；大容器 ≤ 16px，禁止 `rounded-2xl` 级过度圆润 |
| C3 | **扁平 + 描边，而非投影** | 1px 描边（浅底黑 10% / 深底白 12%）分层；卡片默认无外投影；仅弹层允许大投影 + 蓝色辉光 |
| C4 | **按钮只有 4 类** | Primary（蓝底白字）/ Border / Ghost / Danger；hover 上浮 1px；不发明第 5 类 |
| C5 | **状态色用软底 chip** | 10% 色底 + 35% 色描边 + 实色文字 + 圆点，Pill 圆角；禁止实色大块 |
| C6 | **焦点 = 蓝描边 + 3px 柔光环** | `border-color: accent; box-shadow: 0 0 0 3px accent-soft`，全部表单控件统一 |
| C7 | **暗 / 亮完全对等** | 画布 = 素色底 + 点阵纹理，禁止大面积渐变；暗 `#0a0a0a`，**不用纯黑 #000** |
| C8 | **克制动效** | 按钮 hover 150–200ms ease；尺寸/进度 400ms `cubic-bezier(.4,0,.2,1)`；官网级入场必须过弹簧阻尼 |

## 3. Design Tokens

### 3.1 色彩（light / dark）

| Token | Light（默认） | Dark | 用途 |
|-------|--------------|------|------|
| `--ui-bg` | `#f8f8fc` + 点阵（黑 8% / 1px / 22px 格） | `#0a0a0a` + 点阵（白 6%） | 画布 |
| `--ui-surface` | `#ffffff` | `#161616` | 卡片 / 面板 |
| `--ui-surface-2` | `rgba(0,0,0,.04)` | `rgba(255,255,255,.06)` | hover / 填充底 |
| `--ui-fg` | `#0a0a0a` | `#fafafa` | 主文字 |
| `--ui-fg-muted` | `#6b7280` | `#a1a1aa` | 二级文字 |
| `--ui-accent` | `#0080ff` | `#3b82f6` | 唯一品牌蓝 |
| `--ui-accent-2`（hover） | `#3a7bc8` | `#2563eb` | Primary hover |
| `--ui-accent-soft` | 蓝 10% | 蓝 15% | 软底 / 柔光环 |
| `--ui-line` | 黑 10% | 白 12% | 描边 |
| `--ui-line-soft` | 黑 6% | 白 7% | 卡片描边 |
| 状态色 | `#22c55e / #f59e0b / #ef4444` | 同 | success / warning / danger |

### 3.2 形状 & 深度

| Token | 值 |
|-------|-----|
| `--ui-radius-xs/sm/md/lg` | `4 / 6 / 10 / 16px`（pill = 999） |
| `--ui-shadow-lg`（仅弹层） | `inset 0 0 0 1px 黑20% + 0 40px 80px -20px 黑35% + 0 0 120px -10px 蓝15%` |
| `--ui-progress-bar` | `linear-gradient(to right, #6ba3e8, #8fbcf0)` |
| `--ui-divider` | 渐变发丝线 `transparent → line → transparent` |

### 3.3 动效

| 场景 | 值 |
|------|-----|
| spring | `stiffness: 320, damping: 32, mass: 0.8`（快速 settle） |
| 按钮 hover | `150–200ms ease` + `translateY(-1px)` |
| 尺寸 / 进度 | `400ms cubic-bezier(0.4, 0, 0.2, 1)` |
| Dialog 入场 | `opacity 0→1, y 8→0, scale .98→1 · 250ms` |
| 主题切换 | 无过渡（避免 cross-fade 糊） |

## 4. 组件规则（`src/systems/glass/components.tsx`）

- **Button**：4 类。Primary 蓝底白字 hover 加深 + 上浮 1px；Border = 浅底 + 描边；Ghost 全透明 hover 出底；Danger = 红字 + 红 35% 描边，hover 红软底。
- **Badge**：Pill chip —— 10% 色底 + 35% 色描边 + 实色文字 + 7px 圆点。
- **Card**：白面板 + soft 发丝边 + 左侧蓝色竖条标题（签名细节）；interactive 顶部 2px 蓝条。
- **Input / Textarea**：6px 圆角、1px 描边；focus 蓝描边 + 3px 柔光环；无投影。
- **Select**：自绘 listbox —— 触发器同输入框；面板白底 10px 圆角软投影，选中项软蓝底 + 蓝勾。
- **Switch**：42×24 pill 轨道，开启变蓝，白色滑块带 1px 投影。
- **Checkbox / Radio**：4px 圆角盒 / 圆形，选中填主蓝 + 白勾 / 白点。
- **Tabs**：分段控件（surface-2 容器 + 滑动蓝色 pill）。
- **Table**：表头浅底、斑马纹 even 行、hover 染蓝 6%。
- **Dialog**：10px 圆角 + 蓝色辉光舞台投影，`y 8→0 + scale .98→1` 入场。
- **Toast**：实色语义底（蓝/绿/黄/红）+ 白字 + 圆角同卡片。
- **Progress**：软蓝槽 + 蓝色渐变条，Pill。
- **Tooltip**：反色气泡（fg 底 / bg 字）。
- **Avatar**：圆形，软蓝底 + 蓝描边 + 蓝字。
- **Skeleton**：shimmer 微动（1.3s 循环）。

## 5. 排版

| 层级 | 规格 |
|------|------|
| Display / H1 | -0.04em 负字距，挤紧中英 |
| 卡片标题 | 15px，semibold，-0.02em，左侧蓝竖条 |
| 正文 | 14–15px / 1.6 |
| Meta 标签 | 11–12px mono，uppercase，+0.2em 大字距 |

## 6. 禁用清单（Never）

- 纯黑 `#000` 背景
- 多个彩色强调同时出现（第二种蓝 / 紫 / 青作强调）
- Material 式大投影堆叠（弹层以外的投影）
- ≥16px 圆角用于大容器
- 实色大块状态色
- `transition: all` 滥用、无阻尼的线性 tween 入场
