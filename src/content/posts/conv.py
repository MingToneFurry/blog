import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

# ---------- 配置 ----------
TZ = timezone(timedelta(hours=8))  # 中国时区
# --------------------------

def ts_to_iso(ts):
    try:
        return datetime.fromtimestamp(int(ts), tz=TZ).isoformat()
    except Exception:
        return ""

def strip_markdown_hint(text):
    if not text:
        return ""
    return re.sub(r"^\s*<!--markdown-->\s*", "", text, flags=re.IGNORECASE)

def safe_filename(name):
    if not name:
        return "untitled"
    name = name.strip()
    name = re.sub(r"[\\/:*?\"<>|]", "-", name)
    name = re.sub(r"-{2,}", "-", name)
    return name or "untitled"

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def build_post_md(row):
    title = row.get("title", "").strip()
    safe_title = title.replace('"', '\\"')

    created = ts_to_iso(row.get("created"))
    updated = ts_to_iso(row.get("modified")) or created
    body = strip_markdown_hint(row.get("text", ""))

    fm = [
        "---",
        f'title: "{safe_title}"',
        f"published: {created}",
        f"updated: {updated}",
        'description: ""',
        "tags: []",
        'category: "未分类"',
        'image: ""',
        "---",
        "",
    ]
    return "\n".join(fm) + body.strip() + "\n"

def build_page_md(row):
    title = row.get("title", "").strip()
    safe_title = title.replace('"', '\\"')
    body = strip_markdown_hint(row.get("text", ""))

    fm = [
        "---",
        f'title: "{safe_title}"',
        "---",
        "",
    ]
    return "\n".join(fm) + body.strip() + "\n"

def main():
    if len(sys.argv) < 3:
        print("用法：python conv.py typecho.json 输出目录")
        return

    json_file = sys.argv[1]
    out_dir = sys.argv[2]

    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    contents = None
    for item in data:
        if item.get("type") == "table" and item.get("name") == "typecho_contents":
            contents = item.get("data", [])
            break

    if contents is None:
        print("❌ 没找到 typecho_contents")
        return

    post_count = 0
    page_count = 0

    for row in contents:
        t = row.get("type")
        status = row.get("status")

        if status != "publish":
            continue

        slug = safe_filename(row.get("slug") or str(row.get("cid")))

        if t == "post":
            md = build_post_md(row)
            out = os.path.join(out_dir, f"{slug}.md")
            write_file(out, md)
            post_count += 1

        elif t == "page":
            md = build_page_md(row)
            out = os.path.join(out_dir, f"{slug}.md")
            write_file(out, md)
            page_count += 1

    print(f"✅ 转换完成：文章 {post_count} 篇，页面 {page_count} 个")

if __name__ == "__main__":
    main()
