export const meta = {
  name: 'investigate-tui-frameworks',
  description: '调查 codex 与 grok-build 的 TUI 渲染框架：两批 subagents 分别调查两个项目',
  phases: [
    { title: '批次 1：codex TUI', detail: '2 个 agent 并行调查 codex 的 TUI 渲染框架' },
    { title: '批次 2：grok-build TUI', detail: '2 个 agent 并行调查 grok-build 的 TUI 渲染框架' },
    { title: '汇总', detail: '合成对比报告' },
  ],
};

const TUI_SCHEMA = {
  type: 'object',
  properties: {
    project: { type: 'string', description: '项目名（codex 或 grok-build）' },
    framework: { type: 'string', description: '核心渲染框架名称（如 ratatui / tui-rs / 自研 / egui 等）' },
    framework_version: { type: 'string', description: '框架版本（从 Cargo.toml 依赖看）' },
    key_crates: {
      type: 'array',
      items: { type: 'string' },
      description: 'TUI 相关的 crate / 模块路径',
    },
    architecture: {
      type: 'object',
      properties: {
        entry: { type: 'string', description: 'TUI 入口文件' },
        event_loop: { type: 'string', description: '事件循环 / 渲染循环如何组织' },
        layout: { type: 'string', description: '布局系统（如何分屏/排列组件）' },
        widgets: { type: 'string', description: '自定义组件/控件有哪些' },
        state_management: { type: 'string', description: 'UI 状态如何管理' },
      },
      required: ['entry', 'event_loop', 'layout'],
    },
    dependencies: {
      type: 'array',
      items: { type: 'string' },
      description: 'TUI 相关的关键依赖 crate（从 Cargo.toml 看，如 ratatui / crossterm / termion 等）',
    },
    rendering_approach: {
      type: 'string',
      description: '渲染方式：立即模式 vs 保留模式？全量重绘 vs 增量？是否用 buffer diff？',
    },
    notable_features: {
      type: 'array',
      items: { type: 'string' },
      description: '值得注意的 TUI 特性（如流式输出、滚动、语法高亮、鼠标支持等）',
    },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string', description: '文件路径' },
          snippet: { type: 'string', description: '关键代码片段' },
          note: { type: 'string', description: '说明' },
        },
        required: ['file', 'snippet', 'note'],
      },
      description: '支撑结论的代码证据，3-6 条',
    },
  },
  required: ['project', 'framework', 'key_crates', 'architecture', 'dependencies', 'rendering_approach', 'evidence'],
};

const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    report: { type: 'string', description: '完整 markdown 对比报告' },
    comparison_table: { type: 'string', description: '对比表格的 markdown' },
    headline: { type: 'array', items: { type: 'string' }, description: '3-5 条核心差异' },
  },
  required: ['report', 'comparison_table', 'headline'],
};

// ===== 批次 1：codex TUI =====
phase('批次 1：codex TUI');
const codexResults = await parallel([
  () => agent(
    `调查 codex 项目的 TUI 渲染框架。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
已知线索：TUI 代码在 codex-rs/tui/

请重点搞清楚：
1. 核心渲染框架是什么？（查 codex-rs/tui/Cargo.toml 的依赖，如 ratatui / tui-rs / 自研等）版本是多少？
2. TUI 的入口文件在哪？事件循环/渲染循环如何组织？
3. 用了哪些终端后端（crossterm / termion / termwiz）？
4. 渲染方式：立即模式还是保留模式？全量重绘还是增量？
5. 布局系统如何工作（如何分屏、排列组件）？
6. 有哪些自定义 widget/组件？

只读探索，不要修改文件。必须用实际读到的 Cargo.toml 依赖和代码支撑结论。`,
    { label: 'codex TUI 框架与架构', phase: '批次 1：codex TUI', schema: TUI_SCHEMA, model: 'sonnet', effort: 'high' }
  ),
  () => agent(
    `调查 codex 项目的 TUI 交互特性与状态管理。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
已知线索：TUI 代码在 codex-rs/tui/

请重点搞清楚：
1. UI 状态如何管理（全局 state / reducer / 其他模式）？
2. 如何处理用户输入（键盘/鼠标）？
3. 如何渲染模型的流式输出（token 级更新）？
4. 滚动、分页、语法高亮如何实现？
5. 有哪些值得注意的 TUI 特性？
6. 关键的 widget/组件文件有哪些（列出路径）？

只读探索，不要修改文件。必须用实际读到的代码支撑结论。`,
    { label: 'codex TUI 交互与状态', phase: '批次 1：codex TUI', schema: TUI_SCHEMA, model: 'sonnet', effort: 'high' }
  ),
]);

