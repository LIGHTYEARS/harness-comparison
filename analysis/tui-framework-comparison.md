# TUI 渲染框架对比：codex vs grok-build

> 由 workflow `investigate-tui-frameworks` 生成：两批共 4 个调查 agent + 1 个汇总 agent。

## 1. 概述

两者都选择 **ratatui 0.29 + crossterm** 作为 TUI 基础栈，渲染策略也高度一致（立即模式全量重绘进 Buffer + 双 buffer diff 增量输出 + SynchronizedUpdate 原子刷新）。但在**框架定制深度、布局系统、状态管理范式、视口模型、输入处理**五个维度上存在显著差异：

- **codex** 走"深度 fork + 自研布局"路线：用 `nornagon/ratatui` 和 `nornagon/crossterm` 两个 git fork，主表面抛弃 ratatui `Layout`，改用 Flutter 式 flexbox；状态直接 mutate。
- **grok-build** 走"上游 + 分层 crate"路线：用上游 ratatui/crossterm，把渲染原语抽到独立 `xai-grok-pager-render` 等 crate；状态用 Elm 式 Action→dispatch→Effect 纯函数 reducer。

## 2. 对比表格

| 维度 | codex | grok-build |
|---|---|---|
| **核心框架** | ratatui 0.29.0（fork `nornagon/ratatui` @ 9b2ad12） | ratatui 0.29（上游） |
| **终端后端** | crossterm 0.28.1（fork `nornagon/crossterm` @ 87db8bf） | crossterm 0.28（上游） |
| **不稳定特性** | scrolling-regions, unstable-backend-writer, unstable-rendered-line-info, unstable-widget-ref | unstable-widget-ref |
| **布局系统** | 自研 Flutter 式 flexbox（`FlexRenderable` 按 flex 因子分配） | ratatui 原生 `Layout`/`Constraint`，`AgentViewLayout::compute()` 预计算 |
| **状态管理** | `App` struct 直接 mutate，无 reducer | Elm 式 Action→`dispatch`（纯函数）→Effect→异步 task，~25 子模块 |
| **事件循环** | `tokio::select!` 四路复用（app_event / active_thread / tui_events / app_server） | `tokio::select! { biased; }` 多臂，输入由独立 `std::thread` 读取 |
| **帧调度** | `FrameRequester`/`FrameScheduler` actor，`FrameRateLimiter` 限 ~120 FPS | `Presenter` 用 `min_draw_interval` 节流，`has_changes==false` 时零字节输出 |
| **渲染输出** | 双 buffer + `diff_buffers`，`SynchronizedUpdate` 消闪烁 | 双 buffer diff + SynchronizedUpdate，`xai-ratatui-inline` 封装 |
| **视口模型** | 内联视口（底部 N 行）+ DEC scroll region 推入终端原生 scrollback | 虚拟视口（`scroll_offset`）+ sticky header + Fullscreen/Minimal 双模式 re-exec |
| **流式 token** | `StreamController` 缓冲 delta，换行提交，`CommitTick` drain | `AcpUpdateTracker` 追加 block，`invalidate_cache()` + `bump_content_generation()` |
| **输入处理** | `select!` 内直接消费 `TuiEventStream` | 独立线程读输入（防 crossterm waker 泄漏），ACP 消息仅在 `input_rx.is_empty()` 时处理（防饿死） |
| **语法高亮** | syntect 5 + two-face 0.5，围栏块结束批量高亮 | syntect + `xai-grok-markdown` |
| **额外特性** | 内联图片（image crate）、vim 模式、OSC8 链接、$EDITOR | Mermaid 图（子进程渲染）、Kitty 图形协议 image/video、nucleo 模糊搜索、鼠标选择复制、配置热重载 |

## 3. codex TUI 详解

**框架**：ratatui 0.29.0（fork）+ crossterm 0.28.1（fork）。启用 `scrolling-regions`、`unstable-backend-writer`、`unstable-rendered-line-info`、`unstable-widget-ref`。

