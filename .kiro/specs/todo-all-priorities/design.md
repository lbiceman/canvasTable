# 设计文档：TODO 全优先级功能开发

## 技术方案

### P1: 财务函数补全
- **文件**：新增 `src/formula/functions/financial.ts`
- **方案**：实现 PMT/FV/PV/NPV/IRR/NPER/RATE 7 个财务函数
- **注册**：在 `src/formula/function-registry.ts` 中导入并注册
- **接口**：每个函数遵循 FunctionDefinition 接口，含 name/params/evaluate

### P2: 数据处理

#### 多级排序 UI
- **文件**：新增 `src/sort-filter/sort-dialog.ts`
- **方案**：创建模态对话框，支持添加多个排序条件
- **集成**：在 app.ts 工具栏添加排序按钮，调用 SortFilterModel

#### 高级筛选
- **文件**：扩展 `src/sort-filter/filter-dropdown.ts`
- **方案**：在筛选下拉面板中添加"高级筛选"选项卡，支持 AND/OR 条件组合和正则匹配
- **集成**：扩展 ColumnFilter 类型支持高级条件

#### 数据分列
- **文件**：新增 `src/text-to-columns.ts`
- **方案**：创建对话框让用户选择分隔符，将单元格内容拆分到右侧列
- **集成**：在 app.ts 添加菜单入口

#### 去重功能
- **文件**：新增 `src/deduplication.ts`
- **方案**：分析选区内行数据，标记/删除重复行
- **集成**：在 app.ts 添加菜单入口

### P3: 导入导出

#### XLSX 导出样式保真度
- **文件**：修改 `src/print-export/xlsx-exporter.ts`
- **方案**：增强边框样式映射、合并单元格导出逻辑

#### PDF 导出分页优化
- **文件**：修改 `src/print-export/pdf-exporter.ts`
- **方案**：分页时检测合并单元格边界，避免截断

#### CSV 编码检测优化
- **文件**：修改 `src/print-export/encoding-detector.ts`
- **方案**：增加更多编码特征检测规则，提升 GBK/Shift-JIS 识别率

### P4: 协同编辑

#### 协同冲突解决提示
- **文件**：新增 `src/collaboration/conflict-resolver.ts`
- **方案**：检测操作冲突，弹出提示让用户选择接受/拒绝

#### 编辑历史/版本回溯
- **文件**：新增 `src/version-history.ts`
- **方案**：定期保存数据快照，支持查看和恢复

#### 操作权限控制
- **文件**：新增 `src/permission-manager.ts`
- **方案**：支持只读/可编辑模式，锁定特定单元格区域

### P5: 用户体验

#### 颜色选择器增强
- **文件**：新增 `src/color-picker.ts`
- **方案**：创建增强型颜色选择器，支持 HEX/RGB 输入和最近使用颜色

#### 单元格快速样式预设
- **文件**：新增 `src/style-presets.ts`
- **方案**：预定义样式组合（标题/强调/数据等），一键应用

#### 列宽拖拽提示
- **文件**：修改 `src/app.ts`
- **方案**：拖拽调整列宽时显示 tooltip 显示当前宽度数值

## 文件变更清单

### 新增文件
- `src/formula/functions/financial.ts` - 财务函数
- `src/sort-filter/sort-dialog.ts` - 多级排序对话框
- `src/text-to-columns.ts` - 数据分列
- `src/deduplication.ts` - 去重功能
- `src/collaboration/conflict-resolver.ts` - 冲突解决
- `src/version-history.ts` - 版本回溯
- `src/permission-manager.ts` - 权限控制
- `src/color-picker.ts` - 增强颜色选择器
- `src/style-presets.ts` - 样式预设

### 修改文件
- `src/formula/function-registry.ts` - 注册财务函数
- `src/sort-filter/filter-dropdown.ts` - 高级筛选
- `src/sort-filter/types.ts` - 扩展筛选类型
- `src/print-export/xlsx-exporter.ts` - XLSX 样式增强
- `src/print-export/pdf-exporter.ts` - PDF 分页优化
- `src/print-export/encoding-detector.ts` - 编码检测优化
- `src/app.ts` - 集成新功能入口、列宽拖拽提示
- `src/style.css` - 新组件样式
