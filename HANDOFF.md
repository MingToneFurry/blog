# 项目交接

## 授权与操作边界

- 本仓库位于用户明确授权的开发与安全测试环境中；当前任务不是对第三方系统进行未授权操作。
- 允许范围：克隆和维护 `MingToneFurry/blog`、只读验证公开的 Umami 分享统计接口、本地构建与浏览器验收、维护 Git 分支和提交。
- 禁止范围：修改 Umami 账户权限或分享设置、向无关外部系统写入数据、泄露分享令牌、未经用户选择将设计分支合入 `main`。

## 当前目标

1. 修复博客不显示访问量、访客数等 Umami 数据的问题，并将修复提交到 `main`。
2. 保留 `https://api.furry.ist/furry-img` 背景加载、现有页面路由和主要功能。
3. 根据 `iudesigns` 的全部三种规范分别重写前端：`arcade`、`glass`、`mono`。
4. 每种风格保存在独立分支，完成测试和预览后等待用户选择，不提前合并。

## 已确认事实

- 默认分支：`main`；远端：`https://github.com/MingToneFurry/blog.git`。
- 网络失败时使用 `socks5://127.0.0.1:10808`，当前仅配置在本仓库 `.git/config`。
- Umami 分享页仍为 `https://cloud.umami.is/analytics/us/share/HdVBrs2TcRJ2LJd4`。
- 新 API 基址为 `https://gateway-us.umami.is`；分享上下文请求必须带 `x-umami-share-context: 1` 和动态分享令牌。
- Umami Cloud 免费分享查询会把过早的 `startAt` 截到近期窗口，因此不能把 `startAt=0` 直接当作累计。现 helper 以 `max(createdAt, resetAt)` 为统计起点，构造未来空窗并用 `compare=prev` 让单个 comparison 窗口覆盖起点至当前快照，直接取该窗口的全站与文章 PV/UV；接入前、重置前或已删除的历史数据仍无法补算。
- 公开分享令牌只在浏览器内动态获取并仅作内存级复用，不写入仓库、交接文档或 `localStorage`；新版 helper 会主动清理旧版 `umami-share-cache:*` 持久缓存。
- `iudesigns` 目录共三种风格：`arcade.md`、`glass.md`、`mono.md`。

## 分支策略

- `main`：仅保留已完成的统计修复、规格、实施计划与设计无关的仓库维护；用户选定风格前，不合入共享重构 core 或任何设计实现。
- `design/rebuild-core`：从已批准规格所在的 `main` 创建，只承载内容、路由、统计、背景、设置和生命周期等无视觉契约；禁止提前合入 `main`。
- `design/arcade`：ARCADE 视觉重写，禁止提前合入 `main`。
- `design/glass`：ArcTower/GLASS 视觉重写，禁止提前合入 `main`。
- `design/mono`：MONO 视觉重写，禁止提前合入 `main`。

## 功能保留清单

- 首页文章列表、封面、分页、日期、字数、阅读时间、PV/UV。
- 首页、归档、关于、联系方式、隐私、友链、状态、统计路由与导航。
- RSS 搜索、移动菜单、明暗主题、Swup 页面切换。
- 个人资料与社交链接、动态 JSON 友链、TOC、返回顶部、Footer。
- Markdown、代码块、文章图片、License、GitHub 编辑链接、RSS、Sitemap。

## 验证清单

- `pnpm test:umami`
- `pnpm type-check`
- `pnpm build`
- 浏览器验证首页全站统计及至少一篇文章的 PV/UV。
- 三个设计分支分别进行桌面和移动端视觉、键盘焦点、减少动效检查。

## 当前进度

