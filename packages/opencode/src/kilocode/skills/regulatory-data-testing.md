---
name: regulatory-data-testing
description: >
  金融监管报送数据测试智能体。
  对监管报送 ETL 加工结果进行全链路数据测试和质量校验，
  覆盖完整性、准确性、一致性、及时性、唯一性五大维度。
  自动生成测试用例、测试 SQL、数据比对脚本和质量报告。
  支持 EAST、1104、反洗钱、征信等报送场景。
  触发词：数据测试、数据校验、数据质量、报送数据检查、
  监管数据比对、完整性检查、准确性校验、测试用例生成、
  总分核对、跨表核对、异常数据排查、质量报告。
---

# 监管报送数据测试智能体

## 概述

本 Skill 是金融监管报送全流程中的**数据测试环节**。
对监管报送 ETL 加工结果进行全链路数据测试和质量校验，
确保报送数据符合监管制度要求的完整性、准确性、一致性、及时性和唯一性。

## 在整体流程中的位置

```
源系统文档 ──→ [Mapping分析] ──→ [ETL开发] ──→ [数据测试] ──→ 报送产出
  监管制度        (已创建)       (已创建)       (本Skill)
```

## 测试维度

```
                    ┌─────────────┐
                    │   数据测试    │
                    │   五维模型    │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
     ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
     │  完整性     │  │  准确性     │  │  一致性     │
     │Completeness│  │ Accuracy  │  │Consistency │
     └───────────┘  └───────────┘  └───────────┘
     ┌─────┴─────┐  ┌─────┴─────┐
     │  及时性     │  │  唯一性     │
     │Timeliness  │  │Uniqueness  │
     └───────────┘  └───────────┘
```

## 工作流程

### 阶段一：测试准备

1. **读取测试依据文档**
   - 监管制度要求（必填项、校验规则、枚举值约束）
   - mapping 分析结果（字段映射关系和转换逻辑）
   - ETL 开发文档（加工逻辑说明）

2. **确认测试范围**
   - 测试的数据日期/批次
   - 涉及的报送表清单
   - 测试优先级（核心表 vs 辅助表）

### 阶段二：生成测试用例

3. **完整性测试用例**（检查数据是否完整不遗漏）

   | 测试项 | 测试方法 | SQL 示例 |
   |--------|---------|---------|
   | 必填字段非空检查 | 统计目标表必填字段的 NULL 值 | `SELECT COUNT(*) FROM t WHERE required_field IS NULL` |
   | 记录数比对 | 比对源系统和目标表记录数 | `SELECT '源', COUNT(*) FROM src UNION ALL SELECT '目标', COUNT(*) FROM tgt` |
   | 主键非空检查 | 验证主键字段无 NULL | `SELECT COUNT(*) FROM t WHERE pk IS NULL` |
   | 关联字段完整性 | 检查外键引用完整性 | `SELECT a.* FROM child a LEFT JOIN parent b ON a.fk = b.pk WHERE b.pk IS NULL` |
   | 枚举值覆盖率 | 检查是否所有枚举值都有对应数据 | `核对制度枚举值清单 vs 实际数据中的值` |

4. **准确性测试用例**（检查数据是否准确无差错）

   | 测试项 | 测试方法 | SQL 示例 |
   |--------|---------|---------|
   | 金额总分核对 | 源系统金额汇总 vs 目标表金额汇总 | `SELECT SUM(amt) FROM src; SELECT SUM(tgt_amt) FROM tgt` |
   | 编码转换准确性 | 逐编码检查转换结果 | `SELECT src_code, tgt_code, CASE WHEN 期望=实际 THEN 'PASS' ELSE 'FAIL' END FROM ...` |
   | 计算逻辑验证 | 按公式手动验算抽样的加工结果 | 抽取 100 条，逐行按映射逻辑手动验算 |
   | 格式转换检查 | 验证日期/金额格式转换结果 | `SELECT LENGTH(date_field), 期望长度 FROM tgt WHERE LENGTH(date_field) != 期望长度` |
   | 边界值测试 | 检查极值/空值/异常值处理 | `MAX/MIN/NULL/ZERO/负数处理是否正确` |

5. **一致性测试用例**（检查数据是否跨表一致）

   | 测试项 | 测试方法 | SQL 示例 |
   |--------|---------|---------|
   | 跨表字段一致 | 同一客户在不同表中的字段必须一致 | `SELECT a.cust_no, a.cust_name, b.cust_name FROM tab_a a JOIN tab_b b ON a.cust_no=b.cust_no WHERE a.cust_name!=b.cust_name` |
   | 总分平衡 | 明细汇总应等于总表 | `SELECT SUM(detail_amt) FROM detail; SELECT total_amt FROM summary` |
   | 期初期末衔接 | 上期期末 = 本期期初 | `SELECT 上期.期末余额 - 本期.期初余额 WHERE 差异 > 0` |
   | 状态一致性 | 账户状态与交易状态逻辑一致 | `已销户账户不应有新增交易` |

