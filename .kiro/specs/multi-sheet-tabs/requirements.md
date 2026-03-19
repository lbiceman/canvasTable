# 需求文档：多工作表（Sheet）

## 简介

为 ice-excel 电子表格应用添加多工作表（Multi-Sheet）支持。当前应用仅支持单个工作表，本功能将引入底部 Sheet 标签栏，允许用户在同一工作簿中创建、管理和切换多个工作表，并支持跨 Sheet 数据引用与公式计算。

## 术语表

- **Sheet_Manager**：工作表管理器，负责维护所有工作表的元数据（名称、顺序、可见性、颜色标记）以及当前活动工作表的切换逻辑
- **Sheet_Tab_Bar**：底部工作表标签栏 UI 组件，使用 DOM 元素渲染在 Canvas 画布下方，展示所有可见工作表标签并提供交互操作
- **Sheet_Data**：单个工作表的完整数据，包含单元格数据（cells）、行高（rowHeights）、列宽（colWidths）、合并信息、条件格式规则、图表配置等
- **Active_Sheet**：当前正在编辑和显示的工作表
- **Sheet_Context_Menu**：工作表标签的右键上下文菜单，提供重命名、删除、复制、隐藏/显示、颜色标记等操作
- **Cross_Sheet_Reference**：跨工作表引用，使用 `Sheet名称!单元格地址` 格式（如 `Sheet2!A1`）在公式中引用其他工作表的数据
- **Workbook_Data**：工作簿数据，包含所有工作表的 Sheet_Data 集合及工作表元数据

## 需求

### 需求 1：工作表数据模型

**用户故事：** 作为开发者，我希望应用支持多工作表数据结构，以便每个工作表拥有独立的单元格数据、行列配置和格式设置。

#### 验收标准

1. THE Sheet_Manager SHALL 维护一个有序的工作表列表，每个工作表包含唯一标识符（id）、名称（name）、可见性（visible）、颜色标记（tabColor）和对应的 Sheet_Data
2. WHEN 应用初始化时，THE Sheet_Manager SHALL 创建一个名为「Sheet1」的默认工作表并将其设为 Active_Sheet
3. THE Sheet_Manager SHALL 为每个工作表维护独立的 HistoryManager 实例，使撤销/重做操作仅影响当前 Active_Sheet
4. WHEN 用户切换 Active_Sheet 时，THE Sheet_Manager SHALL 保存当前工作表的视口位置（scrollX、scrollY）和选区状态，并在切回时恢复
5. THE Workbook_Data SHALL 支持序列化为 JSON 格式和从 JSON 格式反序列化，以兼容现有的 LocalStorage 持久化和文件导入/导出功能
6. WHEN 从旧版单工作表 JSON 数据导入时，THE Sheet_Manager SHALL 将数据自动迁移为包含单个工作表的 Workbook_Data 格式

### 需求 2：Sheet 标签栏 UI

**用户故事：** 作为用户，我希望在表格底部看到工作表标签栏，以便快速切换、新增工作表。

#### 验收标准

1. THE Sheet_Tab_Bar SHALL 渲染在 Canvas 画布下方、状态栏上方，显示所有可见工作表的标签
2. THE Sheet_Tab_Bar SHALL 在标签列表左侧显示一个「+」按钮，用于新增工作表
3. WHEN 用户点击某个工作表标签时，THE Sheet_Tab_Bar SHALL 将该工作表设为 Active_Sheet，并通知 SpreadsheetRenderer 和 SpreadsheetModel 切换到对应的 Sheet_Data
4. THE Sheet_Tab_Bar SHALL 以视觉高亮方式（如加粗边框或不同背景色）标识当前 Active_Sheet 的标签
5. WHEN 工作表标签数量超出标签栏可见宽度时，THE Sheet_Tab_Bar SHALL 显示左右滚动箭头，允许用户滚动查看被隐藏的标签
6. THE Sheet_Tab_Bar SHALL 适配当前应用主题（亮色/暗色），从 themeColors 读取颜色值

### 需求 3：工作表新增

**用户故事：** 作为用户，我希望能新增工作表，以便在不同工作表中组织不同类别的数据。

#### 验收标准

1. WHEN 用户点击「+」按钮时，THE Sheet_Manager SHALL 在当前 Active_Sheet 之后创建一个新工作表
2. THE Sheet_Manager SHALL 为新工作表自动生成不重复的默认名称，格式为「SheetN」（N 为递增数字，跳过已存在的名称）
3. WHEN 新工作表创建完成后，THE Sheet_Tab_Bar SHALL 自动切换到新创建的工作表
4. THE Sheet_Manager SHALL 将新增工作表操作记录到历史栈，支持撤销新增操作

### 需求 4：工作表删除

**用户故事：** 作为用户，我希望能删除不需要的工作表，以保持工作簿整洁。

#### 验收标准