**架构**：
- 入口 `src/main.rs`（bin `codex-tui`）→ `run_main()` → `run_ratatui_app()` → `App::run()`（`src/app.rs:766`），主事件循环在 `app.rs:1185`。
- 事件循环：`tokio::select!` 复用四路——`app_event_rx`、`active_thread_rx`、`tui_events`（`TuiEventStream` 合并 crossterm 输入 + draw 广播）、`app_server.next_event()`。
- 绘制：`TuiEvent::Draw` → `render_chat_widget_frame()` → `tui.draw_with_resize_reflow()` → `terminal.draw()`。

**关键依赖**：ratatui-macros、pulldown-cmark、syntect 5 + two-face 0.5、tokio（多线程）、tokio-stream、image、unicode-width/segmentation。

**关键模块**：`tui`、`app`、`custom_terminal`（双 buffer + `diff_buffers`）、`render::renderable`（Renderable trait + FlexRenderable）、`chatwidget`、`bottom_pane`、`tui::event_stream`、`tui::frame_requester`、`markdown_render`、`diff_render`。

**特性**：
- 双 buffer 增量 diff，仅写变化 cell；`SynchronizedUpdate` 消闪烁。
- `FrameRequester`/`FrameScheduler` actor 合并帧请求，限 ~120 FPS。
- 自研 Flutter 式 flexbox 布局（`FlexRenderable` 按 flex 因子比例分配空间）。
- 内联视口：底部 N 行实时 UI，已提交历史经 DEC scroll region 推入终端原生 scrollback。
- 流式 token：`StreamController` 缓冲 delta，换行提交；可见 tail 实时渲染，完成行按 `CommitTick` 线程 drain。
- Markdown 渲染 + syntect/two-face 语法高亮，围栏块在块结束批量高亮。
- 自定义 `TextArea`、内联图片（jpeg/png/gif/webp）、kitty/CSI-u 键盘增强、bracketed paste、vim 模式、OSC8 链接、桌面通知、$EDITOR。

## 4. grok-build TUI 详解

**框架**：ratatui 0.29（上游，features: `crossterm`、`unstable-widget-ref`）+ crossterm 0.28（features: `event-stream`、`bracketed-paste`）。

**架构**：
- 入口：独立 bin crate `xai-grok-pager-bin/src/main.rs` → `xai_grok_pager::app::run()`（`src/app/mod.rs:469`）→ `event_loop::run`（`src/app/event_loop.rs:716`）。
- 事件循环：`tokio::select! { biased; }` 多臂——connection cancel/quit、writer_event ack、ACP 消息（仅在 `input_rx.is_empty()` 时处理）、`tasks.join_next()`、progress、bg_update、`input_rx`、resize debounce、tick 定时器。
- 输入由**独立 `std::thread`** 用 `crossterm::event::poll/read` 读取，经 `mpsc::unbounded_channel` 投递，避免在 select! 直接 poll crossterm EventStream（其 future 被 drop 会泄漏 waker）。
- 绘制由 `Presenter` 协调：`request_throttled` 限频 → `present_if_dirty` → `app.draw(terminal)` → `draw_frame`。

**关键依赖**：`xai-grok-pager-render`（渲染原语层）、`xai-ratatui-inline`（带 buffer diff + 同步输出的 Terminal 封装）、`xai-ratatui-textarea`、`xai-grok-markdown`、`xai-grok-mermaid`、`ansi-to-tui`、syntect、nucleo、tokio。

**关键模块**：`app`（AppView + run）、`app/event_loop`、`app/dispatch`（~25 子模块的纯函数 reducer）、`app/actions`（Action/Effect/TaskResult）、`acp/tracker`（流式 token 追踪）、`scrollback`（虚拟视口 + 搜索 + sticky header）、`views/agent`（AgentViewLayout）、`views/prompt_widget`、`xai-grok-pager-render/src/render/draw`。

