/**
 * 线性图标库：24×24 viewBox，stroke 描边风格
 * 通过 CSS mask-image 上色，因此内部颜色统一写死为 #000（只取 alpha 通道）
 * 与设计稿保持同一套图形语言
 */

const S = '#000'

function stroke(d: string, extra = ''): string {
  return `<path d="${d}" stroke="${S}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"${extra}/>`
}

export const ICONS: Record<string, string> = {
  home: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 11.2l8-7.2 8 7.2v8.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 19.4z" stroke="${S}" stroke-width="1.8" stroke-linejoin="round" fill="none"/></svg>`,

  book: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 5.6A1.6 1.6 0 0 1 5.6 4H19.6v16.4H5.6A1.6 1.6 0 0 1 4 18.8z" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M8.4 4v16.4" stroke="${S}" stroke-width="1.8" fill="none"/></svg>`,

  review: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.6a7.4 7.4 0 1 1-7 5" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M3.4 4.4v4.2h4.2" stroke="${S}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M12 8.4v3.8l2.6 1.6" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  user: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8.2" r="3.9" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M4.6 21c0-4 3.5-6.6 7.4-6.6S19.4 17 19.4 21" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  gear: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="${S}" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>`,

  camera: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 8.6A2.6 2.6 0 0 1 5.6 6h1.1l1-1.7h6.6l1 1.7h1.1A2.6 2.6 0 0 1 21 8.6v8A2.6 2.6 0 0 1 18.4 19.2H5.6A2.6 2.6 0 0 1 3 16.6z" stroke="${S}" stroke-width="1.8" fill="none"/><circle cx="12" cy="12.4" r="3.2" stroke="${S}" stroke-width="1.8" fill="none"/></svg>`,

  image: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4.4" width="18" height="15.2" rx="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><circle cx="8.6" cy="9.8" r="1.5" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M4.2 17.2l4.4-4.1 3.2 3 2.5-2.3 4.4 4" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  clipboard: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="4.2" width="14" height="17" rx="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M9 4.2V3.4A1.2 1.2 0 0 1 10.2 2.2h3.6A1.2 1.2 0 0 1 15 3.4v.8" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M9 10.4h6M9 14.4h4" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  plus: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="${S}" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,

  chevronRight: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9.5 5.5L16 12l-6.5 6.5" stroke="${S}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,

  chevronLeft: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 5.5L8 12l6.5 6.5" stroke="${S}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,

  chevronDown: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 9.5L12 16l6.5-6.5" stroke="${S}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,

  search: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="10.8" cy="10.8" r="6.8" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M16 16l4.4 4.4" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  more: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="1.7" fill="${S}"/><circle cx="12" cy="12" r="1.7" fill="${S}"/><circle cx="19" cy="12" r="1.7" fill="${S}"/></svg>`,

  star: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.4l2.75 5.6 6.15.9-4.45 4.35 1.05 6.15L12 17.5l-5.5 2.9 1.05-6.15L3.1 9.9l6.15-.9z" stroke="${S}" stroke-width="1.8" stroke-linejoin="round" fill="none"/></svg>`,

  starFill: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.4l2.75 5.6 6.15.9-4.45 4.35 1.05 6.15L12 17.5l-5.5 2.9 1.05-6.15L3.1 9.9l6.15-.9z" fill="${S}"/></svg>`,

  edit: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 20h4L20 8l-4-4L4 16z" stroke="${S}" stroke-width="1.8" stroke-linejoin="round" fill="none"/><path d="M14.4 5.6l4 4" stroke="${S}" stroke-width="1.8" fill="none"/></svg>`,

  share: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="5.6" r="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><circle cx="6" cy="12" r="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><circle cx="18" cy="18.4" r="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M8.3 10.7l7.4-3.9M8.3 13.3l7.4 3.9" stroke="${S}" stroke-width="1.8" fill="none"/></svg>`,

  clock: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8.6" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M12 7.4V12l3.1 1.9" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  check: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4.8 12.6l4.8 4.8 9.6-9.6" stroke="${S}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,

  refresh: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.8 12a7.8 7.8 0 1 1-2.3-5.5" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M20 3.8v5h-5" stroke="${S}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,

  tag: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.6 3.2H20v8.4L11.4 20.2 3.2 12z" stroke="${S}" stroke-width="1.8" stroke-linejoin="round" fill="none"/><circle cx="16.4" cy="6.8" r="1.1" stroke="${S}" stroke-width="1.8" fill="none"/></svg>`,

  database: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="6" rx="7.6" ry="2.9" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M4.4 6v12c0 1.6 3.4 2.9 7.6 2.9s7.6-1.3 7.6-2.9V6" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M4.4 12c0 1.6 3.4 2.9 7.6 2.9s7.6-1.3 7.6-2.9" stroke="${S}" stroke-width="1.8" fill="none"/></svg>`,

  download: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.4v11.4M7.4 10.4L12 15l4.6-4.6" stroke="${S}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M4.4 20h15.2" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  upload: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 20.6V9.2M7.4 13.6L12 9l4.6 4.6" stroke="${S}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M4.4 4h15.2" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  trash: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4.6 6.8h14.8M9.4 6.8V4.4h5.2v2.4M6.4 6.8l.9 13.4h9.4l.9-13.4" stroke="${S}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,

  info: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8.8" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M12 11.2v5.6M12 7.7v.6" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  calendar: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3.4" y="5" width="17.2" height="15.6" rx="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M3.4 10h17.2M8.2 3.2v3.6M15.8 3.2v3.6" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  sparkle: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.6l1.9 5.1 5.1 1.9-5.1 1.9L12 16.6l-1.9-5.1L5 9.6l5.1-1.9z" fill="${S}"/><path d="M18.4 15.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="${S}"/></svg>`,

  code: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 7.4L4 12l5 4.6M15 7.4L20 12l-5 4.6" stroke="${S}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,

  nodes: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="6" cy="6.4" r="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><circle cx="18" cy="6.4" r="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><circle cx="12" cy="18" r="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M8.4 7.6l2.2 8M15.6 7.6l-2.2 8M8.6 6.4h6.8" stroke="${S}" stroke-width="1.8" fill="none"/></svg>`,

  layers: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.4l8.4 4.3-8.4 4.3-8.4-4.3z" stroke="${S}" stroke-width="1.8" stroke-linejoin="round" fill="none"/><path d="M3.6 12.4l8.4 4.3 8.4-4.3M3.6 16.8l8.4 4.3 8.4-4.3" stroke="${S}" stroke-width="1.8" stroke-linejoin="round" fill="none"/></svg>`,

  briefcase: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7.4" width="18" height="13" rx="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M8.6 7.4V5.4A1.6 1.6 0 0 1 10.2 3.8h3.6a1.6 1.6 0 0 1 1.6 1.6v2" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M3 12.6h18" stroke="${S}" stroke-width="1.8" fill="none"/></svg>`,

  bulb: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.2a6.1 6.1 0 0 1 3.6 11v2H8.4v-2A6.1 6.1 0 0 1 12 3.2z" stroke="${S}" stroke-width="1.8" stroke-linejoin="round" fill="none"/><path d="M9.4 19.4h5.2" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  imagePlus: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2.6" y="5" width="15" height="13" rx="2.6" stroke="${S}" stroke-width="1.8" fill="none"/><circle cx="7.4" cy="9.8" r="1.4" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M3.6 16.4l3.7-3.5 2.7 2.5 2.1-2" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M20 7.4v6M17 10.4h6" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  close: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 6l12 12M18 6L6 18" stroke="${S}" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,

  eye: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.4 12S6 5.6 12 5.6 21.6 12 21.6 12 18 18.4 12 18.4 2.4 12 2.4 12z" stroke="${S}" stroke-width="1.8" stroke-linejoin="round" fill="none"/><circle cx="12" cy="12" r="2.9" stroke="${S}" stroke-width="1.8" fill="none"/></svg>`,

  filter: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3.6 5.4h16.8l-6.6 7.8v5.4l-3.6 2v-7.4z" stroke="${S}" stroke-width="1.8" stroke-linejoin="round" fill="none"/></svg>`,

  copy: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="8.4" y="8.4" width="11.6" height="11.6" rx="2.4" stroke="${S}" stroke-width="1.8" fill="none"/><path d="M15.6 5.6a2.4 2.4 0 0 0-2.4-2.4H6a2.4 2.4 0 0 0-2.4 2.4v7.2A2.4 2.4 0 0 0 6 15.2" stroke="${S}" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`,

  sort: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 4.4v15.2M3.4 16l3.6 3.6L10.6 16M17 19.6V4.4M13.4 8L17 4.4 20.6 8" stroke="${S}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,

  /* ===== 实心变体：底部导航选中态、首页图标（设计稿用填充式） ===== */

  homeFill: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.1a1.4 1.4 0 0 1 .9.3l7.9 6.5c.2.2.3.4.3.7v8.6c0 .9-.7 1.6-1.6 1.6h-4.7v-5.4H9.2v5.4H4.5c-.9 0-1.6-.7-1.6-1.6v-8.6c0-.3.1-.5.3-.7l7.9-6.5a1.4 1.4 0 0 1 .9-.3z" fill="${S}"/></svg>`,

  bookFill: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M6.8 2.9h11.4c.6 0 1 .4 1 1v16.2c0 .6-.4 1-1 1H6.8a2.6 2.6 0 0 1-2.6-2.6V5.5a2.6 2.6 0 0 1 2.6-2.6zm1.9 1.7v14.8h1.5V4.6z" fill="${S}"/></svg>`,

  reviewFill: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M12 2.6a9.4 9.4 0 1 1 0 18.8 9.4 9.4 0 0 1 0-18.8zm-1 4.5v6.1l4.9 2.9.9-1.5-3.8-2.3V7.1z" fill="${S}"/></svg>`,

  userFill: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8.1" r="4.1" fill="${S}"/><path d="M3.8 20.9c0-4.1 3.7-6.7 8.2-6.7s8.2 2.6 8.2 6.7z" fill="${S}"/></svg>`,

  /** 实心公文包：中间留一条透明横带当「包扣」，视觉上像双色 */
  briefcaseFill: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9.6 3.1h4.8a2.3 2.3 0 0 1 2.3 2.3v1.1h2.5A2.8 2.8 0 0 1 22 9.3v9.3a2.8 2.8 0 0 1-2.8 2.8H4.8A2.8 2.8 0 0 1 2 18.6V9.3a2.8 2.8 0 0 1 2.8-2.8h2.5V5.4a2.3 2.3 0 0 1 2.3-2.3zm.5 3.4h3.8v-.9h-3.8zM2 12.3h20v1.8H2z" fill="${S}"/></svg>`,

  /** 扫描框 + 图片 + 加号：上传入口专用 */
  scanImage: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 8.4V5.6A2.6 2.6 0 0 1 5.6 3h2.8M15.6 3h2.8A2.6 2.6 0 0 1 21 5.6v2.8M21 15.4v2.8A2.6 2.6 0 0 1 18.4 21h-2.8M8.4 21H5.6A2.6 2.6 0 0 1 3 18.4v-2.8" stroke="${S}" stroke-width="1.9" stroke-linecap="round" fill="none"/><rect x="6.8" y="7.4" width="10.4" height="9.2" rx="1.8" stroke="${S}" stroke-width="1.7" fill="none"/><circle cx="10.2" cy="10.6" r="1.15" fill="${S}"/><path d="M7.6 15.6l2.9-2.7 2.2 2 1.6-1.4 2.1 1.9" stroke="${S}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M18.4 17.2v3.4M16.7 18.9h3.4" stroke="${S}" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>`,

  /** 羽毛笔：参考回答标题前的小图标 */
  feather: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.6 3.3c-2.4-.9-6.8.6-9.5 3.3-2.9 2.9-3.7 6.4-2.9 8.6l-4.1 4.1a1.1 1.1 0 0 0 1.6 1.5l4.1-4.1c2.2.8 5.7 0 8.6-2.9 2.7-2.7 4.1-7.1 3.2-9.5a1.1 1.1 0 0 0-1-1z" fill="${S}"/></svg>`,

  /* ===== 首页四个入口用的实心图标（设计稿是填充式 + 白色镂空细节） ===== */

  cameraFill: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M8.7 3.9h6.6a2 2 0 0 1 1.9 1.4l.4 1h1.8A2.6 2.6 0 0 1 22 8.9v8.7a2.6 2.6 0 0 1-2.6 2.6H4.6A2.6 2.6 0 0 1 2 17.6V8.9a2.6 2.6 0 0 1 2.6-2.6h1.8l.4-1a2 2 0 0 1 1.9-1.4zM12 9.6a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4z" fill="${S}"/></svg>`,

  imageFill: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M5 3.4h14A2.6 2.6 0 0 1 21.6 6v12a2.6 2.6 0 0 1-2.6 2.6H5A2.6 2.6 0 0 1 2.4 18V6A2.6 2.6 0 0 1 5 3.4zM8.2 7.1a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4.4 17.6l4.8-4.6 3.4 3.2 2.6-2.4 4.5 4.2v.9H4.4z" fill="${S}"/></svg>`,

  clipboardFill: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9.5 2.4h5a1.8 1.8 0 0 1 1.8 1.8v.4h1.4A2.6 2.6 0 0 1 20.3 7.2v13A2.6 2.6 0 0 1 17.7 22.8H6.3A2.6 2.6 0 0 1 3.7 20.2v-13A2.6 2.6 0 0 1 6.3 4.6h1.4v-.4a1.8 1.8 0 0 1 1.8-1.8zM8.6 11.2v1.7h6.8v-1.7zm0 4.1v1.7h4.6v-1.7z" fill="${S}"/></svg>`,

  /** 实心对勾圆：学习计划完成态 */
  checkCircleFill: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M12 2.4a9.6 9.6 0 1 1 0 19.2 9.6 9.6 0 0 1 0-19.2zm4.9 6.5a1.2 1.2 0 0 0-1.7 0l-4.2 4.2-1.9-1.9a1.2 1.2 0 0 0-1.7 1.7l2.7 2.7a1.2 1.2 0 0 0 1.7 0l5.1-5.1a1.2 1.2 0 0 0 0-1.6z" fill="${S}"/></svg>`
}

/** 生成 mask-image 可用的 data URI */
export function iconUri(name: string): string {
  const svg = ICONS[name]
  if (!svg) return ''
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** 供类型检查用：ICONS 的 key 集合（页面传错名字时能提前暴露） */
export const ICON_NAMES = Object.keys(ICONS)
