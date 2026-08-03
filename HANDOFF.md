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
- 所有前端统计根均遵循 fail-closed 契约：SSR 默认 `hidden`，只有同时取得有效非负累计 PV/UV 后才显示；广告拦截、请求失败、超时和响应无效时，标签、数值、横线占位与统计空框全部隐藏。真实 `0` 是有效数据，仍会正常显示。
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
- `pnpm test:stats`
- `pnpm type-check`
- `pnpm build`
- 浏览器验证首页全站统计及至少一篇文章的 PV/UV，并用阻断 `umami-share.js` / Umami 网络请求的场景确认统计整组不可见。
- 三个设计分支分别进行桌面和移动端视觉、键盘焦点、减少动效检查。

## 当前进度

- 仓库已克隆并跟踪 `origin/main`。
- `main` 已完成 Umami 累计统计接口修复及 fail-closed 消费端收敛：单例运行时替代重复内联脚本，Swup 不会重复绑定，无效 HTTP 200 响应不写缓存，失败后可恢复；预览为 `http://127.0.0.1:4329/`。
- `main` 的 helper 缺失实测：首页 9 个统计根、文章页 2 个统计根全部为 `display:none`，可见 `0` / `-` / `--` 占位数为 0；正常接口下全站与文章累计 PV/UV 均正常显示，前进/后退后可恢复且背景节点保持唯一。
- `design/arcade` 最终提交为 `87fbda40c9b7ea82671f3431ff5db9d4935e7631`，预览 `http://127.0.0.1:4327/`；已覆盖 0、1、多篇置顶文章、搜索、设置、移动菜单、TOC、历史导航、背景复用和双视口布局。
- `design/glass` 最终提交为 `a1625b47661bc2f904cb2e0a8c293327c3819077`，预览 `http://127.0.0.1:4325/`；已覆盖统计空轨道折叠、搜索、设置、移动导航、焦点闭环、历史导航和背景复用。
- `design/mono` 最终提交为 `c759ff831f4be3d88844519151bebbdabe87e8d6`，预览 `http://127.0.0.1:4328/`；已覆盖统计列折叠、搜索、设置、移动菜单、分页、TOC、Alt 导航、历史导航和背景复用。
- 三个设计分支均已通过各自契约测试、类型检查、36 页生产构建、`git diff --check`、桌面与移动 Playwright 交互矩阵，并与对应远端分支同步；尚未合入 `main`。
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
- 仓库基线仍有既存类型检查问题：缺少 `hast` 类型；生产构建不受影响。实施时必须确认无新增类型错误。
- 用户要求最多同时使用 3 个子代理；三个候选分支全部完成、推送并展示证据后，将 Goal 标记为 `blocked`，等待用户选择，不自动合并或继续。当前下一步只允许用户选定 `ARCADE`、`GLASS` 或 `MONO` 后再执行合并。
