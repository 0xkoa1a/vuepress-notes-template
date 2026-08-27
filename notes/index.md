---
title: "My Notes"
---

# My Notes

这是知识库首页。编辑根目录的 `site.config.ts` 设置站点名称、描述和导航，
然后直接在 `notes/` 下新增 Markdown 笔记。

## 开始写作

每篇笔记应包含 `title`；可选的 `order` 控制同一分组中的排序：

```markdown
---
title: "示例笔记"
order: 1
---

# 示例笔记

正文从这里开始。
```

顶层目录会自动成为左侧导航分组，无需修改 VuePress 配置。
