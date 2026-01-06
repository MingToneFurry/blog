---
title: "对于Typecho动态内容的防护规则"
published: 2025-07-06T15:55:00+08:00
updated: 2025-07-16T13:55:11+08:00
description: ""
tags: []
category: "未分类"
image: ""
---
# Typecho 动态内容安全防护全攻略  
—— **防御 CC 攻击实战与规则设计**

> **温馨提示**：本文专为 Typecho 博客系统编写，其他平台可参考思路进行适当调整。

---

## 📖 前言

在[上一篇文章](https://blog.furry.ist/2025/07/05/typecho%E5%9C%A8cloudflare%E7%9A%84%E7%BC%93%E5%AD%98%E8%A7%84%E5%88%99.html)中，我们已完成缓存配置。本篇将进一步讲解如何通过 **Cloudflare WAF 自定义规则**保护 Typecho 博客动态内容，抵御 CC 攻击和后台爆破风险。

---

## 🚨 什么是 CC 攻击？

CC 攻击（Challenge Collapsar）是一种常见的 DDoS 攻击，主要特点：

- 模拟正常用户访问，发送大量 HTTP 请求
- 消耗服务器资源（CPU、内存、带宽）
- 导致服务器宕机或服务异常

攻击目标通常为动态页面，如后台、搜索页面等。

```
https://blog.furry.ist/admin/
https://blog.furry.ist/search/
```

与传统网络层攻击相比，CC 攻击针对应用层，隐蔽性更高。

---

## 🌐 Cloudflare 防护优势

Cloudflare 提供强大的 CC 防护服务，常见的验证界面示例如下：

![Cloudflare验证（正在验证...）](https://blog.furry.ist/usr/uploads/2025/07/243914843.png)

接下来，我们将实战配置 Cloudflare WAF 的三大核心规则。

---

# 🛡 实战配置：三大核心规则

## 🔍 规则一：放行搜索引擎爬虫

- **名称**：放行搜索引擎爬虫
- **规则表达式**：`(cf.client.bot)`
- **操作**：跳过所有自定义规则
- **作用**：确保搜索引擎正常收录内容。

---

## 🔐 规则二：后台安全防护

- **名称**：后台防护
- **规则表达式**：
```
(http.request.full_uri wildcard "https://你的域名/admin/*")
```
- **操作**：交互式质询（点击验证按钮）[注：嫌麻烦可以用托管质询]
- **作用**：防止后台被爆破或恶意扫描。

**效果示例**：
![Cloudflare验证（请完成以下操作，验证您是真人）](https://blog.furry.ist/usr/uploads/2025/07/3177903241.png)

> ⚠️ 请将表达式中的 `你的域名` 替换为实际域名。

---

## 🚫 规则三：爬虫与高风险IP拦截
[注:此规则为我从互联网收集来，现找不到原出处，知道的可以在评论区吱一声]
- **名称**：爬虫与高风险IP拦截规则
- **规则表达式**：
```
(ip.geoip.asnum in {59055 59054 59053 59052 59051 59028 45104 45103 45102 37963 34947 211914 134963 63727 63655 61348 55990 269939 265443 206798 206204 200756 149167 141180 140723 139144 139124 136907 131444 45090 137876 133478 132591 132203}) or (http.user_agent contains "80legs") or (http.user_agent contains "Abonti") or (http.user_agent contains "admantx") or (http.user_agent contains "aipbot") or (http.user_agent contains "AllSubmitter") or (http.user_agent contains "Backlink") or (http.user_agent contains "backlink") or (http.user_agent contains "Badass") or (http.user_agent contains "Bigfoot") or (http.user_agent contains "blexbot") or (http.user_agent contains "Buddy") or (http.user_agent contains "CherryPicker") or (http.user_agent contains "cloudsystemnetwork") or (http.user_agent contains "cognitiveseo") or (http.user_agent contains "Collector") or (http.user_agent contains "cosmos") or (http.user_agent contains "CrazyWebCrawler") or (http.user_agent contains "Crescent") or (http.user_agent contains "Devil") or (http.user_agent contains "spider") or (http.user_agent contains "stat") or (http.user_agent contains "Appender") or (http.user_agent contains "Crawler") or (http.user_agent contains "DittoSpyder") or (http.user_agent contains "Konqueror") or (http.user_agent contains "Easou") or (http.user_agent contains "Yisou") or (http.user_agent contains "Etao") or (http.user_agent contains "mail" and http.user_agent contains "olf") or (http.user_agent contains "exabot.com") or (http.user_agent contains "getintent") or (http.user_agent contains "Grabber") or (http.user_agent contains "GrabNet") or (http.user_agent contains "HEADMasterSEO") or (http.user_agent contains "heritrix") or (http.user_agent contains "htmlparser") or (http.user_agent contains "hubspot") or (http.user_agent contains "Jyxobot") or (http.user_agent contains "kraken") or (http.user_agent contains "larbin") or (http.user_agent contains "ltx71") or (http.user_agent contains "leiki") or (http.user_agent contains "LinkScan") or (http.user_agent contains "Magnet") or (http.user_agent contains "Mag-Net") or (http.user_agent contains "Mechanize") or (http.user_agent contains "MegaIndex") or (http.user_agent contains "Metasearch") or (http.user_agent contains "MJ12bot") or (http.user_agent contains "moz.com") or (http.user_agent contains "Navroad") or (http.user_agent contains "Netcraft") or (http.user_agent contains "niki-bot") or (http.user_agent contains "NimbleCrawler") or (http.user_agent contains "Nimbostratus") or (http.user_agent contains "Ninja") or (http.user_agent contains "Openfind") or (http.user_agent contains "Analyzer") or (http.user_agent contains "Pixray") or (http.user_agent contains "probethenet") or (http.user_agent contains "proximic") or (http.user_agent contains "psbot") or (http.user_agent contains "RankActive") or (http.user_agent contains "RankingBot") or (http.user_agent contains "RankurBot") or (http.user_agent contains "Reaper") or (http.user_agent contains "SalesIntelligent") or (http.user_agent contains "Semrush") or (http.user_agent contains "SEOkicks") or (http.user_agent contains "spbot") or (http.user_agent contains "SEOstats") or (http.user_agent contains "Snapbot") or (http.user_agent contains "Stripper") or (http.user_agent contains "Siteimprove") or (http.user_agent contains "sitesell") or (http.user_agent contains "Siphon") or (http.user_agent contains "Sucker") or (http.user_agent contains "TenFourFox") or (http.user_agent contains "TurnitinBot") or (http.user_agent contains "trendiction") or (http.user_agent contains "twingly") or (http.user_agent contains "VidibleScraper") or (http.user_agent contains "WebLeacher") or (http.user_agent contains "WebmasterWorldForum") or (http.user_agent contains "webmeup") or (http.user_agent contains "Webster") or (http.user_agent contains "Widow") or (http.user_agent contains "Xaldon") or (http.user_agent contains "Xenu") or (http.user_agent contains "xtractor") or (http.user_agent contains "Zermelo")
```
- **操作**：托管质询（Cloudflare 自动判定是否显示验证码）

**作用**：有效拦截恶意爬虫及高风险 IP 访问。

---

## 🔖 规则四：全站动态内容防护（可选）
[注:为保证用户体验建议平常不开，当你的站点遭受严重的CC攻击时开启即可，或是开始 I'm under attack 模式]

- **名称**：全站安全防护
- **规则表达式**：`(ip.src ne 127.0.0.1)`
- **操作**：托管质询
- **作用**：为所有访客开启自动验证，有效阻挡 CC 攻击。

---

# ⏱ 进阶建议：速率限制（可选）

速率限制规则通过设定同一访客单位时间内的访问频率来防御刷流量和暴力请求。

- **名称**：限速
- **表达式**：`(http.request.uri.path wildcard "*")`
- **特征**：同一 IP
- **阈值**：10 秒内超过 350 次请求
- **操作**：阻止，持续 10 秒

> ⚠️ 阈值需结合实际访问情况进行调整。

---

## 📌 总结与交流

完成以上配置后，Typecho 博客的动态内容将具备强大防护能力，抵御 CC 攻击无忧。如有疑问或更佳建议，欢迎在评论区留言交流！

*本文经 AI 优化*
