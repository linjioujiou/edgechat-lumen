# Lumen 设计系统 · 前端重设计说明

> 本文件描述这次前端重设计的**设计约定**与**改动边界**。
> 目标不是"换配色"，而是把原本散落在 20 多个文件里的视觉常量收敛成一套可验证的令牌体系，
> 并把界面语言统一到「现代科技 + 简洁 + 苹果式层次」。
> 后台布局约定仍见 `design.md`（本文不覆盖它）。

---

## 1. 设计目标与判据

| 目标 | 落地方式 | 可验证判据 |
| --- | --- | --- |
| 简洁 | 单一强调色、单一中性灰阶、无装饰性渐变堆叠 | 全站只有 1 个强调色令牌；`body` 无彩色背景图 |
| 现代科技 | 系统字体栈、细发丝分隔、玻璃材质、克制的环境光 | `--font-sans` 首项为 `-apple-system`；零外部字体请求 |
| 苹果式层次 | 三级文字灰阶 + 多层叠加阴影 + 大圆角窗口 | 文字对比度全部 ≥ 4.5:1；窗口圆角 26px |
| 有动效但不吵 | 只在"出现 / 切换 / 按压 / 聚焦"四处给反馈 | 过渡 ≤ 640ms，`prefers-reduced-motion` 下全部关闭 |

---

## 2. 令牌（唯一真源）

`frontend/src/styles/lumen/tokens.css`

### 颜色

- **中性阶**：`--lumen-canvas #f5f5f7` → `--lumen-elevated #fff`；文字
  `--lumen-ink #1d1d1f` / `ink-2 #424245` / `ink-3 #5f5f65` / `ink-4 #6e6e73` /
  `ink-5 #8e8e93`（仅图形）。每档正文色在白底与画布上都通过 4.5:1，`ink-5` 不承载文字。
- **强调色**：`--lumen-accent #0071e3`。**填充与文字必须分两支**：
  `--lumen-accent` 给图标 / 描边 / 填充底（配白字 4.70:1）；
  `--lumen-accent-text #0059b3` 给浅色底上的文字（5.38:1）。
  两者对明度的要求相反，一个令牌无法同时满足。
- **语义色**：成功 `#1f7a34`、警告 `#b25000`、危险 `#d70015`。
  Apple 原生的 `#34c759` 在白底只有 2.0:1，连图形的 3:1 都不到，因此压深使用。
- **站点可配置**：`--site-brand` / `--site-brand-rgb` / `--site-action-*` 全部保留，
  后台「站点外观」切换主题时依然生效，默认值指向强调色。

### 字体

```
--font-sans:    -apple-system, "SF Pro Text", "Segoe UI Variable Text", "PingFang SC", …
--font-display: "SF Pro Display", …    标题，字距 -0.022em ~ -0.035em
--font-mono:    "SF Mono", ui-monospace, …
```

**不下载任何外部字体。** 原登录 / 注册页依赖 Google Fonts 的 Dancing Script / Great Vibes
书写体，已整体移除（`auth-fonts.js` 变为空实现），首屏不再有字体请求，断网也不会字体跳变。

### 尺度

圆角 6 / 8 / 10 / 12 / 16 / 20 / 26 / 999；间距取 4 的倍数；
控件高度 44（触控）/ 46（表单）/ 48（主按钮）。

### 动效

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--ease-standard` | `cubic-bezier(.32,.72,0,1)` | 绝大多数状态过渡（起步快、收尾极缓） |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | 入场 |
| `--ease-spring` | `cubic-bezier(.34,1.42,.64,1)` | 徽标 / 面板弹出（唯一带过冲的曲线） |
| `--dur-1…5` | 110 / 180 / 280 / 420 / 640ms | 按压 / 悬停 / 切换 / 入场 / 大块入场 |

---

## 3. 组件层

`styles/ui.css` 统一了 `Surface / Button / Input / Textarea / Select / Badge / Avatar / Dot`。

- **Button**：主按钮实心强调色 + 胶囊圆角；次级白底发丝边；`:active` 缩放 0.975。
- **Input**：42px 高、10px 圆角；`:focus` 边框转强调色并外扩 3.5px 柔光环（不改变布局尺寸）。
- **Avatar**：改为**正圆**（原为圆角方），1px 内描边，补齐 `xs / sm / lg` 三档。
- **Badge**：胶囊、11px、半透明语义底。

---

## 4. 页面结构

### 认证页（登录 / 注册）

单卡片居中：画布 → 顶部冷光 → 玻璃卡片 → 字段级联浮现。
表单改为「标签在上、输入在下」——占位符一旦消失就失去上下文。
信息顺序：logo → 主标题 → 站点名 · 副标题 → 字段 → 主按钮 → 安全声明。

### 聊天工作区

三栏：图标栏 78px → 会话栏 304–368px（浅灰玻璃）→ 消息区纯白。
层次只靠**底色深浅 + 发丝线**，不用投影；选中态用强调色 12% 浅底而非左侧竖条。
气泡：入站 `#f2f2f7` 浅灰块，出站 `#0071e3` 蓝块配白字，尾部圆角收到 6px 指向说话人。

