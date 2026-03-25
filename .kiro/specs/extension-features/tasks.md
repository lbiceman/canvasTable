# 实现计划：扩展功能（Extension Features）

## 概述

按模块逐步实现九大扩展功能，每个模块包含核心实现、UI 集成和对应的属性测试。任务按依赖关系排序：先扩展基础类型和 HistoryManager，再实现各独立模块，最后集成到 SpreadsheetApp。

## 任务

- [ ] 1. 扩展基础类型与 HistoryManager
  - [x] 1.1 扩展 `src/types.ts`，新增 `HyperlinkData`、`FloatingImage` 接口，Cell 接口新增 `hyperlink?` 字段，SpreadsheetData 新增 `images?` 字段
    - 定义 HyperlinkData: `{ url: string; displayText?: string }`
    - 定义 FloatingImage: `{ id, base64Data, x, y, width, height, originalWidth, originalHeight }`
    - Cell 接口新增 `hyperlink?: HyperlinkData`
    - SpreadsheetData 新增 `images?: FloatingImage[]`
    - _需求: 4.2, 5.2, 5.8_

  - [x] 1.2 扩展 `src/history-manager.ts` 的 ActionType 联合类型，新增 setHyperlink、removeHyperlink、insertImage、deleteImage、moveImage、resizeImage、formatPainter、reorderRows、reorderCols、clearFormat、scriptExecution
    - _需求: 2.5, 4.2, 5.6, 8.4, 9.3, 9.6_

- [ ] 2. 实现超链接管理器
  - [x] 2.1 创建 `src/hyperlink-manager.ts`，实现 HyperlinkManager 类
    - 实现 setHyperlink / getHyperlink / removeHyperlink 方法操作 Cell.hyperlink 字段
    - 实现 normalizeUrl 方法（自动添加 https:// 前缀）
    - 实现 openHyperlink 方法（window.open 新标签页）
    - 实现 showDialog 方法（插入/编辑超链接对话框 UI）
    - 集成 HistoryManager 记录 setHyperlink / removeHyperlink 操作
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 2.2 编写超链接属性测试 `src/__tests__/hyperlink.property.test.ts`
    - **Property 13: 超链接设置/获取往返**
    - **验证: 需求 4.2**

  - [ ]* 2.3 编写超链接属性测试
    - **Property 14: 移除超链接保留单元格内容**
    - **验证: 需求 4.6**

  - [ ]* 2.4 编写超链接属性测试
    - **Property 15: URL 规范化**
    - **验证: 需求 4.7**

- [ ] 3. 实现图片管理器
  - [x] 3.1 创建 `src/image-manager.ts`，实现 ImageManager 类
    - 实现 insertImage（文件选择对话框，accept 限制 PNG/JPG/GIF/WebP，5MB 大小校验）
    - 实现 addImage / deleteImage 方法
    - 实现 hitTest 方法（命中测试：图片区域 + 四角控制点）
    - 实现 handleMouseDown / handleMouseMove / handleMouseUp（拖拽移动 + 等比缩放）
    - 实现 renderAll 方法（Canvas 渲染所有浮动图片 + 选中状态控制点）
    - 实现 exportImages / importImages 方法
    - 图片插入时限制最大显示尺寸 800×600，保持宽高比
    - 集成 HistoryManager 记录 insertImage / deleteImage / moveImage / resizeImage
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [ ]* 3.2 编写图片管理器属性测试 `src/__tests__/image-manager.property.test.ts`
    - **Property 16: 图片尺寸限制**
    - **验证: 需求 5.3**

  - [ ]* 3.3 编写图片管理器属性测试
    - **Property 17: 图片缩放保持宽高比**
    - **验证: 需求 5.5**

  - [ ]* 3.4 编写图片管理器属性测试
    - **Property 18: 图片导出/导入往返**
    - **验证: 需求 5.8, 5.9**

