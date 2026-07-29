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
### 第一轮 GLASS 回退点
- `design/glass` 已完成 ArcTower/GLASS 全站视觉重写，尚未合并 `main`，等待用户与其余风格对比后选择。
- ArcTower 实现采用单一蓝强调、素色点阵画布、不透明内容表面、发丝描边、4/6/10/16px 圆角、卡片零投影、蓝竖条签名、状态软底 chip、统一焦点环与暗亮对等 token。
- 已重构或统一覆盖导航、移动菜单、RSS 搜索浮层、首页文章卡与累计 PV、资料卡与累计 PV/UV、归档、友链、文章页、Markdown、TOC、License、文章导航、分页、Footer、返回顶部及加载状态。
- 保留 `https://api.furry.ist/furry-img` 动态背景及 `https://sni-api.furry.ist/furry-img` fallback；背景使用中性去饱和遮罩，内容使用不透明表面保证可读性。
- 统计文案固定为“累计浏览 PV / 累计访客 UV”，脚本仅更新数字节点；卡片统计会等待 Umami helper、串行获取并失败重试，降低首屏并发失败概率。
- 精确浏览器验收已覆盖桌面和 390×844 移动视口：无横向溢出，资料统计两列完整，Footer 位于文章与分页之后，累计站点及文章统计正常更新，动态背景和导航功能保留。
- `pnpm test:umami` 与 `pnpm build` 通过；`pnpm type-check` 仍因既存的 `src/plugins/expressive-code/custom-copy-button.ts` 缺少 `hast` 类型而失败，生产构建不受影响。

## design/glass 后续边界

- 禁止在用户选定前将 `design/glass` 合并进 `main`。
- 后续若继续微调，应保持 ArcTower 单蓝约束，不恢复主题 hue 彩虹选择器或多色品牌强调。
- 若修改统计 UI，必须保留开站以来累计语义、动态分享令牌机制以及 PV/UV 标签与数字节点分离。
- 若修改背景处理，必须保留原始 `api.furry.ist` 地址和现有 fallback，不把外部图片数据写入仓库。
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

## `design/glass` 架构级重构交付记录

### 分支与边界

- 工作树：`D:\Projects\blog-glass`；分支：`design/glass`；用户选定前禁止合入 `main`。
- 本分支保留第一轮 ArcTower 换肤提交作为历史回退点，以普通 merge 吸收 `design/rebuild-core`，未 reset、rebase 或改写历史。
- `3b362c0` 已普通 merge 最新 core，其中包含 `main` 的 `210c3cf` 与 `88e19b9`：精确 lifetime 单 comparison 窗口、`max(createdAt, resetAt)` 起点、comparison 缺失失败语义，以及仅内存分享令牌边界。

### 独立产品结构

- `d1b3175` 建立独立 `src/glass/` Observatory Shell、compact bar、观景窗、RSS 搜索、显示设置和运行时。
- `277cc24` 将首页、文章 Reader、归档、友链、404、关于、联系方式和隐私等全部 HTML 路由迁移到 GLASS 产品树。
- `f6f5d44` 删除已退出依赖图的旧 Fuwari `src/components`、旧 Layout 与仅旧 UI 使用的视觉样式；旧稿仍可由 Git 历史回退。
- `5630bba` 增加 36 页结构、统计、Reader、外链安全和视觉约束契约；最终契约进一步锁定 `dist/_astro` 不得携带旧 `Layout`、`Search`、`DisplaySettings`、OverlayScrollbars、Fancybox、`card-base` 或 `btn-regular` UI 标记。

### 功能与交互

