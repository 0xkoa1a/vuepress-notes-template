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
make export PAGE=parallel/DeepEP.md  # 导出单篇自包含 HTML
make test     # 类型检查、单元测试、站点构建和 file:// 导出回归
make preview  # 启动本地增量预览
make clean    # 清理 _site/ 与 VuePress 缓存
```

## 导出单篇 HTML

单篇笔记可以导出为一个可复制、可直接双击打开的 HTML 文件：

```bash
make export PAGE=parallel/DeepEP.md
```

默认输出到 `_exports/parallel/DeepEP.html`。导出器只构建指定页面，将 Vue
运行时、组件代码、页面样式、KaTeX、Mermaid、ECharts 和本地图片全部内联，
保留正文与右侧 Outline；站点导航、搜索、上一篇/下一篇、更新时间和暗色模式
不会进入导出文件。文件头还会记录源 Markdown、Git commit、工作区是否有修改
和生成时间，便于追溯来源。

默认使用严格模式。导出器会：

1. 用语法树检查目标 Markdown 与站点 Vue/TypeScript 组件中的 `fetch`、
   WebSocket、Worker、动态 import 等运行时依赖；
2. 内联构建产物中的图片、字体、音视频、CSS 与 JavaScript，并审计残留 URL；
3. 在 HTML 最前面加入离线 Content Security Policy 和运行时网络守卫。即使
   第三方依赖中存在无法由静态分析判断的动态分支，也不会静默联网。

如果能够确定的外部依赖仍然存在，严格导出会失败。确实需要联网组件时可以显式
放宽：

```bash
make export PAGE=path/to/note.md ALLOW_EXTERNAL=1
```

非严格模式不会加入断网 CSP/运行时守卫，并会列出允许保留的依赖。普通超链接
不会被抓取；指向其他站内页面的链接离线时也可能不可用，导出器会单独列出。

静态分析无法数学上证明任意第三方 JavaScript 的所有运行分支，因此严格模式的
承诺是“可解析资源全部内联，并在运行时禁止外部访问”，不是仅凭扫描宣称任意
组件绝对离线。若 Vue 组件确实需要动态取数，应把数据改为本地内嵌，或明确使用
`ALLOW_EXTERNAL=1`。

导出只启用目标页面实际使用的 Mermaid/ECharts 支持。当前模板的纯 Markdown
示例约 1.6 MiB，同时包含 Mermaid 与 ECharts 的测试页约 6.1 MiB；实际大小取决
于组件和资源，命令会打印 JavaScript、CSS 和最终 HTML 体积。

## GitHub Pages

`.github/workflows/deploy-pages.yml` 会在推送到 `main` 后运行内容检查、
TypeScript/Vue 类型检查、单元测试、站点构建和 Chromium `file://` 导出回归，
全部通过后才部署。build job 只有仓库读取权限，Pages 和 OIDC 写权限只授予 deploy
job；Actions 固定到 commit SHA。

首次使用时，在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。
Dependabot 每周检查 npm 与 Actions 更新，独立的安全工作流每周运行
`pnpm audit --audit-level=moderate`，不会因注册表的临时状态阻塞正常部署。

## 写作与呈现

Markdown 负责知识内容，Mermaid 负责简单关系，Vue 负责复杂表现和交互。
Agent 的内容保护、组件组织与验证规则见 [AGENTS.md](./AGENTS.md)。

模板附带 [clear-writing-and-visuals Skill](./clear-writing-and-visuals/SKILL.md)，
用于规划、撰写和 Review 文档，涵盖内容取舍、语言、图示、维度和数据依赖的表达。
使用时可请 Agent 按该 Skill 工作；也可以将整个 `clear-writing-and-visuals/`
目录复制到 Codex 的 `~/.codex/skills/` 中复用。
