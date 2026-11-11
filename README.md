# ChatDou — 豆包网页版 ChatGPT / Codex 换肤

一个只改界面的用户脚本（UserScript）。装上之后，豆包网页版的「对话」变成 ChatGPT、「工作」变成 Codex，logo、favicon、配色、字体、圆角、输入框和空会话欢迎页都按对应产品的风格重绘。

只改外观，不改聊天内容，不上传任何数据，也不调用任何外部接口。

## 安装

1. 先装一个用户脚本管理器：[ScriptCat](https://scriptcat.org/) 或 Tampermonkey。
2. 新建脚本，把 `chatdou.js` 的内容整段粘贴进去保存，或者直接进入 https://scriptcat.org/zh-CN/script-show-page/9025 安装。
3. 打开 <https://www.doubao.com/chat> 刷新页面。控制台出现 `[Codex 爆改chatgpt/codex] v… 已启动` 即为生效。

## 说明

- 只作用于 `https://www.doubao.com/chat*` 与 `https://www.doubao.com/`，`@grant none`，不申请任何特殊权限。
- 行为全部写死，没有配置项；想改文案、配色、图标，直接改文件里的 `TEXTS`、`PALETTE`、`CODEX_TOKENS`、`LOGO` 四块。
- 豆包前端改版后选择器可能失效，届时需要跟着调整 `data-testid` 之类的挂载点。
- 与豆包官方无关，仅供个人界面定制使用。

## 许可

MIT