- 仓库已克隆并跟踪 `origin/main`。
- Umami 修复已完成本地单测、生产构建与浏览器端到端验证：全站和文章 PV/UV 均恢复显示。
### 第一轮 ARCADE 回退点
- `design/arcade` 已完成 ARCADE 全站视觉重写并独立提交，禁止在用户选定前合入 `main`：
  - 新增统一电光黄 HUD 令牌、暗/亮模式、分级切角、硬 offset 阴影、编号标签与冲击入场；全站强制无圆角、无磨砂玻璃，并提供 `prefers-reduced-motion` 降级。
  - 导航、资料侧栏、文章卡、文章页、累计 PV/UV 元数据、RSS 搜索、移动菜单、显示设置、友链、归档、Markdown、代码块、TOC、License、分页、Footer 与返回顶部均已统一到 ARCADE 语言。
  - 保留 `https://api.furry.ist/furry-img` 动态背景及 `https://sni-api.furry.ist/furry-img` fallback；视觉层仅降饱和/对比，不替换图片源或加载逻辑。
  - 显示设置保留明暗/自动主题、背景显示与模糊、开发节点；去除会破坏唯一品牌强调色的自定义 hue / 彩虹模式入口。
  - 第一轮当时以 `startAt=0` 解释累计范围；该实现已在架构级重构收尾时被 single full-history comparison window 方案替代，避免 Umami Cloud 免费窗口截断。
  - 首页文章统计使用并发上限为 4 的集中式可重入队列；每篇最多重试 2 次，分别退避 400ms / 900ms，在弱网下兼顾完成速度与限流保护；Swup 替换后会重新扫描尚未完成的卡片。
  - 文章详情页会等待 Umami helper，并使用相同的有限退避重试更新可见的累计 PV/UV 节点；支持直达文章与 Swup 切换。
- `design/arcade` 验证：`pnpm test:umami` 通过，`pnpm build` 通过（36 个页面）；`pnpm type-check` 仅剩既存 `hast` 类型依赖缺失。
- `design/arcade` 本地预览：`http://127.0.0.1:4321/`（若进程仍在）；本地视觉 QA 截图位于忽略目录 `artifacts/arcade/`，不进入 Git；主要验收图为 `home-desktop-v2.png`、`home-mobile-v2.png`、`friends-desktop.png`、`post-desktop-v2.png`。
- 仓库基线仍有既存类型检查问题：缺少 `hast` 类型，以及 `src/utils/content-utils.ts` 的隐式 `any`；生产构建不受影响。
### 架构级重构状态
- 三个设计分支已经完成第一轮视觉重写并推送，但审计确认它们仍大量复用 Fuwari 页面骨架，现定位为可回退的阶段性版本，不是最终“完全重构”交付。
- 用户已通过可视化头脑风暴批准架构级重构：ARCADE、GLASS、MONO 作为三个独立产品，只共享内容 schema、路由契约、类型和纯逻辑，不共享 Layout、导航、文章卡、Reader、移动菜单或视觉组件。
- 已批准的产品定位：ARCADE 为高互动任务控制台；GLASS 为个人数字观测站；MONO 为极简数字出版物。
- 已批准保留 Astro、Markdown、构建部署链、全部公开 URL、RSS、Sitemap、中文 slug 与现有核心功能；允许增加向后兼容的可选内容元数据和风格专属增强。
- 动态背景继续使用主接口与 SNI fallback，但按风格原生化：ARCADE 任务场景、GLASS 观景窗、MONO 灰度刊物封面或页边图。
- 正式设计规格位于 `docs/superpowers/specs/2026-07-29-independent-frontend-rebuild-design.md`；已完成三轮自动审阅并修正全部已报问题，用户已于 2026-07-29 批准实施。
- 实施计划位于 `docs/superpowers/plans/2026-07-29-independent-frontend-rebuild-plan.md`；先构建并验证 `design/rebuild-core`，再分别合入三个现有设计分支进行独立产品重构。
- 实现阶段计划使用未合入 `main` 的 `design/rebuild-core` 承载无视觉共享代码，再分别进入三个现有设计分支；旧设计提交保留为 Git 回退点，不改写历史。
- 友链 JSON 当前由构建期 eager glob 汇总，不是运行时远程 API；重构保留多 JSON 文件驱动协议，不额外发明网络数据层。
- 当前 Swup containers 固定为 `main` 与 `#toc`；各独立 Shell 必须保留稳定容器契约或在分支内同步调整配置并覆盖所有路由。
- Umami helper 已修复，但 Fuwari 消费端仍有重复内联脚本、`0` 初始占位和局部仅 PV 的旧逻辑；`design/rebuild-core` 只提供统一访问层、DOM 属性协议和测试，三个风格分支分别移除旧脚本并接入全站/首页文章/详情页 PV+UV 的 `--` 占位契约。
- `design/rebuild-core` 已增加直接 `@types/hast` 依赖并恢复标准应用类型检查；三个风格分支必须继续保持 `pnpm type-check` 无错误。
- 安全复核发现旧 helper 会把动态分享令牌缓存到 `localStorage` 一小时；现已改为仅内存复用并清理历史持久缓存，令牌与接口探测安全边界不变。
- 2026-07-29 实时复核确认 Cloud 免费账户会把 `startAt=0` 截断：直接查询仅返回约 2,903 PV。未来空窗 + 单个 `prev` comparison 可一次覆盖完整历史，实时返回约 335,847 PV / 140,105 UV；具体数值会随访问增长，且不再通过跨窗口相加而重复计算 UV。
- 用户要求最多同时使用 3 个子代理；三个候选分支全部完成、推送并展示证据后，将 Goal 标记为 `blocked`，等待用户选择，不自动合并或继续。

