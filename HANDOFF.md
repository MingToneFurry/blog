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

- `main`：统计修复和共享基础设施，可合入并推送。
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
- 所有统计请求使用 `startAt=0`，全站与文章 PV/UV 均表示 Umami 开始记录以来的累计值；接入前或已删除的历史数据无法补算。
- `design/mono` 已按 `iudesigns/mono.md` 完成结构化重写：导航、首页文章卡片、文章页、归档、友链、搜索、个人资料与显示设置均采用纯黑白、直角、1px 边框和排版优先的 MONO 系统。
- MONO 显示设置仅保留明暗主题与动态背景开关；旧主题色、彩虹、背景模糊和色相旋转不会覆盖强制灰度显示。
- MONO 保留 `https://api.furry.ist/furry-img` 动态背景及 `https://sni-api.furry.ist/furry-img` 回退，所有统计标签与数字节点分离，脚本只更新数字。
- 首页文章统计由列表组件统一调度，最大并发 4；网络或 API 异常会以 400ms/900ms 延迟有限重试，加载期间显示 `--`，避免将未完成请求误呈现为真实 0。
- `design/arcade` 与 `design/glass` 由各自独立工作树继续实现；所有设计分支均禁止提前合入 `main`。
- 仓库当前基线的 `pnpm type-check` 仍因缺少 `hast` 类型失败；早先出现的 `src/utils/content-utils.ts` 隐式 `any` 已不再复现，生产构建不受影响。

## MONO 交付检查

- 分支：`design/mono`；独立工作树：`D:\Projects\blog-mono`。
- 必测页面：首页、文章页、`/archive/`、`/friends/`。
- 必测交互：RSS 搜索、移动菜单、明暗/自动主题、动态背景开关、Swup 页面切换、键盘焦点与减少动效。
- 必测数据：全站“累计浏览 PV / 累计访客 UV”与文章级累计 PV/UV，文案不得被异步请求替换。
- 交付要求：运行 `pnpm test:umami`、`pnpm build`、记录 `pnpm type-check` 基线失败，完成桌面与移动截图后再供用户选择；不得合并到 `main`。
- 2026-07-28 验证：`pnpm test:umami` 通过；`pnpm build` 通过并生成 36 页；`pnpm type-check` 与 `main` 同样仅报 `custom-copy-button.ts` 缺少 `hast` 类型。
- 主代理已用精确 1440x1000 与 390x844 浏览器视口验收：首页、文章页、归档、友链、搜索、移动菜单、明暗主题、背景开关均通过；移动端无横向溢出，Footer 位于文章和分页之后。
- 累计统计连续 3 轮、每轮观察 10 秒均通过：初始占位为 `--`，全站与首页 8 篇文章的 PV/UV 最终全部完成更新，无遗留加载占位或误报 0。
