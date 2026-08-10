# 项目交接

## 授权与操作边界

- 本仓库位于用户明确授权的开发与安全测试环境中；当前任务不是对第三方系统进行未授权操作。
- 允许范围：克隆和维护 `MingToneFurry/blog`、只读验证公开的 Umami 分享统计接口、本地构建与浏览器验收、维护 Git 分支和提交。
- 禁止范围：修改 Umami 账户权限或分享设置、向无关外部系统写入数据、泄露分享令牌、改写或删除未选中的设计分支历史。用户已明确选择 ARCADE，因此允许将 `design/arcade` 合入 `main`。

## 当前目标

1. 修复博客不显示访问量、访客数等 Umami 数据的问题，并将修复提交到 `main`。
2. 保留 `https://api.furry.ist/furry-img` 背景加载、现有页面路由和主要功能。
3. 根据 `iudesigns` 的全部三种规范分别重写前端：`arcade`、`glass`、`mono`。
4. 保持三个候选分支独立；将用户选定的 ARCADE 合入 `main`，GLASS 与 MONO 继续保留为未合并回退选项。

## 已确认事实

- 默认分支：`main`；远端：`https://github.com/MingToneFurry/blog.git`。
- 网络失败时使用 `socks5://127.0.0.1:10808`，当前仅配置在本仓库 `.git/config`。
- Umami 分享页仍为 `https://cloud.umami.is/analytics/us/share/HdVBrs2TcRJ2LJd4`。
- 新 API 基址为 `https://gateway-us.umami.is`；分享上下文请求必须带 `x-umami-share-context: 1` 和动态分享令牌。
- Umami Cloud 免费分享查询会把过早的 `startAt` 截到近期窗口，因此不能把 `startAt=0` 直接当作累计。现 helper 以 `max(createdAt, resetAt)` 为统计起点，构造未来空窗并用 `compare=prev` 让单个 comparison 窗口覆盖起点至当前快照，直接取该窗口的全站与文章 PV/UV；接入前、重置前或已删除的历史数据仍无法补算。
- 公开分享令牌只在浏览器内动态获取并仅作内存级复用，不写入仓库、交接文档或 `localStorage`；新版 helper 会主动清理旧版 `umami-share-cache:*` 持久缓存。
- 所有前端统计根均遵循 fail-closed 契约：SSR 默认 `hidden`，只有同时取得有效非负累计 PV/UV 后才显示；广告拦截、请求失败、超时和响应无效时，标签、数值、横线占位与统计空框全部隐藏。真实 `0` 是有效数据，仍会正常显示。
- `iudesigns` 目录共三种风格：`arcade.md`、`glass.md`、`mono.md`。

## 分支策略

- `main`：用户已选择 ARCADE，现以普通非快进合并吸收 `design/arcade` 的完整历史，并在冲突处保留 `main` 最新的 Umami fail-closed 修复。
- `design/rebuild-core`：从已批准规格所在的 `main` 创建，只承载内容、路由、统计、背景、设置和生命周期等无视觉契约；禁止提前合入 `main`。
- `design/arcade`：用户选定的 ARCADE 完整重构来源分支；合并后仍保留分支和提交历史。
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
- `pnpm test:stats`
- `pnpm test:core`
- `pnpm type-check`
- `pnpm test:arcade`
- `pnpm build` 与 `git diff --check`
- 浏览器验证首页全站统计及至少一篇文章的 PV/UV，并用阻断 `umami-share.js` / Umami 网络请求的场景确认统计整组不可见。
- 三个设计分支分别进行桌面和移动端视觉、键盘焦点、减少动效检查。

## 当前进度

