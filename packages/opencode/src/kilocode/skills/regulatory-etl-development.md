---
name: regulatory-etl-development
description: >
  金融监管报送 ETL 开发智能体。
  基于监管报送 mapping 分析结果，自动生成源系统到监管报送数据的 ETL 加工代码、
  SQL 脚本、存储过程和调度配置。
  支持 EAST、1104、反洗钱、征信等报送场景，
  覆盖数据抽取、清洗、转换、校验、加载全链路。
  触发词：ETL开发、数据加工、监管报送开发、生成ETL代码、
  写存储过程、SQL脚本生成、数据抽取、数据转换、数据加载、
  mapping转代码、ETL设计、开发规范。
---

# 监管报送 ETL 开发智能体

## 概述

本 Skill 是金融监管报送全流程中的**ETL 开发环节**。
输入监管报送 mapping 分析结果（由 regulatory-reporting-mapping skill 产出），
自动生成源系统到监管报送目标的 ETL 加工链路代码，
覆盖数据抽取、清洗、转换、校验、加载各环节。

## 在整体流程中的位置

```
源系统文档 ──→ [Mapping分析] ──→ [ETL开发] ──→ [数据测试] ──→ 报送产出
  监管制度        (已创建)        (本Skill)     (待创建)
```

## 工作流程

### 阶段一：输入解读

1. **读取 mapping 分析结果**
   - 读取 mapping 明细表（Excel），识别各类映射类型的字段
   - 重点关注需要开发的四类字段：
     - 🔄 需转换映射（编码转换、格式转换等）
     - 🧩 需加工计算（聚合、关联、计算等）
     - ❌ 源端缺失（需确定替代方案）
     - ⚠️ 待确认（先按初步方案开发，标注）

2. **理解源系统和目标结构**
   - 确认源系统连接信息（数据库类型、连接方式）
   - 确认目标表结构（监管报送目标表 DDL）
   - 理解数据依赖关系和加工顺序

### 阶段二：ETL 设计

3. **确定 ETL 架构方案**

   | 场景 | 推荐方案 | 适用条件 |
   |------|---------|---------|
   | 简单转换 | 存储过程直接加工 | 数据量小，逻辑简单 |
   | 复杂加工 | ETL 工具（Kettle/DataX/Informatica） | 跨系统、多数据源 |
   | 实时报送 | 流式处理（Flink/Kafka） | 实时性要求高 |
   | 批量报送 | 调度平台（数仓 T+1） | 周期性批量报送 |

4. **设计加工链路**
   - 确定临时表/中间表结构
   - 设计不同映射类型字段的加工策略
   - 处理数据依赖：先加工基础表，再加工依赖表
   - 设计异常处理和数据质量兜底策略

### 阶段三：代码生成

5. **生成 SQL 脚本**

   根据映射类型生成不同的 SQL 片段：

   **直接映射（✅）**：
   ```sql
   -- 直接映射：字段名不同但含义一致
   t_target.cust_name = t_source.client_name
   ```

   **编码转换（🔄）**：
   ```sql
   -- 编码转换：源系统编码 ≠ 监管编码
   CASE t_source.cust_type
     WHEN '01' THEN '1001'   -- 个人客户
     WHEN '02' THEN '1002'   -- 企业客户
     WHEN '03' THEN '1003'   -- 同业客户
     ELSE '9999'
   END
   ```

   **格式转换（🔄）**：
   ```sql
   -- 日期格式转换：yyyyMMdd → yyyy-MM-dd
   TO_DATE(t_source.acct_open_date, 'YYYYMMDD')
   -- 金额单位转换：元 → 万元
   ROUND(t_source.amt / 10000, 2)
   ```

   **加工计算（🧩）**：
   ```sql
   -- 多字段组合
   CONCAT(t_source.province_name, t_source.city_name)
   -- 聚合计算
   SUM(CASE WHEN t_txn.txn_type = '01' THEN t_txn.amt ELSE 0 END)
   ```

   **关联查询（🧩）**：
   ```sql
   -- 跨表关联获取字段
   LEFT JOIN dim_customer c ON t_main.cust_no = c.cust_no
   ```