1. WHEN 用户通过 Sheet_Context_Menu 选择「删除」时，THE Sheet_Manager SHALL 通过 Modal confirm 弹出确认对话框，显示待删除工作表的名称
2. WHEN 用户确认删除且工作簿中存在多于一个工作表时，THE Sheet_Manager SHALL 删除指定工作表及其所有 Sheet_Data
3. IF 工作簿中仅剩一个工作表，THEN THE Sheet_Manager SHALL 禁用删除操作并在 Sheet_Context_Menu 中将「删除」选项置灰
4. WHEN 删除的工作表为当前 Active_Sheet 时，THE Sheet_Manager SHALL 自动切换到相邻的工作表（优先切换到左侧，左侧无则切换到右侧）
5. THE Sheet_Manager SHALL 将删除操作记录到历史栈，支持撤销删除操作（恢复完整的 Sheet_Data）

### 需求 5：工作表重命名

**用户故事：** 作为用户，我希望能重命名工作表，以便用有意义的名称标识每个工作表的内容。

#### 验收标准

1. WHEN 用户双击工作表标签时，THE Sheet_Tab_Bar SHALL 弹出 Modal prompt 对话框，预填当前工作表名称
2. WHEN 用户通过 Sheet_Context_Menu 选择「重命名」时，THE Sheet_Tab_Bar SHALL 弹出 Modal prompt 对话框，预填当前工作表名称
3. WHEN 用户在 Modal 中输入新名称并点击确认时，THE Sheet_Manager SHALL 验证并应用新名称
4. IF 新名称为空字符串或仅包含空白字符，THEN THE Sheet_Manager SHALL 拒绝重命名并通过 Modal alert 显示提示信息
5. IF 新名称与工作簿中其他工作表名称重复，THEN THE Sheet_Manager SHALL 拒绝重命名并通过 Modal alert 显示提示信息「工作表名称已存在」
6. WHEN 用户在 Modal 中点击取消或按 Escape 键时，THE Sheet_Manager SHALL 取消重命名操作，保持原名称不变

### 需求 6：工作表排序（拖拽）

**用户故事：** 作为用户，我希望通过拖拽调整工作表标签的顺序，以便按照自己的偏好组织工作表。

#### 验收标准

1. WHEN 用户在工作表标签上按下鼠标并拖动时，THE Sheet_Tab_Bar SHALL 启动拖拽操作，显示拖拽中的标签视觉反馈（如半透明跟随鼠标）
2. WHILE 拖拽进行中，THE Sheet_Tab_Bar SHALL 在目标位置显示插入指示线，指示标签将被放置的位置
3. WHEN 用户释放鼠标时，THE Sheet_Manager SHALL 将工作表移动到目标位置，更新工作表列表的顺序
4. IF 用户将标签拖拽到原位置，THEN THE Sheet_Manager SHALL 不执行任何操作
5. THE Sheet_Manager SHALL 将排序操作记录到历史栈，支持撤销排序操作

### 需求 7：工作表复制

**用户故事：** 作为用户，我希望能复制整个工作表，以便基于现有数据创建变体而不影响原始数据。

#### 验收标准

1. WHEN 用户通过 Sheet_Context_Menu 选择「复制」时，THE Sheet_Manager SHALL 创建源工作表的完整深拷贝，包括所有单元格数据、格式、合并信息、条件格式规则和图表配置
2. THE Sheet_Manager SHALL 为复制的工作表生成名称，格式为「原名称 (副本)」，若该名称已存在则追加数字后缀「原名称 (副本 2)」
3. THE Sheet_Manager SHALL 将复制的工作表插入到源工作表的右侧
4. WHEN 复制完成后，THE Sheet_Tab_Bar SHALL 自动切换到复制的工作表

### 需求 8：工作表隐藏与显示

**用户故事：** 作为用户，我希望能隐藏暂时不需要的工作表，以减少标签栏的视觉干扰。

#### 验收标准

1. WHEN 用户通过 Sheet_Context_Menu 选择「隐藏」时，THE Sheet_Manager SHALL 将指定工作表的 visible 属性设为 false
2. WHEN 工作表被隐藏后，THE Sheet_Tab_Bar SHALL 从标签栏中移除该工作表的标签
3. IF 隐藏的工作表为当前 Active_Sheet，THEN THE Sheet_Manager SHALL 自动切换到相邻的可见工作表
4. IF 工作簿中仅剩一个可见工作表，THEN THE Sheet_Manager SHALL 禁用隐藏操作并在 Sheet_Context_Menu 中将「隐藏」选项置灰
5. WHEN 用户通过 Sheet_Context_Menu 选择「显示隐藏的工作表」时，THE Sheet_Tab_Bar SHALL 弹出隐藏工作表列表，允许用户选择要显示的工作表
6. WHEN 用户选择要显示的工作表后，THE Sheet_Manager SHALL 将该工作表的 visible 属性设为 true，并在 Sheet_Tab_Bar 中恢复其标签

