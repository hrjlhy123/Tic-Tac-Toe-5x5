import path from 'path';
import Fontmin from 'fontmin'; // 使用 CommonJS 方式请改用 `const Fontmin = require('fontmin');`

// 设定输入和输出路径（用 path.resolve() 处理路径）
const srcPath = path.resolve('D:/Work/Study/CS 506/Tic-Tac-Toe (5x5)/CascadiaCodeNF.ttf');
const destPath = path.resolve('D:/Work/Study/CS 506/Tic-Tac-Toe (5x5)/output_fonts');

console.log("正在处理字体文件：", srcPath);
console.log("输出目录：", destPath);

// 创建 Fontmin 任务
const fontmin = new Fontmin()
    .src(srcPath) // 这里改成 `path.resolve()`，避免路径解析错误
    .use(Fontmin.ttf2svg())  // 直接转换整个字体
    .dest(destPath);

// 运行转换
fontmin.run((err, files) => {
    if (err) {
        console.error('字体转换失败：', err);
    } else {
        console.log('字体转换成功！SVG 文件已保存到', destPath);
    }
});
