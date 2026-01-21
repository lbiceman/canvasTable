import './style.css';
import { SpreadsheetApp } from './app';
import { UIControls } from './ui-controls';

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
  // 初始化应用
  const app = new SpreadsheetApp('app');
  
  // 创建UI控件
  const uiControls = new UIControls(app);
  
  // 将应用实例暴露到全局，方便调试和测试
  (window as any).app = app;
  (window as any).uiControls = uiControls;
  
  console.log('Canvas Excel 应用已启动', app);
});