- [x] 4. 检查点 - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [ ] 5. 实现格式刷
  - [x] 5.1 创建 `src/format-painter.ts`，实现 FormatPainter 类
    - 定义 FormatPainterMode 类型（'off' | 'single' | 'locked'）和 CopiedFormat 接口
    - 实现 activate（单次模式）/ activateLocked（锁定模式）方法
    - 实现 extractFormat 方法（从单元格提取所有格式属性）
    - 实现 applyToRange 方法（将格式应用到目标区域，仅修改格式不改内容/公式）
    - 实现 deactivate 方法和 getMode 方法
    - 单次模式应用后自动退出，锁定模式保持
    - 集成 HistoryManager 记录 formatPainter 操作
    - _需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [ ]* 5.2 编写格式刷属性测试 `src/__tests__/format-painter.property.test.ts`
    - **Property 22: 格式操作保留单元格内容**
    - **验证: 需求 7.12, 8.9**

  - [ ]* 5.3 编写格式刷属性测试
    - **Property 24: 格式刷完整复制并应用所有格式属性**
    - **验证: 需求 8.1, 8.4**

  - [ ]* 5.4 编写格式刷属性测试
    - **Property 25: 格式刷模式状态转换**
    - **验证: 需求 8.5, 8.7**

- [ ] 6. 实现下拉选择器
  - [x] 6.1 创建 `src/dropdown-selector.ts`，实现 DropdownSelector 类
    - 实现 show 方法（在单元格下方创建 DOM 下拉列表，超过 8 项显示滚动条）
    - 实现 hide 方法和 isVisible 方法
    - 实现 handleKeyDown 方法（上/下方向键导航、Enter 确认、Escape 取消）
    - 实现 onSelect 回调机制
    - 点击列表外部区域自动关闭
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 6.2 编写下拉选择器属性测试 `src/__tests__/dropdown.property.test.ts`
    - **Property 19: 下拉选择设置单元格值**
    - **验证: 需求 6.3**

  - [ ]* 6.3 编写下拉选择器属性测试
    - **Property 20: 下拉列表键盘导航**
    - **验证: 需求 6.4, 6.5**

- [ ] 7. 实现行列拖拽重排序
  - [x] 7.1 创建 `src/row-col-reorder.ts`，实现 RowColReorder 类
    - 定义 ReorderDragState 接口
    - 实现 startRowDrag / startColDrag 方法
    - 实现 updateDrag 方法（更新鼠标位置和目标索引）
    - 实现 endDrag 方法（执行数据迁移）和 cancelDrag 方法
    - 实现 moveRows 方法（整行数据 + 行高一起移动，支持多行）
    - 实现 moveCols 方法（整列数据 + 列宽一起移动，支持多列）
    - 实现 getDragState 方法（供渲染器绘制指示线）
    - 拖拽到原始位置不执行操作，目标位置限制在有效范围内
    - 集成 HistoryManager 记录 reorderRows / reorderCols 操作
    - _需求: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [ ]* 7.2 编写行列重排序属性测试 `src/__tests__/row-col-reorder.property.test.ts`
    - **Property 26: 行重排序数据置换正确性**
    - **验证: 需求 9.3, 9.8**

  - [ ]* 7.3 编写行列重排序属性测试
    - **Property 27: 列重排序数据置换正确性**
    - **验证: 需求 9.6, 9.9**

- [x] 8. 检查点 - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [ ] 9. 实现单元格右键菜单
  - [x] 9.1 创建 `src/cell-context-menu.ts`，实现 CellContextMenu 类
    - 定义 CellMenuItem 接口
    - 实现 show 方法（构建完整菜单项列表：剪切/复制/粘贴/选择性粘贴/分隔线/插入超链接/分隔线/插入行上下/插入列左右/删除行列/分隔线/格式刷/清除格式/分隔线/排序/筛选）
    - 剪贴板为空时禁用粘贴和选择性粘贴菜单项
    - 实现视口边界约束（菜单不超出浏览器视口）
    - 实现 hide 方法（点击外部或 Escape 关闭）
    - 实现 registerExtraItem / removeExtraItem 方法（供插件系统扩展）
    - 清除格式功能：清除选中区域格式属性，保留内容和公式
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14_

  - [ ]* 9.2 编写右键菜单属性测试 `src/__tests__/context-menu.property.test.ts`
    - **Property 21: 剪贴板为空时粘贴菜单项禁用**
    - **验证: 需求 7.6**

  - [ ]* 9.3 编写右键菜单属性测试
    - **Property 23: 右键菜单视口边界约束**
    - **验证: 需求 7.13**

