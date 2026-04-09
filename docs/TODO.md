# ice-excel 待办事项

## 已完成 ✅

- [x] 脚本引擎沙箱逃逸修复（constructor/__proto__/prototype 拦截）
- [x] 数据验证 - 自定义验证接入公式引擎
- [x] HistoryAction data/undoData 从 any 改为 unknown
- [x] 插件自定义公式接入 FunctionRegistry（含 cleanup 反注册）
- [x] 条件格式 UI 管理面板（创建/编辑/删除/预览）
- [x] 透视表配置持久化（JSON 导入导出 + localStorage）
- [x] 数学函数补全：RAND, RANDBETWEEN, LOG, LN, EXP, PI, SIGN
- [x] 统计函数补全：MEDIAN, STDEV, VAR, LARGE, SMALL, RANK, PERCENTILE
- [x] 文本函数补全：REPLACE, REPT, EXACT, CHAR, CODE, CLEAN, VALUE
- [x] 日期函数补全：HOUR, MINUTE, SECOND, TIME, WEEKDAY, WEEKNUM, NETWORKDAYS, WORKDAY
- [x] 查找函数补全：XLOOKUP, CHOOSE, ROW, COLUMN, ROWS, COLUMNS, TRANSPOSE

---

## P0 - 核心交互缺失

- [x] **Ctrl+S 保存快捷键**
  - `handleKeyDown` 中无 `key === 's'` 处理
  - 用户无法通过键盘保存到 localStorage
  - 文件：`src/app.ts` → `handleKeyDown()`

- [x] **数据验证缺少 UI 设置入口**
  - 验证引擎和模型层已实现，渲染层能画下拉箭头
  - 但工具栏和右键菜单均无"数据验证"入口
  - 用户无法通过界面设置验证规则
  - 需要：工具栏按钮 + 设置对话框（支持下拉列表/数值范围/文本长度/自定义表达式）
  - 文件：`src/ui-controls.ts`、新建 `src/validation-dialog.ts`、`src/app.ts`

- [x] **批注悬浮预览**
  - 批注设置/获取/红色三角标记/右键菜单入口均已实现
  - 但鼠标悬停有批注单元格时无 tooltip 显示内容
  - 需要：canvas mousemove 事件中检测批注单元格，显示浮动提示
  - 文件：`src/app.ts`（mousemove 处理）、`src/renderer.ts`

## P1 - 快捷键与状态栏

- [x] **Ctrl+P 打印快捷键**
  - PrintPreviewDialog 已完整实现，但无快捷键入口
  - 文件：`src/app.ts` → `handleKeyDown()`

- [x] **状态栏选区统计信息**
  - 底部状态栏只显示单元格位置
  - 缺少选区的求和/平均值/计数统计（Excel 标配功能）
  - 文件：`src/app.ts`、`src/style.css`

- [x] **公式栏名称框**
  - Excel 左上角名称框：显示当前单元格地址（如 A1），支持输入地址跳转
  - 当前公式栏组件无此功能
  - 文件：`src/formula-bar/formula-bar.ts`

## P2 - 类型安全

- [x] **HistoryAction discriminated union 改造**
  - 当前 data/undoData 为 unknown，调用方需大量类型断言
  - 建议为每种 ActionType 定义对应的数据接口，用 discriminated union 替代
  - 文件：`src/history-manager.ts`
