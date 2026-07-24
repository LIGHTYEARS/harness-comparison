export const meta = {
  name: 'compare-dimensions-9-10',
  description: '对比 codex 与 grok-build 的维度 9-10：能力边界、工程化与可观测',
  phases: [
    { title: '分析', detail: '2 个 agent 并行，各负责一个维度' },
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
        key_files: { type: 'array', items: { type: 'string' } },
        design: { type: 'string', description: 'codex 在该维度的设计要点（300 字内）' },
      },
      required: ['key_files', 'design'],
    },
    grok: {
      type: 'object',
      properties: {
        key_files: { type: 'array', items: { type: 'string' } },
        design: { type: 'string', description: 'grok-build 在该维度的设计要点（300 字内）' },
      },
      required: ['key_files', 'design'],
    },
    differences: { type: 'array', items: { type: 'string' } },
    open_questions: { type: 'array', items: { type: 'string' } },
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
    key: 'capability',
    name: '维度 9：能力边界（超出纯编码）',
    prompt: `对比 codex 与 grok-build 的「能力边界」维度——即超出纯代码编辑的能力。
重点：是否支持多模态（图像/视频生成与理解）、计划模式（plan mode）、工作流（workflow）、子代理/多代理协作（subagent）、web 搜索与抓取、浏览器/计算机使用、任务调度（scheduler）、目标追踪（goal tracking）、记忆/回忆等。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：
- codex：multi_agents.rs（子代理）、view_image.rs（仅查看图片）、tool_search.rs、plan.rs（update_plan）
- grok-build：image_gen/edit、video_gen、web_search、web_fetch、enter/exit_plan_mode、workflow、scheduler、update_goal、subagent/
只读探索，不要修改文件。用实际读到的代码/工具清单支撑结论，尽量列出两边的完整能力清单。`,
  },
  {
    key: 'engineering',
    name: '维度 10：工程化与可观测',
    prompt: `对比 codex 与 grok-build 的「工程化与可观测」维度。
重点：构建系统（Bazel/Cargo/其他）、配置 schema 与文档、测试策略（单元/集成/e2e/benchmark）、tracing/telemetry（OpenTelemetry/日志/rollout）、错误处理与崩溃恢复、CLI 体验（TUI/命令行参数/帮助）、CI/CD、代码质量工具（lint/format）。
codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：
- codex：Bazel + Cargo 双构建、config.schema.json（5732 行）、otel/ crate（OpenTelemetry）、rollout/ crate（rollout 追踪）、cli/e2e_benches/
- grok-build：Cargo workspace（根 Cargo.toml 自动生成）、tracing、benches/、test-support/
只读探索，不要修改文件。用实际读到的代码/配置支撑结论。`,
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
  '你是一名技术写作专家。基于以下 2 个维度的对比分析结果，撰写一份统一的 markdown 对比报告。\n' +
  '报告结构：\n' +
  '1. 顶部摘要（3-5 条最值得关注的跨维度结论）\n' +
  '2. 每个维度一节，包含：设计要点对比表、核心差异、关键文件路径\n' +
  '3. 末尾"待深入确认项"汇总各维度的 open_questions\n\n' +
  '风格：简洁、信息密度高、用表格。不要编造结果中没有的内容。\n\n' +
  '2 个维度的分析结果（JSON）：\n' +
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