- 仓库已克隆并跟踪 `origin/main`。
- `main` 已完成 Umami 累计统计接口修复及 fail-closed 消费端收敛：单例运行时替代重复内联脚本，Swup 不会重复绑定，无效 HTTP 200 响应不写缓存，失败后可恢复；ARCADE 合并候选预览为 `http://127.0.0.1:4330/`。
- `main` 的 helper 缺失实测：首页 9 个统计根、文章页 2 个统计根全部为 `display:none`，可见 `0` / `-` / `--` 占位数为 0；正常接口下全站与文章累计 PV/UV 均正常显示，前进/后退后可恢复且背景节点保持唯一。
- `design/arcade` 最终提交为 `87fbda40c9b7ea82671f3431ff5db9d4935e7631`，预览 `http://127.0.0.1:4327/`；已覆盖 0、1、多篇置顶文章、搜索、设置、移动菜单、TOC、历史导航、背景复用和双视口布局。
- `design/glass` 最终提交为 `a1625b47661bc2f904cb2e0a8c293327c3819077`，预览 `http://127.0.0.1:4325/`；已覆盖统计空轨道折叠、搜索、设置、移动导航、焦点闭环、历史导航和背景复用。
- `design/mono` 最终提交为 `c759ff831f4be3d88844519151bebbdabe87e8d6`，预览 `http://127.0.0.1:4328/`；已覆盖统计列折叠、搜索、设置、移动菜单、分页、TOC、Alt 导航、历史导航和背景复用。
- 三个设计分支均已通过各自契约测试、类型检查、36 页生产构建、`git diff --check`、桌面与移动 Playwright 交互矩阵，并与对应远端分支同步；用户已选择 ARCADE，`main` 的非快进合并冲突已解决并完成合并前回归。
- 已批准的产品定位保持不变：ARCADE 为高互动任务控制台；GLASS 为个人数字观测站；MONO 为极简数字出版物。三者只共享内容 schema、路由契约、类型和纯逻辑，不共享产品 UI 骨架。
- 已保留 Astro、Markdown、全部公开 URL、RSS、Sitemap、中文 slug、主要功能与分类，以及 `https://api.furry.ist/furry-img` 主背景接口和 SNI fallback。
- 正式设计规格位于 `docs/superpowers/specs/2026-07-29-independent-frontend-rebuild-design.md`；已完成三轮自动审阅并修正全部已报问题，用户已于 2026-07-29 批准实施。
- 实施计划位于 `docs/superpowers/plans/2026-07-29-independent-frontend-rebuild-plan.md`；先构建并验证 `design/rebuild-core`，再分别合入三个现有设计分支进行独立产品重构。
- `design/rebuild-core` 继续保留为未合入 `main` 的共享逻辑历史；三个最终候选在各自分支独立维护，旧提交保留为 Git 回退点，不改写历史。
- 友链 JSON 当前由构建期 eager glob 汇总，不是运行时远程 API；重构保留多 JSON 文件驱动协议，不额外发明网络数据层。
- 当前 Swup containers 固定为 `main` 与 `#toc`；各独立 Shell 必须保留稳定容器契约或在分支内同步调整配置并覆盖所有路由。
- Fuwari 与三个候选前端都已移除统计失败时的可见占位；统计根在 ready 前不会占用布局或进入可访问性树。
- 安全复核发现旧 helper 会把动态分享令牌缓存到 `localStorage` 一小时；现已改为仅内存复用并清理历史持久缓存，令牌与接口探测安全边界不变。
- 2026-07-29 实时复核确认 Cloud 免费账户会把 `startAt=0` 截断：直接查询仅返回约 2,903 PV。未来空窗 + 单个 `prev` comparison 可一次覆盖完整历史，实时返回约 335,847 PV / 140,105 UV；具体数值会随访问增长，且不再通过跨窗口相加而重复计算 UV。
- ARCADE 依赖直接包含 `@types/hast`，标准 `tsc --noEmit` 类型检查已恢复为无错误门禁。
- 用户要求最多同时使用 3 个子代理；用户已明确选择 `ARCADE`，等待条件解除。完成合并、回归验证和推送后可结束 Goal；`design/glass` 与 `design/mono` 不合并、不改写。

## 2026-08-08 ARCADE 合并记录