## `design/rebuild-core` 实施记录

- 工作树：`D:\Projects\blog-core`；该分支禁止在用户选择风格前合入 `main`。
- `9c2564d` 增加向后兼容的 category/series/type/featured schema、非突变稳定排序、分组、上一篇/下一篇与中文 pathname 规范化。
- `a752b21` 增加统一累计统计 DOM 协议、最大并发 4 与两次有限退避重试、PV+UV 真零/失败语义、背景主源到 SNI 回退状态机、设置存储和幂等页面生命周期。
- `0ae7614` 增加直接 `@types/hast` 依赖，清理重复 Astro 导入，并将应用类型检查从无声明产物意义的 `--isolatedDeclarations` 收敛为 `tsc --noEmit`。
- core 没有改动旧 Fuwari 统计消费组件，也没有加入任何风格 Layout、视觉组件或 CSS；三个风格分支必须分别移除旧内联脚本并接入新 DOM 协议。
- 验证通过：`pnpm test:core`、`pnpm type-check`、`pnpm build`（36 页）、`git diff --check`。
- 下一步：将 `design/rebuild-core` 普通 merge 到三个现有设计分支，再分别完成独立 Shell、全路由、移动交互与视觉系统。

## `design/arcade` 架构级重构交付记录

### 分支与边界

- 工作树：`D:\Projects\blog-arcade`；分支：`design/arcade`。
- 当前实现基线：`3d404fe`；其中 `6204314` 恢复移动累计遥测条，`6fcdae2` 将“任何断点不得隐藏全站统计”锁入契约，`ad04129` 恢复原生 `hidden` 的 CSS 呈现，`3d404fe` 进一步修复命令搜索结果被 Swup 接管后面板仍覆盖新页面的问题。
- 本分支以普通 merge 吸收 `design/rebuild-core`，保留第一轮 ARCADE 换肤提交作为历史回退点，未 reset、rebase 或改写历史。
- 2026-07-29 再次普通 merge core 的 Umami 安全修复：动态分享令牌仅在页面内存复用，启动时清除旧版持久缓存；令牌未写入代码、构建产物、测试输出或本文档。
- `247dbf0` 普通 merge `design/rebuild-core@c0ab512`，同步精确 lifetime 统计：以 `max(createdAt, resetAt)` 为起点，通过未来空窗与单个 `prev` comparison 取得完整有效历史，缺失 comparison 时保持 UI `--` 而不误报 0。
- 本分支禁止在用户选择前合入 `main`；当前交付仅供候选预览与验收。

### 独立产品结构

