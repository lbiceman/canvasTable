/**
 * ice-excel 代码格式化工具
 * 用法: npx vite-node skills/formatter/format.ts <command> [args]
 */

const command = process.argv[2];
const args = process.argv.slice(3);

// 格式化单个文件
async function formatFile(filePath: string): Promise<boolean> {
  const fs = await import('fs');
  
  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  
  // 1. 统一换行符为 LF
  content = content.replace(/\r\n/g, '\n');
  
  // 2. 移除行尾空格
  content = content.replace(/[ \t]+$/gm, '');
  
  // 3. 确保文件末尾有且仅有一个换行
  content = content.replace(/\n*$/, '\n');
  
  // 4. 移除多余空行（超过2个连续空行变为2个）
  content = content.replace(/\n{3,}/g, '\n\n');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ 已格式化: ${filePath}`);
    return true;
  } else {
    console.log(`- 无需修改: ${filePath}`);
    return false;
  }
}

// 格式化所有 src 文件
async function formatAll(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = fs.readdirSync(srcDir).filter((f: string) => 
    f.endsWith('.ts') || f.endsWith('.css')
  );
  
  let changed = 0;
  for (const file of files) {
    const formatted = await formatFile(path.join(srcDir, file));
    if (formatted) changed++;
  }
  
  console.log(`\n共格式化 ${changed} 个文件`);
}

// 检查格式（不修改文件）
async function checkFormat(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = fs.readdirSync(srcDir).filter((f: string) => 
    f.endsWith('.ts') || f.endsWith('.css')
  );
  
  const issues: string[] = [];
  
  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 检查 CRLF
    if (content.includes('\r\n')) {
      issues.push(`${file}: 包含 CRLF 换行符`);
    }
    
    // 检查行尾空格
    if (/[ \t]+$/m.test(content)) {
      issues.push(`${file}: 包含行尾空格`);
    }
    
    // 检查文件末尾
    if (!content.endsWith('\n') || content.endsWith('\n\n')) {
      issues.push(`${file}: 文件末尾格式不正确`);
    }
    
    // 检查多余空行
    if (/\n{3,}/.test(content)) {
      issues.push(`${file}: 包含多余空行`);
    }
  }
  
  if (issues.length === 0) {
    console.log('✓ 所有文件格式正确');
  } else {
    console.log('发现格式问题:\n');
    issues.forEach(issue => console.log(`  - ${issue}`));
    console.log(`\n运行 "npx vite-node skills/formatter/format.ts all" 自动修复`);
    process.exit(1);
  }
}

// 格式化 JSON 文件
async function formatJson(filePath: string): Promise<void> {
  const fs = await import('fs');
  
  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);
  const formatted = JSON.stringify(json, null, 2) + '\n';
  
  if (formatted !== content) {
    fs.writeFileSync(filePath, formatted, 'utf-8');
    console.log(`✓ 已格式化: ${filePath}`);
  } else {
    console.log(`- 无需修改: ${filePath}`);
  }
}

// 主函数
async function main(): Promise<void> {
  switch (command) {
    case 'file':
      if (!args[0]) {
        console.error('用法: format file <filepath>');
        process.exit(1);
      }
      await formatFile(args[0]);
      break;
    
    case 'all':
      await formatAll();
      break;
    
    case 'check':
      await checkFormat();
      break;
    
    case 'json':
      if (!args[0]) {
        console.error('用法: format json <filepath>');
        process.exit(1);
      }
      await formatJson(args[0]);
      break;
    
    default:
      console.log(`
ice-excel 代码格式化工具

命令:
  all              格式化 src 目录下所有文件
  file <path>      格式化指定文件
  check            检查格式问题（不修改文件）
  json <path>      格式化 JSON 文件

格式化规则:
  - 统一使用 LF 换行符
  - 移除行尾空格
  - 文件末尾保留一个换行
  - 最多保留两个连续空行

示例:
  npx vite-node skills/formatter/format.ts all
  npx vite-node skills/formatter/format.ts file src/app.ts
  npx vite-node skills/formatter/format.ts check
  npx vite-node skills/formatter/format.ts json public/example-data.json
      `);
  }
}

main().catch(console.error);
