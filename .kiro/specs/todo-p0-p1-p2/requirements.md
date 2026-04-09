# ice-excel TODO 待办功能需求文档（P0/P1/P2）

## 功能概述

实现 ice-excel 项目 TODO.md 中 P0（安全与正确性）、P1（功能断点修复）、P2（公式函数补全）三个优先级共 11 项功能需求。

## 用户故事

### P0 - 安全与正确性

**US-1：脚本引擎沙箱安全加固**
- 作为开发者，我希望脚本引擎的沙箱能阻断原型链逃逸攻击，使用户脚本无法访问 `constructor`、`__proto__`、`prototype` 等危险属性。

**US-2：自定义验证接入公式引擎**
- 作为用户，我希望自定义验证规则（如 `=AND(A1>0, A1<100)`）能真正执行公式求值，而非始终返回有效。

**US-3：HistoryAction 类型安全改造**
- 作为开发者，我希望 `HistoryAction` 的 `data` 和 `undoData` 字段使用 discriminated union 替代 `any`，提升类型安全。

### P1 - 功能断点修复

**US-4：插件自定义公式接入公式引擎**
- 作为插件开发者，我希望通过 `PluginAPI.registerFunction()` 注册的公式能在公式引擎中被调用。

**US-5：条件格式 UI 管理面板**
- 作为用户，我希望有一个完整的条件格式管理面板，支持添加、编辑、删除规则和预览效果。

**US-6：透视表配置持久化**
- 作为用户，我希望透视表配置在 JSON 导入/导出和 localStorage 保存/加载时不丢失。

### P2 - 公式函数补全

**US-7：数学函数补全** - RAND, RANDBETWEEN, LOG, LN, EXP, PI, SIGN（SUM 已存在）
**US-8：统计函数补全** - MEDIAN, STDEV, VAR, LARGE, SMALL, RANK, PERCENTILE
**US-9：文本函数补全** - REPLACE, REPT, EXACT, CHAR, CODE, CLEAN, VALUE
**US-10：日期函数补全** - HOUR, MINUTE, SECOND, TIME, WEEKDAY, WEEKNUM, NETWORKDAYS, WORKDAY
**US-11：查找函数补全** - XLOOKUP, CHOOSE, ROW, COLUMN, ROWS, COLUMNS, TRANSPOSE

## 验收标准

### P0
1. 沙箱中执行 `({}).constructor.constructor('return this')()` 等原型链攻击代码时返回 `undefined` 或抛出错误
2. `validateCustom()` 能正确求值公式表达式并返回验证结果
3. `HistoryAction` 使用 discriminated union，`tsc` 编译无 `any` 类型警告

### P1
4. 插件注册的公式函数可在单元格中通过 `=FUNC_NAME()` 调用
5. 条件格式面板支持所有 10 种条件类型的添加、编辑、删除操作
6. 透视表配置在 exportToJSON/importFromJSON 和 localStorage 流程中正确持久化

### P2
7-11. 所有新增公式函数可在单元格中正确调用，参数验证和错误处理与现有函数一致

## 约束条件

1. 不破坏现有功能，新增优于修改
2. TypeScript 严格模式，禁止 `any`（除非绝对必要并注释）
3. 代码注释中文，变量名英文
4. UI 文本简体中文
5. 遵循 MVC 分层架构
6. 新增字段必须可选并提供默认值（数据兼容）
7. 公式函数实现参考现有 handler 签名、错误处理、参数验证模式
