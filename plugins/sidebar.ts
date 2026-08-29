import path from "node:path"

import type {
  SidebarGroupOptions,
  SidebarOptions,
} from "@vuepress/theme-default"

import { displayName, listNoteFiles, readNoteFile } from "../lib/content.js"

type PageMeta = {
  link: string
  order: number
  relativePath: string
  title: string
}

const sortPages = (pages: PageMeta[]): PageMeta[] =>
  [...pages].sort(
    (left, right) =>
      left.order - right.order || left.title.localeCompare(right.title, "zh-CN"),
  )

export function createSidebar(sourceDir: string): SidebarOptions {
  const pages = listNoteFiles(sourceDir).map((relativePath): PageMeta => {
    const note = readNoteFile(sourceDir, relativePath)
    return {
      link: `/${relativePath.replace(/\.md$/iu, ".html")}`,
      order: note.order,
      relativePath,
      title: note.title ?? path.basename(relativePath, path.extname(relativePath)),
    }
  })
  const rootPages = sortPages(
    pages.filter(
      (page) =>
        !page.relativePath.includes("/") &&
        page.relativePath.toLowerCase() !== "index.md",
    ),
  )
  const sectionNames = [
    ...new Set(
      pages
        .filter((page) => page.relativePath.includes("/"))
        .map((page) => page.relativePath.split("/", 1)[0]),
    ),
  ].sort((left, right) => left.localeCompare(right, "zh-CN"))
  const sections: SidebarGroupOptions[] = sectionNames.map((section) => ({
    text: displayName(section),
    collapsible: true,
    children: sortPages(
      pages.filter((page) => page.relativePath.startsWith(`${section}/`)),
    ).map((page) => ({ text: page.title, link: page.link })),
  }))

  return [
    ...rootPages.map((page) => ({ text: page.title, link: page.link })),
    ...sections,
  ]
}