- 用户明确选择 `ARCADE` 后，从 `main@11475fa` 执行普通 `--no-ff` 合并，保留 `design/arcade@87fbda4` 的完整历史；旧 Fuwari 组件、Layout 和样式树按 ARCADE 架构删除，文章详情采用独立 Reader。
- `public/js/blog-stats.js` 以 `main` 的单例幂等、8 秒超时、非负 PV/UV 校验、失败缓存驱逐、原生 `hidden`/`aria-hidden` 和空文本策略为基线，补入 ARCADE 的全站状态同步；`SystemBar` 与 `PostStats` 的 SSR 初态不再输出 `--`。
- `ArcadeShell` 在统计脚本之前内联 `window.__BLOG_STATS_CONFIG__`，Umami helper、统计、背景和分析脚本均标记 `data-swup-ignore-script`，避免 Swup 重复执行和初始化竞态。
- 自动化验证通过：`pnpm test:umami`、`pnpm test:stats`、`pnpm test:core`、`pnpm type-check`、`pnpm test:arcade`；生产构建输出 36 页和 26 篇文章，ARCADE 契约全部通过。
- 实时 Umami 验证器已移除“固定 8 篇首页文章”的错误假设，改为按构建产物动态读取唯一文章路径；当前 1 篇置顶加 8 篇普通文章，三轮均为全站加 9 篇文章 `10/10` 累计 PV+UV 就绪。
- 浏览器正常场景：`1440x1000` 首页最终 10 个统计根全部 `ready`，PV/UV 均为非负数字；`390x844` 文档宽度等于内容视口宽度、遥测条高 28px、移动 Dock 高 64px，无横向溢出或文字重叠。
- 浏览器拦截场景：阻断本地 Umami helper 或 Umami API 后，首页 10 个统计根全部隐藏、20 个值全部为空、全站遥测区域为 `0x0`；背景仍独立恢复到 `https://api.furry.ist/furry-img`。仅解除 API 阻断后，同一 SPA 会话在归档页恢复全站统计，返回首页后恢复全部 `10/10` 统计。
- 搜索结果跳转会同步关闭命令层；关闭按钮与 Escape 均有效且焦点返回触发器。暗色设置持久化，文章 TOC 将“思路”标题定位到系统栏下方 52px；浏览器前进/后退保持 ARCADE 样式、TOC、主题和唯一背景节点。
- 从搜索、浏览器前进/后退及恢复导航采集的网络事件均未出现额外 `api.furry.ist/furry-img` 请求；背景节点始终为 1 个且保持 `ready`。

## 2026-08-10 真机移动端与图片灯箱

- 真机截图中的顶部文字异常不是单段文字换行，而是绝对定位的 `.arcade-scene-coordinates` 与正常流中的 `.arcade-scene-intro > .hud-kicker` 重叠。置顶文章统计进入 `ready` 后会增加卡片高度并上推底部对齐的 Grid 内容，因此旧版在 320–428px 下会稳定产生约 4–14px 覆盖。
- `max-width: 820px` 下现将坐标标签放回 Grid 正常流，并约束最大宽度、换行和边距；`html` 同时固定 `text-size-adjust: 100%`，避免 WebKit 自动字体膨胀重新破坏布局。统计 ready 状态下已实测 320、375、390、393、428、640、641、711、820px 均无重叠和横向溢出，821px 恢复桌面定位且仍保持正间距。
- 亮色主题将可读强调文字 `--ui-accent: #596500` 与荧光填充 `--ui-accent-fill: #dff000` 分离。强调文字对 `#f2f2ee` 背景为 5.69:1、对白色 surface 为 6.39:1；深色前景对荧光填充为 14.93:1，均满足 WCAG AA。
- 新增 ARCADE 原生图片灯箱，覆盖文章正文图片与文章封面，不接管头像、友链图标、装饰背景或 `api.furry.ist` 站点背景。链接到普通网页的文章图片仍先进入灯箱，并由右上角外链动作保留原目标；灯箱切图复用已加载的原始 `<img>` 节点，避免 `no-store` 动态图片再次请求后变成另一张。支持单图模式、多图前后切换、方向键、Escape、点击背景关闭、打开原图、焦点闭环、变化播报与关闭后焦点回收；Swup 页面替换和浏览器前进/后退会保持单一灯箱实例并重新增强当前文章图片。
- 浏览器验收覆盖 390x844 亮色首页、多图文章 `IMAGE 01 / 09` 至 `02 / 09`、单图文章隐藏前后按钮、44x44px 控制按钮、动态视口内完整显示、背景滚动锁定、关闭恢复和无控制台错误。静态契约新增亮色对比度计算、窄屏标签流式布局及灯箱可访问性断言。
