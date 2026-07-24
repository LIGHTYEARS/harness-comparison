# 维度 4 深入：编辑范式之争（工具选择、暴露与兼容）

> 由 workflow `deep-dive-dim4-open-questions` 生成：3 个调查 agent 并行 + 1 个汇总 agent。
> 回答了 `comparison-report-dim1-4.md` 中维度 4 的 3 个开放问题。

## 1. 概述

这三个问题共同指向 agent 框架设计中一个核心工程权衡：**当存在多种编辑工具形态时，如何让模型在正确的时机用正确的工具改文件？**

- **问题 1**（grok-build 四套编辑工具如何选择）→ "通过 profile 在会话级只暴露一套工具"
- **问题 2**（codex apply_patch_tool_type 取值）→ "按模型能力条件注册工具"
- **问题 3**（shell 拦截 apply_patch 是否保留）→ "运行时拦截作为兼容层"

三者合起来，暴露了 codex 与 grok-build 在"编辑工具如何被选择/暴露/兼容"上的根本哲学分歧。

---

## 2. 各问题分析

### 问题 1：grok-build 四套编辑工具，模型如何选择？

**明确答案**：模型并不会在四套工具间"自主选择"。grok-build 通过 **agent profile + ToolKind 机制**，在每次会话中只暴露一套编辑工具给模型，prompt 也随之切换。

- `codex()` profile：只暴露 `Codex:apply_patch`，渲染 `apply_patch_prompt.md`
- `opencode()` profile：暴露 `OpenCode:edit`（Edit 类）+ `OpenCode:write`（Write 类）
- 默认 GrokBuild profile：暴露 `GrokBuild:search_replace`
- subagent：继承父会话 toolset

`ToolKind` 保证每种能力只暴露一个工具——`apply_patch`/`search_replace`/`edit` 都是 `ToolKind::Edit`，`write` 是 `ToolKind::Write`，同一会话里 Edit 类只会有一个。

**代码证据**：

```rust
// crates/codegen/xai-grok-agent/src/config.rs:1537-1542
pub fn codex() -> Self {
    Self {
        tool_config: codex_toolset(),
        system_prompt: TemplateOverride::Codex,
        ..Self::base(BuiltinAgentName::Codex, "Codex toolset and prompt")
    }
}
```

```rust
// crates/codegen/xai-grok-tools/src/registry/types.rs:954-959
// 每种 ToolKind 只保留第一个工具名
let mut kind_to_name: HashMap<ToolKind, String> = HashMap::new();
for tool_config in &config.tools {
    let entry = &self.tools[&tool_config.id];
    let client_name = tool_config.resolve_client_name(&entry.id);
    kind_to_name.entry(entry.kind).or_insert(client_name);
}
```

```markdown
<!-- crates/codegen/xai-grok-agent/templates/apply_patch_prompt.md:138 -->
- Use the `apply_patch` tool to edit files (NEVER try `applypatch` or `apply-patch`, only `apply_patch`): {"command":["apply_patch","*** Begin Patch\n..."]}
```

**置信度**：high

**仍存疑问**：
1. 默认 GrokBuild profile 的 toolset 定义位置
2. `write` 工具在非 opencode profile 是否可被配置启用
3. subagent 继承父 toolset 的具体代码路径

---

### 问题 2：codex apply_patch_tool_type 有哪些取值？对应什么工具形态？

**明确答案**：`ApplyPatchToolType` 枚举**目前只有一个取值**：`Freeform`（序列化为 `"freeform"`）。不存在结构化 JSON 版本。

当 `apply_patch_tool_type == Some(Freeform)` 时，注册 `ApplyPatchHandler`，其 `spec()` 返回 `ToolSpec::Freeform`——即 OpenAI Responses API 的 "custom" 类型工具，使用 **lark 语法**定义的 freeform 文本补丁格式（`*** Begin Patch` / `*** Update File: ...`），**而非 JSON function calling**。

取值由模型目录 `models.json` 决定：gpt-5.6-sol/terra/luna、gpt-5.5、gpt-5.4/mini、gpt-5.2、codex-auto-review 等设为 `"freeform"`，其余为 null（不注册 apply_patch，模型只能用 shell 改文件）。

**代码证据**：

```rust
// codex-rs/protocol/src/openai_models.rs:286-290
#[serde(rename_all = "snake_case")]
pub enum ApplyPatchToolType {
    Freeform,
}
```

```rust
// codex-rs/core/src/tools/spec_plan.rs:782-786
if environment_mode.has_environment() && turn_context.model_info.apply_patch_tool_type.is_some() {
    let include_environment_id = matches!(environment_mode, ToolEnvironmentMode::Multiple);
    planned_tools.add(ApplyPatchHandler::new(include_environment_id));
}
```

```rust
// codex-rs/core/src/tools/handlers/apply_patch_spec.rs:9-27
ToolSpec::Freeform(FreeformTool {
    name: "apply_patch".to_string(),
    description: "...This is a FREEFORM tool, so do not wrap the patch in JSON.".to_string(),
    format: FreeformToolFormat {
        r#type: "grammar".to_string(),
        syntax: "lark".to_string(),
        definition,
    },
})
```

**置信度**：high

**仍存疑问**：
- `models.json` 是本地唯一来源还是会被远端 API 覆盖？若远端返回新枚举值（非 freeform），当前代码是否会反序列化失败或忽略？

---

### 问题 3：shell 拦截 apply_patch 的行为是否仍保留？触发条件？有无 legacy 警告？