- [ ] 10. 实现数据透视表模块
  - [x] 10.1 创建 `src/pivot-table/pivot-table.ts`，实现 PivotTable 引擎
    - 导出 AggregateFunction、PivotFieldConfig、PivotValueConfig、PivotFilterConfig、PivotConfig、PivotResult、PivotResultRow 类型
    - 实现 validateSourceRange 方法（校验非空且包含表头）
    - 实现 extractFields 方法（从源数据区域提取字段列表）
    - 实现 aggregate 方法（sum/count/average/max/min 五种聚合运算）
    - 实现 compute 方法（按行字段分组、列字段展开、值字段聚合、筛选字段过滤、生成小计行和总计行）
    - 非数值数据在 sum/average/max/min 时忽略，count 正常计数
    - _需求: 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 1.10_

  - [ ]* 10.2 编写透视表属性测试 `src/__tests__/pivot-table.property.test.ts`
    - **Property 1: 透视表分组产生唯一值标签**
    - **验证: 需求 1.2, 1.3**

  - [ ]* 10.3 编写透视表属性测试
    - **Property 2: 透视表聚合运算正确性**
    - **验证: 需求 1.4**

  - [ ]* 10.4 编写透视表属性测试
    - **Property 3: 透视表筛选排除未选中值**
    - **验证: 需求 1.6**

  - [ ]* 10.5 编写透视表属性测试
    - **Property 4: 透视表小计与总计结构完整性**
    - **验证: 需求 1.9**

  - [x] 10.6 创建 `src/pivot-table/pivot-table-panel.ts`，实现 PivotTablePanel UI
    - 实现 show 方法（显示配置面板，列出可用字段，支持拖拽到行/列/值/筛选区域）
    - 实现值字段聚合方式选择菜单
    - 实现筛选字段值勾选列表
    - 实现 writeResultToSheet 方法（将结果写入新工作表）
    - 实现 hide 方法
    - 配置变化后 500ms 内重新计算
    - _需求: 1.1, 1.5, 1.6, 1.7, 1.8_

- [ ] 11. 实现宏/脚本模块
  - [x] 11.1 创建 `src/script/script-engine.ts`，实现 ScriptEngine 类
    - 导出 ScriptResult、SavedScript、ScriptAPI 类型
    - 实现 execute 方法（new Function + Proxy 沙箱，注入 ScriptAPI，10 秒超时）
    - ScriptAPI 实现：getCellValue / setCellValue / getSelection / setSelection / getRowCount / getColCount
    - 记录所有 cellChanges，执行完成后通过 HistoryManager 记录为单条可撤销操作
    - 超时或错误时回滚已执行的修改
    - 实现 saveScript / loadScripts / deleteScript（localStorage 持久化）
    - _需求: 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

  - [ ]* 11.2 编写脚本引擎属性测试 `src/__tests__/script-engine.property.test.ts`
    - **Property 5: 脚本 API 单元格读写往返**
    - **验证: 需求 2.2, 2.3**

  - [ ]* 11.3 编写脚本引擎属性测试
    - **Property 6: 脚本运行时错误包含错误信息**
    - **验证: 需求 2.4**

  - [ ]* 11.4 编写脚本引擎属性测试
    - **Property 7: 脚本执行历史原子性**
    - **验证: 需求 2.5**

  - [ ]* 11.5 编写脚本引擎属性测试
    - **Property 8: 脚本保存/加载往返**
    - **验证: 需求 2.8**

  - [x] 11.6 创建 `src/script/script-editor.ts`，实现 ScriptEditor UI
    - 实现 show / hide 方法（打开/关闭脚本编辑器面板）
    - 实现代码编辑区域（textarea + 行号显示）
    - 实现运行按钮、保存按钮、已保存脚本列表
    - 实现 applySyntaxHighlight 方法（关键字/字符串/注释/数字语法高亮）
    - 实现输出面板（显示执行结果或错误信息）
    - _需求: 2.1, 2.4, 2.7, 2.8_

