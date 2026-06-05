---
name: resoft-data
description: "Resoft-Data 数据治理与监管报送专精模式 (data governance & regulatory reporting) — 调度 6 个数据子能力 (探索分析/ETL 开发/数据质量/测试/造数/归因),深度协同 resoftcode 0.1.3+ 内置的 3 个监管报送 skill (regulatory-data-testing / regulatory-etl-development / regulatory-reporting-mapping)"
---

# Resoft-Data Mode

数据治理与监管报送领域专精模式。接受任何数据相关任务,自动分类到 6 个子能力之一,调度对应 skill 完成,产出版本化的可交付物。激活时自动检测 resoftcode 0.1.3+ 是否携带 3 个内置监管报送 skill,如有则优先 dispatch。

## Use when

- 用户在 resoftcode 项目里做监管报送数据实施 (EAST / 1104 / 反洗钱 / 征信)
- 用户请求数据探索、SQL 分析、ETL 加工、数据质量、数据测试、造数、数据归因
- 业务分析师需要从源系统数据字典生成监管报送 mapping
- 数据开发需要批量 ETL 脚本或存储过程
- 数据测试需要 5 维度 (完整性/准确性/一致性/及时性/唯一性) 校验
- 测试环境需要造数 (造正常/异常/边界)
- 上线后报送数据有差异,需要归因

## Do not use when

- 任务是非数据相关的纯代码/纯基础设施/纯 UI 工作 — 用 default executor
- 任务需要的是规划/审查/讨论而非数据实施 — 用 `$plan` / `$code-review`
- 任务需要的是产研管理 (PR、issue 拆解) — 用 `$to-issues`

## 子能力路由

接到任务时,先做场景识别,再 dispatch 到对应子能力。同一任务可能跨多个子能力,顺序执行:

| # | 子能力 | 触发词 | 主调度 skill | 备选 skill |
|---|--------|--------|-------------|-----------|
| 1 | **数据探索/分析** | 探索数据、看一下、源表分析、数据画像 | (通用) SQL 直查 + `regulatory-reporting-mapping` | `data-visualization` |
| 2 | **ETL 开发** | 写 ETL、做加工、生成脚本、SQL 转换、存储过程 | `regulatory-etl-development` | `python-executor` |
| 3 | **数据质量** | 质量评估、字段画像、空值率、值域、波动监控 | `regulatory-data-testing` | (通用) SQL 直查 |
| 4 | **数据测试** | 写测试用例、跑测试、出测试报告、五维校验 | `regulatory-data-testing` | (通用) SQL 直查 |
| 5 | **造数** | 造测试数据、生成样本、构造异常、边界值、压测数据 | (通用) Python + SQL | `python-executor` |
| 6 | **数据归因** | 数据差异、报错、报送失败、追溯源头、对账 | `regulatory-data-testing` (测试方法) + `regulatory-reporting-mapping` (字段血缘) | (通用) 探索 |

**调度规则**:
- `regulatory-*` skill 优先于通用 skill (resoftcode 0.1.3+ binary 携带,无需安装)
- 监管报送场景 (EAST/1104/反洗钱/征信) → 必须用 `regulatory-*` skill
- 通用数据治理场景 → 用通用 skill + 借鉴 `regulatory-*` 的方法论
- 子能力 1/3/4/6 经常需要联合使用 (探索 → 测试 → 归因 是同一条链路)

## Workflow

### 阶段 0: 场景识别

1. 解析用户请求,提取:
   - 报送制度 (EAST/1104/反洗钱/征信/其他)
   - 任务类型 (探索/ETL/质量/测试/造数/归因)
   - 输入 (源系统数据字典、数据库设计文档、监管制度文档、目标表 DDL、SQL 文件)
   - 输出期望 (mapping 表/ETL 脚本/测试报告/造数脚本/归因报告)
2. 检测 resoftcode 0.1.3+ 是否携带 3 个 `regulatory-*` skill:
   - 命令: `kilo skill ls | grep regulatory` 或 `resoftcode skill ls`
   - 命中 → 优先 dispatch
   - 未命中 → 退到通用 skill + 在响应中提示用户升级
3. 输出场景分类结果,让用户确认范围 (1 句话即可,不要长篇访谈)

### 阶段 1: 调度子能力

按场景分类,执行对应子能力:

**子能力 1 - 数据探索/分析**:
- 工具:`regulatory-reporting-mapping` (源系统画像) 或纯 SQL 直查
- 输出:数据画像报告 (表/字段/枚举/空值率/分布)
- 交付物:`docs/analysis/<table>-profile.md`

**子能力 2 - ETL 开发**:
- 工具:`regulatory-etl-development` (主) 或 `python-executor` (Python 写 ETL 时)
- 输入:监管 mapping 表、源/目标 DDL、加工规则
- 输出:可直接执行的 SQL 脚本 / 存储过程 / ETL 任务配置
- 交付物:`etl/<system>/<target_table>.sql` (结构化目录)
- 验证:在沙箱执行,核对记录数与样本

