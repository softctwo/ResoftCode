// kilocode_change - new file
// Built-in skills that ship inside the CLI binary.
// Content is inlined at compile time via Bun's static import of .md files.
// Registered before all discovery phases so user skills with the same name override.

import KILO_CONFIG from "./kilo-config.md"
import REGULATORY_DATA_TESTING from "./regulatory-data-testing.md"
import REGULATORY_ETL_DEVELOPMENT from "./regulatory-etl-development.md"
import REGULATORY_REPORTING_MAPPING from "./regulatory-reporting-mapping.md"
import { Brand } from "../brand"

export interface BuiltinSkill {
  name: string
  description: string
  content: string
}

export const BUILTIN_SKILLS: BuiltinSkill[] = [
  {
    name: "kilo-config",
    description:
      `Guide for ${Brand.product} configuration: config paths, kilo.json fields, commands, agents, skills, permissions, MCPs, providers, TUI settings, plus Agent Manager worktree setup/run scripts, workflows, and state. ` +
      `Use for ${Brand.name} config questions, locating loaded config, changing settings, or Agent Manager questions about run/setup scripts, worktree setup/workflows, apply/merge/PR/conflicts, missing sessions/worktrees, and agent-manager.json recovery.`,
    content: KILO_CONFIG,
  },
  // resoft_change - financial regulatory reporting skills shipped as
  // built-ins for the ChinaSoft Resoft CodingAgent distribution.
  // Source of truth lives in ~/.kilocode/skills/regulatory-* on the
  // build host; copies under src/kilocode/skills/ are inlined at
  // compile time so the published binary is self-contained.
  {
    name: "regulatory-data-testing",
    description:
      "金融监管报送数据测试智能体。对监管报送 ETL 加工结果进行全链路数据测试和质量校验，" +
      "覆盖完整性、准确性、一致性、及时性、唯一性五大维度。自动生成测试用例、测试 SQL、" +
      "数据比对脚本和质量报告。支持 EAST、1104、反洗钱、征信等报送场景。",
    content: REGULATORY_DATA_TESTING,
  },
  {
    name: "regulatory-etl-development",
    description:
      "金融监管报送 ETL 开发智能体。基于监管报送 mapping 分析结果，自动生成源系统到监管报送数据的 " +
      "ETL 加工代码、SQL 脚本、存储过程和调度配置。支持 EAST、1104、反洗钱、征信等报送场景，" +
      "覆盖数据抽取、清洗、转换、校验、加载全链路。",
    content: REGULATORY_ETL_DEVELOPMENT,
  },
  {
    name: "regulatory-reporting-mapping",
    description:
      "金融行业监管报送源系统到监管制度的字段映射分析（Mapping）。通过分析行内源系统的数据字典、" +
      "数据库设计文档、业务文档，根据监管报送目标制度，生成源系统字段到监管指标的映射关系初稿，" +
      "供业务分析师用于客户访谈和后续迭代。覆盖 EAST、1104、反洗钱、征信等报送场景。",
    content: REGULATORY_REPORTING_MAPPING,
  },
]
