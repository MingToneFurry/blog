---
title: "完全基于cloudflare的动态随机图片api！？"
published: 2026-01-02T00:14:37+08:00
updated: 2026-01-02T00:14:37+08:00
description: ""
tags: []
category: "未分类"
image: ""
---
#### 在文章开始之前，先祝各位读者们新年快乐！

---

## 首先，

相信各位对于我们api服务的速度提升感受应该挺大的（？ 这一次关闭不必要api端点并保留主要api端点算是一时兴起吧，起因是看到了这一个github项目

[https://github.com/afoim/cf-rule-random-url](https://github.com/afoim/cf-rule-random-url)

随即我就想到，能不能把我的api也搬到Cloudflare呢？ 由于api的图库有11224张图片，但是呢项目里却说了

> _脚本会在 `dist/` 目录下生成处理好的文件，每个分类包含 4096 个文件（16^3）。_

如果我按照这个方式部署的话，会极大的减少图库的数量，于是我便在群聊里问了群友  
得到了如下回复：  
![2026-01-01T16:13:54.png][1]

显而易见，这个方案不适合我，同时也超过了Cloudflare pages的上限[2w个文件](https://developers.cloudflare.com/pages/platform/limits/#:~:text=Cloudflare%20Pages%20sites%20can%20contain%20up%20to%2020%2C000%20files.)  
于是我便想到了Cloudflare的snippets（不知道为啥我这个free套餐的域名也有snippets权限）结合pages貌似也可以实现，而且不会出现更多重复的文件  
在经过 ~~和ChatGPT激烈的聊天后~~ 我得到了实现方案。

---

### 方案细则

- **Cloudflare Pages（imgmirror.furry.ist）**  
    承载静态图库与索引数据：
    
    - `/large/{id}.webp`
    - `/box/{id}.webp`
    - `/counts.json`
- **Cloudflare Snippets（部署在 api.furry.ist / sni-api.furry.ist）**  
    负责三件事：
    
    1. `/furry-img`：随机逻辑 + 参数解析 + 输出 JSON / 302 / 直出图片
    2. `/large/*`、`/box/*`：同域“反代”到 imgmirror（客户端永远只看到 api 域名）
    3. `/counts.json`：反代/缓存 counts（降低镜像与边缘压力）
- **SEO 控制（主要针对 sni-api.furry.ist）**  
    通过Cloudflare安全规则阻止除了cdn以外的任何访问（这就是为啥你访问 sni-api.furry.ist 会出现403错误的原因），这样可以防止搜索引擎收录这个url（因为我吧api首页也放到pages里了）
    

---

### 请求流（核心路径）

- 用户访问 `https://api.furry-img/furry-img?...`
    
    - Snippets 命中 → 读取 counts（边缘缓存）→ 随机出 id →
        - `format=json`：返回 JSON（url 指向 api 域名）
        - `format=file&redirect=1`：302 → `https://api.furry.ist/{type}/{id}.webp`
        - `format=file&redirect=0`：从 `imgmirror` 拉图并**直出**给用户
- 用户访问 `https://api.furry.ist/large/00001234.webp`
    
    - Snippets 命中 → 反代抓取 `imgmirror/large/00001234.webp` → 同域直出

---

### 静态图库（Pages：imgmirror.furry.ist）

### 目录结构

```
public/
	large/
		00000001.webp
		...
	box/
		00000001.webp
		...
	counts.json
	_headers  
```

### counts.json

示例：  
`{"large":11224,"box":11224,"pad":8}`

- `large`/`box` 表示当前分类下库内可用图片数
- `pad` 表示文件名左侧补零长度

---

### 部署细则

#### 首次部署

1. 准备图库（统一 `.webp`，按编号命名）
2. 生成并上传：
    - `/large/*.webp`
    - `/box/*.webp`
    - `/counts.json`
    - `/_headers`
3. 部署到 Pages，并绑定域名：`imgmirror.xxx.xxx`
4. 在 `api.xxx.xxx` 与 `sni-api.xxx.xxx` 对应 Zone：
    - DNS 记录开启橙云代理
    - 创建 Snippets（匹配上述路径）
5. 在 `sni-api.xxx.xxx` 的 Pages 首页项目：  
    通过安全规则阻止（根据实际可改变此行为）

_在首次部署中，第2步可以让ai写一个脚本来批量实现此行为_

#### 增量更新（新增图片）

1. 将新图补充到 `large/` 或 `box/`（继续顺延编号）
2. 更新 `counts.json`（large/box 数字增加）
3. 推送 Pages 更新（Git 或 wrangler）
4. 无需改 Snippets（counts 缓存会在 TTL 后自动更新）

_依旧建议使用ai编写脚本批量处理_

---

### snippets脚本

> 请根据你的实际情况修改此脚本

```
// Cloudflare Snippets for api.furry.ist

// Goals:

// 1) /furry-img/ implements format=json|file, redirect=0|1, mode=auto|box|large

// 2) /large/* and /box/* are served under api.furry.ist by proxying to imgmirror.furry.ist

// 3) JSON url always uses https://api.furry.ist/... (compat)

// 4) redirect=1 issues 302 but stays on api.furry.ist

  

const MIRROR_ORIGIN = "https://imgmirror.furry.ist";

const PUBLIC_ORIGIN = "https://api.furry.ist";

const COUNTS_URL = `${MIRROR_ORIGIN}/counts.json`;

const COUNTS_CACHE_TTL = 300; // seconds

const DEFAULT_PAD = 8;        // 00000001

const EXT = ".webp";

  

export default {

  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    const path = url.pathname;

  

    // 1) Proxy counts.json (optional but handy for debugging)

    if (path === "/counts.json") {

      return proxyToMirror(request, ctx, "/counts.json", { cacheMode: "counts" });

    }

  

    // 2) Proxy static images under api.furry.ist (NO redirect, keep same-domain)

    if (path.startsWith("/large/") || path.startsWith("/box/")) {

      return proxyToMirror(request, ctx, path, { cacheMode: "image" });

    }

  

    // 3) Random endpoint (support /furry-img and /furry-img/)

    if (path === "/furry-img" || path.startsWith("/furry-img/")) {

      const q = url.searchParams;

  

      const format = (q.get("format") || "file").toLowerCase();    // json | file

      const redirect = (q.get("redirect") || "0").toLowerCase();   // 0 | 1

      const mode = (q.get("mode") || "auto").toLowerCase();        // auto | box | large

  

      if (!["json", "file"].includes(format)) {

        return new Response("bad format", { status: 400 });

      }

      if (!["0", "1"].includes(redirect)) {

        return new Response("bad redirect", { status: 400 });

      }

      if (!["auto", "box", "large"].includes(mode)) {

        return new Response("bad mode", { status: 400 });

      }

  

      const counts = await getCounts(ctx);

      const type = decideType(mode, request); // "large" | "box"

  

      const maxN = counts[type] || 0;

      const pad = counts.pad || DEFAULT_PAD;

      if (maxN <= 0) return new Response("empty library", { status: 503 });

  

      const id = randomInt(1, maxN);

      const filename = `${String(id).padStart(pad, "0")}${EXT}`;

      const filePath = `/${type}/${filename}`;

  

      // IMPORTANT:

      // - JSON url must be https://api.furry.ist/... (your requirement)

      // - redirect=1 must also redirect to api.furry.ist/... (same-domain)

      const publicUrl = `${PUBLIC_ORIGIN}${filePath}`;

      const mirrorUrl = `${MIRROR_ORIGIN}${filePath}`;

  

      if (format === "json") {

        const body = JSON.stringify({

          url: publicUrl,

          type: type,

          filename: filename,

        });

        return new Response(body, {

          status: 200,

          headers: {

            "Content-Type": "application/json; charset=utf-8",

            "Cache-Control": "no-store",

            "Access-Control-Allow-Origin": "*",

          },

        });

      }

  

      // format=file

      if (redirect === "1") {

        // stays on api.furry.ist by design

        return Response.redirect(publicUrl, 302);

      }

  

      // redirect=0: direct binary response (no redirect)

      // Fetch from mirror but do not expose mirror to client

      return fetchBinaryFromMirror(request, ctx, mirrorUrl, {

        noStore: true,

        extraHeaders: {

          "Access-Control-Allow-Origin": "*",

          "x-furry-img-type": type,

          "x-furry-img-file": filename,

        },

      });

    }

  

    // Not matched: passthrough to your existing origin (other API paths unaffected)

    return fetch(request);

  },

};

  

function decideType(mode, request) {

  if (mode === "large" || mode === "box") return mode;

  

  // mode=auto: prefer Client Hint

  const ch = request.headers.get("Sec-CH-UA-Mobile");

  if (ch) return ch.includes("?1") ? "box" : "large";

  

  // fallback UA

  const ua = (request.headers.get("User-Agent") || "").toLowerCase();

  const isMobile =

    ua.includes("mobile") ||

    ua.includes("android") ||

    ua.includes("iphone") ||

    ua.includes("ipad") ||

    ua.includes("ipod") ||

    ua.includes("micromessenger");

  return isMobile ? "box" : "large";

}

  

async function proxyToMirror(request, ctx, path, { cacheMode }) {

  const mirrorUrl = `${MIRROR_ORIGIN}${path}`;

  

  // For images: we generally want to keep upstream cache headers (immutable)

  // For counts: edge-cache it a bit to reduce load

  if (cacheMode === "counts") {

    return fetchCountsWithEdgeCache(ctx, mirrorUrl);

  }

  

  // image / other static: proxy straight through

  return fetchBinaryFromMirror(request, ctx, mirrorUrl, {

    noStore: false, // let image caching work via upstream headers

    extraHeaders: {

      "Access-Control-Allow-Origin": "*",

    },

  });

}

  

async function fetchCountsWithEdgeCache(ctx, mirrorUrl) {

  const cache = caches.default;

  const cacheKey = new Request(mirrorUrl, { method: "GET" });

  

  let resp = await cache.match(cacheKey);

  if (!resp) {

    resp = await fetch(mirrorUrl, { method: "GET" });

    const cached = new Response(resp.body, resp);

    cached.headers.set("Cache-Control", `s-maxage=${COUNTS_CACHE_TTL}`);

    ctx.waitUntil(cache.put(cacheKey, cached.clone()));

    resp = cached;

  } else {

    resp = new Response(resp.body, resp);

  }

  // counts can be cached; but still safe to expose

  resp.headers.set("Access-Control-Allow-Origin", "*");

  return resp;

}

  

async function getCounts(ctx) {

  const resp = await fetchCountsWithEdgeCache(ctx, COUNTS_URL);

  return JSON.parse(await resp.text());

}

  

async function fetchBinaryFromMirror(request, ctx, mirrorUrl, { noStore, extraHeaders }) {

  // Keep it simple: forward minimal headers

  const upstreamReq = new Request(mirrorUrl, {

    method: request.method === "HEAD" ? "HEAD" : "GET",

    headers: pickUpstreamHeaders(request.headers),

  });

  

  const upstreamResp = await fetch(upstreamReq);

  

  // Build response to client, without exposing mirror domain

  const resp = new Response(upstreamResp.body, upstreamResp);

  

  if (noStore) resp.headers.set("Cache-Control", "no-store");

  for (const [k, v] of Object.entries(extraHeaders || {})) {

    resp.headers.set(k, v);

  }

  return resp;

}

  

function pickUpstreamHeaders(headers) {

  const h = new Headers();

  const accept = headers.get("Accept");

  if (accept) h.set("Accept", accept);

  

  const range = headers.get("Range");

  if (range) h.set("Range", range);

  

  return h;

}

  

// unbiased crypto random in [min,max]

function randomInt(min, max) {

  const range = max - min + 1;

  const maxUint = 0xffffffff;

  const bucketSize = Math.floor((maxUint + 1) / range) * range;

  

  let x;

  do {

    const arr = new Uint32Array(1);

    crypto.getRandomValues(arr);

    x = arr[0];

  } while (x >= bucketSize);

  

  return min + (x % range);

}
```

最后在snippets里的片段规则写下合适的片段规则即可使用~

---

2026，服务器别炸了！


  [1]: https://blog.furry.ist/usr/uploads/2026/01/2242067516.png
