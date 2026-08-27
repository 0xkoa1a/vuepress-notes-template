import path from "node:path"
import { fileURLToPath } from "node:url"

import { viteBundler } from "@vuepress/bundler-vite"
import { activeHeaderLinksPlugin } from "@vuepress/plugin-active-header-links"
import { markdownChartPlugin } from "@vuepress/plugin-markdown-chart"
import { markdownExtPlugin } from "@vuepress/plugin-markdown-ext"
import { markdownMathPlugin } from "@vuepress/plugin-markdown-math"
import { slimsearchPlugin } from "@vuepress/plugin-slimsearch"
import { defaultTheme } from "@vuepress/theme-default"
import { defineUserConfig } from "vuepress"

import { createSidebar } from "./plugins/sidebar.js"
import { siteConfig } from "./site.config.js"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const sourceDir = path.join(rootDir, "notes")

const [repositoryOwner = "", repositoryName = ""] =
  process.env.GITHUB_REPOSITORY?.split("/") ?? []
const isUserSite =
  repositoryName.toLowerCase() === `${repositoryOwner.toLowerCase()}.github.io`
const base =
  process.env.GITHUB_ACTIONS === "true" && repositoryName && !isUserSite
    ? `/${repositoryName}/`
    : "/"

// SlimSearch rc.131 currently traverses text below <pre> even though code is
// documented as excluded. Index a sanitized copy, then restore rendered HTML.
const filterSearchPage = (page: { contentRendered: string }): boolean => {
  const rendered = page.contentRendered
  page.contentRendered = rendered.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, "")
  queueMicrotask(() => {
    page.contentRendered = rendered
  })
  return true
}

export default defineUserConfig({
  base,
  lang: siteConfig.lang,
  title: siteConfig.title,
  description: siteConfig.description,
  dest: path.join(rootDir, "_site"),
  pagePatterns: ["**/*.md", "!**/README.md"],
  alias: {
    "@theme/VPPage.vue": path.join(
      rootDir,
      "notes/.vuepress/components/VPPage.vue",
    ),
  },
  bundler: viteBundler(),
  theme: defaultTheme({
    navbar: siteConfig.navbar,
    sidebar: createSidebar(sourceDir),
    sidebarDepth: 0,
    contributors: false,
    lastUpdatedText: "最近更新",
    editLink: false,
    themePlugins: {
      activeHeaderLinks: false,
      backToTop: true,
      mediumZoom: true,
    },
  }),
  plugins: [
    activeHeaderLinksPlugin({
      headerLinkSelector: "a.vp-sidebar-item, a.vp-toc-link",
    }),
    markdownMathPlugin({ type: "katex" }),
    markdownExtPlugin({ tasklist: true }),
    markdownChartPlugin({
      echarts: true,
      mermaid: true,
    }),
    slimsearchPlugin({
      indexContent: true,
      filter: filterSearchPage,
      locales: {
        "/": { placeholder: "搜索文档" },
      },
    }),
  ],
})