### 设置 / 后台

悬浮窗口：26px 圆角 + 发丝边 + 分层投影，四周留出画布。
后台的 `--admin-green` 历史命名实际承担"强调色"职责，已对齐强调蓝；
真正的成功语义保留在 `--admin-success`，不再复用。

---

## 5. 动效清单

1. **页面切换**（`App.vue`）：淡出 150ms / 淡入 260ms + 6px 上浮，`mode="out-in"`。
2. **卡片入场**：620ms 上浮 + 0.97 缩放；logo 用 spring 单独弹入。
3. **字段级联**：`animation-delay: 140ms + i×55ms`。
4. **会话列表级联**：前 8 条 30ms 步进；用 `animation-fill-mode: backwards`
   ——**不能是 both**，否则动画终态会压住 `:active` 的 `transform`。
5. **消息入场**：420ms 上浮 8px + 0.99 缩放。
6. **未读徽标**：320ms spring 弹入。
7. **输入条聚焦**：边框转强调色 + 外扩柔光环。
8. **成员面板**：遮罩淡入 + 面板自右滑入 24px。
9. **按压反馈**：按钮 0.975、图标按钮 0.92、会话行 0.985。
10. **启动态**：品牌标记呼吸 + 不定长进度条。

全部在 `@media (prefers-reduced-motion: reduce)` 下关闭（`animation-delay` 一并归零）。

---

## 6. 可访问性

- **对比度**：17 对前景 / 背景全部通过（`work/contrast.mjs`，半透明背景先合成再算）。
  最小值是强调色图标压在浅底上的 3.70:1（图形阈值 3:1）。
- **触控**：移动端主要操作（菜单、返回、头部按钮、语言切换、发送、演示入口）均 44×44。
- **焦点**：统一 `:focus-visible` 环（2px 强调色 + 2px offset），仅键盘导航时出现。
- **动效偏好**：`prefers-reduced-motion` 全量降级，且不改变最终可见状态。
- **输入字号**：移动端输入框 ≥16px，避免 iOS 聚焦自动放大。

---

## 7. 改动边界

**新增**

- `frontend/src/styles/lumen/tokens.css` — 设计令牌唯一真源
- `frontend/src/styles/lumen/auth.css` — 认证页样式
- `docs/lumen-redesign.md`（本文件）
- `work/`（验证脚手架，不属于构建产物）

**重写**

- `styles/base.css`、`styles.css`、`styles/layout.css`、`styles/ui.css`
- `styles/chat-theme.css`（聊天语义令牌）、`styles/admin/tokens.css`
- `pages/LoginPage.vue`、`pages/RegisterPage.vue`（结构与视觉，逻辑未变）
- `pages/ChatPage.vue` 的 `<style scoped>`（外壳）
- `components/chat/MessageRow.vue`（气泡）、`ConversationList.vue`（会话行）、
  `MessageComposer.vue`（输入区）、`components/ui/LanguageSwitch.vue`、
  `components/demo/DemoNavigator.vue`（改为可收起胶囊）

**移除**

- `styles-liquid.css` 的引用与 `index.html` 里的 `#liquid-glass-engine` SVG 滤镜
  （`backdrop-filter: url(#…)` 折射滤镜开销大且与新材质冲突），
  `liquid-glass.js` 的初始化调用一并去掉。
- 认证页的 Google Fonts 请求与手写体、`useCursor` 自绘光标（改用原生光标）。

**未改动**

- 所有业务逻辑、API 调用、路由、i18n 键结构、WebSocket、加密、Capacitor 桥接。
- 组件模板中的类名与事件绑定（认证页按新结构重排）。
- 后台布局（256px 侧栏 / 64px 顶栏）与全部管理功能。

---

## 8. 验证

```bash
# 1) 构建（demo 版含演示导航，用于离线预览）
npx vite build --config frontend/vite.demo.config.js

# 2) 浏览器回归（真 Chrome + CDP，54 项）
node work/verify.mjs

# 3) 对比度核算（17 对）
node work/contrast.mjs

# 4) 仓库自带测试（含设计断言）
node --test
```

`work/verify.mjs` 覆盖：令牌是否真的解析出值、关键 DOM 钩子、登录→发消息主链路、
6 个断点的横向溢出、减少动态效果降级、页面切换后不空白。
已做变异验证：把 `--lumen-accent` 改成红色，套件立即报 2 处红。