- `f6eeb8f`：建立完全独立的 `src/arcade/` 产品树与 Geist/JetBrains Mono 字体系统：
  - `src/arcade/layouts/ArcadeShell.astro`
  - `src/arcade/components/*`
  - `src/arcade/runtime/arcade-runtime.ts`
  - `src/styles/arcade/index.css`
- `e3994a0`：将首页及 4 页分页重构为 Field Node 任务控制台：系统条、动态任务场景、Active Mission、Transmissions、模块轨、桌面左任务轨与移动底 Dock。
- `bfa9ec2`：将文章 Reader、归档、友链、404、关于、联系方式和隐私页全部迁移到独立 Shell；保留 Markdown、代码块、图片回退、TOC、Giscus、License、GitHub 编辑、上一篇/下一篇与返回顶部。
- `36d7240`：增加 ARCADE 结构契约与实时统计验证器，补齐外链 `noopener`、Swup 后 TOC 状态、命令面板焦点、存储受限降级、44px 触控目标和 reduced-motion 的脚本滚动降级。
- `2290424`：使 `pnpm test:arcade` 自包含，命令会先构建再检查，不依赖工作树中预先存在的 `dist`。
- 页面路由不再引用旧 `Layout`、`MainGridLayout`、`Navbar`、`SideBar`、`Profile`、`PostCard`、`PostMeta` 或旧移动菜单视觉组件；收尾阶段已进一步物理删除 `src/components/**`、`src/layouts/**`、第一轮 ARCADE/旧 Fuwari 样式和仅旧 UI 使用的 `setting-utils`，历史实现仍可从既有 Git 提交恢复。
- ARCADE 契约现在同时锁定源树与构建产物：`dist` 不得再引用或产出旧 `Layout`、`Search`、`DisplaySettings`、`setting-utils` bundle，也不得包含 Fancybox 或 OverlayScrollbars UI；清理后 Vite 客户端模块数由 188 降至 124。

### 功能与交互

- 所有 HTML 路由稳定输出唯一语义 `main` 和 `#toc`；Swup 继续交换这两个容器，运行时在页面替换后重新识别文章模式、TOC、Giscus、统计节点和活动导航。
- 系统条显示全站累计 PV/UV；首页当前页每篇文章以及文章详情均同时显示累计 PV/UV，初始值严格为 `--`，唯一消费端为 `public/js/blog-stats.js`。
- RSS 搜索集成到键盘可操作的命令面板，支持 `Ctrl/Cmd+K`、`/`、Escape、焦点进入/返回、结果跳转和可关闭错误状态。
- 明/暗/自动主题、背景显示/隐藏与 0–24px 模糊继续使用 core 设置键；localStorage 不可用时回到安全默认值。
- 背景只使用 `https://api.furry.ist/furry-img`，失败后切换 `https://sni-api.furry.ist/furry-img`，双失败保留纯色画布。
- ARCADE 视觉严格使用全直角、分级切角、唯一电光黄、硬 offset 阴影、宽字距标题、编号/斜线/L 形角括号；背景之外无磨砂或柔和弥散阴影。所有主要动效不超过 520ms，`prefers-reduced-motion` 下取消 skew、overshoot、大位移和脚本平滑滚动。
- 桌面使用固定左任务轨和文章右侧 TOC；小屏切换为底部 Dock，TOC 转为正文后的线性模块；CSS 提供 820px、640px 和 400px 断点，正文表格、代码和长链接局部滚动或换行。
- 响应式收尾已修复小屏全站统计被隐藏的问题：980px 以下累计 PV/UV 作为 28px 紧凑遥测条固定显示在系统条下方，场景、任务轨和正文同步下移；390px 断点进一步收紧间距但不删除统计。结构测试会阻止以后重新使用 `display: none` 隐藏该遥测条。
- 命令层内链接在捕获阶段先同步关闭，再交给 Swup 导航；任一 Astro/Swup 页面替换事件也会幂等清除命令层与根节点打开标记。普通 Escape 关闭仍保留 160ms 退场和焦点返回，快速重开会取消旧关闭定时器。
- 个人资料、Bilibili、GitHub、RSS、Sitemap、隐私、外部状态页和 Umami 统计页均保留直接入口。
- 2026-08-04 按用户视觉反馈将系统条原有字母 `M` 标记替换为 `siteConfig.favicon` 配置的站点图标；图标保持装饰语义，站名链接仍提供完整可访问名称，配置为空时沿用默认 favicon 列表。
- 同日按用户反馈移除任务侧栏重复且竖排的 `NODE_01` 标签；侧栏保留可读的 `01` 编号、图标、模块名称与 RSS 入口，避免窄栏中的装饰文字折行。

