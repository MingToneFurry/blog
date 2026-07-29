# 博客三套独立前端完全重构实施计划

日期：2026-07-29

状态：用户已批准，执行中

适用仓库：`MingToneFurry/blog`

对应规格：`docs/superpowers/specs/2026-07-29-independent-frontend-rebuild-design.md`

## 1. 交付边界

- `main` 只接收已经完成的 Umami 修复、规格、计划和交接文档。
- 从 `main` 创建未合入的 `design/rebuild-core`，只放无视觉共享代码。
- 在保留既有提交历史的前提下，将 core 分别合入 `design/arcade`、`design/glass`、`design/mono`。
- 三套分支各自拥有完整 Shell、导航、首页、文章 Reader、移动交互和 CSS，不共享视觉组件。
- 用户选定风格前，不将 core 或任何设计实现合入 `main`。
- 全部候选交付后，将 Goal 标记为 `blocked`，等待用户选择。

## 2. Git 与工作树

| 分支 | 工作树 | 用途 |
|---|---|---|
| `main` | `D:\Projects\blog` | 已发布统计修复和文档 |
| `design/rebuild-core` | `D:\Projects\blog-core` | 无视觉契约和测试 |
| `design/arcade` | `D:\Projects\blog-arcade` | Field Node 独立产品 |
| `design/glass` | `D:\Projects\blog-glass` | Observatory 独立产品 |
| `design/mono` | `D:\Projects\blog-mono` | Journal 独立产品 |

执行规则：

- 现有三个设计分支的第一轮换肤提交是回退点，不 reset、不 rebase、不改写。
- 每个逻辑阶段形成小提交并推送对应远端分支。
- 合并 core 时使用普通 merge，保留分支关系；冲突以已批准规格为准，不恢复旧视觉骨架。
- 每个工作树开始和结束时检查 `git status --short --branch`；发现非本任务改动立即停下确认。

## 3. Phase A：共享 Headless Core

### A1. 基线配置与类型

目标文件：

- `package.json`
- `pnpm-lock.yaml`
- `astro.config.mjs`
- `src/global.d.ts`

任务：

1. 增加直接开发依赖 `@types/hast`，消除当前 `custom-copy-button.ts` 的隐式传递类型依赖。
2. 清理 `astro.config.mjs` 重复的 `defineConfig` 导入，不改变构建、Markdown、Swup 或部署行为。
3. 将共享运行时的 Window 类型集中到契约声明；不得把风格 DOM 类型写入 core。

验收：`pnpm type-check`、`pnpm build`、`git diff --check`。

### A2. 内容 schema 与纯数据模型

目标文件：

- `src/content/config.ts`
- `src/types/content.ts`（新增）
- `src/utils/content-utils.ts`
- `src/utils/url-utils.ts`
- `scripts/test-content-core.mjs`（新增）

任务：

1. 为文章增加向后兼容的可选 `category`、`series`、`type`、`featured`。
2. 将 `prev*`、`next*` 标记为过渡兼容字段，不再把它们视为内容作者输入；待三个风格消费端全部迁移后再删除。
3. 定义无 Astro DOM 依赖的数据类型：`PostSummary`、`PostNavigation`、`PostCollectionGroup`。
4. 将过滤、排序、分组、分页输入和上一篇/下一篇改为纯函数：不修改 `CollectionEntry.data`，相同输入稳定输出。
5. 排序优先级固定为 pinned、featured 权重、发布时间、slug；相同时间使用 slug 保证确定性。
6. 缺省 category/type 使用稳定常量，series 缺省不分组。
7. 规范化 pathname：保留中文 slug，统一首尾斜线并安全处理已编码 URL。
8. 保持 `getSortedPosts()` 兼容现有构建消费端：返回带过渡导航字段的克隆结果，不修改 `getCollection()` 返回的原对象；风格分支再迁移到独立 `PostNavigation`。

测试：

- 不突变原输入。
- pinned/featured/日期/slug 稳定排序。
- 缺省元数据。
- 上一篇/下一篇边界。
- 中文、编码中文、重复斜线和 query/hash 的 pathname 规范化。
- draft 在生产过滤、开发保留。

### A3. Umami 累计统计协议

目标文件：

- `public/js/umami-share.js`
- `public/js/blog-stats.js`（新增）
- `src/types/runtime.ts`（新增）
- `scripts/test-umami-share.mjs`
- `scripts/test-stats-runtime.mjs`（新增）

保留底层 helper 的动态分享令牌发现，并使用其统一 lifetime 模式（站点 `createdAt` + 未来空窗 + `compare=prev` 单窗口取值），在其上增加唯一的无视觉消费运行时。

DOM 协议：

- 统计根节点：`data-blog-stats`
- 作用域：`data-stats-scope="site|post"`
- 文章路径：`data-stats-path="/posts/.../"`
- 数值节点：`data-stats-value="pageviews|visitors"`
- 未完成态：文本必须为 `--`，并标记 `data-stats-state="idle|loading|ready|error"`
- 可选格式：`data-stats-format="number|pv|uv"`，运行时只替换数值节点，不重建容器。

