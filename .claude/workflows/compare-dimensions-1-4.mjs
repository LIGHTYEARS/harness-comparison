export const meta = {
  name: 'compare-dimensions-1-4',
  description: '对比 codex 与 grok-build 的前 4 个维度：架构、Prompt、工具系统、代码行动',
  phases: [
    { title: '分析', detail: '4 个 agent 并行，各负责一个维度' },
    { title: '汇总', detail: '合成统一对比报告' },
  ],
};

const DIM_SCHEMA = {
  type: 'object',
  properties: {
    dimension: { type: 'string', description: '维度名称' },
    codex: {
      type: 'object',
      properties: {
        key_files: { type: 'array', items: { type: 'string' }, description: 'codex 中该维度的关键文件路径（相对 agents/codex）' },
        design: { type: 'string', description: 'codex 在该维度的设计要点（200 字内）' },
      },
      required: ['key_files', 'design'],
    },
    grok: {
      type: 'object',
      properties: {
        key_files: { type: 'array', items: { type: 'string' }, description: 'grok-build 中该维度的关键文件路径（相对 agents/grok-build）' },
        design: { type: 'string', description: 'grok-build 在该维度的设计要点（200 字内）' },
      },
      required: ['key_files', 'design'],
    },
    differences: { type: 'array', items: { type: 'string' }, description: '两者在该维度的核心差异点（每条一句话）' },
    open_questions: { type: 'array', items: { type: 'string' }, description: '该维度下需要进一步确认的问题' },
  },
  required: ['dimension', 'codex', 'grok', 'differences', 'open_questions'],
};

const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    report: { type: 'string', description: '统一对比报告的完整 markdown 内容' },
    headline_findings: { type: 'array', items: { type: 'string' }, description: '3-5 条最值得关注的跨维度结论' },
  },
  required: ['report', 'headline_findings'],
};

const dimensions = [
  {
    key: 'architecture',
    name: '维度 1：架构与组织',
    prompt: `对比 codex 与 grok-build 的「架构与组织」维度。
重点：crate/模块划分、模块边界、是否多语言、主循环位置、是否区分 leader/worker、运行时入口（TUI/stdio/headless）。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：codex 主循环在 codex-rs/core/src/session/；grok-build 主循环在 crates/codegen/xai-grok-shell/src/session/acp_session_impl/run_loop.rs。
只读探索，不要修改文件。用实际读到的代码/文件支撑结论，不要凭空臆测。`,
  },
  {
    key: 'prompt',
    name: '维度 2：Prompt 工程',
    prompt: `对比 codex 与 grok-build 的「Prompt 工程」维度。
重点：prompt 存储形式（明文/加密/代码内嵌）、模板组织、动态注入、AGENTS.md 支持、compaction prompt、是否有 subagent prompt。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：codex prompt 在 codex-rs/prompts/templates/（明文 markdown）；grok-build 核心 prompt 在 xai-grok-agent/src/prompt/prompt_encrypted.rs（XOR 加密）+ template.rs（明文常量）。
只读探索，不要修改文件。尽量实际打开 prompt 模板文件看内容结构，用真实文件支撑结论。`,
  },
  {
    key: 'tools',
    name: '维度 3：工具系统',
    prompt: `对比 codex 与 grok-build 的「工具系统」维度。
重点：工具来源（自研/移植）、注册机制、工具协议层、是否支持动态工具搜索、是否并行调用、工具列表（列出主要工具名）。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：codex 工具在 codex-rs/core/src/tools/handlers/；grok-build 工具在 crates/codegen/xai-grok-tools/src/implementations/{codex,opencode,grok_build}/。
只读探索，不要修改文件。尽量列出两边的实际工具名清单，用真实文件支撑结论。`,
  },
  {
    key: 'code-actions',
    name: '维度 4：代码行动（文件编辑）',
    prompt: `对比 codex 与 grok-build 的「代码行动 / 文件编辑」维度。
重点：编辑范式（apply_patch / search_replace / 直接写 / LSP）、实现位置、是否支持流式 patch、错误处理、与命令执行工具的关系。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：codex 用 apply_patch（独立 apply-patch/ crate，含 streaming_parser）；grok-build 有 apply_patch + search_replace + edit + write + LSP 多套。
只读探索，不要修改文件。尽量实际看 apply_patch 的 spec/handler 代码，用真实文件支撑结论。`,
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
log(`分析阶段完成：${valid.length}/${dimensions.length} 个维度返回结果`);

phase('汇总');
const synth = await agent(
  `你是一名技术写作专家。基于以下 4 个维度的对比分析结果，撰写一份统一的 markdown 对比报告。
报告结构：
1. 顶部摘要（3-5 条最值得关注的跨维度结论）
2. 每个维度一节，包含：设计要点对比表、核心差异、关键文件路径
3. 末尾"待深入确认项"汇总各维度的 open_questions

风格：简洁、信息密度高、用表格。不要编造结果中没有的内容。

4 个维度的分析结果（JSON）：
${JSON.stringify(valid, null, 2)}`,
  {
    label: '汇总报告',
    phase: '汇总',
    schema: SYNTH_SCHEMA,
    model: 'sonnet',
    effort: 'high',
  }
);

return {
  analyses: valid,
  report: synth?.report,
  headline_findings: synth?.headline_findings,
};