6. **及时性测试用例**（检查数据时效）

   | 测试项 | 测试方法 |
   |--------|---------|
   | 数据日期检查 | 验证目标表数据日期正确 |
   | 加工时效检查 | 检查 ETL 执行时长是否在 SLA 内 |
   | 延迟数据处理 | 验证对延迟到达数据的处理机制 |

7. **唯一性测试用例**（检查数据是否重复）

   | 测试项 | 测试方法 | SQL 示例 |
   |--------|---------|---------|
   | 主键唯一性 | 检查主键是否重复 | `SELECT pk_cols, COUNT(*) FROM t GROUP BY pk_cols HAVING COUNT(*) > 1` |
   | 业务唯一键 | 检查业务唯一键是否重复 | 同上，按制度定义的业务唯一键检查 |

### 阶段三：执行测试

8. **生成测试 SQL 脚本**

   自动生成完整的测试执行 SQL：

   ```sql
   -- ============================================
   -- 测试任务：EAST_T_ACCT_BASIC_INFO 数据测试
   -- 测试日期：{测试日期}
   -- 测试批次：{批次号}
   -- ============================================

   -- 【完整性测试 T-01】必填字段非空检查
   SELECT 'T-01' AS TEST_ID, '必填字段非空检查' AS TEST_NAME,
          COUNT(*) AS TOTAL,
          SUM(CASE WHEN ACCT_NO IS NULL THEN 1 ELSE 0 END) AS ACCT_NO_NULL,
          SUM(CASE WHEN CUST_NO IS NULL THEN 1 ELSE 0 END) AS CUST_NO_NULL,
          SUM(CASE WHEN ACCT_TYPE IS NULL THEN 1 ELSE 0 END) AS ACCT_TYPE_NULL,
          SUM(CASE WHEN OPEN_DATE IS NULL THEN 1 ELSE 0 END) AS OPEN_DATE_NULL,
          CASE WHEN SUM(CASE WHEN ACCT_NO IS NULL THEN 1
                             WHEN CUST_NO IS NULL THEN 1
                             WHEN ACCT_TYPE IS NULL THEN 1
                             WHEN OPEN_DATE IS NULL THEN 1
                             ELSE 0 END) = 0
               THEN '✅ PASS' ELSE '❌ FAIL' END AS RESULT
   FROM T_EAST_ACCT_BASIC_INFO
   WHERE DATA_DATE = '${biz_date}';

   -- 【完整性测试 T-02】记录数比对
   SELECT 'T-02' AS TEST_ID, '记录数比对' AS TEST_NAME,
          (SELECT COUNT(*) FROM V_SRC_CORE_ACCT WHERE DATA_DATE = '${biz_date}') AS SRC_COUNT,
          (SELECT COUNT(*) FROM T_EAST_ACCT_BASIC_INFO WHERE DATA_DATE = '${biz_date}') AS TGT_COUNT,
          ABS((SELECT COUNT(*) FROM V_SRC_CORE_ACCT WHERE DATA_DATE = '${biz_date}')
            - (SELECT COUNT(*) FROM T_EAST_ACCT_BASIC_INFO WHERE DATA_DATE = '${biz_date}')) AS DIFF,
          CASE WHEN ABS((SELECT COUNT(*) FROM V_SRC_CORE_ACCT WHERE DATA_DATE = '${biz_date}')
                       - (SELECT COUNT(*) FROM T_EAST_ACCT_BASIC_INFO WHERE DATA_DATE = '${biz_date}')) <= 5
               THEN '✅ PASS' ELSE '❌ FAIL' END AS RESULT;

   -- 【准确性测试 T-03】金额总分核对
   SELECT 'T-03' AS TEST_ID, '金额总分核对' AS TEST_NAME,
          (SELECT ROUND(SUM(NVL(BAL,0))/100, 2) FROM V_SRC_CORE_ACCT WHERE DATA_DATE = '${biz_date}') AS SRC_TOTAL_AMT,
          (SELECT ROUND(SUM(NVL(BALANCE,0)), 2) FROM T_EAST_ACCT_BASIC_INFO WHERE DATA_DATE = '${biz_date}') AS TGT_TOTAL_AMT,
          ABS((SELECT ROUND(SUM(NVL(BAL,0))/100, 2) FROM V_SRC_CORE_ACCT WHERE DATA_DATE = '${biz_date}')
            - (SELECT ROUND(SUM(NVL(BALANCE,0)), 2) FROM T_EAST_ACCT_BASIC_INFO WHERE DATA_DATE = '${biz_date}')) AS DIFF,
          CASE WHEN ABS((SELECT ROUND(SUM(NVL(BAL,0))/100, 2) FROM V_SRC_CORE_ACCT WHERE DATA_DATE = '${biz_date}')
                       - (SELECT ROUND(SUM(NVL(BALANCE,0)), 2) FROM T_EAST_ACCT_BASIC_INFO WHERE DATA_DATE = '${biz_date}')) <= 0.01
               THEN '✅ PASS' ELSE '❌ FAIL' END AS RESULT;

   -- 【准确性测试 T-04】编码转换抽检验证
   SELECT 'T-04' AS TEST_ID, '编码转换抽检验证' AS TEST_NAME,
          a.ACCT_TYPE_CODE AS SRC_CODE,
          a.ACCT_TYPE AS TGT_CODE,
          CASE a.ACCT_TYPE_CODE
              WHEN '01' THEN 'SAV'
              WHEN '02' THEN 'CUR'
              WHEN '03' THEN 'FIX'
              ELSE a.ACCT_TYPE_CODE
          END AS EXPECTED,
          CASE WHEN a.ACCT_TYPE = CASE a.ACCT_TYPE_CODE
                                   WHEN '01' THEN 'SAV'
                                   WHEN '02' THEN 'CUR'
                                   WHEN '03' THEN 'FIX'
                                   ELSE a.ACCT_TYPE_CODE
                                 END
               THEN '✅' ELSE '❌' END AS MATCH
   FROM T_EAST_ACCT_BASIC_INFO a
   WHERE a.DATA_DATE = '${biz_date}'
     AND ROWNUM <= 20;

   -- 【一致性测试 T-05】跨表客户名称一致性
   SELECT 'T-05' AS TEST_ID, '跨表客户名称一致性' AS TEST_NAME,
          COUNT(*) AS MISMATCH_COUNT,
          CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END AS RESULT
   FROM T_EAST_CUST_BASIC_INFO a
   JOIN T_EAST_ACCT_BASIC_INFO b
     ON a.CUST_NO = b.CUST_NO AND a.DATA_DATE = b.DATA_DATE
   WHERE a.DATA_DATE = '${biz_date}'
     AND NVL(a.CUST_NAME, '@NULL@') != NVL(b.CUST_NAME, '@NULL@');

   -- 【唯一性测试 T-06】主键唯一性
   SELECT 'T-06' AS TEST_ID, '主键唯一性' AS TEST_NAME,
          COUNT(*) AS DUP_COUNT,
          CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END AS RESULT
   FROM (
       SELECT ACCT_NO, COUNT(*) CNT
       FROM T_EAST_ACCT_BASIC_INFO
       WHERE DATA_DATE = '${biz_date}'
       GROUP BY ACCT_NO
       HAVING COUNT(*) > 1
   );
   ```

