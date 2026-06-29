# FlyingPolarBear GitHub Pages 个人主页

这是一个可以直接发布到 GitHub Pages 的静态个人主页。

## 文件结构

```text
index.html
styles.css
script.js
assets/hero-workspace.png
topics/projects/index.html
topics/notes/index.html
topics/studio/index.html
```

## 发布到 github.io

1. 在 GitHub 新建仓库，仓库名改成 `FlyingPolarBear.github.io`。
2. 把本目录里的所有文件上传到仓库根目录。
3. 打开仓库的 `Settings -> Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，Folder 选择 `/ (root)`。
6. 等待几分钟后访问 `https://FlyingPolarBear.github.io`。

如果你想用命令行发布，先在 GitHub 网页端创建同名仓库，然后在本目录运行：

```bash
git init
git branch -M main
git add .
git commit -m "Publish homepage"
git remote add origin https://github.com/FlyingPolarBear/FlyingPolarBear.github.io.git
git push -u origin main
```

## 需要替换的内容

- 作品、笔记和实验页面里的条目
- `assets/hero-workspace.png`，如果你想换成自己的照片或封面图
