#!/usr/bin/env node

import { spawn } from "node:child_process"
import { constants as fsConstants } from "node:fs"
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.dirname(scriptDir)
const sourceDir = path.join(rootDir, "notes")
const portableRouteSentinel = "/__VUEPRESS_PORTABLE_TARGET__.html"
const packageJson = JSON.parse(
  await readFile(path.join(rootDir, "package.json"), "utf8"),
)

function fail(message) {
  throw new Error(message)
}

function parseArguments(argv) {
  const result = { allowExternal: false, output: null, page: null }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--") {
      continue
    } else if (argument === "--allow-external") {
      result.allowExternal = true
    } else if (argument === "--page") {
      result.page = argv[++index] ?? fail("--page 需要 Markdown 路径")
    } else if (argument === "--output") {
      result.output = argv[++index] ?? fail("--output 需要 HTML 路径")
    } else if (!argument.startsWith("-") && !result.page) {
      result.page = argument
    } else {
      fail(`未知参数：${argument}`)
    }
  }

  if (!result.page) {
    fail("缺少页面路径，例如：pnpm export:page -- parallel/DeepEP.md")
  }
  return result
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

async function ensureFile(filePath) {
  await access(filePath, fsConstants.R_OK)
  if (!(await stat(filePath)).isFile()) fail(`不是文件：${filePath}`)
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(absolute)))
    else if (entry.isFile()) files.push(absolute)
  }
  return files
}

function toPosix(value) {
  return value.split(path.sep).join("/")
}

function pageRouteFromHtml(buildDir, htmlPath) {
  const relative = toPosix(path.relative(buildDir, htmlPath))
  if (relative === "index.html") return "/"
  if (relative.endsWith("/index.html")) {
    return `/${relative.slice(0, -"index.html".length)}`
  }
  return `/${relative}`
}

function replaceAsync(value, pattern, replacer) {
  const matches = [...value.matchAll(pattern)]
  if (!matches.length) return Promise.resolve(value)
  return Promise.all(matches.map((match) => replacer(...match))).then((replacements) => {
    let cursor = 0
    let output = ""
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index]
      output += value.slice(cursor, match.index) + replacements[index]
      cursor = match.index + match[0].length
    }
    return output + value.slice(cursor)
  })
}

const mimeTypes = new Map([
  [".avif", "image/avif"],
  [".css", "text/css"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".ogg", "audio/ogg"],
  [".otf", "font/otf"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
])

function splitUrl(value) {
  const match = value.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/u)
  return {
    fragment: match?.[3] ?? "",
    pathname: match?.[1] ?? value,
    query: match?.[2] ?? "",
  }
}

function isExternalUrl(value) {
  return /^(?:https?:)?\/\//iu.test(value)
}

