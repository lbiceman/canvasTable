# ice-excel TODO P0/P1/P2 技术设计文档

## 1. 脚本引擎沙箱逃逸修复（P0）

**文件**：`src/script/script-engine.ts` → `createSandbox()`

**方案**：在 Proxy 的 `get` 拦截器中，对白名单对象冻结原型链，拦截 `constructor`、`prototype`、`__proto__` 等危险属性访问。对白名单中的内置对象（Math, Date, String 等）使用 `Object.freeze` 冻结原型。

**变更**：
- 在 `createSandbox` 方法中添加危险属性黑名单检查
- 对白名单对象的返回值进行原型链安全包装

## 2. 自定义验证接入公式引擎（P0）

**文件**：`src/validation.ts` → `validateCustom()`

**方案**：调用 `FormulaEngine.getInstance()` 对 `customExpression` 进行求值，将结果转为布尔值作为验证结果。

**变更**：
- `validateCustom` 方法接入 `FormulaEngine`
- 支持 `=AND(A1>0, A1<100)` 等公式表达式

## 3. HistoryAction 类型安全改造（P0）

**文件**：`src/history-manager.ts`

**方案**：为每种 `ActionType` 定义对应的 `data`/`undoData` 类型接口，使用 discriminated union 替代 `any`。由于 ActionType 种类繁多且数据结构各异，采用 `Record<string, unknown>` 作为基础类型，配合具体操作类型的类型守卫。

**变更**：
- 将 `data: any` 和 `undoData: any` 替换为 `data: HistoryActionData` 和 `undoData: HistoryActionData`
- `HistoryActionData` 定义为 `Record<string, unknown>` 以保持灵活性同时消除 `any`

## 4. 插件自定义公式接入公式引擎（P1）

**文件**：`src/plugin/plugin-api.ts`、`src/formula/function-registry.ts`

**方案**：在 `PluginAPI.registerFunction()` 中，除了存入内部 Map，同时调用 `FormulaEngine.getInstance().getRegistry().register()` 注册到公式引擎。cleanup 时同步反注册。

**变更**：
- `PluginAPI.registerFunction` 增加 FunctionRegistry 注册逻辑
- `FunctionRegistry` 添加 `unregister` 方法
- `PluginAPI.cleanup` 增加反注册逻辑

## 5. 条件格式 UI 管理面板（P1）

**文件**：`src/app.ts`

**方案**：当前 `app.ts` 已有完整的条件格式面板实现（createConditionalFormatPanel、renderConditionalFormatPanel、handleAddConditionalFormatRule 等方法），包含添加规则、规则列表展示功能。需要补充：编辑规则和删除规则的 UI 交互。

**变更**：
- 在 `createRuleItem` 方法中添加编辑和删除按钮
- 添加编辑规则的表单回填逻辑

## 6. 透视表配置持久化（P1）

**文件**：`src/types.ts`、`src/model.ts`、`src/data-manager.ts`

**方案**：
- 在 `SpreadsheetData` 中添加可选的 `pivotTableConfigs` 字段
- 在 `exportToJSON` 中序列化透视表配置
- 在 `importFromJSON` 中反序列化透视表配置
- localStorage 流程自动跟随 exportToJSON/importFromJSON

**变更**：
- `types.ts`：新增 `PivotTableConfig` 接口，`SpreadsheetData` 添加 `pivotTableConfigs?` 字段
- `model.ts`：exportToJSON/importFromJSON 处理透视表数据
- `pivot-table.ts`：添加序列化/反序列化方法

## 7-11. 公式函数补全（P2）

**文件**：
- `src/formula/functions/math.ts` - RAND, RANDBETWEEN, LOG, LN, EXP, PI, SIGN
- `src/formula/functions/statistics.ts` - MEDIAN, STDEV, VAR, LARGE, SMALL, RANK, PERCENTILE
- `src/formula/functions/text.ts` - REPLACE, REPT, EXACT, CHAR, CODE, CLEAN, VALUE
- `src/formula/functions/date.ts` - HOUR, MINUTE, SECOND, TIME, WEEKDAY, WEEKNUM, NETWORKDAYS, WORKDAY
- `src/formula/functions/lookup.ts` - XLOOKUP, CHOOSE, ROW, COLUMN, ROWS, COLUMNS, TRANSPOSE

**方案**：在各文件的 `register*Functions` 函数末尾追加新函数注册，遵循现有 handler 签名模式（`(args: FormulaValue[], context?: EvaluationContext) => FormulaValue`）。

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/script/script-engine.ts` | 修改 | 沙箱安全加固 |
| `src/validation.ts` | 修改 | 自定义验证接入公式引擎 |
| `src/history-manager.ts` | 修改 | 类型安全改造 |
| `src/plugin/plugin-api.ts` | 修改 | 插件公式注册到引擎 |
| `src/formula/function-registry.ts` | 修改 | 添加 unregister 方法 |
| `src/app.ts` | 修改 | 条件格式面板编辑/删除 |
| `src/types.ts` | 修改 | 添加 PivotTableConfig 类型 |
| `src/model.ts` | 修改 | 透视表持久化 |
| `src/formula/functions/math.ts` | 修改 | 新增 7 个数学函数 |
| `src/formula/functions/statistics.ts` | 修改 | 新增 7 个统计函数 |
| `src/formula/functions/text.ts` | 修改 | 新增 7 个文本函数 |
| `src/formula/functions/date.ts` | 修改 | 新增 8 个日期函数 |
| `src/formula/functions/lookup.ts` | 修改 | 新增 7 个查找函数 |