**特性**：
- 增量 buffer diff + SynchronizedUpdate；`has_changes == false` 时 `discard()` 零字节输出。
- `Presenter` 用 `min_draw_interval` 节流，防 token 洪水饿死输入。
- 流式 token：`AcpUpdateTracker` 把 `AgentMessageChunk` 追加到 block，`invalidate_cache()` + `bump_content_generation()`，下一帧只重画变化行。
- 双模式：Fullscreen（alt-screen）/ Minimal（原生滚动），`/minimal` `/fullscreen` 可 re-exec 切换。
- 虚拟视口（`scroll_offset` + `viewport_height`），sticky header，正则搜索高亮 + 跳转，nucleo 模糊历史搜索。
- Kitty 图形协议 image/video/preview overlay（PostFlush 在同步块内写入）。
- Mermaid 图（子进程渲染 ```mermaid 围栏）、ANSI→TUI（tracing pane）。
- 鼠标支持（滚轮带加速度、点击/拖拽选择、点击链接）、文本选择复制、OSC8 链接键盘循环选中。
- 多 agent/subagent（IndexMap）、配置热重载（`ConfigWatcher` 监听 `~/.grok/pager.toml`）、暂停 $EDITOR（`park_input_reader` 让渡 stdin）。

## 5. 核心差异

1. **框架定制 vs 上游分层**：codex 维护 ratatui/crossterm 两个 git fork 以启用 scrolling-regions 等不稳定特性并扩展终端后端；grok-build 用上游版本，把定制逻辑抽到 `xai-grok-pager-render`、`xai-ratatui-inline` 等独立 crate，分层更清晰、可复用性更强。

2. **布局系统：自研 flexbox vs ratatui Layout**：codex 主表面用 Flutter 式 `FlexRenderable`（按 flex 因子比例分配），`desired_height(width)` 驱动高度计算；grok-build 用 ratatui 原生 `Layout`/`Constraint`，`AgentViewLayout::compute()` 一次性预计算所有 pane Rect。前者更适合动态高度内容，后者更静态、可预测。

3. **状态管理：直接 mutate vs 纯函数 reducer**：codex 的 `App` struct 被事件 handler 直接 mutate；grok-build 用 Action→`dispatch`（同步、纯函数、无 IO、可测试）→`Effect`→异步 task 的 Elm 式流水线，dispatch 拆成 ~25 子模块。grok-build 的架构更易测试和推理，codex 更直接但耦合度高。

4. **视口模型：内联 + 原生 scrollback vs 虚拟视口**：codex 默认内联视口（底部 N 行），用 DEC scroll region 把历史推入终端原生 scrollback，可直接用终端滚动条；grok-build 用 `scroll_offset` 虚拟视口 + sticky header，并提供 Fullscreen/Minimal 双模式 re-exec 切换。

5. **输入与防饿死策略**：codex 在 `select!` 内直接消费 `TuiEventStream`；grok-build 用独立线程读输入（避免 crossterm EventStream waker 泄漏），且 ACP 消息仅在 `input_rx.is_empty()` 时处理，显式防止流式输出饿死终端输入——这是 codex 未体现的工程考量。

## 6. 后续建议

- **fork 维护成本**：codex 依赖两个 git fork，需评估 ratatui 上游合并进度与 fork 漂移风险；grok-build 的 crate 分层是否可被 codex 借鉴以降低维护负担。
- **流式渲染性能**：两者都用 buffer diff，但 codex 是"换行提交 + CommitTick drain"，grok-build 是"追加 + invalidate_cache + generation bump"。值得在高 token 速率下实测两者的帧延迟、CPU 占用与输入响应差异。
- **状态管理可测试性**：grok-build 的 dispatch 纯函数可脱离 tokio/终端单测，codex 的 mutate 模式如何保证回归测试覆盖？值得对比两者的测试策略与覆盖率。
- **视口/滚动体验**：内联视口 + 原生 scrollback（codex）vs 虚拟视口 + sticky header（grok-build）在长会话、终端尺寸变化、鼠标滚轮场景下的 UX 差异，需实际操作评估。
- **自研 crate 的复用价值**：grok-build 的 `xai-ratatui-inline`、`xai-grok-pager-render` 是否可作为通用 TUI 基础设施被其他项目复用；codex 的 `FlexRenderable` flexbox 布局是否值得抽出。
- **输入线程模型**：grok-build 独立线程读输入 + 防饿死的设计是否应成为 ratatui 应用的推荐模式，codex 的 `TuiEventStream` 合并方案在极端负载下是否存在输入延迟问题。
