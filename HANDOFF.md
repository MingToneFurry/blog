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
### 第一轮 MONO 回退点
- 第一轮当时把所有统计请求设为 `startAt=0` 并按累计展示；后续实时复核已证明 Umami Cloud 会截断过早起点，因此该旧实现只作为 Git 回退点保留，不得再作为累计口径。当前 lifetime 实现见后文。
- `design/mono` 已按 `iudesigns/mono.md` 完成结构化重写：导航、首页文章卡片、文章页、归档、友链、搜索、个人资料与显示设置均采用纯黑白、直角、1px 边框和排版优先的 MONO 系统。
- MONO 显示设置仅保留明暗主题与动态背景开关；旧主题色、彩虹、背景模糊和色相旋转不会覆盖强制灰度显示。
- MONO 保留 `https://api.furry.ist/furry-img` 动态背景及 `https://sni-api.furry.ist/furry-img` 回退，所有统计标签与数字节点分离，脚本只更新数字。
- 首页文章统计由列表组件统一调度，最大并发 4；网络或 API 异常会以 400ms/900ms 延迟有限重试，加载期间显示 `--`，避免将未完成请求误呈现为真实 0。
- `design/arcade` 与 `design/glass` 由各自独立工作树继续实现；所有设计分支均禁止提前合入 `main`。
- 该第一轮回退点当时的 `pnpm type-check` 仍因缺少 `hast` 类型失败；后续 `design/rebuild-core` 已增加直接 `@types/hast` 依赖，第二轮 MONO 已恢复无错误类型检查。

## MONO 交付检查

- 分支：`design/mono`；独立工作树：`D:\Projects\blog-mono`。
- 必测页面：首页、文章页、`/archive/`、`/friends/`。
- 必测交互：RSS 搜索、移动菜单、明暗/自动主题、动态背景开关、Swup 页面切换、键盘焦点与减少动效。
- 必测数据：全站“累计浏览 PV / 累计访客 UV”与文章级累计 PV/UV，文案不得被异步请求替换。
- 交付要求：运行 `pnpm test:core`、`pnpm type-check`、`pnpm build`、`pnpm test:mono-contract` 与 `git diff --check`，完成桌面与移动截图后再供用户选择；不得合并到 `main`。
- 第一轮 2026-07-28 验证：`pnpm test:umami` 通过；`pnpm build` 通过并生成 36 页；当时 `pnpm type-check` 与 `main` 同样仅报 `custom-copy-button.ts` 缺少 `hast` 类型。该历史基线已被后续 core 修复。
- 主代理已用精确 1440x1000 与 390x844 浏览器视口验收：首页、文章页、归档、友链、搜索、移动菜单、明暗主题、背景开关均通过；移动端无横向溢出，Footer 位于文章和分页之后。
- 累计统计连续 3 轮、每轮观察 10 秒均通过：初始占位为 `--`，全站与首页 8 篇文章的 PV/UV 最终全部完成更新，无遗留加载占位或误报 0。
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

## MONO / Journal 第二轮独立产品交付（2026-07-29）

### 授权环境与操作边界

- 本节记录的全部代码、构建、接口契约验证与本地预览均位于用户明确授权的开发和安全测试环境；不包含对无关第三方系统的写操作。
- 操作范围严格限定为 `D:\Projects\blog-mono` 的 `design/mono` 分支。没有修改其他设计工作树，没有 reset、rebase 或改写第一轮 MONO 提交，也没有将任何设计实现合入 `main`。
- Umami 动态分享令牌仍只在浏览器内动态获取并以内存复用；源码、构建产物、截图和本交接文档均未写入动态令牌。
- 当前交付只供用户在 ARCADE、GLASS、MONO 三个候选之间选择。用户选择前禁止把本分支合入 `main`。

### 产品与代码结构

- `src/mono/layouts/JournalShell.astro` 是唯一页面 Shell；所有公开 HTML 路由稳定输出一个语义 `main` 与一个 `#toc`，继续满足 Swup 的容器契约。
- `src/mono/components/` 自建 Masthead、动态刊图、站点/文章统计、RSS 搜索、显示设置、首页编辑索引、分页、Reader、License、TOC、归档、友链、Footer、图片与静态页组件。
- `src/mono/runtime/journal.ts` 只承载 Journal 专属增强：RSS 检索、Dialog、主题/背景设置消费、导航高亮、阅读进度、返回顶部、代码复制、图片揭示与 Alt+方向键前后篇。`49438d5` 已增加 Escape 显式关闭当前 `dialog[open]`，并通过既有 `closeDialog` 恢复触发按钮焦点。
- `src/styles/mono/journal.css` 是独立视觉系统：黑白灰、全直角、1px 边框、无渐变、无界面模糊、无纹理、仅 Dialog 允许一层环境阴影；全部过渡不超过 320ms，并包含 `prefers-reduced-motion`。
- 首页改为数字刊物：Masthead、卷期/RSS、动态灰度刊图、pinned/featured 刊首文章、顺序编号编辑索引、分类/系列/年份索引和编辑手记；移动端保持单线性结构。
- 文章页改为窄正文、宽留白与边注式目录，保留日期、更新、字数、阅读时间、分类/系列/标签、Markdown 插件、图片回退、Giscus、License、GitHub 编辑链接、上一篇/下一篇与返回顶部。
- 归档、友链、404、关于、联系方式和隐私全部迁移到 Journal 组件树；首页 4 页分页、26 篇文章、中文 slug、RSS、Sitemap 和 robots 保持不变。
- 在确认无任何公开路由引用后，已删除旧 `src/components`、`src/layouts`、第一轮视觉 CSS 和旧 `setting-utils.ts`，因此本轮不再保留旧 Fuwari 内联统计或视觉消费路径。第一轮实现仍完整保存在 Git 历史回退点。