**子能力 3 - 数据质量**:
- 工具:`regulatory-data-testing` (5 维度方法论) + SQL 直查
- 输出:质量评估报告 (5 维度评分 + 风险点 + 整改建议)
- 交付物:`docs/quality/<table>-quality-report.md`

**子能力 4 - 数据测试**:
- 工具:`regulatory-data-testing` (主)
- 输入:监管制度、mapping、ETL 文档
- 输出:测试用例 (完整性/准确性/一致性/及时性/唯一性) + 测试 SQL + 执行结果
- 交付物:`test/<batch>/<table>-test-cases.md` + `test/<batch>/<table>-test-sqls.sql`
- 验证:执行测试 SQL,记录通过率

**子能力 5 - 造数**:
- 工具:Python (`python-executor`) 或 SQL
- 输入:目标表 DDL、业务规则
- 输出:造数脚本 + 造数结果验证
- 交付物:`testdata/<table>/generate.sql` + `testdata/<table>/verify.sql`
- 覆盖:正常样本、边界值、异常值、关联一致性

**子能力 6 - 数据归因**:
- 工具:`regulatory-data-testing` (测试方法定位问题点) + `regulatory-reporting-mapping` (字段血缘)
- 输入:差异数据 (期望 vs 实际)、源系统、加工链路日志
- 输出:归因链 (差异 → 加工步骤 → 源数据问题)
- 交付物:`docs/attribution/<incident>-attribution.md`
- 验证:用归因结论重跑,确认差异消失

### 阶段 2: 交叉验证

完成子能力后,跑一次交叉验证:
- 子能力 1 (探索) → 必须被子能力 3 (质量) 验证
- 子能力 2 (ETL) → 必须被子能力 4 (测试) 验证
- 子能力 5 (造数) → 必须被子能力 4 (测试) 验证 (造数合理性)
- 子能力 6 (归因) → 必须能复现,验证结论可重放

### 阶段 3: 交付汇总

- 列出所有交付物路径
- 标注哪些用了 `regulatory-*` skill (作为 resoftcode 0.1.3+ 价值证明)
- 标注下一步建议 (测试通过 → 上线 / 测试失败 → 回退到阶段 1)

## 与 resoftcode 0.1.3+ 的协同

`resoft-data` 模式与 resoftcode 二进制内的 3 个内置 skill 深度协同:

```text
用户任务
  │
  ▼
resoft-data 路由
  │
  ├── 监管报送场景 ──→ regulatory-reporting-mapping (mapping)
  │                  ──→ regulatory-etl-development (ETL)
  │                  ──→ regulatory-data-testing (测试)
  │
  └── 通用数据治理 ──→ SQL/Python (通用)
```

**优先级规则**:
- 监管报送场景 (用户提到 EAST/1104/反洗钱/征信/mapping/报送制度) → 100% 用 `regulatory-*`
- 通用数据治理 → 借鉴 `regulatory-*` 的方法论 (5 维度、Mapping 表模板),但不一定 dispatch 那个具体 skill
- 用户显式说"用 regulatory" 或 `$resoft-data regulatory <task>` → 强制用 `regulatory-*`

**版本要求**:
- resoftcode ≥ 0.1.3 才携带 3 个 `regulatory-*` skill
- 检测命令: `resoftcode --version` + `kilo skill ls | grep regulatory`
- 0.1.3 之前或非 resoftcode → 提示用户升级 (`npm install -g @chinaresoft/resoftcode@latest`)

## 输入/输出规范

**最小输入**:
- 任务描述 (1 句话)
- 输入文件路径 (数据字典/制度文档/源表 DDL)
- 期望产出 (mapping/ETL/测试报告/造数脚本/归因报告)

**最小输出**:
- 交付物文件路径 (按子能力分类的目录结构)
- 关键发现 (差异点、风险点、待确认事项)
- 下一步建议

**禁止**:
- 不要把所有内容塞进 chat 回复 (用文件)
- 不要返回未经执行的 SQL (执行后才算交付)
- 不要在没有 mapping 的情况下做 ETL (mapping 是 ETL 的输入)
- 不要在没有测试的情况下上线 (测试是上线的门)

## Relationship to other OMX surfaces

- `$plan` — 当用户需要的是计划/方案,而不是数据实施,走 `$plan`
- `$ralph` — 当用户需要持续循环到全部任务通过,走 `$ralph`
- `$code-review` — 当用户需要审查 SQL/脚本质量,走 `$code-review`
- `executor` (default) — 当用户任务是普通代码而非数据,走 default
- `resoft-data` (this) — 监管报送 + 通用数据治理,本 skill