### 验证证据

- `pnpm test:core`：通过，覆盖 Umami helper、内容纯函数、累计统计运行时、背景状态机、设置和生命周期。
- `pnpm type-check`：通过，无类型错误。
- `pnpm test:arcade`：通过；自包含执行生产构建后检查 36 个 HTML、26 篇文章、唯一 `main/#toc`、全部 ARCADE Shell、统计 `--` 占位、PV+UV 双节点、Giscus、License、外链安全属性、旧视觉源树和构建资产均为零、reduced-motion、390px 安全断点，以及移动端累计遥测条不可隐藏契约。
- `pnpm build`：通过，生成 36 页；保留首页 4 页分页、26 篇文章、归档、友链、关于、联系方式、隐私、404、RSS、Sitemap 与 robots.txt。
- `pnpm verify:arcade-stats`：三轮实时验证均为 `9/9`，每轮包含全站和首页 8 篇文章的累计 PV+UV；输出不包含动态分享令牌。
- 背景实时只读探测：主接口与 SNI 回退均返回 `200 image/webp`；core 测试同时覆盖主成功、主失败转回退、双失败、禁用与重复初始化。
- 本地 HTTP 冒烟：`http://127.0.0.1:4326/` 与 `/posts/start/` 均返回 200、均输出 `data-product="arcade-field-node"`，且不引用任何退役资产。
- `git diff --check`：通过。
- 本地静态预览：`http://127.0.0.1:4326/`（仅当对应预览进程仍在运行）。
- 主线程以精确 `390x844` 复验移动首页：全站累计条为 `display:flex` 且可见，实测高度 `28px`、底边约 `85.3px`，Hero 顶边 `110px`，重叠量为 `0`；当次实时值为 `335874+ PV / 140105 UV`。文档宽度与视口内容宽度均为 `380px`，没有页面级横向溢出。
- 同一移动浏览器会话已确认文章累计 `90 PV / 61 UV` 就绪，文章 H1 位于累计条下方且 TOC 存在；数值会随访问继续增长。
- 最终截图目录：`C:\Users\MingTone\.codex\visualizations\2026\07\27\019fa50e-1c97-71e2-a08c-fab02dbda466\blog-rebuild-qa`；文件为 `arcade-final-home-desktop.png`、`arcade-final-home-mobile.png`、`arcade-final-article-desktop.png`，均不包含动态分享令牌。
- 真实浏览器在 `3d404fe` 前精确复现：输入 `cloudflare` 并点击首条结果后，文章 H1 已被 Swup 替换，但命令层仍为 `hidden=false`、`data-open=true`、`aria-hidden=false`、`display:grid`，根节点仍有 `data-command-open=true`。
- 同一路径在 `3d404fe` 后通过：文章 URL/H1 正确，命令层为 `hidden=true`、无 `data-open`、`aria-hidden=true`、`display:none`，根节点无打开标记；Escape 关闭后焦点返回“打开搜索”，浏览器后退首页与前进文章也始终保持命令层关闭。
- `3d404fe` 验证：`pnpm type-check` 与自包含 `pnpm test:arcade` 均通过；后者重新构建 36 页并通过 26 篇文章的 ARCADE 契约，新增捕获阶段关闭与页面替换同步归一断言。
- 站点图标替换后再次通过 `pnpm type-check` 与自包含 `pnpm test:arcade`；契约新增首页品牌必须渲染非空 favicon `<img>` 且不得回退字母标记。公开图标源经授权代理返回 `200 image/jpeg`，真实浏览器在 1440×1000 与 390×844 下均完成解码，图标框分别为 36×36 与 32×32，和站名重叠量为 0。
- 目录标题装饰已约束为单行 `//`，目录链接标记 `data-no-swup` 并由运行时补偿固定顶栏偏移；任务侧栏不再输出 `NODE_01`。上述改动已完成 ARCADE 门禁与真实文章截图回归。

