/**
 * 页面搬迁工具（一次性脚本，不参与打包）
 *
 * 作用：把旧 `pages/**` 里的 `<template>` 与 `<style>` **原样**搬到 `src/pages/**`，
 * 只替换 `<script>` 为新的 `<script setup lang="ts">`。
 *
 * 为什么这么做：模板与样式已经和设计稿逐屏对过，不允许为了改技术栈重新手打一遍；
 * 批量搬把「格式漂移」的风险降到最低。
 *
 * 用法：node scripts/port-page.js <旧页面> <新页面> <新脚本文件>
 */
const fs = require('fs')
const path = require('path')

const [, , oldPath, newPath, scriptPath] = process.argv
if (!oldPath || !newPath || !scriptPath) {
  console.error('用法: node scripts/port-page.js <old> <new> <script-file>')
  process.exit(1)
}

const src = fs.readFileSync(oldPath, 'utf8')

function block(tag) {
  const start = src.indexOf(`<${tag}`)
  if (start < 0) return ''
  const end = src.indexOf(`>`, start) + 1
  const close = src.lastIndexOf(`</${tag}>`)
  if (close < 0) return ''
  return src.slice(start, close + tag.length + 3)
}

const template = block('template')
const style = block('style')
const script = fs.readFileSync(scriptPath, 'utf8').trim()

if (!template) {
  console.error(`✗ ${oldPath} 没有 <template>`)
  process.exit(1)
}

const out = `${template}\n\n${script}\n\n${style}\n`
fs.mkdirSync(path.dirname(newPath), { recursive: true })
fs.writeFileSync(newPath, out, 'utf8')
console.log(`✓ ${newPath}  (${(Buffer.byteLength(out) / 1024).toFixed(1)} KB)`)