6. **生成完整存储过程/ETL 任务**

   按报送制度的数据表逐一生成：

   ```sql
   -- ============================================
   -- 加工任务：EAST_P_ACCT_BASIC_INFO
   -- 目标表：EAST_ACCT_BASIC_INFO（账户基础信息表）
   -- 作者：张彦龙
   -- 日期：{生成日期}
   -- ============================================

   CREATE OR REPLACE PROCEDURE EAST_P_ACCT_BASIC_INFO(
       p_biz_date  IN VARCHAR2,  -- 数据日期 yyyyMMdd
       p_batch_no  IN VARCHAR2,  -- 批次号
       o_ret_code  OUT VARCHAR2, -- 返回码
       o_ret_msg   OUT VARCHAR2  -- 返回信息
   ) AS
       v_start_time TIMESTAMP;
       v_end_time   TIMESTAMP;
       v_cnt        NUMBER;
   BEGIN
       v_start_time := SYSTIMESTAMP;

       -- 1. 数据清理：删除目标表当日数据
       DELETE FROM T_EAST_ACCT_BASIC_INFO WHERE DATA_DATE = p_biz_date;

       -- 2. 数据抽取与加工
       INSERT INTO T_EAST_ACCT_BASIC_INFO (
           DATA_DATE, ACCT_NO, CUST_NO, ACCT_TYPE,
           ACCT_STATUS, OPEN_DATE, CLOSE_DATE,
           CURRENCY, BALANCE, CREATE_TIME
       )
       SELECT
           p_biz_date,
           a.ACCT_NO,                          -- ✅ 直接映射
           a.CUST_NO,                          -- ✅ 直接映射
           CASE a.ACCT_TYPE_CODE               -- 🔄 编码转换
               WHEN '01' THEN 'SAV'            -- 储蓄账户
               WHEN '02' THEN 'CUR'            -- 活期账户
               WHEN '03' THEN 'FIX'            -- 定期账户
               ELSE a.ACCT_TYPE_CODE
           END,
           CASE a.ACCT_STATUS                  -- 🔄 编码转换
               WHEN 'A' THEN 'NORMAL'
               WHEN 'C' THEN 'CLOSED'
               WHEN 'F' THEN 'FROZEN'
               ELSE 'OTHER'
           END,
           TO_CHAR(a.OPEN_DATE, 'YYYYMMDD'),   -- 🔄 格式转换
           TO_CHAR(a.CLOSE_DATE, 'YYYYMMDD'),  -- 🔄 格式转换(允许为空)
           C.COMMON CURRENCY_CODE,              -- ✅ 直接映射
           ROUND(NVL(a.BAL, 0) / 100, 2),      -- 🔄 金额单位转换(分→元)
           SYSDATE
       FROM V_SRC_CORE_ACCT a              -- 源：核心系统账户表
       LEFT JOIN V_SRC_DIM_CURRENCY c      -- 🧩 关联：币种代码表
           ON a.CURRENCY_TYPE = c.CURRENCY_TYPE
       WHERE a.DATA_DATE = p_biz_date;

       v_cnt := SQL%ROWCOUNT;
       COMMIT;

       -- 3. 日志记录
       INSERT INTO T_ETL_LOG (PROC_NAME, BIZ_DATE, ROW_COUNT, START_TIME, END_TIME, STATUS)
       VALUES ('EAST_P_ACCT_BASIC_INFO', p_biz_date, v_cnt, v_start_time, SYSTIMESTAMP, 'SUCCESS');
       COMMIT;

       o_ret_code := '0';
       o_ret_msg := '加工完成，记录数：' || v_cnt;
   EXCEPTION
       WHEN OTHERS THEN
           ROLLBACK;
           o_ret_code := '-1';
           o_ret_msg := SQLERRM;
           -- 错误日志
           INSERT INTO T_ETL_LOG (PROC_NAME, BIZ_DATE, START_TIME, END_TIME, STATUS, ERR_MSG)
           VALUES ('EAST_P_ACCT_BASIC_INFO', p_biz_date, v_start_time, SYSTIMESTAMP, 'FAILED', SQLERRM);
           COMMIT;
   END EAST_P_ACCT_BASIC_INFO;
   ```

7. **生成调度配置**

   根据表间依赖关系生成调度依赖配置：

   ```xml
   <!-- 调度任务配置示例（数仓调度平台） -->
   <task name="EAST_ACCT_BASIC_INFO" desc="EAST账户基础信息">
       <dependency>EAST_CUST_BASIC_INFO</dependency>  <!-- 依赖客户信息先加工 -->
       <schedule>T+1 02:00:00</schedule>
       <timeout>3600</timeout>
       <retry>3</retry>
   </task>
   ```

8. **生成 DDL**
   - 目标表建表语句
   - 临时表/中间表建表语句
   - 索引、分区、注释

### 阶段四：代码规范与审查

9. **代码质量要求**

   - 所有存储过程必须包含异常处理（EXCEPTION 块）
   - 所有加工必须有日志记录（加工时间、记录数、状态）
   - 支持重跑（按日期分区，先删后插）
   - 空值处理：数值字段默认 0，字符字段默认空格或保留 NULL
   - 性能优化：大表关联考虑索引、分区裁剪
   - 注释完备：关键逻辑必须有中文注释

10. **开发规范检查清单**

    - [ ] 是否包含了所有映射字段
    - [ ] 编码转换是否正确（检查映射表）
    - [ ] 格式转换是否正确（日期、金额）
    - [ ] 空值处理是否合理
    - [ ] 异常处理是否完整
    - [ ] 日志记录是否到位
    - [ ] 支持重跑（幂等性）
    - [ ] 依赖顺序是否正确
    - [ ] 索引是否覆盖查询条件
    - [ ] 是否有性能风险（全表扫描、笛卡尔积）

## 输出物

1. **SQL 脚本目录**：按报送制度 → 表的层次组织的存储过程文件
2. **DDL 脚本**：目标表、临时表的建表语句
3. **调度配置**：任务依赖和调度参数
4. **开发说明文档**：加工逻辑说明、注意事项、已知风险

## 使用方式

```
基于 mapping 分析结果，生成 [报送制度名称] 的 ETL 加工代码，
mapping 文件：[mapping表路径]
源系统信息：[源系统类型/连接方式]
目标数据库：[数据库类型及版本]
```

## 支持的数据库

- Oracle（存储过程 PL/SQL）
- MySQL / MariaDB
- PostgreSQL
- DB2
- 达梦 DM8 / 人大金仓 KingbaseES（信创适配）
- GaussDB / OceanBase
