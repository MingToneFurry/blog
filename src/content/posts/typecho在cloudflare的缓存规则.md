---
title: "typecho在cloudflare的缓存规则"
published: 2025-07-05T23:44:00+08:00
updated: 2025-10-28T21:30:38+08:00
description: ""
tags: []
category: "未分类"
image: ""
---
# 使用 Cloudflare CDN 后访问速度变慢？
## 教你自定义缓存规则解决问题

使用 Cloudflare CDN 后，是否遇到网站打开速度缓慢，或使用 itdog 等测速工具时，看到一片“中国红”？这通常由以下两种原因导致：

1. **Cloudflare 分配的 IP 被墙或速度慢**
2. **默认缓存设置不当，Cloudflare 默认只缓存部分文件**

本文主要讲解如何通过**自定义缓存规则**解决第二个问题。关于 IP 优选方法，请参考：[二叉树树的博客](https://www.afo.im/posts/cf-fastip/)。

---

## 一、了解缓存的作用

缓存是指 CDN 服务商将你网站的文件存储到全球各地服务器，当用户访问时直接从 CDN 节点返回缓存内容，提升网站响应速度。

由于 Typecho 为动态博客系统，**需要绕过所有动态页面，仅缓存静态资源**。

- **动态资源**：Typecho 后台、评论区、各文章主页面（需实时显示评论）
- **静态资源**：CSS、JS、图片等静态文件

---

## 二、自定义缓存规则

### 1\. 设置缓存所有内容

进入 Cloudflare 后台，选择对应域名，点击左侧**缓存**中的 **Cache Rules**：
![CacheRules点开位置][2]
- 点击 **创建规则**。
![创建规则按钮样貌][3]
- 输入规则名称，选择 **所有传入请求**。
![选择后的样子如图][4]
- 设置选项：
  - 缓存资格：**符合缓存条件**
  - 边缘 TTL：**忽略缓存控制表头，使用此 TTL**
  - TTL 时间：推荐输入 **1个月**（可根据需求调整）

> **注意**：若你的网站主题在不同设备有不同显示效果，请启用**缓存密钥**中的“缓存欺骗盔甲”和“按设备类型缓存”。

完成设置后，保存即可。

---

### 2\. 设置绕过缓存动态资源

再次创建缓存规则，输入自定义规则名称，点击**编辑表达式**，输入以下内容（将 `example.com` 替换为你的域名）：
![编辑表达式长这个样子哦~][5]

```
(http.request.uri.path contains "/admin" and http.host contains "example.com")
or (http.request.full_uri contains "comment" and http.host contains "example.com")
or (http.request.uri.path contains "/comment" and http.host contains "example.com")
or (http.host contains "example.com" and http.request.uri.path contains "/search")
or (http.host contains "example.com" and ends_with(http.request.full_uri, "html"))
or (http.host contains "example.com" and ends_with(http.request.full_uri, "/"))
```

缓存规则选择**绕过缓存**，保存即可。

---

## 三、其他优化建议

建议在动态区域结合 WAF 防火墙策略，以抵御 CC 攻击或其他安全威胁。如有需求，请留言交流。

> 注：本站首页访问较慢是因为使用了大量未缓存的动态图片加载接口，属于正常现象。

---

如有疑问，欢迎留言讨论！
[1]: https://www.afo.im/posts/cf-fastip/  
[2]: https://blog.furry.ist/usr/uploads/2025/07/218512458.png  
[3]: https://blog.furry.ist/usr/uploads/2025/07/2706739313.png  
[4]: https://blog.furry.ist/usr/uploads/2025/07/688472878.png  
[5]: https://blog.furry.ist/usr/uploads/2025/07/2567014499.png
