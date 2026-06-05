# OMX 模式配置 (本仓库)

本目录定义 OMX (oh-my-codex) 模式,跟 resoftcode binary 协同工作。

## 模式清单

| 模式 | Prompt | Skill | 用途 | 触发 |
|------|--------|-------|------|------|
| `resoft-data` | [`prompts/resoft-data.md`](./prompts/resoft-data.md) | [`skills/resoft-data/SKILL.md`](./skills/resoft-data/SKILL.md) | 数据治理与监管报送专精 (6 个子能力) | `$resoft-data` / keyword 路由 |

## resoft-data 模式

数据治理与监管报送领域专精模式。覆盖:

1. 数据探索/分析
2. ETL 开发
3. 数据质量评估
4. 数据测试 (5 维度)
5. 造数
6. 数据归因

**核心集成**:与 resoftcode 0.1.3+ binary 内置的 3 个 `regulatory-*` skill 深度协同:

- `regulatory-data-testing` — 5 维度数据测试方法论
- `regulatory-etl-development` — 监管报送 ETL 代码生成
- `regulatory-reporting-mapping` — 源系统到监管制度字段映射

详细使用流程见 [`skills/resoft-data/SKILL.md`](./skills/resoft-data/SKILL.md)。

## 安装 (本机 OMX)

要让 OMX 在 resoftcode 仓库(或本机任意目录)识别这些模式,把配置软链或复制到 `~/.codex/`:

```sh
# 软链 (推荐,跟着仓库走)
mkdir -p ~/.codex
ln -sfn /Users/zhangyanlong/workspaces/ResoftCode/.codex/prompts ~/.codex/prompts-resoft
ln -sfn /Users/zhangyanlong/workspaces/ResoftCode/.codex/skills ~/.codex/skills-resoft
# 然后在 ~/.codex/AGENTS.md 里 include 上述路径
```

或者直接复制:

```sh
cp -r .codex/prompts/* ~/.codex/prompts/
cp -r .codex/skills/* ~/.codex/skills/
```

## 版本依赖

| 模式 | 需要的 resoftcode 版本 |
|------|---------------------|
| `resoft-data` 基础路由 | ≥ 0.1.3 (携带 3 个 `regulatory-*` skill) |
| 退路(无 `regulatory-*` 时) | 任何版本 (ad-hoc SQL + 5 维度方法论 inlined) |

## 协作

| 模式 | 推荐组合 |
|------|---------|
| `resoft-data` + `planner` | 复杂跨系统数据迁移:planner 出方案,resoft-data 执行 |
| `resoft-data` + `code-reviewer` | 上线前:resoft-data 出 SQL,code-reviewer 审查 |
| `resoft-data` + `data-visualization` | 数据交付后:resoft-data 出数据,visualization 出图表 |