### 2026-08-04 最终收尾

- 首页内容契约改为先通过纯函数 `partitionPinnedPosts()` 分离置顶与普通文章，再仅对普通文章按 `PAGE_SIZE=8` 分页；置顶任务只在首页独立展示，支持 0、1、多个置顶。当前 26 篇文章在四页形成 `9/8/8/1` 的可见分布（第一页为 1 篇置顶加 8 篇普通文章），无重复、无遗漏；每个置顶任务使用唯一 heading ID 和动态 `PRIORITY_XX`。
- Hero 标题固定为“探索”与“记录 / 连接”两行，桌面字号收敛为 `6.4vw`、行高为 `1.02`；模块编号统一为首页 `001`、归档 `002`、关于 `003`、联络 `004`、友链 `005`、隐私 `006`，并同步 PageHeader、ModuleDeck 与命令快捷入口。
- 事件委托现在扫描完整 `event.composedPath()`；命令打开目标收窄为 `button[data-command-open]`，因此点击 SVG `<use>` 也能可靠关闭面板，且不会把根节点的打开状态误识别为触发器。设置滑杆协议独立为 `data-background-blur-control`，不再与根节点 `data-background-blur` 状态属性冲突。
- TOC 链接标记 `data-no-swup` 并由运行时按固定系统条和移动遥测条计算滚动偏移；目录装饰 `//` 强制单行。页面替换入场改为只改变 opacity 的 `arcade-reveal`，不再让 Swup 后的容器残留 transform。
- 背景运行时保持原主源与 SNI fallback；成功状态下重复初始化不会重新写入图片 `src`。真实 Swup 导航验证为同一图片节点、0 次额外 `src` 赋值、0 次状态变化、总资源请求仍为 1 次，`currentSrc` 与 opacity 均保持不变。
- `[data-blog-stats]` 在 `idle`、`loading`、`error` 状态下整块隐藏，只在 PV/UV 同时有效的 `ready` 状态显示；全站统计同步到根节点 `data-site-stats-state`，桌面和移动布局会在统计不可用时收回预留轨道。后续成功重试可恢复整块统计及数字显示。
- 生产模式 Playwright 矩阵已覆盖 `1440x1000`、`1280x580`、`390x844`：Hero、搜索、SVG 关闭、Escape 与焦点恢复、设置页签、主题/背景/模糊持久化、TOC、分页、上一篇/下一篇、浏览器前进后退、移动 Dock、背景 Swup 同源、正常统计、广告拦截及解除后恢复均通过，无 page error 或 console error。
- 广告拦截场景中 10 个统计根全部隐藏，不显示 PV/UV、`--`、`0` 或空框；桌面遥测区域为 `0x0`，移动场景与系统栏保持 `24px` 间距。解除拦截后 10 个根全部恢复，20 个 PV/UV 值均为数字。
- 最终 QA 结果：`C:\Users\MingTone\.codex\visualizations\2026\08\04\arcade-final-qa\qa-results.json`；主要截图为同目录下的 `home-1440x1000.png`、`home-1280x580.png`、`home-390x844.png`、`home-stats-blocked-1440x1000.png`、`home-stats-blocked-390x844.png` 与 `article-1280x580.png`。
- 最终实现见 `design/arcade` 分支 HEAD；禁止在用户选定前合入 `main`。候选交付完成并推送后，Goal 停在等待用户选择，不自动继续或合并。
- 已知非阻塞警告：`src/content/assets` 数据集合为空、Browserslist 数据较旧、pnpm 10 提示旧 `pnpm.patchedDependencies` 字段位置；均未影响当前构建与运行时契约。
