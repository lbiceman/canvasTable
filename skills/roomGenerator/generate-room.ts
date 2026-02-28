/**
 * 协作房间 JSON 数据生成器
 * 用法: npx vite-node skills/roomGenerator/generate-room.ts <roomName> [options]
 *
 * 选项:
 *   --rows <n>     数据行数（不含表头），默认 10
 *   --cols <n>     列数，默认 10
 *   --theme <name> 主题色 (blue/green/orange/purple)，默认 blue
 *   --empty        生成空白表格
 */

// 单元格接口
interface Cell {
  content: string;
  rowSpan: number;
  colSpan: number;
  isMerged: boolean;
  bgColor?: string;
  fontColor?: string;
}

// 房间数据接口
interface RoomData {
  roomId: string;
  document: {
    cells: Cell[][];
    rowHeights: number[];
    colWidths: number[];
  };
  operations: unknown[];
  revision: number;
}

// 主题色配置
const THEMES: Record<string, { header: string; headerFont: string; altRow: string }> = {
  blue: { header: '#3498DB', headerFont: '#FFFFFF', altRow: '#F0F8FF' },
  green: { header: '#4ECDC4', headerFont: '#FFFFFF', altRow: '#F0FFF0' },
  orange: { header: '#E67E22', headerFont: '#FFFFFF', altRow: '#FFF8F0' },
  purple: { header: '#9B59B6', headerFont: '#FFFFFF', altRow: '#F8F0FF' },
};

// 示例表头数据池
const HEADER_POOL = [
  '编号', '名称', '类型', '状态', '描述', '创建日期', '负责人',
  '优先级', '进度', '备注', '标签', '版本', '评分', '数量',
  '金额', '来源', '分类', '等级', '地区', '部门', '邮箱',
  '电话', '地址', '学历', '专业', '技能',
];

// 示例数据池（按列类型）
const DATA_POOL: Record<string, string[]> = {
  '编号': ['A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A007', 'A008', 'A009', 'A010'],
  '名称': ['项目Alpha', '项目Beta', '项目Gamma', '任务一', '任务二', '任务三', '模块X', '模块Y', '模块Z', '测试项'],
  '类型': ['开发', '测试', '设计', '运维', '产品', '研究', '支持', '管理', '培训', '其他'],
  '状态': ['进行中', '已完成', '待开始', '暂停', '已取消', '审核中', '进行中', '已完成', '待开始', '进行中'],
  '描述': ['核心功能开发', '性能优化', 'UI改版', '数据迁移', '接口对接', '文档编写', '代码审查', '需求分析', '系统测试', '部署上线'],
  '创建日期': ['2025-01-15', '2025-02-20', '2025-03-10', '2025-04-05', '2025-05-18', '2025-06-22', '2025-07-08', '2025-08-14', '2025-09-01', '2025-10-30'],
  '负责人': ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十', '钱十一', '陈十二'],
  '优先级': ['高', '中', '低', '紧急', '高', '中', '低', '中', '高', '低'],
  '进度': ['80%', '100%', '0%', '45%', '60%', '30%', '90%', '100%', '15%', '50%'],
  '备注': ['重点项目', '', '待确认', '', '跨部门协作', '', '即将完成', '已归档', '', '需要资源'],
};

