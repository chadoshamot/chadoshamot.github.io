---
title: MyAlgo：一个算法初学者的题库与笔记仓库
date: 2026-10-02 20:30:00
updated: 2026-10-02 21:50:00
categories:
  - 学习
tags:
  - Note
  - 算法
  - Python
  - Git
  - Summary
description: 一个算法初学者的刷题记录：按专题分组的 AcWing 题解、C++ 与 Python 两套实现、还在补全的 Partial 目录，以及最初学 git 时留下的速查笔记。
excerpt: 作为完全的算法初学者，不求学得多难，但求学的都懂。这个仓库按专题收着 AcWing 题解与 Python 练习，文件名就是题号，带 Partial 的目录说明那块还没刷完。
---

作为完全的算法初学者，不求学得多难，但求学的都懂。

这个仓库用来记录刷题的过程，几年后再回看，「庶几会有笑容」。

**[MyAlgo · GitHub 仓库](https://github.com/chadoshamot/MyAlgo)**

<!-- more -->

## 目前的进度

已经完成《代码随想录》的算法课程，笔记整理在语雀里，链接暂时还没开放。现在正在学 Python 的基本语法，练习记录都放在 `MyPythonTry/` 里。

仓库是 2026 年 2 月建的，一开始是私有的，最近才开放出来。

## 仓库里有什么

### `Acwing/`：按算法专题分组的题解

C++ 和 Python 两套实现都保留着，目录按专题划分：

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

文件名直接用题目编号：`785.cpp`、`843.py`、`899.cpp` 这样，回头看到编号就知道是哪道题。带 `Partial` 字样的目录，说明那一块还没刷完。目录里还有一份 `Acwing/模板.docx`，是随手可查的模板小抄。

### `MyPythonTry/`：Python 练习

命名是 `p1024.py`、`p1303.py`、`p1480.py`、`p1601.py`、`p2142.py`、`p2249.py`、`p2440.py`，每个还配了 `P1024_2.in` / `P1024_2.out` 这样的输入输出样例文件，方便本地直接跑。内容多是高精度运算、二分查找、木材加工这一类入门题。

## README 里的 git 速查

仓库 README 里有一节 learn to use git，记着刚上手时最常用的三条命令：

```bash
git add xxx.xx
git status   # 看哪些文件在暂存区里
git push     # 把暂存区里的改动提交上去
```

现在看当然已经不够用了，先留着当作入门时的纪念。

## 仓库的组织方式

- 文件名用题号，回头看到编号就知道是哪道题；想不起题目内容也没关系，专题目录能兜底
- C++ 与 Python 两份实现放在一起，同一道题可以对照着看，对理解两种语言的写法差异有帮助
- 提交顺序、`Partial` 目录被逐步补全的过程、从 C++ 到 Python 的迁移，本身就构成了一条时间线

## 写在最后

如果这个仓库能帮到人，希望刚开始学算法的同学能从中得到一点学习路径上的启发；路过的大佬要是觉得还行，欢迎点个 star 鼓励一下。

**[前往 GitHub：查看仓库与最新笔记](https://github.com/chadoshamot/MyAlgo)**
