// ==UserScript==
// @name         豆包网页版 爆改chatgpt/codex
// @version      1.0.3
// @description  把 doubao.com/chat 的「对话」改名 ChatGPT、「工作」改名 Codex，同时替换 logo / 图标 / 配色 / 字体 / 圆角，模仿 ChatGPT 与 Codex 的界面风格。只改界面，不改你的数据和功能。
// @author       松鼠老方
// @homepageURL  https://github.com/LaoFang114514/ChatDou
// @supportURL   https://github.com/LaoFang114514/ChatDou
// @match        https://www.doubao.com/chat*
// @match        https://www.doubao.com/
// @grant        none
// @run-at       document-start
// @noframes
// @license MIT
// ==/UserScript==

/* 要改文案 / 配色 / 图标，改 CONFIG、TEXTS、PALETTE、LOGO 四块就行。
 * 颜色都是覆盖豆包自己的 CSS 变量（--dbx-*），不动它的深浅色机制。 */

(function () {
  'use strict';

  var VERSION = '1.0.2';
  var root = document.documentElement;

  /* ========== 1. CONFIG ========== */
  /* ========== 1. 固定值（行为已写死，没有开关表） ========== */
  var MODEL_BRAND = 'ChatDou';   // 模型名里的品牌词（紧跟版本号的那种写法）
  var PLUS_URL = 'https://www.doubao.com/member/subscription';
  var LOAD_MAX_MS = 3600;        // 加载动画硬上限，到点一定放行
  var LOAD_MIN_MS = 420;         // 开屏最少盖多久
  var SWITCH_FLASH_MS = 520;     // 模式切换最少盖多久
  var STABLE_FRAMES = 4;         // 连续几帧尺寸不变才算布局稳住

  /* ========== 2. TEXTS：文案映射 ========== */
  var TEXTS = {
    // 整段文字精确匹配时才替换（用来处理标签、按钮、菜单项，避免误伤句子）
    exact: {
      '豆包': 'ChatGPT',
      'Doubao': 'ChatGPT',
      '对话': 'ChatGPT',
      '工作': 'Codex',
      '新对话': '新聊天',
      '新工作任务': '新任务',
      '定时任务': '已计划任务',
      '云盘': '文件库',
      '插件 · 技能 · 工作台': '连接器 · 技能 · 应用',
      'API 服务': 'API',
      '项目': '项目',
      '创建新项目': '新建项目',
      '最近': '聊天记录',
      '对话列表设置': '聊天列表设置',
      '有什么我能帮你的吗？': '有什么可以帮你的？',
      '今天有什么工作要处理？': '我们要构建什么？',
      '为你推荐': '建议',
      'AI 生成可能有误 请核实': 'AI 可能会犯错，请核查重要信息。',
      '下载电脑版': '下载桌面版',
      '归档对话': '归档聊天',
      '发消息或按住空格说话...': '询问 ChatGPT',
      '发消息或创建任务... / 使用技能 @ 添加资料': '让 Codex 执行任务 · 用 @ 添加上下文'
    },
    // 子串替换（长词优先，运行时会按长度排序）；只作用于界面区域，正文默认跳过
    substr: [
      ['豆包大模型', 'ChatDou'],
      ['豆包同学', 'ChatDou'],
      ['豆包', 'ChatDou'],
      ['Doubao', 'ChatDou'],
      ['doubao', 'ChatDou'],
      ['新工作任务', '新任务'],
      ['归档对话', '归档聊天'],
      ['对话列表', '聊天列表'],
      ['新对话', '新聊天'],
      ['本次对话', '本次聊天'],
      ['对话', '聊天'],
      ['插件 · 技能 · 工作台', '连接器 · 技能 · 应用'],
      ['工作台', '应用'],
      ['工作任务', '任务'],
      ['工作电脑', '云电脑'],
      ['工作', '任务'],
      ['API 服务', 'API'],
      ['API&nbsp;服务', 'API'],
      ['发消息或按住空格说话', '询问 ChatGPT'],
      ['发消息或创建任务', '让 Codex 执行任务']
    ],
    // 按当前模式动态覆盖的输入框提示
    placeholderByMode: {
      chat: '询问 ChatGPT',
      work: '随心输入'
    },
    // 只在 Codex（工作）模式下再套一层的改名，对照 Codex 桌面版侧栏。
    // 改名永远从「原文」算，所以这里只写基础改名之后的结果词。
    // 注意：'新聊天' 才是豆包真正的「新对话」按钮，别把 '新任务'（豆包的新工作任务）标成「新对话」，
    // 否则点它会跑进工作模式
    mode: {
      work: {
        '新聊天': '新对话',
        '已计划任务': '已安排',
        '连接器 · 技能 · 应用': '插件',
        '文件库': '拉取请求',
        '聊天记录': '最近',
        '有什么可以帮你的？': '我们要构建什么？'
      }
    }
  };

  // 这些容器里是「内容」而不是「界面」，默认不动里面的文字
  var CONTENT_SELECTORS = [
    '[data-testid="message-list"]',
    '[data-testid="union_message"]',
    '[data-testid="message_content"]',
    '[data-testid="message_text_content"]',
    '[data-testid="send_message"]',
    '[data-testid="receive_message"]',
    '[data-testid="editable_conversation_name"]',
    '[data-conversation-title-text]',
    '.tiptap',
    'pre',
    'code',
    'textarea',
    '[contenteditable="true"]'
  ];
  // 输入框提示类属性（只改这几个，别碰 data-* 语义属性）
  var TEXT_ATTRS = ['placeholder', 'data-placeholder', 'aria-label', 'title', 'alt'];

  /* ========== 3. PALETTE：配色变量 ========== */
  // ChatGPT 浅色 / 深色近似值（浅色：#fff 正文 + #f9f9f9 侧栏 + #171717 文字 + OpenAI 绿 #00a67e）
  var PALETTE = {
    light: {
      '--dbx-neutral-50': '#ececec',
      '--dbx-neutral-100': '#e5e5e5',
      '--dbx-neutral-200': '#d9d9d9',
      '--dbx-neutral-900': '#171717',
      '--dbx-neutral-1000': '#0d0d0d',
      '--dbx-text-primary': '#171717',
      '--dbx-text-secondary': 'rgba(23,23,23,.62)',
      '--dbx-text-tertiary': 'rgba(23,23,23,.42)',
      '--dbx-text-disable': 'rgba(23,23,23,.26)',
      '--dbx-text-markdown': 'rgba(23,23,23,.94)',
      '--dbx-bg-base-web': '#f9f9f9',
      '--dbx-bg-body-web': '#ffffff',
      '--dbx-bg-body-white': '#ffffff',
      '--dbx-bg-body-overlay-web': '#ffffff',
      '--dbx-bg-float': '#ffffff',
      '--dbx-bg-mask': 'rgba(0,0,0,.32)',
      '--dbx-fill-trans-10': 'rgba(0,0,0,.04)',
      '--dbx-fill-trans-10-hover': 'rgba(0,0,0,.06)',
      '--dbx-fill-trans-20': 'rgba(0,0,0,.06)',
      '--dbx-fill-trans-20-hover': 'rgba(0,0,0,.09)',
      '--dbx-fill-trans-30': 'rgba(0,0,0,.10)',
      '--dbx-fill-trans-30-hover': 'rgba(0,0,0,.15)',
      '--dbx-line-7': 'rgba(0,0,0,.055)',
      '--dbx-line-10': 'rgba(0,0,0,.10)',
      '--dbx-line-15': 'rgba(0,0,0,.14)',
      '--dbx-line-divider-5': 'rgba(0,0,0,.05)',
      '--dbx-line-divider-10': 'rgba(0,0,0,.08)',
      '--dbx-fill-chat-bubble-bg': '#f4f4f4',
      '--dbx-fill-chat-bubble-bg2': '#eef7f3',
      '--dbd-bg-subtle-1': '#f9f9f9',
      '--dbd-bg-subtle-2': '#f9f9f9',
      '--dbd-bg-subtle-3': '#f4f4f4',
      '--dbd-bg-subtle-4': '#f4f4f4',
      '--dbd-bg-subtle-5': '#f4f4f4',
      '--dbd-bg-contrast-2': '#f4f4f4',
      '--dbd-bg-base-1': '#ffffff',
      '--dbd-bg-base-2': '#ffffff',
      '--dbd-bg-base-3': '#ffffff',
      '--dbd-bg-elevated-1': '#ffffff',
      '--dbd-bg-elevated-2': '#ffffff',
      '--dbd-bg-elevated-3': '#ffffff',
      '--dbd-bg-elevated-4': '#ffffff',
      '--dbd-bg-elevated-5': '#ffffff',
      '--dbd-legacy-bg-press': '#ececec',
      '--dbd-text-60': '#6b6b6b',
      '--dbd-text-100': '#171717',
      '--dbd-theme-action-bg-active': '#00916f'
    },
    dark: {
      '--dbx-neutral-50': '#2f2f2f',
      '--dbx-neutral-100': '#383838',
      '--dbx-neutral-200': '#4a4a4a',
      '--dbx-neutral-900': '#ececec',
      '--dbx-neutral-1000': '#ffffff',
      '--dbx-text-primary': '#ececec',
      '--dbx-text-secondary': 'rgba(236,236,236,.68)',
      '--dbx-text-tertiary': 'rgba(236,236,236,.45)',
      '--dbx-text-disable': 'rgba(236,236,236,.28)',
      '--dbx-text-markdown': 'rgba(236,236,236,.94)',
      '--dbx-bg-base-web': '#171717',
      '--dbx-bg-body-web': '#212121',
      '--dbx-bg-body-white': '#212121',
      '--dbx-bg-body-overlay-web': '#2f2f2f',
      '--dbx-bg-float': '#2f2f2f',
      '--dbx-bg-mask': 'rgba(0,0,0,.6)',
      '--dbx-fill-trans-10': 'rgba(255,255,255,.05)',
      '--dbx-fill-trans-10-hover': 'rgba(255,255,255,.08)',
      '--dbx-fill-trans-20': 'rgba(255,255,255,.09)',
      '--dbx-fill-trans-20-hover': 'rgba(255,255,255,.13)',
      '--dbx-fill-trans-30': 'rgba(255,255,255,.16)',
      '--dbx-fill-trans-30-hover': 'rgba(255,255,255,.22)',
      '--dbx-line-7': 'rgba(255,255,255,.08)',
      '--dbx-line-10': 'rgba(255,255,255,.13)',
      '--dbx-line-15': 'rgba(255,255,255,.18)',
      '--dbx-line-divider-5': 'rgba(255,255,255,.07)',
      '--dbx-line-divider-10': 'rgba(255,255,255,.12)',
      '--dbx-fill-chat-bubble-bg': '#2f2f2f',
      '--dbx-fill-chat-bubble-bg2': '#1f3a33',
      '--dbd-bg-subtle-1': '#212121',
      '--dbd-bg-subtle-2': '#212121',
      '--dbd-bg-subtle-3': '#2f2f2f',
      '--dbd-bg-subtle-4': '#2f2f2f',
      '--dbd-bg-subtle-5': '#2f2f2f',
      '--dbd-bg-contrast-2': '#2f2f2f',
      '--dbd-bg-base-1': '#212121',
      '--dbd-bg-base-2': '#212121',
      '--dbd-bg-base-3': '#2f2f2f',
      '--dbd-bg-elevated-1': '#2f2f2f',
      '--dbd-bg-elevated-2': '#2f2f2f',
      '--dbd-bg-elevated-3': '#2f2f2f',
      '--dbd-bg-elevated-4': '#2f2f2f',
      '--dbd-bg-elevated-5': '#2f2f2f',
      '--dbd-legacy-bg-press': '#383838',
      '--dbd-text-60': '#b4b4b4',
      '--dbd-text-100': '#ececec',
      '--dbd-theme-action-bg-active': '#0f8f6f'
    }
  };

  // 品牌色：ChatGPT = OpenAI 绿；Codex = 终端荧光绿（近似，可自行改值）
  var ACCENT = {
    chatgpt: {
      light: { solid: '#00a67e', hover: '#00916f', pressed: '#007a5c', text: '#00875f', weak: 'rgba(0,166,126,.10)', weaker: 'rgba(0,166,126,.06)', raw: '0,166,126' },
      dark: { solid: '#2cc98f', hover: '#4ad7a5', pressed: '#25ad7b', text: '#5ddcb0', weak: 'rgba(44,201,143,.14)', weaker: 'rgba(44,201,143,.09)', raw: '44,201,143' }
    },
    codex: {
      light: { solid: '#7c5cf6', hover: '#6b48e6', pressed: '#5a3bd0', text: '#6b48e6', weak: 'rgba(124,92,246,.12)', weaker: 'rgba(124,92,246,.07)', raw: '124,92,246' },
      dark: { solid: '#a08bff', hover: '#b6a5ff', pressed: '#8a72f0', text: '#a08bff', weak: 'rgba(160,139,255,.16)', weaker: 'rgba(160,139,255,.09)', raw: '160,139,255' }
    }
  };

  // Codex 皮肤再压暗一档、边框更硬，靠 CSS 类实现（见 STYLE）
  // Codex 桌面版是暖米色底 + 白色卡片，这里把整条灰阶都往暖色偏一点
  var CODEX_TOKENS = {
    light: {
      '--dbx-bg-base-web': '#f7f6f2',
      '--dbx-bg-body-web': '#faf9f6',
      '--dbx-bg-body-white': '#ffffff',
      '--dbx-bg-body-overlay-web': '#ffffff',
      '--dbx-bg-float': '#ffffff',
      '--dbx-neutral-50': '#ecebe6',
      '--dbx-neutral-100': '#e6e4dd',
      '--dbx-neutral-200': '#d9d7ce',
      '--dbx-neutral-900': '#23211d',
      '--dbx-text-primary': '#23211d',
      '--dbx-text-secondary': 'rgba(35,33,29,.62)',
      '--dbx-text-tertiary': 'rgba(35,33,29,.42)',
      '--dbx-text-markdown': 'rgba(35,33,29,.94)',
      '--dbx-fill-chat-bubble-bg': '#f3f1ec',
      '--dbx-fill-chat-bubble-bg2': '#f1edfb',
      '--dbx-line-7': 'rgba(60,50,20,.07)',
      '--dbx-line-10': 'rgba(60,50,20,.12)',
      '--dbx-line-15': 'rgba(60,50,20,.17)',
      '--dbx-fill-trans-10': 'rgba(60,50,20,.05)',
      '--dbx-fill-trans-20': 'rgba(60,50,20,.07)',
      '--dbx-fill-trans-30': 'rgba(60,50,20,.12)',
      '--dbd-bg-base-1': '#faf9f6',
      '--dbd-bg-base-2': '#faf9f6',
      '--dbd-bg-base-3': '#ffffff',
      '--dbd-bg-subtle-1': '#f7f6f2',
      '--dbd-bg-subtle-2': '#f7f6f2',
      '--dbd-bg-subtle-3': '#f3f1ec',
      '--dbd-bg-elevated-1': '#ffffff',
      '--dbd-bg-elevated-2': '#ffffff',
      '--dbd-bg-elevated-3': '#ffffff',
      '--dbd-bg-elevated-4': '#ffffff',
      '--dbd-bg-elevated-5': '#ffffff',
      '--dbd-text-100': '#23211d',
      '--dbd-text-60': '#6f6b62'
    },
    dark: {
      '--dbx-bg-base-web': '#100f12',
      '--dbx-bg-body-web': '#17161a',
      '--dbx-bg-body-white': '#201f25',
      '--dbx-bg-body-overlay-web': '#201f25',
      '--dbx-bg-float': '#201f25',
      '--dbx-neutral-50': '#2a2930',
      '--dbx-neutral-100': '#323138',
      '--dbx-neutral-200': '#414049',
      '--dbx-fill-chat-bubble-bg': '#212027',
      '--dbx-line-10': 'rgba(255,255,255,.11)',
      '--dbx-line-15': 'rgba(255,255,255,.16)',
      '--dbd-bg-base-1': '#17161a',
      '--dbd-bg-base-2': '#17161a',
      '--dbd-bg-base-3': '#201f25',
      '--dbd-bg-elevated-1': '#201f25',
      '--dbd-bg-elevated-2': '#201f25',
      '--dbd-bg-elevated-3': '#201f25',
      '--dbd-bg-elevated-4': '#201f25',
      '--dbd-bg-elevated-5': '#201f25'
    }
  };

  var FONTS = {
    sans: 'Inter, "SF Pro Text", -apple-system, "Segoe UI Variable Text", "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
    mono: '"JetBrains Mono", "SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
  };

  /* ========== 4. LOGO ========== */
  // 图标取自 LobeHub Icons（lobe-icons, @lobehub/icons-static-svg 的 openai.svg / codex.svg），
  // 都是品牌矢量路径，viewBox 0 0 24 24，用 currentColor 上色。
  var OPENAI_D = 'M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z';
  var CODEX_D = 'M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z';
  var MARK_CHATGPT = '<path d="' + OPENAI_D + '"></path>';
  var MARK_CODEX = '<path d="' + CODEX_D + '"></path>';
  var LOGO = {
    chatgpt: { inner: MARK_CHATGPT, fill: 'currentColor', stroke: 'none' },
    codex: { inner: MARK_CODEX, fill: 'currentColor', stroke: 'none' }
  };
  // 豆包 logo 的 path 开头特征（实测自 2026-11 的线上 DOM），命中就换成我们的标记
  var DOUBAO_PATH_HINTS = ['M8.41325', 'M8.4132', 'M 8.41325'];
  var DOUBAO_IMG_HINT = /doubao[^/]*\b(logo|brand|mark)\b|favicon-doubao|\/logo[-_]doubao/i;

  function markBody(skin, fg) {
    return '<g fill="' + fg + '" fill-rule="evenodd">' + (skin === 'codex' ? MARK_CODEX : MARK_CHATGPT) + '</g>';
  }

  function faviconURI(skin) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<rect width="24" height="24" rx="5.5" fill="#0d0d0d"></rect>' + markBody(skin, '#ffffff') +
      '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  // 只有标记、没有底色方块：用来替换页面里的豆包品牌图（它们自带圆角/圆形裁切）
  function markURI(skin, dark) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      markBody(skin, dark ? '#ffffff' : '#0d0d0d') + '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  /* ========== 5. 样式（结构层：变量覆盖不到的地方） ========== */
  var STYLE = [
    'html.gptx{ --g-border:var(--dbx-line-10); --g-accent:var(--dbx-fill-highlight); }',
    // 全局字体
    'html.gptx, html.gptx body{ font-family:var(--s-font-family); -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }',
    // 侧栏：字号收到 14px（ChatGPT 侧栏是 14/20）
    'html.gptx nav .text-16{ font-size:14px !important; line-height:20px !important; }',
    'html.gptx nav{ letter-spacing:.01em; }',
    'html.gptx [data-testid="conversation-list-v2-item"]{ font-size:14px; }',
    'html.gptx [data-testid="conversation-list-v2-item"] .text-14,' +
    'html.gptx [data-testid="conversation-list-v2-item"] [class*="text-16"]{ font-size:14px !important; line-height:20px !important; }',
    // 对话/工作 切换胶囊
    'html.gptx [data-conversation-mode-switch]{ border:1px solid var(--g-border); box-shadow:none; }',
    'html.gptx [data-conversation-mode-switch] button{ font-weight:500; letter-spacing:.02em; }',
    'html.gptx.s-codex [data-conversation-mode-switch] button{ font-family:var(--font-mono); letter-spacing:.04em; }',
    'html.gptx.s-codex [data-testid="create_office_task_button"],' +
    'html.gptx.s-codex [data-testid="create_conversation_button"]{ font-family:var(--font-mono); }',
    // 输入框：ChatGPT 式柔和投影 + 24px 圆角
    'html.gptx [data-testid="chat_input"]{ box-shadow:0 1px 2px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.05); transition:box-shadow .18s ease; }',
    'html.gptx [data-testid="chat_input"]:focus-within{ box-shadow:0 0 0 1px var(--g-border),0 6px 24px rgba(0,0,0,.09); }',
    'html.gptx.t-dark [data-testid="chat_input"]{ box-shadow:0 1px 2px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.32); }',
    // 正文行距按 ChatGPT 排版
    'html.gptx [data-testid="message_text_content"] p{ line-height:1.72; }',
    // 选中色 / 滚动条
    'html.gptx ::selection{ background:var(--dbx-fill-highlight-trans-10, rgba(0,166,126,.16)); }',
    'html.gptx *{ scrollbar-width:thin; scrollbar-color:var(--dbx-fill-trans-30) transparent; }',
    'html.gptx ::-webkit-scrollbar{ width:10px; height:10px; }',
    'html.gptx ::-webkit-scrollbar-thumb{ background:var(--dbx-fill-trans-20); border:3px solid transparent; background-clip:content-box; border-radius:9999px; }',
    'html.gptx ::-webkit-scrollbar-thumb:hover{ background:var(--dbx-fill-trans-30-hover); background-clip:content-box; }',
    // 建议卡片：ChatGPT 式细边框
    'html.gptx [data-testid="suggest_message_item"]{ border-radius:14px; }',
    // 输入框占位文案：ProseMirror 每次重渲染都会把 data-placeholder 写回去，所以只能用 CSS 覆盖。
    // 选择器写宽一点：豆包自己的规则带 !important，扩展（沉浸式翻译等）也会插样式， specificity 不够就压不住
    'html.gptx [data-testid="chat_input"] [data-placeholder]::before,' +
    'html.gptx [data-testid="chat_input"] p[data-placeholder]::before,' +
    'html.gptx .tiptap p.is-editor-empty:first-child::before,' +
    'html.gptx .ProseMirror p.is-editor-empty:first-child::before{ content:var(--g-ph, "询问 ChatGPT") !important; }',
    // 空会话问候语：ChatGPT 没有大标题，压低一档更像它
    'html.gptx div[class*="greeting-height"]{ font-size:22px !important; font-weight:500 !important; letter-spacing:-.01em; opacity:.85; }',
    // 问候语上方的品牌图标
    // 高度固定 56px，两种模式一样，切模式时不会因为高度差上下跳
    'html.gptx .gptx-hero{ display:flex; align-items:center; justify-content:center; height:56px; color:var(--dbx-text-primary); }',
    'html.gptx .gptx-hero svg{ width:44px; height:44px; display:block; opacity:.85; }',
    // 豆包自己在问候语上方放的品牌图，换标后由 .gptx-hero 接管
    'html.gptx .gptx-hide{ display:none !important; }',
    // 切换开关：竖排点击列表（跟侧栏其他条目一样的手感），不再是并排胶囊
    // 切换列表（只存在于任务台菜单里）：跟菜单条目同规格
    'html.gptx .gptx-switch{ display:flex; flex-direction:column; gap:2px; margin:0; padding:0; width:100%; }',
    'html.gptx .gptx-seg{ display:flex; align-items:center; gap:10px; height:38px; padding:0 10px; border:0; border-radius:6px; background:transparent; color:var(--dbx-text-primary); font-weight:400; font-size:14px; line-height:30px; font-family:inherit; text-align:left; cursor:pointer; transition:background .14s ease,color .14s ease,transform .1s ease; }',
    'html.gptx .gptx-seg svg{ width:16px; height:16px; flex:none; opacity:.8; }',
    'html.gptx .gptx-seg:hover{ background:var(--dbx-fill-trans-10-hover); }',
    'html.gptx .gptx-seg[aria-selected="true"]{ background:var(--dbx-fill-trans-10-hover); font-weight:500; }',
    'html.gptx.s-codex .gptx-seg{ font-family:var(--font-mono); letter-spacing:.02em; }',
    // 隐藏正文里的大胶囊切换
    'html.gptx.hidemsw [data-conversation-mode-switch]{ display:none !important; }',
    // ---- Codex 桌面版味道：紫色获取 Plus + 左下开始使用清单 ----
    'html.gptx .gptx-plus{ display:inline-flex; align-items:center; gap:6px; margin:-2px 0 10px; padding:4px 10px 4px 8px; border:1px solid rgba(124,92,246,.28); border-radius:9999px; background:rgba(124,92,246,.08); color:#6b48e6; font-size:12px; font-weight:500; cursor:pointer; }',
    'html.gptx.t-dark.s-codex .gptx-plus{ color:#a08bff; border-color:rgba(160,139,255,.30); background:rgba(160,139,255,.12); }',
    'html.gptx .gptx-plus svg{ width:13px; height:13px; flex:none; }',
    // 放在顶栏右侧时：去掉侧栏那套外边距，尺寸收小一点，跟旁边的图标按钮对齐
    'html.gptx [data-header-host] .gptx-plus{ margin:0; flex:none; height:28px; padding:3px 10px 3px 8px; }',
    // Codex 空会话：图标放大、变淡，卡片改成白底细边框
    'html.gptx.s-codex .gptx-hero svg{ width:56px; height:56px; opacity:.55; }',
    'html.gptx.s-codex [data-testid="suggest_message_item"]{ border:1px solid var(--dbx-line-10); background:var(--dbx-bg-body-white); border-radius:14px; }',
    // ---- 建议区改成模块卡网格（ChatGPT 模式保留豆包原词，照样能点）----
    // 宽度统一：--g-mod-w 由 JS 实测输入框宽度后写到 html 上，让卡片总宽跟输入框一模一样
    'html.gptx [data-testid="office-sug-preview-direct"],' +
    'html.gptx [data-testid="suggest_message_list"]{ width:100%; max-width:var(--g-mod-w, 100%) !important; margin-left:auto; margin-right:auto; }',
    // 豆包把建议按钮装在一个 div 里：section > [h2, div > button*]，所以网格要打在里层 div 上
    'html.gptx.gridsug [data-testid="office-sug-preview-direct"] > div:not(.gptx-switch):not(.gptx-mods),' +
    'html.gptx.gridsug [data-testid="suggest_message_list"]{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; width:100%; align-items:stretch; justify-items:stretch; }',
    'html.gptx.gridsug [data-testid="office-sug-preview-direct"] > div:not(.gptx-switch):not(.gptx-mods) > button,' +
    'html.gptx.gridsug [data-testid="suggest_message_item"]{ display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-end; gap:10px; width:100%; min-height:96px; padding:14px; box-sizing:border-box; border:1px solid var(--dbx-line-10); border-radius:14px; background:var(--dbx-bg-body-white); text-align:left; font-size:13px; line-height:1.45; }',
    'html.gptx.gridsug [data-testid="office-sug-preview-direct"] > div:not(.gptx-switch):not(.gptx-mods) > button:hover{ border-color:var(--dbx-line-20-hover); }',
    'html.gptx .gptx-mods{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; width:100%; max-width:var(--g-mod-w, 100%); margin:0 auto 24px; align-items:stretch; justify-items:stretch; }',
    'html.gptx .gptx-mod{ display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-end; gap:12px; width:100%; min-height:96px; padding:14px; box-sizing:border-box; border:1px solid var(--dbx-line-10); border-radius:14px; background:var(--dbx-bg-body-white); color:var(--dbx-text-primary); font-size:13px; line-height:1.45; text-align:left; cursor:pointer; transition:border-color .14s ease,background .14s ease; }',
    'html.gptx .gptx-mod:hover{ border-color:var(--dbx-line-20-hover); background:var(--dbx-bg-float); }',
    'html.gptx .gptx-mod svg{ width:18px; height:18px; flex:none; opacity:.6; }',
    '@media (max-width:1180px){ html.gptx .gptx-mods, html.gptx.gridsug [data-testid="office-sug-preview-direct"] > div:not(.gptx-switch):not(.gptx-mods), html.gptx.gridsug [data-testid="suggest_message_list"]{ grid-template-columns:repeat(2,minmax(0,1fr)); } }',
    '@media (max-width:720px){ html.gptx .gptx-mods, html.gptx.gridsug [data-testid="office-sug-preview-direct"] > div:not(.gptx-switch):not(.gptx-mods), html.gptx.gridsug [data-testid="suggest_message_list"]{ grid-template-columns:minmax(0,1fr); } }',
    'html.gptx.s-codex [data-testid="chat_input"]{ border-radius:18px; }',
    // ---- 品牌名旁边那个小 v：只是下拉菜单的指示箭头，永远朝下 ----
    'html.gptx .gptx-brand-arrow{ color:var(--dbx-text-tertiary); transition:color .14s ease; }',
    'html.gptx .gptx-brand-arrow:hover{ color:var(--dbx-text-primary); }',
    'html.gptx .gptx-sep{ height:0.5px; margin:4px 8px; background:var(--dbx-line-10); }',
    // Codex 模式下只藏卡片容器自己的标题和卡片，不藏我们插进去的模块卡
    'html.gptx .gptx-sug-hidden > h1, html.gptx .gptx-sug-hidden > h2, html.gptx .gptx-sug-hidden > h3,' +
    'html.gptx .gptx-sug-hidden > div:not(.gptx-switch):not(.gptx-mods){ display:none !important; }',
    // ---- 获取 Plus 弹窗 ----
    'html.gptx .gptx-modal{ position:fixed; inset:0; z-index:2147483640; display:flex; align-items:center; justify-content:center; background:var(--dbx-bg-mask, rgba(0,0,0,.45)); animation:gptxFade .16s ease; }',
    'html.gptx .gptx-modal-box{ display:flex; flex-direction:column; width:min(920px,92vw); height:min(660px,86vh); border:1px solid var(--dbx-line-10); border-radius:16px; background:var(--dbx-bg-body-white); box-shadow:0 24px 72px rgba(0,0,0,.36); overflow:hidden; }',
    'html.gptx .gptx-modal-h{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px 10px 16px; border-bottom:1px solid var(--dbx-line-10); font-size:14px; font-weight:600; color:var(--dbx-text-primary); }',
    'html.gptx .gptx-modal-h div{ display:flex; align-items:center; gap:12px; }',
    'html.gptx .gptx-modal-h a{ font-size:12px; font-weight:400; color:var(--dbx-text-secondary); text-decoration:none; }',
    'html.gptx .gptx-modal-h a:hover{ color:var(--dbx-text-primary); }',
    'html.gptx .gptx-modal-x{ width:26px; height:26px; border:0; border-radius:8px; background:transparent; color:var(--dbx-text-secondary); font-size:18px; line-height:1; cursor:pointer; }',
    'html.gptx .gptx-modal-x:hover{ background:var(--dbx-fill-trans-20-hover); color:var(--dbx-text-primary); }',
    'html.gptx .gptx-modal iframe{ flex:1; width:100%; border:0; background:transparent; }',
    '@keyframes gptxFade{ from{ opacity:0 } to{ opacity:1 } }',
    // 侧栏条目圆角按 ChatGPT 的 8px
    'html.gptx [data-testid="conversation-list-v2-item"] a,' +
    'html.gptx [data-testid="conversation-list-v2-item"] > div{ border-radius:8px; }',
    'html.gptx [data-testid="conversation-list-v2-item"] a{ padding:5px 8px; }',
    // 顶部提示文字更像 ChatGPT 底部免责声明
    'html.gptx [data-testid="conversation_header_tip_text"]{ opacity:.75; }',
    // 隐藏「下载电脑版」
    'html.gptx.hidedl [data-testid="chat_header_download_client"]{ display:none !important; }',
    // Codex 皮肤：更硬的分隔线 + 终端味字重
    'html.gptx.s-codex nav{ text-transform:none; }',
    'html.gptx.s-codex [data-conversation-mode-switch]{ border-radius:12px; }',
    'html.gptx.s-codex [data-conversation-mode-switch] button{ border-radius:9px; }',
    'html.gptx.s-codex [data-conversation-mode-switch] > div[aria-hidden="true"]{ border-radius:9px; }',
    'html.gptx.s-codex [data-testid="chat_input"]{ border-radius:14px; }',
    // logo 标记跟豆包原有 svg 尺寸走，别撑坏布局
    'html.gptx .gptx-mark{ display:block; }',
    // ---- 加载动画：盖住换皮和重排的那一瞬间 ----
    'html.gptx .gptx-load{ position:fixed; inset:0; z-index:2147483646; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; transition:opacity .26s cubic-bezier(.22,.61,.36,1); will-change:opacity; }',
    'html.gptx .gptx-load.gptx-load--hide{ opacity:0; pointer-events:none; }',
    'html.gptx .gptx-load svg{ width:44px; height:44px; animation:gptxBreathe 1.4s cubic-bezier(.4,0,.6,1) infinite; }',
    'html.gptx .gptx-load i{ display:block; position:relative; width:110px; height:2px; border-radius:2px; overflow:hidden; background:rgba(125,125,125,.22); }',
    'html.gptx .gptx-load i::after{ content:""; position:absolute; top:0; left:-48%; width:48%; height:100%; border-radius:2px; background:currentColor; animation:gptxSlide 1.25s cubic-bezier(.55,.15,.45,.85) infinite; }',
    '@keyframes gptxBreathe{ 0%{ opacity:.28; transform:scale(.9) rotate(-8deg) } 50%{ opacity:.95; transform:scale(1) rotate(0deg) } 100%{ opacity:.28; transform:scale(.9) rotate(8deg) } }',
    '@keyframes gptxSlide{ 0%{ left:-48% } 62%{ left:100% } 100%{ left:100% } }',
    // 模块卡：hover 轻微抬起 + 阴影，跟 Codex 桌面版一样
    'html.gptx .gptx-mod, html.gptx.gridsug [data-testid="office-sug-preview-direct"] > div:not(.gptx-switch):not(.gptx-mods) > button{ transition:border-color .16s ease,background .16s ease,transform .16s ease,box-shadow .16s ease; }',
    'html.gptx .gptx-mod:hover{ transform:translateY(-1px); box-shadow:0 6px 18px rgba(0,0,0,.12); }',
    'html.gptx .gptx-mod:active, html.gptx .gptx-seg:active{ transform:scale(.985); }',
    // 弹窗：轻微弹出
    'html.gptx .gptx-modal-box{ animation:gptxPop .2s cubic-bezier(.22,.61,.36,1); }',
    '@keyframes gptxPop{ from{ opacity:0; transform:translateY(6px) scale(.985) } to{ opacity:1; transform:none } }',
    '@media (prefers-reduced-motion: reduce){ html.gptx .gptx-load svg, html.gptx .gptx-load i::after, html.gptx .gptx-modal-box{ animation:none; } html.gptx .gptx-load{ transition:opacity .1s linear; } html.gptx .gptx-mod:hover{ transform:none; } }'
  ].join('\n');

  /* ========== 6. 运行时 ========== */

  // 编译文案规则：exact 直接查表；substr 按长度降序，长词先吃
  var SUBSTR = TEXTS.substr.slice().sort(function (a, b) { return b[0].length - a[0].length; });

  function mapText(s) {
    if (!s) return s;
    var t = s.trim();
    if (Object.prototype.hasOwnProperty.call(TEXTS.exact, t)) {
      // 保持原来的前后空白
      return s.replace(t, TEXTS.exact[t]);
    }
    var out = s;
    for (var i = 0; i < SUBSTR.length; i++) {
      var from = SUBSTR[i][0];
      if (out.indexOf(from) === -1) continue;
      // 已经是目标词就跳过，避免自我套娃
      if (from === out) continue;
      out = out.split(from).join(SUBSTR[i][1]);
    }
    return out;
  }

  // 聊天正文一律不动，免得改坏内容
  var skipSel = CONTENT_SELECTORS.join(', ');

  function isInContent(el) {
    try { return !!(el.closest && el.closest(skipSel)); } catch (e) { return false; }
  }

  // 只在这些「界面区」里找文字，不去扫整棵树：长会话流式输出时也不会卡
  var UI_ROOTS = [
    'nav',
    'header',
    '[data-header-host]',
    '[data-testid="chat-route-layout"]',
    '[data-conversation-mode-switch]',
    '[data-empty-conversation]',
    '[data-testid="chat_input"]',
    '[data-testid="suggest_message_list"]',
    '[role="menu"]',
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[data-radix-portal]'
  ];
  // 这些区里允许「整段精确匹配」替换（输入框占位语就属于这种：是界面字，不是内容）
  var EXACT_INSIDE_CONTENT = '[data-testid="chat_input"]';

  // 每个文本节点记住它的「原文」，改名永远从原文算：
  // 这样在 ChatGPT / Codex 之间来回切，不会出现 新任务→新聊天→新对话 这种叠加改名
  var ORIG = typeof WeakMap === 'function' ? new WeakMap() : null;
  // 还要记住「我们上次写给这个节点的值」：切模式时节点当前文字是我们的旧输出，
  // 不能当成豆包改过的原文重新基线，否则 新对话 会被二次改名成 新聊天 并卡住
  var LAST = typeof WeakMap === 'function' ? new WeakMap() : null;

  // 模型名里的品牌词单独处理：只有「品牌 + 版本号」才算模型名（豆包 2.1 Lite / ChatGPT 2.1 Pro），
  // 侧栏那个光秃秃的 ChatGPT 不会被误伤
  function applyModelBrand(s) {
    if (!MODEL_BRAND || MODEL_BRAND === 'ChatGPT') return s;
    return s.replace(/(ChatGPT|Doubao|doubao|豆包)(?=[ \u00A0]*\d)/g, MODEL_BRAND);
  }

  function mapFrom(s) {
    var out = mapText(s, false);
    if (_mode === 'work' && TEXTS.mode && TEXTS.mode.work) {
      var t = out.trim();
      if (Object.prototype.hasOwnProperty.call(TEXTS.mode.work, t)) out = out.replace(t, TEXTS.mode.work[t]);
    }
    return applyModelBrand(out);
  }

  function handleTextNode(n) {
    var el = n.parentElement;
    if (!el || el.ownerDocument !== document) return;
    var cls = el.className;
    if (typeof cls === 'string' && cls.indexOf('gptx-keep') >= 0) return;
    var old = n.nodeValue;
    if (!old) return;
    var marked = !!(ORIG && ORIG.has(n));
    if (!marked && !HINT_RE.test(old)) return;
    var orig = marked ? ORIG.get(n) : old;
    if (isInContent(el)) {
      // 内容区只允许「整段等于某个 exact key」的替换，例如输入框占位语
      var t = orig.trim();
      if (!Object.prototype.hasOwnProperty.call(TEXTS.exact, t)) return;
      if (!(el.closest && el.closest(EXACT_INSIDE_CONTENT))) return;
    }
    var next = mapFrom(orig);
    if (next === old) {
      if (LAST) { try { LAST.set(n, old); } catch (e) {} }
      return;
    }
    if (old !== orig && !(LAST && LAST.get(n) === old)) {
      // 豆包自己动过这个节点（写的不是我们上次的值），以当前文字重新作为原文
      var again = mapFrom(old);
      if (again === old) return;
      orig = old;
      next = again;
    }
    n.nodeValue = next;
    if (ORIG) { try { ORIG.set(n, orig); } catch (e) {} }
    if (LAST) { try { LAST.set(n, next); } catch (e) {} }
  }

  // 粗筛：文本里一个候选首字都没有就跳过（候选字由规则表自动生成，改文案不用管这里）
  var HINT_RE = (function () {
    var chars = '';
    for (var k in TEXTS.exact) chars += k.charAt(0);
    for (var i = 0; i < SUBSTR.length; i++) chars += SUBSTR[i][0].charAt(0);
    if (TEXTS.mode) for (var m in TEXTS.mode) for (var j in TEXTS.mode[m]) chars += j.charAt(0);
    chars = chars.replace(/[.*+?^${}()|[\]\\\-]/g, function (c) { return '\\' + c; });
    return new RegExp('[' + chars + ']');
  })();

  function renameTextNodes() {
    if (!document.body) return;
    for (var r = 0; r < UI_ROOTS.length; r++) {
      var roots;
      try { roots = document.querySelectorAll(UI_ROOTS[r]); } catch (e) { continue; }
      for (var i = 0; i < roots.length; i++) {
        var w = document.createTreeWalker(roots[i], NodeFilter.SHOW_TEXT, null, null);
        var n;
        while ((n = w.nextNode())) handleTextNode(n);
      }
    }
  }

  function renameAttributes() {
    if (!document.body) return;
    var sel = TEXT_ATTRS.map(function (a) { return '[' + a + ']'; }).join(',');
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (isInContent(el)) continue;
      for (var j = 0; j < TEXT_ATTRS.length; j++) {
        var a = TEXT_ATTRS[j];
        if (!el.hasAttribute(a)) continue;
        var v = el.getAttribute(a);
        var nv = applyModelBrand(mapText(v));
        if (nv !== v) el.setAttribute(a, nv);
      }
    }
  }

  /* ---- logo ---- */
  function paintLogos() {

    var svgs = document.querySelectorAll('svg');
    var skin = resolveSkin();
    for (var i = 0; i < svgs.length; i++) {
      var svg = svgs[i];
      if (svg.getAttribute('data-gptx-caret') === '1') continue; // 那个小 v 是折叠按钮，不当 logo 换
      var p = svg.querySelector('path');
      if (!p) continue;
      var d = p.getAttribute('d') || '';
      var isDoubao = DOUBAO_PATH_HINTS.some(function (h) { return d.indexOf(h) === 0; });
      var already = svg.classList.contains('gptx-mark');
      if (!isDoubao && !already) continue;
      if (already && svg.getAttribute('data-skin') === skin) continue;
      // 只换「品牌位置」的标记：左上角工作区、空会话大图，以及 20px 以上的图标。
      // 输入框里那些 14px 的小箭头/小标记形状跟豆包 logo 同源，换了会很碎
      var brand = svg.closest && svg.closest('[data-testid="workspace-switch-chip"], .gptx-hero');
      if (!brand) {
        var box = svg.getBoundingClientRect();
        if (box.width < 20 || box.height < 20) continue;
      }
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', LOGO[skin].fill);
      svg.setAttribute('stroke', LOGO[skin].stroke || 'none');
      svg.setAttribute('data-skin', skin);
      svg.classList.add('gptx-mark');
      svg.innerHTML = LOGO[skin].inner;
    }
    // 图片形式的豆包 logo
    var imgs = document.querySelectorAll('img');
    var stamp = skin + '-' + resolveTheme();
    for (var k = 0; k < imgs.length; k++) {
      var im = imgs[k];
      var src = im.getAttribute('src') || '';
      var mine = im.getAttribute('data-gptx-mark');
      if (mine === stamp) continue;
      if (mine || DOUBAO_IMG_HINT.test(src) || im.getAttribute('alt') === '豆包') {
        im.src = markURI(skin, resolveTheme() === 'dark');
        im.setAttribute('data-gptx-mark', stamp);
      }
    }
  }

  function paintFavicon() {

    var uri = faviconURI(resolveSkin());
    var links = document.querySelectorAll('link[rel*="icon"], link[rel*="apple-touch"]');
    if (!links.length) {
      var l = document.createElement('link');
      l.rel = 'icon';
      l.type = 'image/svg+xml';
      (document.head || root).appendChild(l);
      links = [l];
    }
    for (var i = 0; i < links.length; i++) {
      if (links[i].href !== uri) links[i].href = uri;
    }
    var old = document.querySelector('link[data-gptx-fallback]');
    if (old) old.remove();
  }

  /* ---- 问候语上方的图标 ---- */
  function paintHero() {
    var greet = document.querySelector('div[class*="greeting-height"]');
    if (!greet || !greet.parentElement) return;
    var parent = greet.parentElement;
    var skin = resolveSkin();
    // 豆包在「工作」模式的问候语上方放了自己的品牌图，藏掉，由我们的图标接管
    for (var s = greet.previousElementSibling; s; s = s.previousElementSibling) {
      if (s.classList && s.classList.contains('gptx-hero')) continue;
      if (s.tagName === 'IMG' || s.tagName === 'PICTURE' || (s.querySelector && s.querySelector('img'))) {
        s.classList.add('gptx-hide');
      }
    }
    var heroList = document.querySelectorAll('.gptx-hero');
    var hero = heroList.length ? heroList[0] : null;
    for (var h = 1; h < heroList.length; h++) heroList[h].remove(); // 全局只留一个
    if (!hero) {
      hero = document.createElement('div');
      hero.className = 'gptx-hero';
      hero.setAttribute('aria-hidden', 'true');
      parent.insertBefore(hero, greet);
    } else if (hero.parentElement !== parent || hero.nextElementSibling !== greet) {
      parent.insertBefore(hero, greet); // 豆包重排过就放回问候语上面
    }
    if (hero.getAttribute('data-skin') === skin && hero.firstChild) return;
    var box = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    box.setAttribute('viewBox', '0 0 24 24');
    box.setAttribute('fill', LOGO[skin].fill);
    box.setAttribute('stroke', LOGO[skin].stroke || 'none');
    box.setAttribute('stroke-linecap', 'round');
    box.setAttribute('stroke-linejoin', 'round');
    box.classList.add('gptx-mark');
    box.innerHTML = LOGO[skin].inner; // 内容是本脚本里写死的常量，不含外部数据
    hero.textContent = '';
    hero.appendChild(box);
    hero.setAttribute('data-skin', skin);
  }

  /* ---- 侧栏 ChatGPT / Codex 切换 ---- */
  function segSVG(skin) {
    return '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">' +
      (skin === 'codex' ? MARK_CODEX : MARK_CHATGPT) + '</svg>';
  }

  function switchMode(target) {
    var sw = document.querySelector('[data-conversation-mode-switch]');
    var btns = sw ? [].slice.call(sw.querySelectorAll('button')) : [];
    if (btns.length >= 2) { btns[target === 'work' ? 1 : 0].click(); afterSwitch(target); return true; }
    // 会话页没有那个胶囊，退回侧栏的「新任务 / 新聊天」
    var alt = document.querySelector(target === 'work'
      ? '[data-testid="create_office_task_button"]'
      : '[data-testid="create_conversation_button"]');
    if (alt) { alt.click(); afterSwitch(target); return true; }
    return false;
  }

  function afterSwitch(target) {
    if (target) _mode = target; // 先乐观换皮
    applyClasses();
    applyTokens();              // 底色/图标立刻按新模式刷一遍，动画盖住豆包重渲染，淡出时已是新皮肤
    showLoading(SWITCH_FLASH_MS, false); // 切模式不等字体，免得拖到上限
  }

  // 切换列表只放在「任务台」下拉菜单里（点品牌名弹出：医生应用 / 金融投研应用…），
  // 菜单没挂载时不塞到别处，免得位置跳来跳去
  function menuHost() { return document.querySelector('[data-testid="workbench-sidebar-dropdown"]'); }

  function buildSwitch() {
    var host = menuHost();
    if (!host) return null;
    // 全局只留一个：豆包重渲染时层级会变，只按当前 host 找会在两个位置各插一个
    var found = document.querySelectorAll('.gptx-switch');
    var box = found.length ? found[0] : null;
    for (var d = 1; d < found.length; d++) found[d].remove();
    if (!box) {
      box = document.createElement('div');
      box.className = 'gptx-switch';
      box.setAttribute('role', 'tablist');
      box.innerHTML =
        '<button type="button" class="gptx-seg" role="tab" data-mode="chat">' + segSVG('chatgpt') + '<span>ChatGPT</span></button>' +
        '<button type="button" class="gptx-seg" role="tab" data-mode="work">' + segSVG('codex') + '<span>Codex</span></button>';
      box.addEventListener('click', function (e) {
        var seg = e.target && e.target.closest ? e.target.closest('.gptx-seg') : null;
        if (!seg) return;
        e.preventDefault();
        switchMode(seg.getAttribute('data-mode'));
        // 选完模拟 Esc 把菜单关掉，跟点其它菜单条目一致
        var menuEl = box.closest('[role="menu"], [data-slot="dropdown-menu-content"]');
        if (menuEl) menuEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        setTimeout(schedule, 150);
      });
    }
    // 分隔线 + 列表放在「更多应用」下面
    var sep = host.querySelector(':scope > .gptx-sep');
    if (!sep) {
      sep = document.createElement('div');
      sep.className = 'gptx-sep';
      sep.setAttribute('role', 'separator');
    }
    if (box.parentElement !== host || box.previousElementSibling !== sep) {
      host.appendChild(sep);
      host.appendChild(box);
    }
    return box;
  }

  function syncSwitch(box) {
    var segs = box.querySelectorAll('.gptx-seg');
    for (var i = 0; i < segs.length; i++) {
      var on = segs[i].getAttribute('data-mode') === _mode;
      segs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      segs[i].setAttribute('tabindex', on ? '0' : '-1');
    }
  }

  /* ---- Codex 桌面版专属装饰 ---- */
  var SPARK_D = 'M12 2.4c1.1 5.6 3.2 7.7 8.8 8.8-5.6 1.1-7.7 3.2-8.8 8.8-1.1-5.6-3.2-7.7-8.8-8.8 5.6-1.1 7.7-3.2 8.8-8.8z';

  // 模块卡图标：放大镜 / 代码尖括号 / 眼睛 / 齿轮，都是直线圆弧，画得准才不像糊的
  var MOD_ICONS = {
    search: '<circle cx="11" cy="11" r="6.2"></circle><path d="M15.6 15.6 20 20"></path>',
    code: '<path d="M8.5 6 3.5 12l5 6"></path><path d="M15.5 6l5 6-5 6"></path>',
    eye: '<path d="M2.6 12S6.2 5.8 12 5.8 21.4 12 21.4 12 17.8 18.2 12 18.2 2.6 12 2.6 12z"></path><circle cx="12" cy="12" r="2.6"></circle>',
    gear: '<circle cx="12" cy="12" r="3.2"></circle><path d="M12 2.6v3M12 18.4v3M2.6 12h3M18.4 12h3M5.4 5.4l2.1 2.1M16.5 16.5l2.1 2.1M18.6 5.4l-2.1 2.1M7.5 16.5l-2.1 2.1"></path>'
  };
  // 对照截图里的四个模块
  var CODEX_MODULES = [
    { icon: 'search', text: '探索并理解代码' },
    { icon: 'code', text: '构建新功能、应用或工具' },
    { icon: 'eye', text: '审查代码并提出修改建议' },
    { icon: 'gear', text: '修复问题和失败' }
  ];

  // Plus 药丸放在顶栏右侧动作组（就是侧边栏右边那一排）
  function plusHost() {
    var host = document.querySelector('[data-header-host]');
    if (!host) return null;
    for (var c = host.firstElementChild; c; c = c.nextElementSibling) {
      if (/justify-end/.test(String(c.className))) return c;
    }
    return host;
  }

  function paintPlus() {
    var all = document.querySelectorAll('.gptx-plus');
    var chip = all.length ? all[0] : null;
    for (var x = 1; x < all.length; x++) all[x].remove(); // 全局只留一个
    var host = _mode === 'work' ? plusHost() : null;
    if (!host) { if (chip) chip.remove(); return; }
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'gptx-plus';
      chip.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + SPARK_D + '"></path></svg><span>获取 Plus</span>';
      chip.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openPlusModal(); });
    }
    if (chip.parentElement !== host) host.appendChild(chip);
  }

  function moduleClick(text) {
    var ed = document.querySelector('[data-testid="chat_input"] .tiptap') ||
      document.querySelector('.tiptap.ProseMirror') || document.querySelector('[contenteditable="true"]');
    if (!ed) return;
    ed.focus();
    // ProseMirror 吃 beforeinput，execCommand 插进去就是真的进了输入框；插不进去至少光标到位
    try { document.execCommand('insertText', false, text + ' '); } catch (e) {}
  }

  // 卡片总宽对齐输入框：豆包给容器写的 max-width 比输入框窄，所以实测一次输入框宽度塞进 --g-mod-w
  function syncContentWidth() {
    var input = document.querySelector('[data-testid="chat_input"]');
    if (!input) return;
    var w = Math.round(input.getBoundingClientRect().width);
    if (!(w > 200) || w > 4000) return;
    var want = w + 'px';
    if (root.style.getPropertyValue('--g-mod-w') !== want) root.style.setProperty('--g-mod-w', want);
  }

  function paintModules() {
    var sec = document.querySelector('[data-testid="office-sug-preview-direct"]');
    var list = document.querySelector('[data-testid="suggest_message_list"]');
    var grid = document.querySelector('.gptx-mods');
    var all = document.querySelectorAll('.gptx-mods');
    for (var z = 1; z < all.length; z++) all[z].remove();
    var want = !!true && _mode === 'work' && !!(sec || list);
    if (!want) {
      if (grid) grid.remove();
      if (sec) sec.classList.remove('gptx-sug-hidden');
      if (list) list.classList.remove('gptx-hide');
      return;
    }
    var host, ref = null;
    if (sec) {
      sec.classList.add('gptx-sug-hidden'); // 只藏卡片，不藏我们插的东西
      host = sec;
      ref = sec.firstElementChild;         // 模块卡放最上面，切换列表还在末尾
    } else {
      list.classList.add('gptx-hide');
      host = list.parentElement;
      ref = list;
    }
    var sig = CODEX_MODULES.map(function (m) { return m.text; }).join('|');
    if (grid && grid.getAttribute('data-mods') !== sig) { grid.remove(); grid = null; }
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'gptx-mods';
      grid.setAttribute('data-mods', sig);
      var html = '';
      for (var i = 0; i < CODEX_MODULES.length; i++) {
        var m = CODEX_MODULES[i];
        html += '<button type="button" class="gptx-mod" data-text="' + m.text + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          MOD_ICONS[m.icon] + '</svg><span>' + m.text + '</span></button>';
      }
      grid.innerHTML = html;
      grid.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.gptx-mod') : null;
        if (b) moduleClick(b.getAttribute('data-text'));
      });
    }
    if (grid.parentElement !== host || grid.nextElementSibling !== ref) host.insertBefore(grid, ref);
  }

  function safePlusUrl() {
    return /^https?:\/\//.test(PLUS_URL || '') ? PLUS_URL : 'https://www.doubao.com/member/subscription';
  }

  function onModalEsc(e) {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    closePlusModal();
  }

  function closePlusModal() {
    var m = document.querySelector('.gptx-modal');
    if (m) m.remove();
    document.removeEventListener('keydown', onModalEsc, true);
  }

  function openPlusModal() {
    var url = safePlusUrl();
    if (document.querySelector('.gptx-modal')) return;
    
    var box = document.createElement('div');
    box.className = 'gptx-modal';
    // iframe 的 src 固定用白名单校验过的 URL，不用任意配置串
    box.innerHTML = '<div class="gptx-modal-box">' +
      '<div class="gptx-modal-h"><span>获取 Plus</span><div>' +
      '<a href="' + url + '" target="_blank" rel="noopener">新标签页打开</a>' +
      '<button type="button" class="gptx-modal-x" aria-label="关闭">×</button></div></div>' +
      '<iframe src="' + url + '" title="获取 Plus"></iframe></div>';
    box.addEventListener('click', function (e) {
      if (e.target === box) { closePlusModal(); return; }
      var x = e.target.closest ? e.target.closest('.gptx-modal-x') : null;
      if (x) closePlusModal();
    });
    document.body.appendChild(box);
    document.addEventListener('keydown', onModalEsc, true);
  }

  /* ---- 侧栏顶部：字样跟着模式走 + 小箭头折叠切换开关 ---- */
  function paintBrand() {
    var chip = document.querySelector('[data-testid="workspace-switch-chip"]');
    if (!chip) return;
    var want = resolveSkin() === 'codex' ? 'Codex' : 'ChatGPT';
    var span = chip.querySelector('span');
    if (span) {
      span.classList.add('gptx-keep'); // 这一处由下面按模式定字，通用改名跳过
      if (span.textContent.trim() !== want) span.textContent = want;
    }
    // 豆包在这个位置放的是它自己的品牌标记；换成向下的小 v（chevron）当菜单指示箭头，
    // 点击行为仍归豆包自己（打开任务台菜单），我们不拦事件
    var arrow = chip.querySelector('svg');
    if (!arrow) return;
    arrow.classList.add('gptx-brand-arrow');
    if (arrow.getAttribute('data-gptx-caret') !== '1') {
      arrow.setAttribute('data-gptx-caret', '1');
      arrow.setAttribute('viewBox', '0 0 24 24');
      arrow.setAttribute('fill', 'none');
      arrow.setAttribute('stroke', 'currentColor');
      arrow.setAttribute('stroke-width', '1.9');
      arrow.setAttribute('stroke-linecap', 'round');
      arrow.setAttribute('stroke-linejoin', 'round');
      arrow.innerHTML = '<path d="M6.6 9.4 12 14.8 17.4 9.4"></path>';
    }
  }

  /* ---- 新对话 / 新任务：每个模式只留自己那一个入口 ---- */
  function paintEntries() {
    var pairs = [
      ['[data-testid="create_conversation_button"]', 'chat'], // 豆包的「新对话」
      ['[data-testid="create_office_task_button"]', 'work']   // 豆包的「新工作任务」
    ];
    for (var p = 0; p < pairs.length; p++) {
      var nodes = document.querySelectorAll(pairs[p][0]);
      var hide = _mode !== pairs[p][1];
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.toggle('gptx-hide', hide);
    }
  }

  /* ---- 加载动画 ---- */
  var loadEl = null, loadTimer = null, loadShownAt = 0, loadDeadline = 0, loadDwellAt = 0;
  var loadSig = '', loadStable = 0, loadFontsGate = true, lastHref = '';

  // 字体换页（font swap）本身会让文字重新排版，所以字体没加载完也不许淡出
  var fontsReady = true;
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    fontsReady = document.fonts.status === 'loaded';
    if (!fontsReady) {
      document.fonts.ready.then(function () { fontsReady = true; }, function () { fontsReady = true; });
    }
  }

  // 关键区域的尺寸指纹：右栏还在自己排版时这个值一直在变，变了就说明还没稳
  function layoutSig() {
    var rect = function (sel) {
      var n = document.querySelector(sel);
      if (!n) return '-';
      var b = n.getBoundingClientRect();
      return Math.round(b.top) + '_' + Math.round(b.left) + '_' + Math.round(b.width) + '_' + Math.round(b.height);
    };
    return rect('[data-testid="chat-route-layout"]') + '#' + rect('[data-testid="chat_input"]') + '#' +
      rect('div[class*="greeting-height"]') + '#' + rect('[data-testid="message-list"]') + '#' + rect('nav');
  }

  function loadColors() {
    var th = resolveTheme(), skin = resolveSkin();
    var tok = {};
    for (var k in PALETTE[th]) tok[k] = PALETTE[th][k];
    if (skin === 'codex') for (var k2 in CODEX_TOKENS[th]) tok[k2] = CODEX_TOKENS[th][k2];
    return {
      bg: tok['--dbx-bg-body-web'] || (th === 'dark' ? '#212121' : '#ffffff'),
      fg: tok['--dbx-text-primary'] || (th === 'dark' ? '#ececec' : '#171717')
    };
  }

  function ensureLoading() {
    if (loadEl && loadEl.parentNode) return loadEl;
    loadEl = document.createElement('div');
    loadEl.className = 'gptx-load';
    loadEl.setAttribute('aria-hidden', 'true');
    loadEl.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd"></svg><i></i>';
    (document.body || root).appendChild(loadEl);
    return loadEl;
  }

  // 图标和底色跟着当前皮肤/深浅色走，免得动画本身也在闪
  function paintLoading() {
    if (!loadEl || !loadEl.parentNode) return;
    var skin = resolveSkin();
    var svg = loadEl.querySelector('svg');
    var want = skin === 'codex' ? MARK_CODEX : MARK_CHATGPT;
    if (svg.getAttribute('data-skin') !== skin) {
      svg.setAttribute('data-skin', skin);
      svg.innerHTML = want;
    }
    var c = loadColors();
    loadEl.style.background = c.bg;
    loadEl.style.color = c.fg;
  }

  function appReady() {
    var side = document.querySelector('[data-testid="flow_chat_sidebar"]');
    if (!side) return false;
    if (/\/chat\/\d/.test(location.pathname)) {
      var list = document.querySelector('[data-testid="message-list"]');
      return !!(list && list.children.length);
    }
    return !!document.querySelector('[data-testid="chat_input"]');
  }

  function showLoading(dwellMs, needFonts) {
        // 加载动画总是开着
    var el = ensureLoading();
    paintLoading();
    // 直接闪现：先关过渡、去掉隐藏类、强制回流，再恢复过渡 —— 这样只有淡出是动画
    el.style.transition = 'none';
    el.classList.remove('gptx-load--hide');
    void el.offsetWidth;
    el.style.transition = '';
    var now = Date.now();
    loadShownAt = now;
    loadDwellAt = now + (dwellMs || LOAD_MIN_MS);
    loadDeadline = now + LOAD_MAX_MS;   // 硬上限，到点一定放行
    loadFontsGate = needFonts !== false;     // 只有开屏才等字体；切模式等字体会拖到上限
    loadSig = '';
    loadStable = 0;
    if (!loadTimer) loadTimer = setInterval(tickLoading, 90);
  }

  function tickLoading() {
    if (!loadEl || !loadEl.parentNode) { clearInterval(loadTimer); loadTimer = null; return; }
    var now = Date.now();
    if (now >= loadDeadline) { closeLoading(); return; }
    if (now < loadDwellAt || !appReady()) return;
    if (loadFontsGate && !fontsReady) return;
    var sig = layoutSig();
    if (sig === loadSig) loadStable++; else { loadStable = 0; loadSig = sig; }
    if (loadStable >= (STABLE_FRAMES || 4)) closeLoading();
  }

  function closeLoading() {
    if (loadTimer) { clearInterval(loadTimer); loadTimer = null; }
    if (loadEl) loadEl.classList.add('gptx-load--hide');
  }

  // SPA 换页：豆包用的是自己的路由，content script 里改 history 拦不住，只能盯 URL。
  // 换页只用来收掉弹窗；切会话不闪加载动画（按你的要求），只有模式切换才闪。
  function watchNavigation() {
    lastHref = location.href;
    window.addEventListener('popstate', closePlusModal);
    setInterval(function () {
      if (location.href === lastHref) return;
      lastHref = location.href;
      closePlusModal();
    }, 180);
  }

  /* ---- 模式 / 主题 ---- */
  var _mode = 'chat';
  function mode() { return _mode; }

  function detectMode() {
    var sw = document.querySelector('[data-conversation-mode-switch]');
    if (!sw) return _mode;
    var btns = [].slice.call(sw.querySelectorAll('button'));
    if (btns.length < 2) return _mode;
    var idx = -1;
    for (var i = 0; i < btns.length; i++) {
      var c = btns[i].className || '';
      if (c.indexOf('font-medium') >= 0 && c.indexOf('text-dbx-text-secondary') < 0) { idx = i; break; }
    }
    if (idx < 0) {
      // 退路：看滑块位置
      var pill = sw.querySelector('div[aria-hidden="true"]');
      if (pill) {
        var m = /translateX\((-?[\d.]+)px\)/.exec(pill.style.transform || '');
        if (m && parseFloat(m[1]) > 0) idx = 1;
      }
    }
    if (idx >= 0) _mode = idx === 0 ? 'chat' : 'work';
    return _mode;
  }

  // 深浅色固定暗色（ChatGPT 深灰 #212121 正文 + #171717 侧栏），靠 syncDoubaoTheme 把豆包自己的开关也翻过去
  function resolveTheme() { return 'dark'; }

  // 皮肤跟着当前标签走：对话 = ChatGPT，工作 = Codex
  function resolveSkin() { return _mode === 'work' ? 'codex' : 'chatgpt'; }

  function applyTokens() {
    var th = resolveTheme();
    var skin = resolveSkin();
    var map = {};
    var merge = function (o) { for (var k in o) map[k] = o[k]; };
    merge(PALETTE[th]);
    if (skin === 'codex') merge(CODEX_TOKENS[th]);
    var ac = ACCENT[skin][th];
    merge({
      '--dbx-brand-default': ac.solid,
      '--dbx-fill-highlight': ac.solid,
      '--dbx-fill-highlight-hover': ac.hover,
      '--dbx-fill-highlight-disable': ac.weaker,
      '--dbx-fill-highlight-trans-10': ac.weak,
      '--dbx-fill-highlight-trans-10-blank': ac.weak,
      '--dbx-line-highlight': ac.weak,
      '--dbx-text-highlight': ac.text,
      '--dbx-text-highlight-hover': ac.hover,
      '--dbx-text-highlight-secondary': ac.text,
      '--dbx-text-highlight-disable': ac.weaker,
      '--dbx-fill-primary-50': ac.solid,
      '--dbx-fill-primary-60': ac.pressed,
      '--dbx-fill-primary-transparent-1': ac.weaker,
      '--s-color-brand-primary-default': ac.solid,
      '--s-color-brand-primary-default-raw': ac.raw,
      '--s-color-brand-primary-hover': ac.hover,
      '--s-color-brand-primary-hover-raw': ac.raw,
      '--s-color-brand-primary-pressed': ac.pressed,
      '--s-color-brand-primary-pressed-raw': ac.raw,
      '--s-color-brand-primary-disable': ac.weaker,
      '--s-color-brand-primary-transparent-1': ac.weaker,
      '--s-color-brand-primary-transparent-2': ac.weak,
      '--s-color-brand-primary-transparent-3': ac.weak,
      '--color-brand-primary': ac.solid,
      '--dbd-theme-highlight-weak-bg-1': ac.weaker,
      '--dbd-theme-highlight-weak-bg-2': ac.weak,
      '--dbd-theme-highlight-weak-bg-3': ac.weak,
      '--dbd-theme-highlight-weak-border': ac.weak,
      '--dbd-theme-text-highlight-2': ac.text,
      '--dbd-theme-text-highlight-3': ac.text,
      // 字体
      '--s-font-family': (skin === 'codex' && true) ? FONTS.sans : FONTS.sans,
      '--font-sans': FONTS.sans,
      '--font-dbx-sans-serif': FONTS.sans,
      '--font-mono': FONTS.mono,
      '--dbx-font-mono': FONTS.mono,
      '--dbd-font-mono': FONTS.mono,
      '--color-text-primary': th === 'dark' ? '#ececec' : '#222222',
      // 输入框占位语（按当前标签给值，CSS 里用 content:var(--g-ph) 吃掉豆包的重渲染）
      '--g-ph': JSON.stringify(_mode === 'work' ? TEXTS.placeholderByMode.work : TEXTS.placeholderByMode.chat),
      'color-scheme': th
    });
    for (var key in map) {
      if (key === 'color-scheme') continue;
      if (root.style.getPropertyValue(key) !== map[key]) root.style.setProperty(key, map[key]);
    }
    root.style.setProperty('color-scheme', th);
  }

  function applyClasses() {
    var skin = resolveSkin();
    var th = resolveTheme();
    root.classList.add('gptx');
    root.classList.toggle('s-chatgpt', skin === 'chatgpt');
    root.classList.toggle('s-codex', skin === 'codex');
    root.classList.toggle('t-light', th === 'light');
    root.classList.toggle('t-dark', th === 'dark');
    root.classList.add('hidedl');
    root.classList.add('hidemsw');
    root.classList.add('gridsug');
  }

  function setTitle() {
    
    var want = resolveSkin() === 'codex' ? 'Codex' : 'ChatGPT';
    var cur = document.title || '';
    var m = /^(.*?)\s*-\s*(.+)$/.exec(cur);
    var nt;
    if (m && /豆包|doubao|ChatGPT|Codex/i.test(m[2])) {
      // 「会话名 - 豆包」只动后缀，别碰会话名本身
      nt = m[1] + ' - ' + want;
    } else {
      nt = mapText(cur);
      if (/字节跳动|AI 智能助手/.test(nt)) nt = want; // 首页长标题收敛成一个词
      // 像「豆包任务伙伴」这种没有分隔符的营销标题，换完名很别扭，直接收成品牌词
      if (nt !== cur && nt.indexOf(' - ') < 0 && nt.length > 10) nt = want;
    }
    if (nt && nt !== cur) document.title = nt;
  }

  /* ---- 一次性刷新 ---- */
  var queued = false;
  var appliedTitle = 0;
  var lastRun = 0;
  var MIN_GAP = 250; // 毫秒；流式输出时别每帧全扫

  function refresh(force) {
    lastRun = Date.now();
    detectMode();
    applyClasses();
    applyTokens();
    renameTextNodes();
    renameAttributes();
    paintBrand();
    if (Date.now() - appliedTitle > 800 || force) { setTitle(); appliedTitle = Date.now(); }
    paintLogos();
    paintFavicon();
    paintHero();
    var box = buildSwitch();
    if (box) syncSwitch(box);
    paintPlus();
    paintEntries();
    paintModules();
    syncContentWidth();
    paintLoading();
    var stale = document.querySelector('.gptx-check'); // 旧版本的「开始使用」卡片残留
    if (stale) stale.remove();
  }

  function schedule(delay) {
    if (queued) return;
    queued = true;
    var wait = Math.max(delay || 0, MIN_GAP - (Date.now() - lastRun));
    var run = function () {
      queued = false;
      try { refresh(false); } catch (e) { console.warn('[ChatGPT/Codex 换皮]', e); }
    };
    // 后台标签页里 rAF 是冻结的，用 rAF 会把刷新卡死到用户切回来为止；隐藏时改用定时器
    if (document.hidden) setTimeout(run, Math.max(wait, MIN_GAP));
    else if (wait > 0) setTimeout(run, wait);
    else requestAnimationFrame(run);
  }

  /* ---- 启动 ---- */
  function injectStyle() {
    var st = document.getElementById('gptx-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'gptx-style';
      (document.head || root).appendChild(st);
    }
    // 值没变就不要重写，否则会把 MutationObserver 点着形成死循环
    if (st.textContent !== STYLE) st.textContent = STYLE;
  }

  // 深浅色用豆包自己的开关（localStorage 的 dbx-web-theme），别去伪造 data-theme：
  // 伪造只会让一半组件按深色、一半按浅色渲染，看着就是「变了但很乱」
  var THEME_KEY = 'dbx-web-theme';
  function syncDoubaoTheme() {
    var want = 'dark';
    var cur = null;
    try { cur = localStorage.getItem(THEME_KEY); } catch (e) { return; }
    if (cur === want) {
      try { sessionStorage.removeItem('gptx.theme.reload'); } catch (e) {}
      return;
    }
    if (cur === null) return; // 拿不到豆包的开关就不硬来
    var tried = null;
    try { tried = sessionStorage.getItem('gptx.theme.reload'); } catch (e) {}
    if (tried === want) return; // 已经试过一回了，不再刷新，避免死循环
    try {
      localStorage.setItem(THEME_KEY, want);
      sessionStorage.setItem('gptx.theme.reload', want);
    } catch (e) { return; }
    location.reload();
  }

  function boot() {
    injectStyle();
    syncDoubaoTheme();
    refresh(true);
    showLoading();
    watchNavigation();
    var mo = new MutationObserver(function (muts) {
      // 自己改的 class/style 也走这里，但所有写操作都是幂等的，不会打转
      // 标题（切会话时 SPA 会改）必须放行，否则要等定时轮询才更新
      var interesting = false;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes' && (m.target === document || m.target === root)) continue;
        interesting = true;
        break;
      }
      if (interesting) schedule();
    });
    mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'placeholder', 'data-placeholder', 'aria-label', 'title', 'href'] });
    // 输入法/流式输出时别太频繁
    setInterval(function () { schedule(); }, 1500);
    document.addEventListener('DOMContentLoaded', function () { refresh(true); });
    window.addEventListener('load', function () { refresh(true); });
    // 拖窗口/最大化时输入框宽度会变，立刻重测，卡片宽度才跟得上
    window.addEventListener('resize', function () { schedule(0); }, { passive: true });
    // 从后台标签页切回来时立刻刷一次（后台时定时器被浏览器限流，回来要马上补齐）
    document.addEventListener('visibilitychange', function () { if (!document.hidden) schedule(0); });
  }

  if (document.readyState === 'loading') {
    injectStyle();
    // 豆包还没开始画就把底色和动画挂上，免得先白一下再变深色
    applyClasses();
    applyTokens();
    showLoading();
    document.addEventListener('DOMContentLoaded', boot);
    // 先扫一次，减少闪烁
    MutationObserver && schedule();
  } else {
    boot();
  }

  console.log('[Codex 爆改chatgpt/codex] v' + VERSION + ' 已启动');
})();
