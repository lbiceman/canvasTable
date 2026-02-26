/**
 * ice-excel 开发调试工具
 * 用法: npx vite-node skills/devTools/dev-tools.ts <command> [args]
 */

const command = process.argv[2];
const args = process.argv.slice(3);

// 生成测试数据
function generateTestData(rows: number, cols: number): void {
  const data: string[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: string[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(`R${i + 1}C${j + 1}`);
    }
    data.push(row);
  }
  
  const output = JSON.stringify({ data }, null, 2);
  console.log(output);
}

// 分析 JSON 数据文件
async function analyzeData(filePath: string): Promise<void> {
  const fs = await import('fs');
  const content = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);
  
  if (json.data) {
    // 简化格式
    const rows = json.data.length;
    const cols = json.data[0]?.length || 0;
    const nonEmpty = json.data.flat().filter((c: string) => c).length;
    console.log(`格式: 简化格式`);
    console.log(`行数: ${rows}`);
    console.log(`列数: ${cols}`);
    console.log(`非空单元格: ${nonEmpty}`);
  } else if (json.cells) {
    // 完整格式
    const rows = json.cells.length;
    const cols = json.cells[0]?.length || 0;
    const merged = json.cells.flat().filter((c: { isMerged?: boolean }) => c?.isMerged).length;
    console.log(`格式: 完整格式`);
    console.log(`行数: ${rows}`);
    console.log(`列数: ${cols}`);
    console.log(`合并单元格: ${merged}`);
  }
}

// 检查 TypeScript 类型
async function checkTypes(): Promise<void> {
  const { execSync } = await import('child_process');
  try {
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log('✓ 类型检查通过');
  } catch {
    process.exit(1);
  }
}

// 统计代码行数
async function countLines(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = fs.readdirSync(srcDir).filter((f: string) => f.endsWith('.ts'));
  
  let total = 0;
  for (const file of files) {
    const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
    const lines = content.split('\n').length;
    total += lines;
    console.log(`${file}: ${lines} 行`);
  }
  console.log(`总计: ${total} 行`);
}

// 主函数
async function main(): Promise<void> {
  switch (command) {
    case 'generate':
      const rows = parseInt(args[0]) || 100;
      const cols = parseInt(args[1]) || 10;
      generateTestData(rows, cols);
      break;
    
    case 'analyze':
      if (!args[0]) {
        console.error('用法: dev-tools analyze <file.json>');
        process.exit(1);
      }
      await analyzeData(args[0]);
      break;
    
    case 'check':
      await checkTypes();
      break;
    
    case 'lines':
      await countLines();
      break;
    
    default:
      console.log(`
ice-excel 开发调试工具

命令:
  generate [rows] [cols]  生成测试数据 JSON (默认 100x10)
  analyze <file.json>     分析数据文件结构
  check                   运行 TypeScript 类型检查
  lines                   统计源代码行数

示例:
  npx vite-node skills/devTools/dev-tools.ts generate 1000 50 > test.json
  npx vite-node skills/devTools/dev-tools.ts analyze public/example-data.json
  npx vite-node skills/devTools/dev-tools.ts check
  npx vite-node skills/devTools/dev-tools.ts lines
      `);
  }
}

main().catch(console.error);
