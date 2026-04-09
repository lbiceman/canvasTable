# ice-excel TODO P0/P1/P2 任务列表

## P0 - 安全与正确性

- [x] T1: 脚本引擎沙箱逃逸修复 (`src/script/script-engine.ts`)
- [x] T2: 自定义验证接入公式引擎 (`src/validation.ts`)
- [x] T3: HistoryAction 类型安全改造 (`src/history-manager.ts`)

## P1 - 功能断点修复

- [x] T4: 插件自定义公式接入公式引擎 (`src/plugin/plugin-api.ts`, `src/formula/function-registry.ts`)
- [x] T5: 条件格式 UI 管理面板完善 (`src/app.ts`)
- [x] T6: 透视表配置持久化 (`src/types.ts`, `src/model.ts`)

## P2 - 公式函数补全

- [x] T7: 数学函数补全 (`src/formula/functions/math.ts`)
- [x] T8: 统计函数补全 (`src/formula/functions/statistics.ts`)
- [x] T9: 文本函数补全 (`src/formula/functions/text.ts`)
- [x] T10: 日期函数补全 (`src/formula/functions/date.ts`)
- [x] T11: 查找函数补全 (`src/formula/functions/lookup.ts`)