### 统计、背景与设置契约

- 全站、首页当前页每篇文章和文章详情均使用唯一 `data-blog-stats` 协议，同时渲染累计 PV 与累计 UV；所有未完成/失败值初始并保持 `--`，真实零才显示 `0`。
- 首页第 1—3 页各有 8 组文章统计，第 4 页有 2 组；每页另有 1 组全站统计。文章详情有 1 组全站统计和 1 组文章统计。
- 统计底层默认使用 core 的 lifetime 模式：以 `max(createdAt, resetAt)` 为有效开站起点，构造未来空窗并用单个 `compare=prev` comparison 覆盖起点至当前快照，直接取得累计 PV/UV；调用方显式提供 `startAt`/`endAt` 时仍按指定区间查询。运行时继续继承最大并发 4、250ms/750ms 两次有限退避、单项失败隔离、中文 pathname 规范化和 Swup 幂等扫描。
- 动态刊图继承 core 的 `https://api.furry.ist/furry-img` 主源、`https://sni-api.furry.ist/furry-img` 回退与双失败纯色纸张状态机；首页用灰度刊首图，其他页面用页边图，正文始终为纯色。
- 显示设置直接消费 `settings-core`，继续使用 `theme`、`hide-bg`、`bg-blur` 键。为同时遵守 Journal “无模糊材质”硬约束，`bg-blur` 在本风格中以刊图墨度/对比柔化表达并持久化，不使用 CSS blur 或 backdrop-filter。
- 首屏 inline bootstrap 在绑定背景状态机前读取 `hide-bg`；关闭背景时先把 `data-background-visible=false` 同步到刊图根节点，避免 core 初始化抢先发起图片请求。

### 提交记录

- `935edf4`：普通 merge 最新 `design/rebuild-core`，包含动态分享令牌仅内存复用与旧持久缓存清理；保留双方历史和交接记录。
- `9b1e183`：建立独立 Journal Shell、刊头、首页、搜索、设置、统计、动态刊图、Footer、运行时和完整视觉系统。
- `833a01a`：用独立 Journal Reader 替换旧文章页，保留 Markdown、Giscus、License、GitHub 编辑与前后篇。
- `c87790e`：迁移归档、友链、404 与三份静态 Markdown 页面，并统一外链安全属性。
- `7753175`：增加 `pnpm test:mono-contract`，自动验证 36 页、容器、统计、外链、无障碍名称、旧视觉引用与 MONO 样式禁用项。
- `aec8c5d`：删除已确认无引用的退役 Fuwari 视觉树和重复客户端脚本。
- `575adc0`：记录第二轮独立 Journal 交接状态并推送完整实现。
- `9949fee`：普通 merge `design/rebuild-core@c0ab512`。其中 `210c3cf` 改用单个 comparison 取得 Cloud 免费账户未截断的累计值，`88e19b9` 将有效起点收敛为 `max(createdAt, resetAt)` 并在 comparison 缺失时显式报错；冲突解决继续保留对旧 `Profile.astro` 的删除。
- `49438d5`：显式兼容 Escape 关闭原生 Dialog，并为 Escape、`dialog[open]` 查询和焦点恢复 helper 增加 MONO 源码契约。

### 已完成验证

- `pnpm test:core`：通过；Umami、内容排序、统计运行时、背景、设置和生命周期全部契约测试通过。
- `pnpm type-check`：通过，无新增或遗留 TypeScript 错误。
- `pnpm build`：通过，生成 36 个静态页面；首页 4 页、26 篇文章、归档、友链、静态页、404、RSS、Sitemap 和 robots 均生成。
- `pnpm test:mono-contract`：通过；36 个 HTML 页各有且仅有一个 `main` 与一个 `#toc`，无旧 Fuwari DOM，统计均以 `--` 起始，所有 `target=_blank` 链接含 `noopener noreferrer`，按钮有可访问名称，Journal CSS 禁用项检查通过。
- `git diff --check`：通过。
- `http://127.0.0.1:4328/` 本地预览返回 HTTP 200；该端口是当前会话的临时预览，不是部署地址。

### 浏览器验收与待补证据

- 主线程已在可用的应用内浏览器确认：首页全站统计与当前 8 篇文章统计全部完成更新（9/9）；中文文章详情累计 PV/UV 成功；背景状态依次验证主源、SNI 回退、双失败 `error` 与恢复。截图路径由主线程补齐，本交接不编造文件名、数值或时间。
- 主线程验收时发现原生 Dialog 的 Escape 未关闭；`49438d5` 已显式兼容并复用焦点恢复 helper。该提交之后仍需由主线程在可用浏览器复验 Escape 关闭和触发按钮焦点返回。
- 本子代理按 Browser skill 重新连接后仍得到 `agent.browsers.list() = []`，因此没有伪造或绕过该通道生成修复后截图。其余桌面/精确 `390x844`、搜索、主题三态、柔化持久化、Swup 前进后退、TOC、键盘与 reduced-motion 截图路径同样由主线程补齐；记录和截图不得包含动态分享令牌。

### 已知非阻塞提示

- 构建仍报告 `src/content/assets` 没有匹配 JSON/YAML 的 glob-loader 提示；这是既有空数据集合提示，不影响 36 页输出。
- pnpm 会提示旧版 `package.json` 中的 `pnpm.patchedDependencies` 字段在当前 pnpm 版本不再读取；本轮未修改该部署基线，Astro 生产构建仍通过。