- [x] 12. 检查点 - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [ ] 13. 实现插件系统
  - [x] 13.1 创建 `src/plugin/plugin-api.ts`，实现 PluginAPI 类
    - 实现 getCellValue / setCellValue（受控的单元格读写）
    - 实现 registerFunction（注册自定义公式函数）
    - 实现 addToolbarButton / addContextMenuItem（添加 UI 扩展点）
    - 实现 onCellChange（监听单元格变更事件）
    - 实现 cleanup 方法（清理该插件注册的所有资源）
    - 使用 Proxy 包装限制插件只能通过白名单方法操作
    - _需求: 3.2_

  - [x] 13.2 创建 `src/plugin/plugin-manager.ts`，实现 PluginManager 类
    - 导出 Plugin、PluginInfo、PluginStatus 类型
    - 实现 registerPlugin 方法（验证 name/version/activate 字段，调用 activate 并传入 PluginAPI）
    - 实现 unloadPlugin 方法（调用 deactivate，通过 PluginAPI.cleanup 移除所有注册资源）
    - 实现 getPlugins 方法（返回插件列表含 name/version/status）
    - activate 异常时捕获并标记为 'failed' 状态
    - _需求: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 13.3 编写插件系统属性测试 `src/__tests__/plugin-manager.property.test.ts`
    - **Property 9: 插件注册验证拒绝无效插件**
    - **验证: 需求 3.3**

  - [ ]* 13.4 编写插件系统属性测试
    - **Property 10: 插件注册成功后可通过列表查询**
    - **验证: 需求 3.4, 3.7**

  - [ ]* 13.5 编写插件系统属性测试
    - **Property 11: 插件卸载清理所有注册资源**
    - **验证: 需求 3.5**

  - [ ]* 13.6 编写插件系统属性测试
    - **Property 12: 插件激活异常标记为失败状态**
    - **验证: 需求 3.6**

- [ ] 14. 集成到 SpreadsheetApp 与渲染器
  - [x] 14.1 扩展 `src/app.ts`（SpreadsheetApp），集成所有新模块
    - 初始化所有新模块实例（HyperlinkManager、ImageManager、FormatPainter、DropdownSelector、RowColReorder、CellContextMenu、PivotTable、PivotTablePanel、ScriptEngine、ScriptEditor、PluginManager）
    - 绑定右键事件到 CellContextMenu
    - 绑定格式刷按钮（单击 activate，双击 activateLocked）
    - 绑定 Ctrl+点击超链接打开
    - 绑定行号/列号区域拖拽到 RowColReorder
    - 绑定下拉验证单元格点击到 DropdownSelector
    - 绑定图片层鼠标事件到 ImageManager
    - _需求: 4.4, 4.8, 5.4, 5.5, 6.2, 7.1, 7.14, 8.2, 8.3, 8.5, 8.6, 8.8, 9.1, 9.4, 9.10_

  - [x] 14.2 扩展 `src/renderer.ts`（SpreadsheetRenderer），新增渲染逻辑
    - 超链接单元格渲染：蓝色字体 + 下划线
    - 下拉验证单元格渲染：右侧下拉箭头图标
    - 行列拖拽指示线渲染（水平/垂直插入线）
    - 格式刷模式光标切换
    - Ctrl+悬停超链接单元格时光标变为 pointer
    - _需求: 4.3, 4.8, 6.1, 8.2, 9.2, 9.5_

  - [x] 14.3 扩展 `src/data-manager.ts`，支持图片数据的导入/导出
    - 导出 JSON 时包含 images 数组
    - 导入 JSON 时还原图片到 ImageManager
    - _需求: 5.8, 5.9_

- [ ] 15. 扩展工具栏 UI
  - [x] 15.1 修改 `index.html`，在工具栏中添加新按钮
    - 添加「格式刷」按钮
    - 添加「插入超链接」按钮
    - 添加「插入图片」按钮
    - 添加「数据透视表」按钮
    - 添加「脚本编辑器」按钮
    - _需求: 1.1, 2.1, 5.1, 8.1_

  - [x] 15.2 扩展 `src/style.css`，添加新模块的样式
    - 透视表配置面板样式
    - 脚本编辑器面板样式（含语法高亮颜色）
    - 超链接对话框样式
    - 下拉选择器样式（含滚动条）
    - 右键菜单样式（含禁用状态、分隔线）
    - 格式刷激活状态按钮高亮
    - 行列拖拽指示线样式
    - _需求: 6.8, 7.1, 8.3_

