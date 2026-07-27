export const meta = {
  name: 'three-way-comparison',
  description: '三方对比 codex/grok-build/opencode：5 个维度并行深入分析',
  phases: [
    { title: '分析', detail: '5 个 agent 并行，各负责一个维度' },
    { title: '汇总', detail: '合成统一三方对比报告' },
  ],
};

const DIM_SCHEMA = {
  type: 'object',
  properties: {
    dimension: { type: 'string', description: '维度名称' },
    codex: {
      type: 'object',
      properties: {
        key_files: { type: 'array', items: { type: 'string' } },
        design: { type: 'string', description: 'codex 设计要点（200 字内）' },
      },
      required: ['key_files', 'design'],
    },
    grok: {
      type: 'object',
      properties: {
        key_files: { type: 'array', items: { type: 'string' } },
        design: { type: 'string', description: 'grok-build 设计要点（200 字内）' },
      },
      required: ['key_files', 'design'],
    },
    opencode: {
      type: 'object',
      properties: {
        key_files: { type: 'array', items: { type: 'string' } },
        design: { type: 'string', description: 'opencode 设计要点（200 字内）' },
      },
      required: ['key_files', 'design'],
    },
    differences: { type: 'array', items: { type: 'string' }, description: '三方核心差异点' },
    evolution: { type: 'string', description: '如果存在演化/移植关系，说明（如 opencode 原版 -> grok-build 移植）' },
  },
  required: ['dimension', 'codex', 'grok', 'opencode', 'differences'],
};

const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    report: { type: 'string', description: '统一三方对比报告的完整 markdown' },
    headline: { type: 'array', items: { type: 'string' }, description: '5 条最值得关注的跨维度结论' },
  },
  required: ['report', 'headline'],
};

const ROOTS = {
  codex: '/home/tiger/workspace/harness-comparison/agents/codex',
  grok: '/home/tiger/workspace/harness-comparison/agents/grok-build',
  opencode: '/home/tiger/workspace/harness-comparison/agents/opencode',
};

const dimensions = [
  {
    key: 'code-actions',
    name: '维度 4：代码行动（文件编辑）',
    prompt: `三方对比「代码行动 / 文件编辑」维度：codex、grok-build、opencode。
重点：编辑范式（apply_patch/search_replace/edit/write）、实现位置、是否流式、错误处理、与命令执行的关系。
注意：grok-build 移植了 opencode 的 edit/write 工具，请对比"原版 vs 移植版"的差异。
codex 根目录：${ROOTS.codex}
grok-build 根目录：${ROOTS.grok}
opencode 根目录：${ROOTS.opencode}
已知线索：
- codex：codex-rs/core/src/tools/handlers/apply_patch.rs、codex-rs/apply-patch/（独立 crate）
- grok-build：crates/codegen/xai-grok-tools/src/implementations/{codex/apply_patch, grok_build/search_replace, opencode/edit, opencode/write}/
- opencode：packages/opencode/src/tool/{edit,apply_patch,write}.ts、packages/core/src/tool/{edit,write,apply-patch}.ts
只读探索，用实际代码支撑结论。`,
  },
  {
    key: 'model-interaction',
    name: '维度 7：模型交互',
    prompt: `三方对比「模型交互」维度：codex、grok-build、opencode。
重点：LLM SDK（自研/第三方）、支持的 provider、streaming 实现、模型切换、重试策略、token 统计。
codex 根目录：${ROOTS.codex}
grok-build 根目录：${ROOTS.grok}
opencode 根目录：${ROOTS.opencode}
已知线索：
- codex：codex-rs/codex-client/src/sse.rs、codex-rs/model-provider/、自研 SDK
- grok-build：crates/codegen/xai-grok-sampler/src/client.rs、自研 SDK
- opencode：用 Vercel AI SDK（ai 包）、packages/llm/src/providers/（10+ provider）
只读探索，用实际代码支撑结论。`,
  },
  {
    key: 'prompt',
    name: '维度 2：Prompt 工程',
    prompt: `三方对比「Prompt 工程」维度：codex、grok-build、opencode。
重点：prompt 存储形式、模板组织、是否按 provider/model 分模板、动态注入、compaction prompt、subagent prompt。
codex 根目录：${ROOTS.codex}
grok-build 根目录：${ROOTS.grok}
opencode 根目录：${ROOTS.opencode}
已知线索：
- codex：codex-rs/prompts/templates/（明文 markdown，单一模板）
- grok-build：xai-grok-agent/src/prompt/（加密 + MiniJinja）
- opencode：packages/opencode/src/session/prompt/（按 provider/model 分 .txt 模板：anthropic/gpt/gemini/codex/plan 等）
只读探索，用实际代码支撑结论。`,
  },
  {
    key: 'tui',
    name: 'TUI 渲染框架',
    prompt: `三方对比「TUI 渲染框架」维度：codex、grok-build、opencode。
重点：TUI 框架选择、布局系统、状态管理、流式渲染、视口模型、输入处理。
codex 根目录：${ROOTS.codex}
grok-build 根目录：${ROOTS.grok}
opencode 根目录：${ROOTS.opencode}
已知线索：
- codex：ratatui 0.29（fork nornagon）+ crossterm（fork），自研 flexbox 布局
- grok-build：ratatui 0.29（上游）+ crossterm（上游），原生 Layout
- opencode：@opentui（自研，基于 SolidJS），packages/tui/src/
只读探索，用实际代码支撑结论。`,
  },
  {
    key: 'ai-friendliness',
    name: 'AI 友好性',
    prompt: `三方对比「AI 友好性」维度：codex、grok-build、opencode。
重点：AI 规则文件（AGENTS.md/CLAUDE.md/CONTEXT.md 等）、贡献指南、架构文档、配置 schema、测试指引、代码规范。
codex 根目录：${ROOTS.codex}
grok-build 根目录：${ROOTS.grok}
opencode 根目录：${ROOTS.opencode}
已知线索：
- codex：22KB AGENTS.md（详尽，带 just 命令、行数限制、token 限制）
- grok-build：无 AI 规则文件
- opencode：多层 AGENTS.md + 87KB CONTEXT.md（Session Runtime 术语表）
只读探索，用实际文件内容支撑结论。`,
  },
];

phase('分析');
const results = await parallel(
  dimensions.map((d) => () =>
    agent(d.prompt, {
      label: d.name,
      phase: '分析',
      schema: DIM_SCHEMA,
      model: 'sonnet',
      effort: 'high',
    })
  )
);

const valid = results.filter(Boolean);
log('分析阶段完成：' + valid.length + '/' + dimensions.length + ' 个维度返回结果');

phase('汇总');
const synth = await agent(
  '你是一名技术写作专家。基于以下 5 个维度的三方对比分析结果，撰写一份统一的 markdown 报告。\n' +
  '报告结构：\n' +
  '1. 顶部摘要（5 条最值得关注的跨维度结论，特别注意"演化/移植"关系）\n' +
  '2. 每个维度一节，包含：三方设计要点对比表、核心差异、演化关系（如有）、关键文件\n' +
  '3. 综合洞察：三方在工程哲学上的根本分野\n' +
  '4. 后续建议\n\n' +
  '风格：简洁、信息密度高、用表格。不要编造结果中没有的内容。\n\n' +
  '5 个维度的分析结果（JSON）：\n' +
  JSON.stringify(valid, null, 2),
  {
    label: '三方对比汇总',
    phase: '汇总',
    schema: SYNTH_SCHEMA,
    model: 'sonnet',
    effort: 'high',
  }
);

return {
  analyses: valid,
  report: synth?.report,
  headline: synth?.headline,
};