log(`批次 1 完成：${codexResults.filter(Boolean).length}/2 个 agent 返回`);

// ===== 批次 2：grok-build TUI =====
phase('批次 2：grok-build TUI');
const grokResults = await parallel([
  () => agent(
    `调查 grok-build 项目的 TUI 渲染框架。
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：TUI 代码在 crates/codegen/xai-grok-pager/

请重点搞清楚：
1. 核心渲染框架是什么？（查 crates/codegen/xai-grok-pager/Cargo.toml 的依赖，如 ratatui / tui-rs / 自研 / egui 等）版本是多少？
2. TUI 的入口文件在哪？事件循环/渲染循环如何组织？
3. 用了哪些终端后端（crossterm / termion / termwiz）？
4. 渲染方式：立即模式还是保留模式？全量重绘还是增量？
5. 布局系统如何工作（如何分屏、排列组件）？
6. 有哪些自定义 widget/组件？

只读探索，不要修改文件。必须用实际读到的 Cargo.toml 依赖和代码支撑结论。`,
    { label: 'grok-build TUI 框架与架构', phase: '批次 2：grok-build TUI', schema: TUI_SCHEMA, model: 'sonnet', effort: 'high' }
  ),
  () => agent(
    `调查 grok-build 项目的 TUI 交互特性与状态管理。
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：TUI 代码在 crates/codegen/xai-grok-pager/

请重点搞清楚：
1. UI 状态如何管理（全局 state / reducer / 其他模式）？
2. 如何处理用户输入（键盘/鼠标）？
3. 如何渲染模型的流式输出（token 级更新）？
4. 滚动、分页、语法高亮如何实现？
5. 有哪些值得注意的 TUI 特性？
6. 关键的 widget/组件文件有哪些（列出路径）？

只读探索，不要修改文件。必须用实际读到的代码支撑结论。`,
    { label: 'grok-build TUI 交互与状态', phase: '批次 2：grok-build TUI', schema: TUI_SCHEMA, model: 'sonnet', effort: 'high' }
  ),
]);

log(`批次 2 完成：${grokResults.filter(Boolean).length}/2 个 agent 返回`);

// ===== 汇总 =====
phase('汇总');
const allResults = [...codexResults.filter(Boolean), ...grokResults.filter(Boolean)];
const synth = await agent(
  `你是一名技术写作专家。基于以下对 codex 和 grok-build 的 TUI 渲染框架调查结果，撰写一份 markdown 对比报告。
报告结构：
1. 概述：两者 TUI 框架选择的总体差异
2. 对比表格：框架、版本、后端、渲染方式、布局、状态管理、交互特性等
3. codex TUI 详解：框架、架构、关键依赖、特性
4. grok-build TUI 详解：框架、架构、关键依赖、特性
5. 核心差异：3-5 条最值得关注的差异点
6. 后续建议：TUI 维度值得进一步分析什么

风格：简洁、信息密度高。不要编造结果中没有的内容。

调查结果（JSON）：
${JSON.stringify(allResults, null, 2)}`,
  { label: 'TUI 对比汇总', phase: '汇总', schema: SYNTH_SCHEMA, model: 'sonnet', effort: 'high' }
);

return {
  codex: codexResults.filter(Boolean),
  grok: grokResults.filter(Boolean),
  report: synth?.report,
  comparison_table: synth?.comparison_table,
  headline: synth?.headline,
};
