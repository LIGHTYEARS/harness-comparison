export const meta = {
  name: 'deep-dive-dim4-open-questions',
  description: '深入维度 4（文件编辑）的 3 个开放问题：编辑工具选择策略、apply_patch_tool_type 取值、shell 拦截行为',
  phases: [
    { title: '调查', detail: '3 个 agent 并行，各回答一个开放问题' },
    { title: '汇总', detail: '合成结论报告' },
  ],
};

const Q_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string', description: '被调查的问题' },
    answer: { type: 'string', description: '基于代码的明确答案（200-400 字）' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string', description: '文件路径（相对 agents/xxx）' },
          line: { type: 'string', description: '行号或代码片段标识' },
          snippet: { type: 'string', description: '关键代码片段（简短）' },
          note: { type: 'string', description: '这段代码说明了什么' },
        },
        required: ['file', 'snippet', 'note'],
      },
      description: '支撑答案的代码证据，2-5 条',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: '答案置信度' },
    follow_up: { type: 'string', description: '仍需进一步确认的子问题' },
  },
  required: ['question', 'answer', 'evidence', 'confidence'],
};

const SYNTH_SCHEMA = {
  type: 'object',
  properties: {
    report: { type: 'string', description: '完整 markdown 报告' },
    conclusions: { type: 'array', items: { type: 'string' }, description: '3-5 条核心结论' },
  },
  required: ['report', 'conclusions'],
};

const questions = [
  {
    key: 'q1',
    name: 'Q1: grok-build 编辑工具选择策略',
    prompt: `调查问题：grok-build 同时提供 apply_patch（codex 移植）、search_replace、edit（opencode）、write（opencode）四套编辑工具。模型在实际运行中如何选择用哪一套？
请重点查找：
1. system prompt / apply_patch_prompt.md / subagent_prompt.md 中是否有引导模型选择编辑工具的文字
2. 工具的 description 字段（模型看到的工具说明）如何描述各自的适用场景
3. 是否有配置开关只暴露其中一套（如 model_info / feature flag / ToolKind 过滤）
4. search_replace 与 edit 功能重叠，两者如何区分使用场景

grok-build 根目录：/home/tiger/workspace/harness-comparison/agents/grok-build
已知线索：
- 工具实现：crates/codegen/xai-grok-tools/src/implementations/{codex/apply_patch, grok_build/search_replace, opencode/edit, opencode/write}/
- prompt：crates/codegen/xai-grok-agent/templates/
- 工具注册：crates/codegen/xai-grok-tools/src/registry/types.rs

只读探索，不要修改文件。必须用实际读到的代码/prompt 文本支撑答案，不要臆测。`,
  },
  {
    key: 'q2',
    name: 'Q2: codex apply_patch_tool_type 取值',
    prompt: `调查问题：codex 的 apply_patch 工具仅在 model_info.apply_patch_tool_type 存在时才注册。这个字段有哪些取值？不同取值对应什么不同的编辑工具形态？
请重点查找：
1. apply_patch_tool_type 字段的定义位置（struct/enum）和所有可能的取值
2. 不同取值下注册的工具 spec 有何不同（freeform lark 文本 vs 结构化 JSON vs 其他）
3. model_info 是如何决定 apply_patch_tool_type 取值的（模型能力 catalog？配置？）
4. 是否存在非 apply_patch 的备选编辑工具类型（如直接 write_file）

codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
已知线索：
- apply_patch_spec.rs：codex-rs/core/src/tools/handlers/apply_patch_spec.rs（create_apply_patch_freeform_tool + lark）
- model_info / models-manager：codex-rs/models-manager/
- 搜 "apply_patch_tool_type" 关键词

只读探索，不要修改文件。必须用实际读到的代码支撑答案，列出所有枚举值。`,
  },
  {
    key: 'q3',
    name: 'Q3: codex shell 拦截 apply_patch 行为',
    prompt: `调查问题：codex 的 shell.rs / exec_command.rs 用 intercept_apply_patch 拦截命令行里的 apply_patch 调用，路由到补丁 runtime（不真正执行 shell）。这个行为在当前代码中是否仍保留？触发条件是什么？是否有 legacy 警告？
请重点查找：
1. intercept_apply_patch 函数的实现位置和逻辑（如何识别命令行中的 apply_patch 调用）
2. 拦截后的路由路径（到哪个 runtime，是否与直接调用 apply_patch 工具等价）
3. 是否有 feature flag / 配置项控制拦截行为的开关
4. 是否有 deprecation / legacy 警告提示模型不要用 shell 调 apply_patch
5. 拦截行为在新版模型/工具下是否仍活跃，还是已完全迁移到独立 apply_patch 工具调用

codex 根目录：/home/tiger/workspace/harness-comparison/agents/codex
已知线索：
- codex-rs/core/src/tools/handlers/apply_patch.rs（ApplyPatchHandler + intercept_apply_patch）
- codex-rs/core/src/tools/handlers/shell.rs
- codex-rs/core/src/apply_patch.rs（安全评估 + 路由到 runtime）
- 搜 "intercept_apply_patch" 关键词

只读探索，不要修改文件。必须用实际读到的代码支撑答案。`,
  },
];

phase('调查');
const results = await parallel(
  questions.map((q) => () =>
    agent(q.prompt, {
      label: q.name,
      phase: '调查',
      schema: Q_SCHEMA,
      model: 'sonnet',
      effort: 'high',
    })
  )
);

const valid = results.filter(Boolean);
log(`调查阶段完成：${valid.length}/${questions.length} 个问题返回结果`);

phase('汇总');
const synth = await agent(
  `你是一名技术写作专家。基于以下 3 个开放问题的调查结果，撰写一份 markdown 报告。
报告结构：
1. 概述：为什么这 3 个问题重要（揭示"编辑范式之争"背后的工程权衡）
2. 每个问题一节：明确答案 + 代码证据（文件:行号 + 片段）+ 置信度 + 仍存疑问
3. 综合结论：3-5 条跨问题的核心洞察，特别是 codex 与 grok-build 在"编辑工具如何被选择/暴露/兼容"上的设计哲学差异
4. 后续建议：基于这些发现，下一步值得分析什么

风格：简洁、信息密度高、用代码片段说话。不要编造结果中没有的内容。

调查结果（JSON）：
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
  investigations: valid,
  report: synth?.report,
  conclusions: synth?.conclusions,
};