- [x] 16. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [x] 17. E2E 测试（Playwright）
  - [x] 17.1 创建 `e2e/hyperlink.spec.ts`，超链接 E2E 测试
    - 测试通过右键菜单插入超链接（输入 URL 和显示文本）
    - 测试超链接单元格渲染为蓝色下划线样式（截图对比）
    - 测试编辑超链接（右键 → 编辑超链接 → 修改 URL）
    - 测试移除超链接（右键 → 移除超链接 → 验证内容保留）
    - 测试 URL 自动补全 https:// 前缀
    - _需求: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7_

  - [x] 17.2 创建 `e2e/image-insert.spec.ts`，图片插入 E2E 测试
    - 测试点击「插入图片」按钮弹出文件选择对话框
    - 测试插入图片后 Canvas 上显示浮动图片（截图对比）
    - 测试拖拽移动图片位置
    - 测试拖拽边角控制点等比缩放图片
    - 测试选中图片后按 Delete 删除
    - 测试超过 5MB 图片显示错误提示
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 17.3 创建 `e2e/format-painter.spec.ts`，格式刷 E2E 测试
    - 测试单击格式刷按钮进入单次模式（按钮高亮）
    - 测试单次模式下点击目标单元格应用格式后自动退出
    - 测试双击格式刷按钮进入锁定模式（连续应用）
    - 测试锁定模式下按 Escape 退出
    - 测试格式刷仅复制格式不改变目标内容（截图对比）
    - _需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [x] 17.4 创建 `e2e/dropdown-selector.spec.ts`，下拉选择器 E2E 测试
    - 测试配置了 dropdown 验证的单元格显示下拉箭头图标
    - 测试点击下拉箭头弹出选项列表
    - 测试点击选项设置单元格值并关闭列表
    - 测试键盘上/下方向键导航选项
    - 测试 Enter 确认选择、Escape 取消
    - 测试超过 8 个选项时显示滚动条
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 17.5 创建 `e2e/row-col-reorder.spec.ts`，行列拖拽重排序 E2E 测试
    - 测试在行号区域拖拽行到新位置（数据跟随移动）
    - 测试拖拽过程中显示水平插入指示线
    - 测试在列号区域拖拽列到新位置（数据跟随移动）
    - 测试拖拽过程中显示垂直插入指示线
    - 测试多行选中后整体拖拽
    - 测试拖拽到原始位置不执行操作
    - _需求: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [x] 17.6 创建 `e2e/cell-context-menu.spec.ts`，右键菜单增强 E2E 测试
    - 测试右键点击单元格弹出完整菜单（包含所有菜单项）
    - 测试剪切/复制/粘贴菜单项功能
    - 测试剪贴板为空时粘贴和选择性粘贴显示为禁用状态
    - 测试插入行（上方/下方）、插入列（左侧/右侧）
    - 测试删除行、删除列
    - 测试格式刷菜单项激活格式刷模式
    - 测试清除格式（保留内容，清除样式）
    - 测试菜单不超出视口边界
    - 测试点击外部或 Escape 关闭菜单
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14_

  - [x] 17.7 创建 `e2e/pivot-table.spec.ts`，数据透视表 E2E 测试
    - 测试选中数据区域后点击「数据透视表」按钮打开配置面板
    - 测试面板列出源数据所有列标题作为可用字段
    - 测试拖拽字段到行/列/值/筛选区域
    - 测试切换聚合方式（求和/计数/平均值/最大值/最小值）
    - 测试筛选字段值勾选过滤
    - 测试空数据区域显示错误提示
    - 测试透视表结果写入新工作表
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 1.10_

  - [x] 17.8 创建 `e2e/script-editor.spec.ts`，脚本编辑器 E2E 测试
    - 测试点击「脚本编辑器」按钮打开编辑器面板
    - 测试编写脚本并点击运行（验证单元格被修改）
    - 测试脚本语法错误时输出面板显示错误信息
    - 测试脚本执行后可通过 Ctrl+Z 撤销所有修改
    - 测试保存脚本到列表、加载已保存脚本
    - 测试语法高亮（关键字/字符串/注释/数字不同颜色）
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8_

  - [x] 17.9 创建 `e2e/plugin-system.spec.ts`，插件系统 E2E 测试
    - 测试通过 window.app 注册一个有效插件（验证 getPlugins 返回 active 状态）
    - 测试插件添加工具栏按钮（按钮可见且可点击）
    - 测试插件添加右键菜单项（菜单项可见且可点击）
    - 测试卸载插件后工具栏按钮和菜单项被移除
    - 测试注册缺少必要字段的插件抛出错误
    - 测试插件 activate 异常时标记为 failed 状态
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 18. 浏览器 MCP 交互测试（Chrome DevTools）
  - [x] 18.1 超链接浏览器 MCP 测试
    - 使用 Chrome DevTools MCP 工具打开应用页面
    - 右键单元格 → 点击「插入超链接」→ 填写 URL 和显示文本 → 确认
    - 截图验证超链接单元格蓝色下划线渲染
    - Ctrl+点击超链接验证新标签页打开
    - 右键 → 编辑超链接 → 修改 → 确认 → 截图验证
    - 右键 → 移除超链接 → 验证内容保留
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 18.2 图片插入浏览器 MCP 测试
    - 使用 Chrome DevTools MCP 工具打开应用页面
    - 点击「插入图片」按钮 → 上传测试图片文件
    - 截图验证图片在 Canvas 上正确渲染
    - 拖拽图片到新位置 → 截图验证位置变化
    - 拖拽边角控制点缩放 → 截图验证等比缩放
    - 选中图片 → 按 Delete → 验证图片删除
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 18.3 格式刷浏览器 MCP 测试
    - 使用 Chrome DevTools MCP 工具打开应用页面
    - 设置源单元格格式（加粗、红色字体、黄色背景）
    - 单击格式刷按钮 → 截图验证按钮高亮状态
    - 点击目标单元格 → 截图验证格式已应用
    - 双击格式刷按钮进入锁定模式 → 连续点击多个单元格 → 截图验证
    - 按 Escape 退出 → 验证格式刷模式关闭
    - _需求: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 18.4 下拉选择器浏览器 MCP 测试
    - 使用 Chrome DevTools MCP 工具打开应用页面
    - 配置单元格 dropdown 验证规则（通过 evaluate_script）
    - 点击下拉箭头 → 截图验证下拉列表显示
    - 点击选项 → 验证单元格值更新
    - 键盘上/下导航 → Enter 确认 → 验证选择
    - Escape 取消 → 验证单元格值未变
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 18.5 行列拖拽重排序浏览器 MCP 测试
    - 使用 Chrome DevTools MCP 工具打开应用页面
    - 输入测试数据到多行多列
    - 在行号区域拖拽行到新位置 → 截图验证数据移动
    - 在列号区域拖拽列到新位置 → 截图验证数据移动
    - 验证拖拽过程中指示线显示（截图）
    - _需求: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 18.6 右键菜单增强浏览器 MCP 测试
    - 使用 Chrome DevTools MCP 工具打开应用页面
    - 右键点击单元格 → 截图验证完整菜单显示
    - 逐一点击菜单项验证功能（剪切/复制/粘贴/插入行列/删除行列）
    - 验证剪贴板为空时粘贴菜单项灰色禁用状态（截图）
    - 测试清除格式功能 → 截图验证
    - 验证菜单在视口边角位置的自动调整
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 7.8, 7.9, 7.10, 7.12, 7.13_

  - [x] 18.7 数据透视表浏览器 MCP 测试
    - 使用 Chrome DevTools MCP 工具打开应用页面
    - 输入包含表头的测试数据
    - 选中数据区域 → 点击「数据透视表」按钮 → 截图验证配置面板
    - 拖拽字段到行/列/值区域 → 截图验证透视表结果
    - 切换聚合方式 → 验证结果更新
    - 测试空数据区域错误提示（截图）
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.10_

  - [x] 18.8 脚本编辑器浏览器 MCP 测试
    - 使用 Chrome DevTools MCP 工具打开应用页面
    - 点击「脚本编辑器」按钮 → 截图验证编辑器面板
    - 输入脚本代码（如批量设置单元格值）→ 点击运行
    - 截图验证单元格被脚本修改
    - 输入错误脚本 → 运行 → 截图验证错误信息显示
    - 保存脚本 → 刷新 → 加载已保存脚本 → 验证
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8_

  - [x] 18.9 插件系统浏览器 MCP 测试
    - 使用 Chrome DevTools MCP 工具打开应用页面
    - 通过 evaluate_script 注册测试插件（添加工具栏按钮和菜单项）
    - 截图验证工具栏新增按钮
    - 右键验证菜单新增项
    - 通过 evaluate_script 卸载插件 → 截图验证按钮和菜单项已移除
    - 注册无效插件 → 验证 getPlugins 返回 failed 状态
    - _需求: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7_

## 说明

- 标记 `*` 的任务为可选任务，可跳过以加速 MVP 开发
- 每个任务引用了具体的需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性（使用 fast-check）
- 单元测试验证具体示例和边界情况