function isSpecialUrl(value) {
  return /^(?:data:|blob:|mailto:|tel:|javascript:|#)/iu.test(value)
}

async function resolveLocalAsset(value, baseDirectory, buildDirectory) {
  if (!value || isExternalUrl(value) || isSpecialUrl(value)) return null
  if (/^[a-z][a-z\d+.-]*:/iu.test(value)) return null

  const { fragment, pathname: rawPathname } = splitUrl(value)
  let pathname
  try {
    pathname = decodeURIComponent(rawPathname)
  } catch {
    pathname = rawPathname
  }

  const candidate = pathname.startsWith("/")
    ? path.resolve(buildDirectory, `.${pathname}`)
    : path.resolve(baseDirectory, pathname)
  if (!isInside(buildDirectory, candidate)) return null

  try {
    if (!(await stat(candidate)).isFile()) return null
  } catch {
    return null
  }

  return { filePath: candidate, fragment }
}

async function assetToDataUrl(asset) {
  const content = await readFile(asset.filePath)
  const mimeType =
    mimeTypes.get(path.extname(asset.filePath).toLowerCase()) ??
    "application/octet-stream"
  return `data:${mimeType};base64,${content.toString("base64")}${asset.fragment}`
}

async function inlineCssUrls(css, cssFile, buildDirectory, unresolved) {
  const cssDirectory = path.dirname(cssFile)
  for (const match of css.matchAll(/@import\s+(["'])(.*?)\1/giu)) {
    const value = match[2].trim()
    if (!value || isSpecialUrl(value)) continue
    unresolved.add(`CSS @import ${value}`)
  }

  return replaceAsync(
    css,
    /url\(\s*(?:(['"])(.*?)\1|([^)'"\s][^)]*?))\s*\)/giu,
    async (fullMatch, _quote, quotedValue, bareValue) => {
      const value = (quotedValue ?? bareValue ?? "").trim()
      if (!value || isSpecialUrl(value)) return fullMatch
      if (isExternalUrl(value)) {
        unresolved.add(`CSS 外部资源 ${value}`)
        return fullMatch
      }
      const asset = await resolveLocalAsset(value, cssDirectory, buildDirectory)
      if (!asset) {
        unresolved.add(`CSS url(${value})`)
        return fullMatch
      }
      return `url("${await assetToDataUrl(asset)}")`
    },
  )
}

async function inlineAttributeValue(
  value,
  htmlDirectory,
  buildDirectory,
  unresolved,
) {
  if (isSpecialUrl(value) || isExternalUrl(value)) return value
  const asset = await resolveLocalAsset(value, htmlDirectory, buildDirectory)
  if (!asset) {
    unresolved.add(value)
    return value
  }
  return assetToDataUrl(asset)
}

async function inlineSrcset(
  value,
  htmlDirectory,
  buildDirectory,
  unresolved,
) {
  const candidates = value.split(",")
  const inlined = await Promise.all(
    candidates.map(async (candidate) => {
      const match = candidate.trim().match(/^(\S+)(\s+.*)?$/u)
      if (!match) return candidate
      const url = await inlineAttributeValue(
        match[1],
        htmlDirectory,
        buildDirectory,
        unresolved,
      )
      return `${url}${match[2] ?? ""}`
    }),
  )
  return inlined.join(", ")
}

async function inlineResourceTags(html, htmlPath, buildDirectory, unresolved) {
  const htmlDirectory = path.dirname(htmlPath)
  const resourceTagPattern =
    /<(?:img|source|video|audio|track|input|embed|object|use)\b[^>]*>/giu

  return replaceAsync(html, resourceTagPattern, async (tag) => {
    let output = await replaceAsync(
      tag,
      /\b(src|poster|data|href|xlink:href)\s*=\s*(["'])(.*?)\2/giu,
      async (_attribute, name, quote, value) =>
        `${name}=${quote}${await inlineAttributeValue(
          value,
          htmlDirectory,
          buildDirectory,
          unresolved,
        )}${quote}`,
    )
    output = await replaceAsync(
      output,
      /\bsrcset\s*=\s*(["'])(.*?)\1/giu,
      async (_attribute, quote, value) =>
        `srcset=${quote}${await inlineSrcset(
          value,
          htmlDirectory,
          buildDirectory,
          unresolved,
        )}${quote}`,
    )
    return output
  })
}

function escapeClosingTag(value, tagName) {
  return value.replace(new RegExp(`</${tagName}`, "giu"), `<\\/${tagName}`)
}

async function inlineBuildResources(html, htmlPath, buildDirectory, route) {
  const unresolved = new Set()
  const htmlDirectory = path.dirname(htmlPath)

  const stylesheetLinks = [
    ...html.matchAll(
      /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/giu,
    ),
  ]
  for (const match of stylesheetLinks) {
    const asset = await resolveLocalAsset(match[1], htmlDirectory, buildDirectory)
    if (!asset) {
      unresolved.add(`stylesheet ${match[1]}`)
      continue
    }
    let css = await readFile(asset.filePath, "utf8")
    css = await inlineCssUrls(css, asset.filePath, buildDirectory, unresolved)
    html = html.replace(
      match[0],
      () => `<style>${escapeClosingTag(css, "style")}</style>`,
    )
  }

  html = html.replace(
    /<link\b(?=[^>]*\brel=["'](?:modulepreload|preload|prefetch)["'])[^>]*>/giu,
    "",
  )

  html = await inlineResourceTags(html, htmlPath, buildDirectory, unresolved)
  html = await replaceAsync(
    html,
    /<style\b[^>]*>([\s\S]*?)<\/style>/giu,
    async (fullMatch, css) => {
      const inlined = await inlineCssUrls(
        css,
        htmlPath,
        buildDirectory,
        unresolved,
      )
      return fullMatch.replace(css, () => escapeClosingTag(inlined, "style"))
    },
  )
  html = await replaceAsync(
    html,
    /\bstyle\s*=\s*(["'])(.*?)\1/giu,
    async (_fullMatch, quote, css) =>
      `style=${quote}${await inlineCssUrls(
        css,
        htmlPath,
        buildDirectory,
        unresolved,
      )}${quote}`,
  )

  const moduleScripts = [
    ...html.matchAll(
      /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["']([^"']+)["'])[^>]*><\/script>/giu,
    ),
  ]
  if (moduleScripts.length !== 1) {
    fail(`预期一个 VuePress 客户端入口，实际找到 ${moduleScripts.length} 个`)
  }
  for (const match of moduleScripts) {
    const asset = await resolveLocalAsset(match[1], htmlDirectory, buildDirectory)
    if (!asset) fail(`找不到客户端入口：${match[1]}`)
    let javascript = await readFile(asset.filePath, "utf8")
    if (!javascript.includes(portableRouteSentinel)) {
      fail("客户端入口缺少 portable route 标记，无法保证 file:// 路由")
    }
    const routeLiteral = JSON.stringify(route).slice(1, -1)
    javascript = javascript.replaceAll(portableRouteSentinel, () => routeLiteral)
    html = html.replace(
      match[0],
      () =>
        `<script type="module">${escapeClosingTag(javascript, "script")}</script>`,
    )
  }

  const additionalScripts = [
    ...html.matchAll(
      /<script\b(?=[^>]*\bsrc=["']([^"']+)["'])[^>]*><\/script>/giu,
    ),
  ]
  for (const match of additionalScripts) {
    const asset = await resolveLocalAsset(match[1], htmlDirectory, buildDirectory)
    if (!asset) {
      unresolved.add(`script ${match[1]}`)
      continue
    }
    const javascript = await readFile(asset.filePath, "utf8")
    html = html.replace(
      match[0],
      () => `<script>${escapeClosingTag(javascript, "script")}</script>`,
    )
  }

  return { html, unresolved }
}

function stripJavaScriptLiteralsAndComments(source) {
  let output = ""
  let index = 0
  let state = "code"
  let quote = ""
  const templates = []

  const mask = (character) => (character === "\n" ? "\n" : " ")

  while (index < source.length) {
    const character = source[index]
    const next = source[index + 1]

    if (state === "line-comment") {
      output += mask(character)
      if (character === "\n") state = "code"
      index += 1
      continue
    }
    if (state === "block-comment") {
      output += mask(character)
      if (character === "*" && next === "/") {
        output += " "
        index += 2
        state = "code"
      } else {
        index += 1
      }
      continue
    }
    if (state === "string") {
      output += mask(character)
      if (character === "\\") {
        if (next !== undefined) output += mask(next)
        index += 2
      } else {
        index += 1
        if (character === quote) state = "code"
      }
      continue
    }
    if (state === "template") {
      output += mask(character)
      if (character === "\\") {
        if (next !== undefined) output += mask(next)
        index += 2
      } else if (character === "`") {
        templates.pop()
        state = "code"
        index += 1
      } else if (character === "$" && next === "{") {
        output += " "
        templates[templates.length - 1].expressionDepth = 1
        state = "code"
        index += 2
      } else {
        index += 1
      }
      continue
    }

    if (character === "/" && next === "/") {
      output += "  "
      index += 2
      state = "line-comment"
    } else if (character === "/" && next === "*") {
      output += "  "
      index += 2
      state = "block-comment"
    } else if (character === '"' || character === "'") {
      output += " "
      quote = character
      index += 1
      state = "string"
    } else if (character === "`") {
      output += " "
      templates.push({ expressionDepth: null })
      index += 1
      state = "template"
    } else if (
      character === "{" &&
      templates.length > 0 &&
      templates.at(-1)?.expressionDepth !== null
    ) {
      templates[templates.length - 1].expressionDepth += 1
      output += character
      index += 1
    } else if (
      character === "}" &&
      templates.length > 0 &&
      templates.at(-1)?.expressionDepth !== null
    ) {
      templates[templates.length - 1].expressionDepth -= 1
      output += character
      index += 1
      if (templates[templates.length - 1].expressionDepth === 0) {
        templates[templates.length - 1].expressionDepth = null
        state = "template"
      }
    } else {
      output += character
      index += 1
    }
  }

  return output
}

function collectPortabilityIssues(html, unresolved) {
  const issues = new Set(unresolved)
  const documentMarkup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "<script></script>")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "<style></style>")
  const resourceTags =
    /<(?:script|link|img|source|video|audio|track|iframe|embed|object|use)\b[^>]*>/giu
  for (const tag of documentMarkup.match(resourceTags) ?? []) {
    for (const match of tag.matchAll(
      /\b(?:src|srcset|poster|data|href|xlink:href)\s*=\s*(["'])(.*?)\1/giu,
    )) {
      const value = match[2].trim()
      if (!value || isSpecialUrl(value)) continue
      if (isExternalUrl(value)) issues.add(`外部资源 ${value}`)
      else issues.add(`未内联资源 ${value}`)
    }
  }

  const scriptBodies = [
    ...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/giu),
  ].map((match) => match[1])
  for (const script of scriptBodies) {
    for (const match of script.matchAll(
      /\b(?:fetch|WebSocket|EventSource|Worker)\(\s*(["'])(.*?)\1/giu,
    )) {
      const value = match[2]
      if (!isSpecialUrl(value)) issues.add(`运行时资源 ${value}`)
    }
    if (/\bimport\s*\(/u.test(stripJavaScriptLiteralsAndComments(script))) {
      issues.add("仍存在动态 import()")
    }
  }

  return [...issues].sort()
}

function collectInternalLinks(html) {
  const links = new Set()
  const documentMarkup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "")
  for (const match of documentMarkup.matchAll(
    /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/giu,
  )) {
    const value = match[2].trim()
    if (
      value &&
      !isSpecialUrl(value) &&
      !isExternalUrl(value) &&
      !/^(?:mailto:|tel:)/iu.test(value)
    ) {
      links.add(value)
    }
  }
  return [...links].sort()
}

function escapeHtmlAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

async function runCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options })
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} 失败（code=${code}, signal=${signal}）`))
    })
  })
}

async function gitValue(args, fallback) {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd: rootDir, stdio: ["ignore", "pipe", "ignore"] })
    let output = ""
    child.stdout.on("data", (chunk) => {
      output += chunk
    })
    child.once("error", () => resolve(fallback))
    child.once("exit", (code) => resolve(code === 0 ? output.trim() : fallback))
  })
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const inputWithoutPrefix = options.page.replace(/^notes[\\/]/u, "")
  const sourcePath = path.resolve(sourceDir, inputWithoutPrefix)
  if (!isInside(sourceDir, sourcePath)) fail("页面路径必须位于 notes/ 内")
  if (path.extname(sourcePath).toLowerCase() !== ".md") fail("页面必须是 Markdown 文件")
  if (path.basename(sourcePath).toLowerCase() === "readme.md") {
    fail("README.md 不属于当前 VuePress pagePatterns，不能导出")
  }
  await ensureFile(sourcePath)

  const pageRelative = toPosix(path.relative(sourceDir, sourcePath))
  const defaultOutput = path.join(
    rootDir,
    "_exports",
    pageRelative.replace(/\.md$/iu, ".html"),
  )
  const outputPath = path.resolve(rootDir, options.output ?? defaultOutput)
  if (path.extname(outputPath).toLowerCase() !== ".html") {
    fail("导出目标必须是 .html 文件")
  }

  // Keep generated modules below the repository so their bare imports resolve
  // through this repository's node_modules, while still isolating every run.
  const workDirectory = await mkdtemp(path.join(rootDir, ".vuepress-export-"))
  const buildDirectory = path.join(workDirectory, "dist")
  const tempDirectory = path.join(workDirectory, "temp")
  const cacheDirectory = path.join(workDirectory, "cache")

  try {
    console.log(`\n导出 ${pageRelative}`)
    const vuepressBin = path.join(
      rootDir,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "vuepress.cmd" : "vuepress",
    )
    await runCommand(vuepressBin, ["build", "notes"], {
      cwd: rootDir,
      env: {
        ...process.env,
        VUEPRESS_EXPORT_CACHE: cacheDirectory,
        VUEPRESS_EXPORT_DEST: buildDirectory,
        VUEPRESS_EXPORT_PAGE: pageRelative,
        VUEPRESS_EXPORT_TEMP: tempDirectory,
        VUEPRESS_PORTABLE_EXPORT: "1",
        VITE_PORTABLE_EXPORT: "1",
      },
    })

    const buildFiles = await walk(buildDirectory)
    const htmlFiles = buildFiles.filter(
      (file) => file.endsWith(".html") && path.basename(file) !== "404.html",
    )
    if (htmlFiles.length !== 1) {
      fail(`预期一个页面 HTML，实际找到 ${htmlFiles.length} 个`)
    }

    const htmlPath = htmlFiles[0]
    const route = pageRouteFromHtml(buildDirectory, htmlPath)
    let html = await readFile(htmlPath, "utf8")
    const inlined = await inlineBuildResources(
      html,
      htmlPath,
      buildDirectory,
      route,
    )
    html = inlined.html

    const issues = collectPortabilityIssues(html, inlined.unresolved)
    if (issues.length && !options.allowExternal) {
      fail(`页面不是完全自包含：\n- ${issues.join("\n- ")}`)
    }
    if (issues.length) {
      console.warn(`\n允许的非自包含依赖：\n- ${issues.join("\n- ")}`)
    }

    const internalLinks = collectInternalLinks(html)
    if (internalLinks.length) {
      console.warn(`\n离线时可能不可用的站内链接：\n- ${internalLinks.join("\n- ")}`)
    }

    const commit = await gitValue(["rev-parse", "HEAD"], "unknown")
    const dirty = Boolean(await gitValue(["status", "--porcelain"], ""))
    const generatedAt = new Date().toISOString()
    const metadata = [
      `<meta name="portable-source" content="${escapeHtmlAttribute(`notes/${pageRelative}`)}">`,
      `<meta name="portable-commit" content="${escapeHtmlAttribute(commit)}">`,
      `<meta name="portable-dirty" content="${dirty}">`,
      `<meta name="portable-generated-at" content="${generatedAt}">`,
      `<meta name="portable-exporter" content="${escapeHtmlAttribute(`${packageJson.name}@${packageJson.version}`)}">`,
      `<!-- portable-export source=notes/${pageRelative} commit=${commit} dirty=${dirty} generated=${generatedAt} -->`,
    ].join("\n")
    html = html.replace("</head>", () => `${metadata}\n</head>`)

    await mkdir(path.dirname(outputPath), { recursive: true })
    const atomicPath = `${outputPath}.tmp-${process.pid}`
    await writeFile(atomicPath, html)
    await rename(atomicPath, outputPath)

    const javascriptBytes = buildFiles
      .filter((file) => file.endsWith(".js"))
      .reduce(async (totalPromise, file) => (await totalPromise) + (await stat(file)).size, Promise.resolve(0))
    const cssBytes = buildFiles
      .filter((file) => file.endsWith(".css"))
      .reduce(async (totalPromise, file) => (await totalPromise) + (await stat(file)).size, Promise.resolve(0))
    const finalBytes = (await stat(outputPath)).size

    console.log("\n资源体积")
    console.log(`  JavaScript  ${formatBytes(await javascriptBytes)}`)
    console.log(`  CSS         ${formatBytes(await cssBytes)}`)
    console.log(`  单文件 HTML ${formatBytes(finalBytes)}`)
    if (finalBytes > 25 * 1024 ** 2) console.warn("  警告：导出文件超过 25 MiB")
    else if (finalBytes > 10 * 1024 ** 2) console.warn("  提示：导出文件超过 10 MiB")
    console.log(`\n已生成 ${path.relative(rootDir, outputPath)}`)
  } finally {
    await rm(workDirectory, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`\n导出失败：${error.message}`)
  process.exitCode = 1
})
