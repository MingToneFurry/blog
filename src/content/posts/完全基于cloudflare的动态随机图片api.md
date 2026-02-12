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

![群友的回复](../assets/images/完全基于cloudflare的动态随机图片api.png)

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



> 请根据你的实际情况修改此脚本，别忘记替换 api.furry.ist imgmirror.furry.ist等替换为你自己的域名！ 



```js
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

const DEFAULT_PAD = 8; // 00000001

const EXT = ".webp";

  

// 设置一个长随机串；然后用 ?debug=你的串 来拿到详细错误（否则不泄露细节）

const DEBUG_TOKEN = "b7d0c1e7f4f14a0b9b1b9a2c0g8d8e77"; // e.g. "b7d0c1e7f4f14a0b9b1b9a2c0g8d8e77"

  

// /furry-img(/) 强制完全不缓存

const NO_CACHE_HEADERS = {

  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  "Surrogate-Control": "no-store",

};

  

let countsMemo = null;

let countsMemoExpiresAt = 0;

let countsMemoPromise = null;

  

export default {

  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    const path = url.pathname;

  

    const isCounts = path === "/counts.json";

    const isProxyImg = path.startsWith("/large/") || path.startsWith("/box/");

    // 兼容 /furry-img?x 与 /furry-img/?x（pathname 不含 query）

    const isRandom = path === "/furry-img" || path.startsWith("/furry-img/");

  

    // 其他 API 路径完全不干预

    if (!isCounts && !isProxyImg && !isRandom) {

      return fetch(request);

    }

  

    const debug = isDebug(url);

    const finalize = (resp) => (isRandom ? withNoCache(resp) : resp);

  

    try {

      if (request.method === "OPTIONS") {

        return finalize(handleOptions());

      }

      if (request.method !== "GET" && request.method !== "HEAD") {

        return finalize(methodNotAllowed());

      }

  

      // 1) counts.json (handy for debugging)

      if (isCounts) {

        const counts = await getCounts();

        return jsonResponse(counts, {

          cacheControl: `public, max-age=0, s-maxage=${COUNTS_CACHE_TTL}`,

          head: request.method === "HEAD",

        });

      }

  

      // 2) Proxy static images under api.furry.ist (NO redirect, keep same-domain)

      if (isProxyImg) {

        const mirrorUrl = `${MIRROR_ORIGIN}${path}${url.search}`;

        return fetchBinaryFromMirror(request, mirrorUrl, {

          noStore: false, // keep upstream cache headers

          extraHeaders: {

            "Access-Control-Allow-Origin": "*",

          },

        });

      }

  

      // 3) Random endpoint

      const q = url.searchParams;

  

      const format = (q.get("format") || "file").toLowerCase(); // json | file

      const redirect = (q.get("redirect") || "0").toLowerCase(); // 0 | 1

      const mode = (q.get("mode") || "auto").toLowerCase(); // auto | box | large

  

      if (!["json", "file"].includes(format)) {

        return finalize(badRequest("bad format", request.method === "HEAD"));

      }

      if (!["0", "1"].includes(redirect)) {

        return finalize(badRequest("bad redirect", request.method === "HEAD"));

      }

      if (!["auto", "box", "large"].includes(mode)) {

        return finalize(badRequest("bad mode", request.method === "HEAD"));

      }

  

      let counts;

      try {

        counts = await getCounts();

      } catch (e) {

        return finalize(serviceUnavailable("counts unavailable", request.method === "HEAD"));

      }

  

      const type = decideType(mode, request); // "large" | "box"

  

      const maxN = Number(counts && counts[type] != null ? counts[type] : 0);

      const pad = Number(counts && counts.pad != null ? counts.pad : DEFAULT_PAD);

  

      if (!Number.isFinite(maxN) || maxN <= 0) {

        return finalize(serviceUnavailable("empty library", request.method === "HEAD"));

      }

  

      const safePad = Number.isFinite(pad) && pad > 0 && pad < 64 ? pad : DEFAULT_PAD;

  

      const id = randomInt(1, maxN);

      const filename = `${String(id).padStart(safePad, "0")}${EXT}`;

      const filePath = `/${type}/${filename}`;

  

      const publicUrl = `${PUBLIC_ORIGIN}${filePath}`;

      const mirrorUrl = `${MIRROR_ORIGIN}${filePath}`;

  

      if (format === "json") {

        return finalize(

          jsonResponse(

            {

              url: publicUrl,

              type: type,

              filename: filename,

            },

            { cacheControl: "no-store", head: request.method === "HEAD" }

          )

        );

      }

  

      // format=file

      if (redirect === "1") {

        // stays on api.furry.ist by design + 强制不缓存

        return redirectNoCache(publicUrl, 302);

      }

  

      // redirect=0: direct binary response (no redirect)

      const bin = await fetchBinaryFromMirror(request, mirrorUrl, {

        noStore: true,

        extraHeaders: {

          "Access-Control-Allow-Origin": "*",

          "x-furry-img-type": type,

          "x-furry-img-file": filename,

        },

      });

      return finalize(bin);

    } catch (err) {

      return finalize(errorResponse(err, debug, request.method === "HEAD"));

    }

  },

};

  

function isDebug(url) {

  if (!DEBUG_TOKEN) return false;

  return url.searchParams.get("debug") === DEBUG_TOKEN;

}

  

function applyNoCache(headers) {

  for (const [k, v] of Object.entries(NO_CACHE_HEADERS)) headers.set(k, v);

}

function withNoCache(resp) {

  applyNoCache(resp.headers);

  return resp;

}

function redirectNoCache(url, status = 302) {

  const headers = new Headers();

  headers.set("Location", url);

  headers.set("Access-Control-Allow-Origin", "*");

  applyNoCache(headers);

  return new Response(null, { status, headers });

}

  

function handleOptions() {

  const headers = new Headers();

  headers.set("Access-Control-Allow-Origin", "*");

  headers.set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");

  headers.set("Access-Control-Allow-Headers", "Content-Type, Range");

  headers.set("Access-Control-Max-Age", "86400");

  return new Response(null, { status: 204, headers });

}

  

function methodNotAllowed() {

  const headers = new Headers();

  headers.set("Allow", "GET,HEAD,OPTIONS");

  headers.set("Access-Control-Allow-Origin", "*");

  headers.set("Cache-Control", "no-store");

  return new Response("method not allowed", { status: 405, headers });

}

  

function badRequest(msg, head) {

  const headers = new Headers();

  headers.set("Content-Type", "text/plain; charset=utf-8");

  headers.set("Cache-Control", "no-store");

  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(head ? null : msg, { status: 400, headers });

}

  

function serviceUnavailable(msg, head) {

  const headers = new Headers();

  headers.set("Content-Type", "text/plain; charset=utf-8");

  headers.set("Cache-Control", "no-store");

  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(head ? null : msg, { status: 503, headers });

}

  

function jsonResponse(obj, { cacheControl, head } = {}) {

  const headers = new Headers();

  headers.set("Content-Type", "application/json; charset=utf-8");

  headers.set("Access-Control-Allow-Origin", "*");

  headers.set("Cache-Control", cacheControl || "no-store");

  const body = head ? null : JSON.stringify(obj);

  return new Response(body, { status: 200, headers });

}

  

function errorResponse(err, debug, head) {

  const detail = errToString(err);

  const headers = new Headers();

  headers.set("Content-Type", "text/plain; charset=utf-8");

  headers.set("Cache-Control", "no-store");

  headers.set("Access-Control-Allow-Origin", "*");

  

  if (debug) {

    headers.set("x-snippet-error", detail.replace(/[\r\n]+/g, " ").slice(0, 1500));

    return new Response(head ? null : detail, { status: 500, headers });

  }

  return new Response(head ? null : "internal error", { status: 500, headers });

}

  

function errToString(err) {

  try {

    if (err && typeof err === "object" && typeof err.stack === "string") return err.stack;

    if (err && typeof err === "object" && typeof err.message === "string") return err.message;

    return String(err);

  } catch {

    return "unknown error";

  }

}

  

function decideType(mode, request) {

  if (mode === "large" || mode === "box") return mode;

  

  const ch = request.headers.get("Sec-CH-UA-Mobile");

  if (ch) return ch.includes("?1") ? "box" : "large";

  

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

  

async function getCounts() {

  const now = Date.now();

  if (countsMemo && now < countsMemoExpiresAt) return countsMemo;

  if (countsMemoPromise) return countsMemoPromise;

  

  const stale = countsMemo;

  

  countsMemoPromise = (async () => {

    const resp = await fetch(COUNTS_URL, { method: "GET" });

    if (!resp.ok) throw new Error(`counts fetch failed: ${resp.status}`);

    const text = await resp.text();

    const json = safeJsonParse(text);

    if (!json || typeof json !== "object") throw new Error("counts json is not an object");

    return json;

  })();

  

  try {

    const fresh = await countsMemoPromise;

    countsMemo = fresh;

    countsMemoExpiresAt = Date.now() + COUNTS_CACHE_TTL * 1000;

    return fresh;

  } catch (err) {

    if (stale) return stale;

    throw err;

  } finally {

    countsMemoPromise = null;

  }

}

  

function safeJsonParse(text) {

  try {

    return JSON.parse(text);

  } catch {

    throw new Error(`counts json parse failed (first 120 bytes): ${String(text).slice(0, 120)}`);

  }

}

  

async function fetchBinaryFromMirror(request, mirrorUrl, { noStore, extraHeaders }) {

  const upstreamReq = new Request(mirrorUrl, {

    method: request.method === "HEAD" ? "HEAD" : "GET",

    headers: pickUpstreamHeaders(request.headers),

  });

  

  const upstreamResp = await fetch(upstreamReq);

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

  

  const inm = headers.get("If-None-Match");

  if (inm) h.set("If-None-Match", inm);

  

  const ims = headers.get("If-Modified-Since");

  if (ims) h.set("If-Modified-Since", ims);

  

  return h;

}

  

// unbiased crypto random in [min,max] (fallback to Math.random if crypto missing)

function randomInt(min, max) {

  const range = max - min + 1;

  if (!Number.isFinite(range) || range <= 0) return min;

  

  const cryptoObj = typeof crypto !== "undefined" ? crypto : null;

  if (

    cryptoObj &&

    typeof cryptoObj.getRandomValues === "function" &&

    typeof Uint32Array !== "undefined"

  ) {

    const maxUint = 0xffffffff;

    const bucketSize = Math.floor((maxUint + 1) / range) * range;

  

    let x;

    do {

      const arr = new Uint32Array(1);

      cryptoObj.getRandomValues(arr);

      x = arr[0];

    } while (x >= bucketSize);

  

    return min + (x % range);

  }

  

  return min + Math.floor(Math.random() * range);

}
```



最后在snippets里的片段规则写下合适的片段规则即可使用~



---



2026，服务器别炸了！

