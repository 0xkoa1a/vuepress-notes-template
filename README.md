# VuePress Notes Template

一个可直接克隆的个人知识库模板，使用 VuePress 2、Vue 3、Vite 和 default
theme。模板内置自动侧栏、全文搜索、KaTeX、Mermaid、ECharts、宽屏文章布局、
右侧文章目录、暗色模式和 GitHub Pages 部署。

## 使用模板

在 GitHub 点击 **Use this template** 创建仓库，或直接克隆后修改远端：

```bash
git clone https://github.com/0xkoa1a/vuepress-notes-template.git my-notes
cd my-notes
fnm use
corepack enable
make install
make preview
```

在 `site.config.ts` 修改站点名称、描述和顶部导航。GitHub Actions 会根据新
仓库名称自动计算 Pages base，无需手工同步仓库名。

## 新增笔记

站点内容统一放在 `notes/`。每篇 Markdown 需要标题元数据和同名一级标题：

```markdown
---
title: "笔记标题"
order: 1
---

# 笔记标题

正文从这里开始。
```

`notes/` 下的顶层目录会自动成为侧栏分组，目录内的 Markdown 会递归发现并按
`order`、标题排序。根目录页面直接显示在侧栏中。图片可以放在笔记旁的
`images/` 目录并使用相对路径引用。

## 常用命令

```bash
make check    # 检查 Node、pnpm、VuePress 和 Markdown 标题
make install  # 按 pnpm-lock.yaml 安装依赖
make render   # 完整生成 _site/index.html
make preview  # 启动本地增量预览
make clean    # 清理 _site/ 与 VuePress 缓存
```

## GitHub Pages

`.github/workflows/deploy-pages.yml` 会在推送到 `main` 后构建并部署。首次使用
时，在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

## 写作与呈现

Markdown 负责知识内容，Mermaid 负责简单关系，Vue 负责复杂表现和交互。
Agent 的内容保护、组件组织与验证规则见 [AGENTS.md](./AGENTS.md)。
