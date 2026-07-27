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