9. **执行测试并收集结果**

   运行所有测试 SQL，将结果汇总到测试结果表中：

   | TEST_ID | TEST_NAME | DIMENSION | TOTAL | PASS | FAIL | PASS_RATE | RESULT |
   |---------|-----------|-----------|-------|------|------|-----------|--------|
   | T-01 | 必填字段非空 | 完整性 | 4 | 4 | 0 | 100% | ✅ PASS |
   | T-02 | 记录数比对 | 完整性 | 1 | 1 | 0 | 100% | ✅ PASS |
   | T-03 | 金额总分核对 | 准确性 | 1 | 1 | 0 | 100% | ✅ PASS |
   | T-04 | 编码转换验证 | 准确性 | 20 | 19 | 1 | 95% | ⚠️ WARN |
   | T-05 | 跨表客户名一致性 | 一致性 | 3 | 3 | 0 | 100% | ✅ PASS |
   | T-06 | 主键唯一性 | 唯一性 | 0 | 0 | 0 | 100% | ✅ PASS |

### 阶段四：问题分析与报告

10. **失败用例分析**

    针对每个 FAIL 的测试用例：
    - 输出具体的差异数据明细
    - 分析根因（源数据问题 / ETL 加工问题 / 映射规则问题）
    - 给出修复建议

11. **生成测试报告**

    输出 Word 格式的数据测试报告，包含：
    - 测试概述（范围、环境、数据日期）
    - 测试执行概况（总数、通过率、各维度得分）
    - 五维测试详情（每个维度测试结果明细）
    - 失败用例详情（根因分析和修复建议）
    - 数据质量评分（基于五维的综合评分）
    - 测试结论与报送建议

## 数据质量评分模型

| 维度 | 权重 | 评分规则 |
|------|------|---------|
| 完整性 | 25% | 必填字段空值率、记录丢失率 |
| 准确性 | 30% | 转换错误率、金额差异率、编码准确率 |
| 一致性 | 20% | 跨表不一致记录占比 |
| 及时性 | 10% | 加工时效是否在 SLA 内 |
| 唯一性 | 15% | 主键重复率 |

综合得分 ≥ 95 分方可报送。

## 使用方式

```
对 [报送制度名称] 的加工结果执行数据测试，
mapping 文件：[mapping表路径]
目标表/库：[目标数据库信息]
测试日期：[数据日期]
ETL 开发文档：[可选]
```

## 输出物

1. **测试 SQL 脚本**：完整的测试执行脚本
2. **测试执行结果表**：所有用例的执行结果汇总
3. **差异数据明细**：失败用例的具体差异数据
4. **数据质量报告**（Word）：专业格式的测试报告
5. **修复建议清单**：按优先级排序的问题修复建议
