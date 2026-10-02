---
title: MyAlgo：一个算法初学者的题库与笔记仓库
date: 2026-10-02 20:30:00
updated: 2026-10-02 20:30:00
categories:
  - 学习
tags:
  - Note
  - 算法
  - Python
  - Git
  - Summary
description: 一个算法初学者的公开刷题仓库：按专题分组的 AcWing 题解、C++ 与 Python 两套实现、仍在补充的 Partial 目录，以及 README 里那份诚实的 git 速查。
excerpt: 不求学得多难，但求学的都懂。这个仓库按专题收着 AcWing 题解与 Python 练习，文件名就是题号，带 Partial 的目录说明那一块还没刷完。
---

README 的开头写得很直白：作为完全的算法初学者，不求学得多难，但求学的都懂；建这个仓库是想记录自己敲代码的过程，几年后再回看，「庶几会有笑容」。

**[MyAlgo · 查看 GitHub 仓库](https://github.com/chadoshamot/MyAlgo)**

本文根据仓库 README 与目录结构整理。仓库还在持续更新，具体内容以仓库当前状态为准。

<!-- more -->

## 目前的状态

README 记录了两件事：

1. 已经完成《代码随想录》的算法课程，笔记附在语雀里，链接尚未开放
2. 正在学习 Python 的基本语法，练习记录放在 `MyPythonTry/` 里

仓库创建于 2026 年 2 月，代码以 C++ 与 Python 为主。README 里还留着「将来如果开放这个仓库的话」这句话——如今它已经公开了，这句可以当作历史遗迹来看。

## 仓库里有什么

### `Acwing/`：按算法专题分组的题解

C++ 与 Python 两套实现并存，目录按专题划分：

```text
Acwing/cpp/基础算法Partial
Acwing/cpp/数据结构Partial
Acwing/cpp/搜索与图论
Acwing/cpp/dp
Acwing/cpp/greed
Acwing/cpp/math
Acwing/py/基础算法Partial
Acwing/py/数据结构Partial
Acwing/py/搜索与图论
Acwing/py/math
```

文件名基本就是题目编号：`785.cpp`、`843.py`、`899.cpp` 这样。带 `Partial` 字样的目录，意味着那一块还没刷完——这个标记比任何进度条都诚实。目录里还有一份 `Acwing/模板.docx`，是随手可查的模板小抄。

### `MyPythonTry/`：Python 练习

这里的命名换成了 `p1024.py`、`p1303.py`、`p1480.py`、`p1601.py`、`p2142.py`、`p2249.py`、`p2440.py`，并配了 `P1024_2.in` / `P1024_2.out` 这样的输入输出样例文件。

从题号格式看，像是高精度运算、二分查找、木材加工这一类入门题（README 没有点名题目来源，这里只按题号推测）。

## README 里的 git 速查

README 有一节叫 learn to use git，只记了三条：

```bash
git add xxx.xx
git status   # 看哪些文件在暂存区里
git push     # 把暂存区里的改动提交上去
```

严格说，`git push` 是把本地提交推送到远端，真正生成提交的是 `git commit`。这条笔记大约写于初学阶段，留在仓库里反而显得真实——谁的 git 入门笔记里没有几条半懂半错的注解呢。

## 一点观察

- 用题号当文件名，好处是回头看到编号就知道是哪道题，坏处是光看数字想不起题目内容，好在有专题目录兜底
- C++ 与 Python 两份实现放在一起，同一道题可以对照着看，对理解两种语言的写法差异有帮助
- 整个仓库本身就是一份学习记录：提交顺序、`Partial` 目录被逐步补全的过程、从 C++ 到 Python 的迁移，都带着时间戳

## 写在最后

README 里说，如果开放这个仓库，希望初学者能从中得到一些学习路径的启发，也欢迎大佬「鼓励鼓励点个 star」。

从「代码随想录 → 按专题刷题 → 换语言重刷」这条线索看，路径并不花哨，但每一步都留下了可以回看的东西。这大概就是它值得公开的理由。

**[前往 GitHub：查看仓库与最新笔记](https://github.com/chadoshamot/MyAlgo)**