运行规则：

1. 全站和文章请求都由同一初始化入口扫描。
2. 所有请求固定累计口径，文章 path 经过 core 规范化。
3. 首页文章使用最大并发 4；单项最多重试 2 次，退避 250ms/750ms。
4. 一项失败保持 `--`，不影响其他节点。
5. 同 scope/path 在单页面生命周期只请求一次；成功节点不重复抓取。
6. 初次载入、`astro:page-load` 和 Swup 页面替换都能幂等重扫。
7. 运行时不持久化动态令牌，不在日志输出令牌。

测试：

- site/post PV+UV 正确映射，真实零显示 `0`。
- 初始和失败状态保持 `--`。
- 并发上限、有限重试、单项失败隔离。
- 中文 pathname 查询格式。
- 重复初始化、同 key 去重和页面替换后的增量扫描。
- 缓存令牌失效后的底层单次刷新行为继续通过。

说明：core 不修改旧 `Profile.astro`、`PostMeta.astro`、`PostCard.astro` 或文章页。三个风格分支分别删除继承到的旧统计脚本并接入该协议。

### A4. 背景加载状态机

目标文件：

- `src/types/runtime.ts`
- `src/utils/background-core.ts`（新增）
- `public/js/blog-background.js`（新增）
- `scripts/test-background-core.mjs`（新增）

状态：`disabled -> idle -> loading-primary -> loading-fallback -> ready|error`。

契约：

- 主源固定 `https://api.furry.ist/furry-img`。
- 回退固定 `https://sni-api.furry.ist/furry-img`。
- 根节点使用 `data-blog-background`；图片节点使用 `data-background-image`。
- core 只维护状态、选择图片源和应用设置，不定义裁切、灰度、位置或透明度。
- 用户关闭背景时不设置图片 src；启用后才加载主源。
- 主源失败只切换一次回退；回退失败进入纯色 `error`，不无限重试。
- 成功解码后才进入 `ready`，避免破图和首屏布局抖动。
- Swup 切换后复用当前可用源并幂等连接新 DOM。

测试：关闭不请求、主源成功、主源到回退、双失败、重复初始化、设置切换。

### A5. 设置存储与生命周期

目标文件：

- `src/utils/settings-core.ts`（新增）
- `src/utils/lifecycle-core.ts`（新增）
- `scripts/test-settings-core.mjs`（新增）
- `scripts/test-lifecycle-core.mjs`（新增）

统一设置：

- `theme`: `light|dark|auto`
- `backgroundVisible`: boolean，兼容读取/写入旧键 `hide-bg`
- `backgroundBlur`: 有界数值，兼容旧键 `bg-blur`

规则：

- localStorage 不可用或值损坏时回到默认值，不抛错。
- 提供 SSR 安全的纯解析/序列化函数和浏览器适配器。
- 首屏 inline bootstrap 只负责尽早写入语义属性，不包含风格颜色。
- 生命周期注册返回 cleanup；同 key 重复注册先清理旧实例。
- 统一监听原生首次载入、Astro/Swup 页面完成事件；单模块失败隔离。

测试：合法/损坏存储、旧键迁移、auto theme、数值边界、重复注册和 cleanup。

### A6. Core 验证与交付

新增 npm 脚本：

- `test:content-core`
- `test:stats-runtime`
- `test:background-core`
- `test:settings-core`
- `test:lifecycle-core`
- `test:core` 聚合以上测试和 `test:umami`

必须通过：

```text
pnpm test:core
pnpm type-check
pnpm build
git diff --check
```

构建基线为 36 个静态页面；如页面数变化，必须先解释对应路由变化，不能静默接受。

更新 `HANDOFF.md`，提交、推送 `design/rebuild-core`，记录 SHA 和验证结果。

## 4. Phase B：三个独立产品并行重构

并行上限遵守用户要求：最多同时使用 3 个子代理，每个代理独占一个工作树和一个设计分支，不跨分支修改。主代理负责合并 core、冲突审查和统一验收。

三个分支共同要求：

1. 合入 `design/rebuild-core`，不把 core 合入 `main`。
2. 删除继承到的旧 `MainGridLayout`/Fuwari 页面消费路径；旧文件可在确认无引用后删除。
3. 每个产品自建 Layout、导航、首页、分页、归档、友链、静态 Markdown 页面、文章 Reader、TOC、搜索、设置、移动导航、Footer、404。
4. 保留所有现有 URL、RSS、Sitemap、robots、中文 slug、Markdown 插件、Giscus、License、GitHub 编辑链接、图片回退和全部外链。
5. 所有页面稳定输出语义 `main` 和 `#toc`；Swup 继续交换这两个容器。若分支确需改变 containers，必须覆盖每条路由并单独证明可靠。
6. 将全站、首页每篇和文章详情的 PV/UV 节点迁移到 core DOM 协议，初始为 `--`；彻底移除重复旧脚本。
7. 将同一背景状态机视觉化，但各分支只控制自己的构图和 CSS。
8. 无 JavaScript 时正文、导航、分页、归档、友链仍可访问。

### B1. ARCADE / Field Node

