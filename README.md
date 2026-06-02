# RLC Signal Web

这是一个用于“信号与系统”课堂展示的静态单页网站，主题为“从冲激到特征：RLC 电路动态分析交互展示”。

网站使用纯 HTML、CSS、JavaScript 实现，不依赖 React、Vue、Vite、后端或数据库。页面包含串联 RLC 电路说明、参数交互仿真、输出波形、零极点图、理论链路图、PPT 图片展示区和 PPT 下载入口。

## 本地预览

直接双击打开项目根目录中的 `index.html` 即可预览：

```text
index.html
```

也可以在浏览器中手动打开该文件。

## 主要功能

- 调节电阻 `R`、电感 `L`、电容 `C`
- 选择阶跃输入或冲激近似输入
- 实时计算并绘制 `v_C(t)` 输出波形
- 实时绘制零极点图
- 显示传递函数、当前极点、阻尼形态与稳定性结论
- 展示 `assets/slides/` 中的 12 张 PPT 图片
- 下载 `assets/image_ppt.pptx` 和 `assets/editable_ppt.pptx`

默认参数：

```text
R = 1Ω
L = 1H
C = 0.25F
```

默认系统对应：

```text
H(s) = 4 / (s^2 + s + 4)
p = -0.5000 ± j1.9365
```

## GitHub Pages 部署

1. 将整个项目上传到 GitHub 仓库。
2. 确认根目录中包含 `index.html`、`style.css`、`app.js`、`.nojekyll` 和 `assets/`。
3. 在仓库 Settings 中打开 Pages。
4. 选择部署分支，例如 `main`，目录选择仓库根目录。
5. 保存后等待 GitHub Pages 生成访问链接。

项目中的资源路径均使用相对路径，适合 GitHub Pages 子路径部署。

## 说明

页面中的仿真曲线和零极点图由 JavaScript 实时计算并使用 Canvas 绘制，不是图片伪造。公式渲染使用 MathJax CDN，因此离线环境下公式可能显示为 LaTeX 文本，但核心交互仿真仍可运行。