**明确答案**：拦截行为**仍然保留且活跃**，没有 feature flag 关闭它，也没有迁移到仅独立 apply_patch 工具。

- **实现位置**：`intercept_apply_patch` 定义在 `apply_patch.rs:544`，被两条 shell 路径无条件调用——`shell.rs:142`（ShellCommandHandler）和 `exec_command.rs:314`（ExecCommandHandler/unified_exec）
- **识别逻辑**：匹配 `[apply_patch|applypatch, <patch>]` 直接形式，或 `[bash|zsh|sh, -c, <script>]` / `[pwsh, -command, ...]` / `[cmd, /c, ...]` 形式，从脚本里用 tree-sitter-bash 抽取 heredoc patch 体
- **路由路径**：拦截后走与直接 `ApplyPatchHandler` **同一条** `apply_patch::apply_patch` + `ApplyPatchRuntime` 路径，行为等价
- **legacy 警告**：**没有**显式 deprecation 警告。唯一引导是 `ImplicitInvocation` 错误——当模型把原始 patch 体直接当命令传（无 `apply_patch` 前缀）时，提示改用 `["apply_patch", "<patch>"]`。对真正以 `apply_patch ...` 开头的 shell 命令，拦截**静默**生效

**代码证据**：

```rust
// codex-rs/core/src/tools/handlers/shell.rs:140-156
let apply_patch_cwd = PathUri::from_abs_path(&exec_params.cwd);
if let Some(output) = intercept_apply_patch(&exec_params.command, &apply_patch_cwd, ...).await? {
    return Ok(output);
}
```

```rust
// codex-rs/apply-patch/src/invocation.rs:112-166
const APPLY_PATCH_COMMANDS: [&str; 2] = ["apply_patch", "applypatch"];
pub fn maybe_parse_apply_patch(argv, cwd) -> MaybeApplyPatch {
    match argv {
        [cmd, body] if APPLY_PATCH_COMMANDS.contains(&cmd.as_str()) => ...,
        _ => match parse_shell_script(argv, cwd) { Some((shell, script)) => extract_apply_patch_from_shell(...) }
    }
}
```

**置信度**：high

**仍存疑问**：
- 拦截逻辑在未来是否计划移除（统一到独立 apply_patch 工具）？目前无任何 deprecation 信号。

---

## 3. 综合结论（5 条核心洞察）

### 洞察 1：工具暴露——"会话级单选" vs "能力级条件注册"
grok-build 用 **agent profile** 在会话启动时就锁定唯一编辑工具（ToolKind 去重）。codex 用 **model_info.apply_patch_tool_type** 在每次 turn 规划时条件注册。前者是"配置决定论"，后者是"能力决定论"。

### 洞察 2：工具形态——"FREEFORM 文本补丁" vs "标准 JSON 结构化工具"
codex 的 apply_patch 是 `ToolSpec::Freeform`，用 **lark 语法**定义补丁格式，明确要求"不要用 JSON 包裹"。grok-build 的所有编辑工具都是**标准 JSON schema 工具**。codex 把"补丁语法"放进了工具定义本身，grok-build 把"编辑语义"放进了 JSON 参数。

### 洞察 3：兼容性——"运行时静默拦截" vs "无兼容层"
codex 在**新旧两条 shell 路径**中都无条件保留 `intercept_apply_patch`，无 flag、无 deprecation 警告。这是一个"模型看不见的兼容层"。grok-build 没有这种拦截——工具就是工具，调错了就报错。

### 洞察 4：Edit/Write 分离——"两类 ToolKind" vs "一种补丁格式"
grok-build 显式区分 `ToolKind::Edit`（局部替换）和 `ToolKind::Write`（整文件覆写）。codex 只有 apply_patch 一种编辑工具，通过 patch 格式（`*** Update File` vs `*** Add File`）同时处理局部修改和整文件创建——把"粒度选择"交给补丁语法而非工具种类。

### 洞察 5：引导方式——"prompt 工程" vs "runtime 工程"
grok-build 重度依赖 prompt 模板：`apply_patch_prompt.md` 硬编码工具名并给格式示例，`prompt.md` 用 `${{ tools.by_kind.edit }}` 动态解析。codex 则把引导下沉到 runtime：拦截逻辑 + `ImplicitInvocation` 错误提示模型"改用 `["apply_patch", "<patch>"]`"。前者靠"告诉模型怎么做"，后者靠"运行时纠正模型怎么做"。

---

## 4. 后续建议

1. **grok-build 默认 profile 的 toolset 定义**：搜索 `grok_build_toolset` / `default_toolset`，确认默认 GrokBuild profile 是否真的只暴露 `search_replace`，以及是否存在自定义 toolset 组合的入口。
2. **codex models.json 的远端覆盖机制**：确认 `apply_patch_tool_type` 是否会被远端 API 响应覆盖；若远端返回未知枚举值，serde 反序列化是 panic 还是静默忽略。
3. **intercept_apply_patch 的移除计划**：在 codex 代码库中搜索 TODO/deprecation 注释，确认 shell 拦截是否有迁移时间表。
4. **freeform 工具的模型适配成本**：对比 codex freeform 与 grok-build 结构化 JSON 在"模型输出格式错误率"上的差异——这是两种范式的实际工程代价。
5. **subagent 的 toolset 继承路径**：grok-build subagent 继承父会话 toolset 的具体代码路径尚未确认。
