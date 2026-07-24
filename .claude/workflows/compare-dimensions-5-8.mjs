export const meta = {
  name: 'compare-dimensions-5-8',
  description: '对比 codex 与 grok-build 的维度 5-8：命令执行与沙箱、上下文与记忆、模型交互、可扩展性',
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
        key_files: { type: 'array', items: { type: 'string' }, description: 'codex 中该维度的关键文件路径' },
        design: { type: 'string', description: 'codex 在该维度的设计要点（300 字内）' },
      },
      required: ['key_files', 'design'],
    },
    grok: {
      type: 'object',
      properties: {
        key_files: { type: 'array', items: { type: 'string' }, description: 'grok-build 中该维度的关键文件路径' },
        design: { type: 'string', description: 'grok-build 在该维度的设计要点（300 字内）' },
      },
      required: ['key_files', 'design'],
    },
    differences: { type: 'array', items: { type: 'string' }, description: '两者核心差异点（每条一句话）' },
    open_questions: { type: 'array', items: { type: 'string' }, description: '该维度下需进一步确认的问题' },
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
    key: 'sandbox',
    name: '维度 5：命令执行与沙箱',
    prompt: `对比 codex 与 grok-build 的「命令执行与沙箱」维度。
重点：shell/bash 工具实现、沙箱技术（命名空间/landlock/Seatbelt/网络策略）、命令执行的权限审批流程、网络访问控制、是否支持交互式命令、与文件系统的隔离。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：
- codex：codex-rs/core/src/tools/handlers/shell.rs、codex-rs/linux-sandbox/（bwrap+landlock）、codex-rs/exec/、codex-rs/network-proxy/
- grok-build：crates/codegen/xai-grok-tools/src/implementations/grok_build/bash/、crates/codegen/xai-grok-sandbox/src/、crates/codegen/xai-grok-workspace/src/permission/
只读探索，不要修改文件。用实际读到的代码支撑结论。`,
  },
  {
    key: 'memory',
    name: '维度 6：上下文与记忆',
    prompt: `对比 codex 与 grok-build 的「上下文与记忆」维度。
重点：对话历史管理、token 预算/估算、auto-compaction 策略（何时触发、如何压缩、压缩 prompt）、长期记忆形式（无/向量/文件）、是否有 dream/离线整理、记忆的检索与排序策略。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：
- codex：codex-rs/core/src/compact.rs、codex-rs/core/src/session/token_budget.rs、codex-rs/memories/、codex-rs/core/src/context_manager/
- grok-build：crates/common/xai-grok-compaction/、crates/codegen/xai-grok-agent/src/compaction.rs、crates/codegen/xai-grok-memory/src/（embedding/index/mmr/dream）、crates/codegen/xai-token-estimation/
只读探索，不要修改文件。用实际读到的代码支撑结论，尽量给出具体的阈值/策略参数。`,
  },
  {
    key: 'model',
    name: '维度 7：模型交互',
    prompt: `对比 codex 与 grok-build 的「模型交互」维度。
重点：支持的 LLM 后端/提供商、API 调用方式、streaming 实现（SSE/WebSocket）、是否可切换模型、重试/容错/退避策略、token 计数与用量统计、是否支持多轮工具调用循环。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：
- codex：codex-rs/codex-client/src/sse.rs、codex-rs/models-manager/、codex-rs/model-provider/、codex-rs/backend-client/
- grok-build：crates/codegen/xai-grok-sampler/src/client.rs、crates/codegen/xai-grok-shell/src/agent/models.rs、crates/codegen/xai-grok-models/src/lib.rs
只读探索，不要修改文件。用实际读到的代码支撑结论。`,
  },
  {
    key: 'extensibility',
    name: '维度 8：可扩展性',
    prompt: `对比 codex 与 grok-build 的「可扩展性」维度。
重点：插件机制（如何安装/加载/卸载）、skills 系统、MCP 服务器集成、hooks 系统、配置格式与 schema、是否有插件市场、编辑器集成协议（ACP/LSP）、自定义模型/工具的扩展点。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：
- codex：codex-rs/plugin/、codex-rs/skills/、codex-rs/codex-mcp/、codex-rs/hooks/、codex-rs/config/、codex-rs/core/config.schema.json
- grok-build：crates/codegen/xai-grok-plugin-marketplace/、crates/codegen/xai-grok-mcp/、crates/codegen/xai-grok-hooks/、crates/codegen/xai-grok-config/、crates/codegen/xai-acp-lib/
只读探索，不要修改文件。用实际读到的代码支撑结论。`,
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
  '你是一名技术写作专家。基于以下 4 个维度的对比分析结果，撰写一份统一的 markdown 对比报告。\n' +
  '报告结构：\n' +
  '1. 顶部摘要（3-5 条最值得关注的跨维度结论）\n' +
  '2. 每个维度一节，包含：设计要点对比表、核心差异、关键文件路径\n' +
  '3. 末尾"待深入确认项"汇总各维度的 open_questions\n\n' +
  '风格：简洁、信息密度高、用表格。不要编造结果中没有的内容。\n\n' +
  '4 个维度的分析结果（JSON）：\n' +
  JSON.stringify(valid, null, 2),
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
