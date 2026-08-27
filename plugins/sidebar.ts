import fs from "node:fs"
import path from "node:path"

import type { SidebarConfig, SidebarGroup } from "vuepress"

type PageMeta = {
  title: string
  order: number
  link: string
}

function unquote(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, "$2")
}

function displayName(value: string): string {
  return value
    .replace(/[-_]+/gu, " ")
    .replace(/\b\p{L}/gu, (character) => character.toUpperCase())
}

function readPage(sourceDir: string, relativePath: string): PageMeta {
  const content = fs.readFileSync(path.join(sourceDir, relativePath), "utf8")
  const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/u)?.[1] ?? ""
  const title = frontmatter.match(/^title:\s*(.+)$/mu)?.[1]?.trim()
  const order = frontmatter.match(/^order:\s*(\d+)$/mu)?.[1]

  return {
    title: title ? unquote(title) : path.basename(relativePath, ".md"),
    order: order ? Number.parseInt(order, 10) : Number.MAX_SAFE_INTEGER,
    link: `/${relativePath.replace(/\.md$/u, ".html")}`,
  }
}

function listMarkdownFiles(directory: string, prefix = ""): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".vuepress" || entry.name === "README.md") return []

    const relativePath = path.posix.join(prefix, entry.name)
    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return listMarkdownFiles(absolutePath, relativePath)
    }

    return entry.isFile() && entry.name.endsWith(".md") ? [relativePath] : []
  })
}

function sortPages(pages: PageMeta[]): PageMeta[] {
  return pages.sort(
    (left, right) =>
      left.order - right.order || left.title.localeCompare(right.title, "zh-CN"),
  )
}

function sectionGroup(sourceDir: string, directory: string): SidebarGroup | null {
  const pages = sortPages(
    listMarkdownFiles(path.join(sourceDir, directory), directory).map((file) =>
      readPage(sourceDir, file),
    ),
  )

  if (!pages.length) return null

  return {
    text: displayName(directory),
    collapsible: true,
    children: pages.map((page) => ({ text: page.title, link: page.link })),
  }
}

export function createSidebar(sourceDir: string): SidebarConfig {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
  const rootPages = sortPages(
    entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(".md") &&
          !["index.md", "README.md"].includes(entry.name),
      )
      .map((entry) => readPage(sourceDir, entry.name)),
  )
  const sections = entries
    .filter((entry) => entry.isDirectory() && entry.name !== ".vuepress")
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
    .map((entry) => sectionGroup(sourceDir, entry.name))
    .filter((group): group is SidebarGroup => group !== null)

  return [
    ...rootPages.map((page) => ({ text: page.title, link: page.link })),
    ...sections,
  ]
}