- 首页为个人数字观测站：受限动态观景窗、站点累计 PV/UV、最新写作、分类筛选、Writing / Identity / Network 模块和四页分页。
- 首页当前八篇文章及文章详情均输出 `--` 初始值和累计 PV+UV，唯一消费端为 `public/js/blog-stats.js`；紧凑列表关闭逐项 live region，避免批量统计结果反复播报。
- Reader 保留 Markdown、代码块、图片、阅读进度、TOC、License、GitHub 编辑、Giscus、上一篇/下一篇与返回顶部。
- 保留 RSS 搜索、明/暗/自动主题、背景显示与 0–24px 模糊、移动导航、友链、状态、统计、RSS、Sitemap 与隐私入口。
- 背景只使用 `https://api.furry.ist/furry-img`，失败后切换 `https://sni-api.furry.ist/furry-img`；双失败时保留本地画布。
- `f2e3252` 修复搜索跳转前关闭 dialog、导航 popover 互斥/外部关闭、移动遮罩、Escape、焦点返回和断点语义同步。桌面 context rail 现在是 HTML 中真实 `open` 的 `<details>`，进入可访问树；移动首屏立即关闭，断点切换只初始化一次，不会在移动端重复初始化时关掉用户刚打开的抽屉。
- 最终收尾为原生 `<dialog>` 增加显式 Escape 路径：先匹配 `dialog[open]`，调用统一 `closeDialog()` 并由既有 `close` 监听器恢复触发按钮焦点；该顺序已加入交付契约，避免依赖浏览器默认 cancel 行为。
- 移动 drawer 统一暴露 `data-glass-drawer-panel`：打开后聚焦面板内关闭按钮，Tab/Shift+Tab 只在 modal panel 内闭环，遮罩、关闭按钮或 Escape 关闭后均将焦点还给原 summary。
- 最终规格审计逐项对齐 `iudesigns/glass.md`：明暗色、surface、发丝线、accent/hover、Dialog 舞台阴影、250ms 入场与 400ms 进度均使用规范值；Badge/状态点、圆形 Avatar、分段控件和 42×24 显式 Switch 使用唯一语义 pill token，普通卡片继续无投影、无全站磨砂，并提供键盘焦点与 `prefers-reduced-motion` 降级。

### 验证与待补验

- 自动门禁：`pnpm test:core`、`pnpm type-check`、`pnpm build`（36 页）、`pnpm test:glass-contracts`、`git diff --check`。
- GLASS 契约覆盖 36 个 HTML、首页 1 个站点统计根和 8 个文章统计根、文章功能矩阵、真实 open context rail、具名 `complementary` 可访问结构、显式 dialog Escape、ArcTower token/动效/Switch 结构、旧 UI 源树与最终 dist 零残留；不依赖 `CONTEXT RAIL` 等纯装饰字样。
- 2026-07-29 最终实时只读 Umami 验证未输出分享令牌：全站累计 `335875 PV / 140105 UV / 318615 visits`；`/posts/start/` 为 `10 PV / 5 UV / 5 visits`。数值会随访问增长。
- 2026-07-29 两条背景源均返回 `200 image/webp`；本地预览 `http://127.0.0.1:4332/` 返回 `200 text/html`。
- 主线程已在 4332 桌面预览中确认右侧头像、分类与外部坐标 rail 可见，DOM 快照出现 `complementary "页面上下文"` 与 `complementary "观测站概览"`；截图暂存于主线程 QA 工作树。
- 主线程 IAB 已验证 `390x844` 首页背景、Hero、累计统计与无横向溢出，移动导航打开/关闭，搜索 `Cloudflare` 返回 5 条，文章 Swup 入口后位于顶部且文章 PV/UV 正常；文章工具打开聚焦关闭按钮、Tab 环、伪遮罩、Escape 与焦点返回均通过，移动主导航也聚焦关闭按钮并保留 `role=dialog` / `aria-modal=true`。当前子代理的 Browser skill 仍返回空浏览器列表；主线程继续补菜单完整焦点环、Dialog/Switch 和 Swup/history 最终矩阵。
- 非阻塞警告：空 `src/content/assets`、Browserslist 数据较旧、pnpm 10 提示旧 `pnpm.patchedDependencies` 字段位置。
