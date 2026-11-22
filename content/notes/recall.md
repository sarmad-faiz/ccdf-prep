Read this last, right before the exam.

## Module 1 · Foundations
- Everything is tokens, output included. Oversized input → error before generation; ceiling mid-generation → `model_context_window_exceeded`. Your app trims.
- Temperature 0 ≠ deterministic. Newest models: non-default sampling params and `budget_tokens` → 400.
- Fable > Opus > **Sonnet (default)** > Haiku; move on eval evidence. Model choice ≠ reasoning (per request, `effort`).
- Examples show shape, cost tokens every call, can let a cheaper model pass.
- Async client = real-time concurrency; Batches = offline, ≤24h, cheaper, poll.

## Module 2 · Prompting, agents, tools
- Prompt failure → diagnose the structure, add one technique. Structured outputs enforce; prompts request. No prefill with JSON outputs; check `stop_reason`.
- Thinking tokens billed as output. Return thinking blocks unchanged.
- Claude requests tools; your app executes. Every `tool_use` → matching `tool_result` in the very next user turn, all together.
- Streaming: parse tools after `content_block_stop`; commit after `message_stop`; discard partial turns.
- Context: prune, compact, clear, hand off. Overflow looks like bad tool picks.
- Workflow when steps are known; agent when the path isn't. Explicit exit + HITL before irreversible actions. Managed Agents ≠ ZDR/BAA.
- Memory: external storage for multi-session; Skills load on description match; subagents don't inherit Skills.
- Image tokens ⌈w/28⌉×⌈h/28⌉; PDF = `document`; batch results unordered → `custom_id`.

## Module 3 · Claude Code & MCP
- Deny beats allow; enterprise deny survives bypass. `acceptEdits` allows `rm` in working dir; bypass drops the protected-path guard.
- `CLAUDE.md` dilutes; rules files scope by `paths`; hooks are deterministic. `PreToolUse` blocks (exit 2), `PostToolUse` audits.
- Explore/Plan subagents skip `CLAUDE.md`. Skills = command format; plugins namespace commands; no absolute paths.
- MCP: stdio local, HTTP shared. Local scope = `~/.claude.json`; project = `.mcp.json`. Secrets by env var; leaked → rotate.
- Caching: ≤4 breakpoints, 5 min TTL (or 1h), ≥1,024 tokens, exact prefix.

## Module 4 · Production
- Eval before feature; change one thing; read per case. Calibrate judges; code checks where enough.
- Integration tests catch seams; traces find the step.
- Retry 429/529/5xx with backoff + jitter + `retry-after`; never 400/401/403/404 or refusals. One retry owner. Tool failure → `is_error: true`.
- Instrument tokens, latency, errors. Reliability floor before cost. Fan-out ≈ 15× tokens, not for coding.
- Untrusted content is data. Enforce with least privilege, hooks, sandbox, audit; prompts are not security.

## Module 5 · Deployment & reuse
- Reusable = parameters + assumptions doc + bundled eval + audit bundle.
- Contribute: rights check first; one thing, example, test, assumptions; right channel.
- Requirements: checkable behaviours + latency, scale, residency, identity. Gated lifecycle.
- Customer's cloud picks the platform. Pin full model IDs, keep the prior version, canary against the baseline.
- Compliance first, then latency from the customer's region, then total cost. EU-only → Bedrock or Vertex.
- Every seam is a boundary; contained only as well as the most privileged seam.