工作树：`D:\Projects\blog-arcade`

专属结构：

- `src/arcade/layouts/ArcadeShell.astro`
- `src/arcade/components/*`
- `src/arcade/runtime/*`
- `src/styles/arcade/*`

首页：系统条、动态任务场景、Active Mission、Transmissions、模块入口；桌面左任务轨，移动底部 Dock。

文章：任务简报、边缘 HUD、分段进度、命令面板式 TOC/搜索、键盘导航。

硬约束：全直角与分级切角、唯一电光黄、红色仅警示、硬 offset 阴影、标题大写宽字距、动效不超过 520ms；reduced-motion 删除 skew/overshoot/大位移。

### B2. GLASS / Observatory

工作树：`D:\Projects\blog-glass`

专属结构：

- `src/glass/layouts/GlassShell.astro`
- `src/glass/components/*`
- `src/glass/runtime/*`
- `src/styles/glass/*`

首页：compact bar、受限观景窗、站点简介与累计数据、Writing/Identity/Network/System 观测模块。

文章：中央编辑工作台、桌面右 context rail、移动文章工具抽屉、内容概览和分类筛选。

硬约束：唯一强调蓝、4/6/10/16 圆角、发丝描边、普通卡片无投影、点阵纯色画布、禁止全站磨砂堆叠。

### B3. MONO / Journal

工作树：`D:\Projects\blog-mono`

专属结构：

- `src/mono/layouts/JournalShell.astro`
- `src/mono/components/*`
- `src/mono/runtime/*`
- `src/styles/mono/*`

首页：Masthead、卷期/RSS、刊首文章、顺序编号文章索引、出版物分类/系列/归档索引。

文章：窄正文与宽留白、边注/脚注式 TOC 和统计、键盘前后篇、线性移动结构。

硬约束：黑白灰、全直角、1px 边框、无渐变/模糊/纹理/装饰投影；背景图只作灰度封面或页边图，正文保持纯色；动效不超过 320ms 且无 overshoot。

## 5. Phase C：分支内自动化验证

每个设计分支必须通过：

```text
pnpm test:core
pnpm type-check
pnpm build
git diff --check
```

另外做静态检查：

- 不再引用旧 `MainGridLayout`、`Profile.astro`、`PostMeta.astro`、`PostCard.astro` 的统计脚本。
- 页面源中不存在统计初始值 `0` 冒充未加载状态。
- 每个路由存在 `main` 和 `#toc`。
- 外链含合理的 `rel`；交互控件有可访问名称和可见 focus。
- CSS 包含 `prefers-reduced-motion`，390px 不出现页面级横向溢出。

## 6. Phase D：浏览器与视觉验收

每个分支启动独立本地预览端口，逐一检查桌面和精确 `390x844`：

### D1. 路由与内容

- 首页及分页 2、3、4。
- 归档、友链、关于、联系方式、隐私、404。
- 一篇中文 slug 和一篇英文 slug 文章。
- RSS、Sitemap、robots、外部状态页和统计页。

### D2. 交互

- 搜索打开、输入、结果跳转、关闭、索引失败。
- light/dark/auto、背景显示/隐藏、模糊持久化。
- Swup 首页到文章、文章到归档、浏览器前进/后退。
- TOC、上一篇/下一篇、返回顶部、移动菜单/抽屉/命令面板。
- 纯键盘路径、Escape、焦点返回、44px 触控目标、reduced-motion。

### D3. 统计可靠性

- 全站统计显示累计 PV+UV。
- 当前首页每篇文章同时显示累计 PV+UV。
- 文章详情同时显示累计 PV+UV。
- 每套首页连续刷新 3 轮；记录每轮文章数、成功数和失败路径。
- API 成功返回真实零时显示 `0`；令牌、网关或单篇失败时保持 `--`。
- 验收记录和截图不得包含动态分享令牌。

### D4. 背景降级

- 主接口成功。
- 模拟主接口失败，确认切换 SNI。
- 模拟两者失败，确认纯色画布、无破图、无无限 loading。
- 关闭背景后不继续呈现图片；模糊设置按风格生效。

### D5. 视觉证据

每个分支保存：

- 桌面首页截图。
- `390x844` 首页截图。
- 桌面文章页截图。
- 必要时补充移动文章页或专属交互截图。

截图与验收记录放入该分支 `artifacts/` 或文档约定的非生产目录；不提交包含令牌、Cookie 或个人会话信息的文件。

## 7. Phase E：交付与停止条件

每个设计分支：

1. 更新 `HANDOFF.md`，写明授权边界、当前 SHA、实现结构、验证结果、截图路径、已知问题。
2. 分阶段提交并推送到 `origin/design/*`。
3. 主代理复查三套之间的信息架构、DOM 结构和移动交互确实独立，不接受只换 token/CSS 的结果。

最终向用户提供三个分支 SHA、预览说明、截图和验收矩阵。此时不合并任何候选到 `main`，将 Goal 标记为 `blocked`，等待用户选择 ARCADE、GLASS 或 MONO。用户选择后再开启单独的合并、清理和生产前复核阶段。
