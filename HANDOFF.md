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
- 所有统计请求使用 `startAt=0`，全站与文章 PV/UV 均表示 Umami 开始记录以来的累计值；接入前或已删除的历史数据无法补算。
- 公开分享令牌只在浏览器内动态获取，不写入仓库或交接文档。
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
- 仓库基线仍有既存类型检查问题：缺少 `hast` 类型；生产构建不受影响。实施时必须确认无新增类型错误。
- 用户要求最多同时使用 3 个子代理；三个候选分支全部完成、推送并展示证据后，将 Goal 标记为 `blocked`，等待用户选择，不自动合并或继续。