### 需求 9：工作表颜色标记

**用户故事：** 作为用户，我希望能为工作表标签设置颜色，以便通过颜色快速区分不同用途的工作表。

#### 验收标准

1. WHEN 用户通过 Sheet_Context_Menu 选择「标签颜色」时，THE Sheet_Tab_Bar SHALL 显示颜色选择面板，提供预定义颜色选项和「无颜色」选项
2. WHEN 用户选择一种颜色后，THE Sheet_Manager SHALL 将该颜色存储到工作表的 tabColor 属性
3. THE Sheet_Tab_Bar SHALL 在标签底部绘制一条与 tabColor 对应的彩色指示条，宽度与标签等宽、高度为 3 像素
4. WHEN 用户选择「无颜色」时，THE Sheet_Manager SHALL 清除工作表的 tabColor 属性，THE Sheet_Tab_Bar SHALL 移除彩色指示条

### 需求 10：跨 Sheet 数据引用与公式计算

**用户故事：** 作为用户，我希望在公式中引用其他工作表的数据，以便跨工作表进行汇总计算。

#### 验收标准

1. THE FormulaEngine SHALL 支持解析 Cross_Sheet_Reference 格式 `SheetName!CellRef`（如 `Sheet2!A1`）和 `SheetName!RangeRef`（如 `Sheet2!A1:B5`）
2. WHEN 工作表名称包含空格或特殊字符时，THE FormulaEngine SHALL 支持使用单引号包裹名称的格式 `'Sheet Name'!A1`
3. WHEN 公式包含 Cross_Sheet_Reference 时，THE FormulaEngine SHALL 从 Sheet_Manager 获取目标工作表的 Sheet_Data 并读取对应单元格的值
4. IF Cross_Sheet_Reference 引用的工作表名称不存在，THEN THE FormulaEngine SHALL 返回 `#REF!` 错误
5. IF Cross_Sheet_Reference 引用的单元格地址超出目标工作表范围，THEN THE FormulaEngine SHALL 返回 `#REF!` 错误
6. WHEN 被引用工作表中的源数据发生变化时，THE FormulaEngine SHALL 重新计算所有引用该数据的公式单元格
7. WHEN 被引用的工作表被删除时，THE FormulaEngine SHALL 将所有引用该工作表的公式结果更新为 `#REF!` 错误
8. WHEN 被引用的工作表被重命名时，THE FormulaEngine SHALL 自动更新所有引用该工作表的公式中的工作表名称

### 需求 11：右键上下文菜单

**用户故事：** 作为用户，我希望通过右键菜单快速访问工作表操作，以提高操作效率。

#### 验收标准

1. WHEN 用户右键点击工作表标签时，THE Sheet_Tab_Bar SHALL 显示 Sheet_Context_Menu，包含以下选项：重命名、删除、复制、隐藏、标签颜色、显示隐藏的工作表
2. WHEN 用户点击菜单外部区域时，THE Sheet_Context_Menu SHALL 关闭
3. THE Sheet_Context_Menu SHALL 根据当前状态动态禁用不可用的选项（如仅剩一个工作表时禁用「删除」和「隐藏」）
4. THE Sheet_Context_Menu SHALL 适配当前应用主题（亮色/暗色）

### 需求 12：通用 Modal 弹窗组件

**用户故事：** 作为开发者，我希望有一个统一的 Modal 弹窗组件，以替代浏览器原生的 `alert()`、`confirm()`、`prompt()` 调用，提供与项目 UI 风格一致的用户交互体验。

#### 验收标准

1. THE Modal 组件 SHALL 封装在独立的 `src/modal.ts` 文件中，提供 `alert`、`confirm`、`prompt` 三种静态方法
2. THE Modal 组件 SHALL 支持通过参数配置标题（title）、内容（message）、确认按钮文本（confirmText）、取消按钮文本（cancelText）
3. THE Modal 组件 SHALL 返回 Promise，`alert` 返回 `Promise<void>`，`confirm` 返回 `Promise<boolean>`，`prompt` 返回 `Promise<string | null>`
4. THE Modal 组件 SHALL 显示半透明遮罩层，点击遮罩层或按 Escape 键关闭弹窗（等同于取消操作）
5. THE Modal 组件 SHALL 适配当前应用主题（亮色/暗色），从 CSS 变量读取颜色值，样式与现有项目 UI 保持一致
6. THE Modal 组件 SHALL 支持扩展，允许传入自定义 DOM 内容（customContent）替代默认的文本消息，以支持复杂表单场景
7. WHEN Modal 弹窗显示时，THE Modal 组件 SHALL 自动聚焦到确认按钮或输入框，支持 Enter 键确认、Escape 键取消
8. THE 项目中所有现有的 `alert()`、`confirm()`、`prompt()` 调用 SHALL 替换为 Modal 组件的对应方法
