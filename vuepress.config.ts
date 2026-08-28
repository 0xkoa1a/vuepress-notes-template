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
import { portableFileRouterPlugin } from "./plugins/portableExport.js"
import { siteConfig } from "./site.config.js"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const sourceDir = path.join(rootDir, "notes")
const isPortableExport = process.env.VUEPRESS_PORTABLE_EXPORT === "1"
const portablePage = process.env.VUEPRESS_EXPORT_PAGE
const portableClientConfig = path.join(
  rootDir,
  "notes/.vuepress/portable-client.ts",
)

if (isPortableExport && !portablePage) {
  throw new Error("VUEPRESS_EXPORT_PAGE is required for portable export")
}

const [repositoryOwner = "", repositoryName = ""] =
  process.env.GITHUB_REPOSITORY?.split("/") ?? []
const isUserSite =
  repositoryName.toLowerCase() === `${repositoryOwner.toLowerCase()}.github.io`
const base = (
  process.env.GITHUB_ACTIONS === "true" && repositoryName && !isUserSite
    ? `/${repositoryName}/`
    : "/"
) as `/${string}/`

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
  base: isPortableExport ? "/" : base,
  lang: siteConfig.lang,
  title: siteConfig.title,
  description: siteConfig.description,
  dest: isPortableExport
    ? process.env.VUEPRESS_EXPORT_DEST
    : path.join(rootDir, "_site"),
  temp: isPortableExport ? process.env.VUEPRESS_EXPORT_TEMP : undefined,
  cache: isPortableExport ? process.env.VUEPRESS_EXPORT_CACHE : undefined,
  pagePatterns: isPortableExport
    ? [portablePage as string]
    : ["**/*.md", "!**/README.md"],
  shouldPreload: isPortableExport ? false : undefined,
  shouldPrefetch: isPortableExport ? false : undefined,
  templateBuild: isPortableExport
    ? path.join(rootDir, "notes/.vuepress/templates/portable-build.html")
    : undefined,
  alias: {
    "@theme/VPPage.vue": path.join(
      rootDir,
      "notes/.vuepress/components/VPPage.vue",
    ),
  },
  bundler: viteBundler(
    isPortableExport
      ? {
          viteOptions: {
            plugins: [portableFileRouterPlugin()],
            build: {
              assetsInlineLimit: () => true,
              cssCodeSplit: false,
              modulePreload: false,
              rolldownOptions: {
                output: { codeSplitting: false },
              },
            },
          },
        }
      : undefined,
  ),
  theme: defaultTheme({
    colorMode: isPortableExport ? "light" : "auto",
    colorModeSwitch: !isPortableExport,
    navbar: isPortableExport ? false : siteConfig.navbar,
    sidebar: isPortableExport ? false : createSidebar(sourceDir),
    sidebarDepth: 0,
    contributors: false,
    lastUpdated: !isPortableExport,
    lastUpdatedText: isPortableExport ? undefined : "最近更新",
    editLink: false,
    themePlugins: {
      activeHeaderLinks: false,
      backToTop: !isPortableExport,
      git: !isPortableExport,
      linksCheck: !isPortableExport,
      mediumZoom: true,
      nprogress: !isPortableExport,
    },
  }),
  plugins: [
    ...(isPortableExport
      ? [
          {
            name: "portable-layout",
            clientConfigFile: portableClientConfig,
          },
        ]
      : []),
    activeHeaderLinksPlugin({
      headerLinkSelector: "a.vp-sidebar-item, a.vp-toc-link",
    }),
    markdownMathPlugin({ type: "katex" }),
    markdownExtPlugin({ tasklist: true }),
    markdownChartPlugin({
      echarts: true,
      mermaid: true,
    }),
    ...(isPortableExport
      ? []
      : [
          slimsearchPlugin({
            indexContent: true,
            filter: filterSearchPage,
            locales: {
              "/": { placeholder: "搜索文档" },
            },
          }),
        ]),
  ],
})