// 解析命令行参数
function parseArgs(): { roomName: string; rows: number; cols: number; theme: string; empty: boolean } {
  const argv = process.argv.slice(2);
  const roomName = argv.find((a) => !a.startsWith('--')) || '';
  const getArg = (name: string): string | undefined => {
    const idx = argv.indexOf(`--${name}`);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  return {
    roomName,
    rows: parseInt(getArg('rows') || '10'),
    cols: parseInt(getArg('cols') || '10'),
    theme: getArg('theme') || 'blue',
    empty: argv.includes('--empty'),
  };
}

// 创建单元格
function createCell(content: string, bgColor?: string, fontColor?: string): Cell {
  const cell: Cell = { content, rowSpan: 1, colSpan: 1, isMerged: false };
  if (bgColor) cell.bgColor = bgColor;
  if (fontColor) cell.fontColor = fontColor;
  return cell;
}

// 生成表头
function generateHeaders(cols: number, theme: { header: string; headerFont: string }): Cell[] {
  const headers: Cell[] = [];
  for (let c = 0; c < cols; c++) {
    const headerText = c < HEADER_POOL.length ? HEADER_POOL[c] : `列${c + 1}`;
    headers.push(createCell(headerText, theme.header, theme.headerFont));
  }
  return headers;
}

// 生成数据行
function generateDataRow(rowIndex: number, cols: number): Cell[] {
  const row: Cell[] = [];
  for (let c = 0; c < cols; c++) {
    const headerName = c < HEADER_POOL.length ? HEADER_POOL[c] : '';
    const pool = DATA_POOL[headerName];
    const content = pool ? pool[rowIndex % pool.length] : '';
    // 奇偶行交替背景
    const cellBg = rowIndex % 2 === 0 ? '#F8F9FA' : undefined;
    row.push(createCell(content, cellBg));
  }
  return row;
}

// 生成空白行
function generateEmptyRow(cols: number): Cell[] {
  const row: Cell[] = [];
  for (let c = 0; c < cols; c++) {
    row.push(createCell(''));
  }
  return row;
}

// 生成房间数据
function generateRoomData(roomName: string, rows: number, cols: number, themeName: string, empty: boolean): RoomData {
  const theme = THEMES[themeName] || THEMES['blue'];
  const cells: Cell[][] = [];

  if (empty) {
    // 空白表格
    for (let r = 0; r < rows + 1; r++) {
      cells.push(generateEmptyRow(cols));
    }
  } else {
    // 带数据的表格：第一行是表头
    cells.push(generateHeaders(cols, theme));
    for (let r = 0; r < rows; r++) {
      cells.push(generateDataRow(r, cols));
    }
  }

  // 默认行高和列宽
  const rowHeights = new Array(cells.length).fill(30) as number[];
  const colWidths = new Array(cols).fill(100) as number[];

  return {
    roomId: roomName,
    document: { cells, rowHeights, colWidths },
    operations: [],
    revision: 0,
  };
}

// 主函数（使用动态 import 避免 Node.js 类型依赖）
async function main(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const readline = await import('readline');

  const { roomName, rows, cols, theme, empty } = parseArgs();

  // 验证 roomName
  if (!roomName) {
    console.log(`
协作房间数据生成器

用法: npx vite-node skills/roomGenerator/generate-room.ts <roomName> [options]

参数:
  roomName              房间名称（英文字母、数字、下划线）

选项:
  --rows <n>            数据行数（不含表头），默认 10
  --cols <n>            列数，默认 10
  --theme <name>        主题色 (blue/green/orange/purple)，默认 blue
  --empty               生成空白表格

示例:
  npx vite-node skills/roomGenerator/generate-room.ts demo
  npx vite-node skills/roomGenerator/generate-room.ts myroom --rows 20 --cols 8 --theme green
  npx vite-node skills/roomGenerator/generate-room.ts blank --empty --rows 30 --cols 26
    `);
    process.exit(1);
  }

  if (!/^[a-zA-Z0-9_]+$/.test(roomName)) {
    console.error('错误: roomName 只允许英文字母、数字和下划线');
    process.exit(1);
  }

  if (!THEMES[theme]) {
    console.error(`错误: 不支持的主题 "${theme}"，可选: ${Object.keys(THEMES).join('/')}`);
    process.exit(1);
  }

  const outputPath = path.join(process.cwd(), 'server', 'data', `room_${roomName}.json`);

  // 检查文件是否已存在
  if (fs.existsSync(outputPath)) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const overwrite = await new Promise<boolean>((resolve) => {
      rl.question(`文件 room_${roomName}.json 已存在，是否覆盖？(y/n) `, (answer: string) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
    if (!overwrite) {
      console.log('已取消');
      process.exit(0);
    }
  }

  console.log(`生成房间数据...`);
  console.log(`  房间名: ${roomName}`);
  console.log(`  行数: ${rows}（${empty ? '空白' : '+ 1行表头'}）`);
  console.log(`  列数: ${cols}`);
  console.log(`  主题: ${theme}`);

  const data = generateRoomData(roomName, rows, cols, theme, empty);
  const json = JSON.stringify(data);

  fs.writeFileSync(outputPath, json, 'utf-8');
  console.log(`\n✓ 已生成: ${outputPath}`);
}

main().catch(console.error);
