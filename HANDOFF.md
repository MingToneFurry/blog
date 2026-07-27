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
- `design/arcade` 已完成 ARCADE 全站视觉重写并独立提交，禁止在用户选定前合入 `main`：
  - 新增统一电光黄 HUD 令牌、暗/亮模式、分级切角、硬 offset 阴影、编号标签与冲击入场；全站强制无圆角、无磨砂玻璃，并提供 `prefers-reduced-motion` 降级。
  - 导航、资料侧栏、文章卡、文章页、累计 PV/UV 元数据、RSS 搜索、移动菜单、显示设置、友链、归档、Markdown、代码块、TOC、License、分页、Footer 与返回顶部均已统一到 ARCADE 语言。
  - 保留 `https://api.furry.ist/furry-img` 动态背景及 `https://sni-api.furry.ist/furry-img` fallback；视觉层仅降饱和/对比，不替换图片源或加载逻辑。
  - 显示设置保留明暗/自动主题、背景显示与模糊、开发节点；去除会破坏唯一品牌强调色的自定义 hue / 彩虹模式入口。
  - 统计文案明确为开站以来“累计浏览 PV / 累计访客 UV”，统计 helper 仍以 `startAt=0` 获取累计范围，脚本只替换数值节点文本。
  - 首页文章统计使用单一可重入队列顺序加载，并为网络/API 短暂失败提供最多 3 次退避重试，避免同时请求全部文章触发限流；Swup 替换后会重新扫描尚未完成的卡片。
- `design/arcade` 验证：`pnpm test:umami` 通过，`pnpm build` 通过（36 个页面）；`pnpm type-check` 仅剩既存 `hast` 类型依赖缺失。
- `design/arcade` 本地预览：`http://127.0.0.1:4321/`（若进程仍在）；本地视觉 QA 截图位于忽略目录 `artifacts/arcade/`，不进入 Git；主要验收图为 `home-desktop-v2.png`、`home-mobile-v2.png`、`friends-desktop.png`、`post-desktop-v2.png`。
- 仓库基线仍有既存类型检查问题：缺少 `hast` 类型，以及 `src/utils/content-utils.ts` 的隐式 `any`；生产构建不受影响。
