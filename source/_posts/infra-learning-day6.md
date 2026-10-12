---
title: Infra学习day6
date: 2026-10-12 18:05:49
categories:
  - 学习
tags:
  - Note
  - Infra
  - Linux
  - Git
  - Summary
description: Infra 学习第六天的运行环境与版本管理笔记，涵盖 venv、conda、Docker 的隔离范围、GPU 软件栈与环境排查，以及 Git 提交、分支、merge 和 rebase。
excerpt: Infra 学习第六天，梳理虚拟环境与容器的隔离边界，按层检查 GPU 软件栈，再学习 Git 的工作区、暂存区、提交与分支历史，并记录 C++ 算子接入 Python 的实践入口。
---

第六天学习运行环境与版本管理，内容包括 venv、conda 和 Docker 的隔离范围，GPU 软件栈及排查流程，以及 Git 的工作区、暂存区、提交和分支历史。

<!-- more -->

## 1. venv、conda 与 Docker

三种工具处理的环境范围不同：

- **venv**：基于已有 Python 解释器创建虚拟环境，主要隔离 Python 包的安装位置，常用于纯 Python 项目。它不隔离操作系统、驱动或全部原生依赖。
- **conda**：管理独立环境中的 Python、软件包，以及包渠道提供的一部分原生库和工具，常用于科学计算和具有二进制依赖的项目。
- **Docker/容器**：将应用及其用户态依赖组织为镜像，并以隔离的进程环境运行，常用于部署、CI 和跨机器复现。

### 容器与宿主机的关系

Linux 容器与运行它的宿主环境共享内核，通过相应机制隔离文件系统视图、进程和网络等资源。共享内核不意味着容器进程与宿主机进程默认共享同一个内存地址空间。隔离范围还取决于容器的启动配置。参见 [Docker 的容器说明](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/)。

镜像保存应用及其依赖文件，可以据此创建容器，减少每次手动配置用户态环境的操作。不过，镜像本身不包含运行时所需的全部宿主条件；例如 GPU 容器仍然依赖宿主机驱动和设备访问配置。

## 2. GPU 软件栈中的组件

笔记中的 GPU 软件栈可以按以下层次理解：

```text
应用 / PyTorch / 自定义扩展
        │
CUDA Runtime 与数学库（cudart、cuBLAS、cuDNN 等）
        │
用户态驱动库（libcuda）
        │
内核态 NVIDIA Driver
        │
GPU
```

这是用于区分组件职责的概念层次，并不表示每个调用都会逐一经过所有列出的库。

- **NVIDIA Driver**：提供操作系统与 GPU 交互的驱动支持，包括内核态与用户态组件。`nvidia-smi` 用于查看设备及驱动相关状态。
- **CUDA Toolkit**：开发工具集合，包含 `nvcc`、头文件、开发库及调试和分析工具。
- **CUDA Runtime 与数学库**：应用运行时使用的用户态组件，例如 `cudart` 和 `cuBLAS`。
- **cuDNN**：面向深度学习算子的加速库，是 CUDA 生态中的一个组件，不等于整个 CUDA。

驱动、开发工具链和应用运行依赖属于不同层次。参见 [NVIDIA 的 CUDA 安装指南](https://docs.nvidia.com/cuda/cuda-installation-guide-linux/)。

## 3. 按层检查 GPU 环境

以下命令以 Linux Shell 为例，从设备、编译工具链、Python 到框架逐层查看环境。

### 驱动是否能看到设备

```bash
nvidia-smi
```

这一步查看驱动接口能否访问 GPU。命令成功不等于当前 Python 环境中的框架已经能够使用 CUDA。

### 编译工具链来自哪里

```bash
which nvcc
nvcc --version
```

`which nvcc` 查看命令路径，`nvcc --version` 查看 CUDA 编译工具链版本。它们描述的是找到的 Toolkit 编译器，不是当前框架构建所用的 CUDA 版本。

### 当前使用哪个 Python

```bash
which python
python -c 'import sys; print(sys.executable)'
```

这一步确认命令查找结果与实际解释器路径，用于区分不同虚拟环境中的 Python。

### 框架看到什么

```bash
python - <<'PY'
import torch

print("torch:", torch.__version__)
print("built with CUDA:", torch.version.cuda)
print("CUDA available:", torch.cuda.is_available())
print("device count:", torch.cuda.device_count())
PY
```

这些信息分别表示 PyTorch 版本、构建所用的 CUDA 版本、当前 CUDA 是否可用，以及框架可见的设备数量。它们回答的问题不同，不能只用其中一个版本号描述整个 GPU 环境。

### 常见现象与检查范围

- **`nvidia-smi` 失败**：检查驱动、宿主机设备状态，以及容器中的设备访问配置。
- **`nvidia-smi` 成功，但找不到 `nvcc`**：检查 Toolkit 是否安装，以及 `PATH` 是否包含它的路径。仅运行预编译框架时，未必需要本地安装 `nvcc`。
- **框架导入成功，但 CUDA 不可用**：检查是否安装 CPU 构建、驱动是否兼容、容器是否获得 GPU 访问能力，以及设备是否被可见性配置屏蔽。
- **自定义扩展编译失败**：检查编译器、Toolkit、头文件、ABI 和目标 GPU 架构设置。
- **运行时缺少 `.so`**：检查动态库搜索路径、wheel 或 conda 包的依赖，以及二进制架构是否匹配。

这些是对应现象的检查范围，并不意味着某种现象只由一个原因造成。

## 4. Git 的工作区、暂存区与提交

Git 中，编辑文件首先改变工作区；`git add` 将准备提交的内容放入暂存区；`git commit` 根据暂存区创建提交。

```text
工作区 ── git add ──► 暂存区 ── git commit ──► 新提交
```

`HEAD` 指向当前检出的提交，通常通过当前分支引用间接指向它。常用查看命令如下：

```bash
git diff
git diff --staged
git status --short
git log --oneline --decorate -10
```

- `git diff` 比较工作区与暂存区中的已跟踪内容，显示尚未暂存的修改。
- `git diff --staged` 比较暂存区与 `HEAD`，显示下一次提交准备包含的修改。
- `git status --short` 简要显示文件状态，包括未跟踪文件。
- `git log --oneline --decorate -10` 显示最近 10 条提交及相关引用标记。

分别检查未暂存和已暂存的差异，可以确认哪些修改留在工作区，哪些会进入提交。

## 5. 一次修改与提交的流程

```bash
git clone https://github.com/owner/project.git
cd project
git switch -c docs/improve-foundations

# 修改文件并完成相应验证后，检查状态与差异。
git status --short
git diff --check
git diff

git add path/to/changed-file
git diff --staged
git commit -m "docs: expand programming foundations"
```

`git clone` 获取仓库，`git switch -c` 创建并切换到工作分支。`git diff --check` 检查差异中的空白错误等问题，不代替代码或文档内容验证。

`git add` 明确选择要暂存的文件，随后通过 `git diff --staged` 查看提交内容。`git commit` 创建本地提交，不会自动将它推送到远程仓库。示例中的仓库地址和文件路径需要替换为实际值。

## 6. merge 与 rebase

假设 `main` 和 `feature` 从提交 `C` 分叉：

```text
A---B---C---F---G  main
         \
          D---E    feature
```

`main` 增加了 `F`、`G`，`feature` 增加了 `D`、`E`。

### merge：连接两条历史

```bash
git switch feature
git merge main
```

在这个已经分叉的示例中，成功合并后会产生一个具有两个父提交的合并提交 `M`：

```text
A---B---C---F---G  main
         \       \
          D---E---M  feature
```

原有提交保持不变，`M` 将两条历史连接起来。不过，merge 并非每次都会创建合并提交；能够快进时，默认行为可以只移动分支引用。参见 [Git 的 merge 文档](https://git-scm.com/docs/git-merge)。

### rebase：在新基线上重放提交

从最初的分叉状态出发执行：

```bash
git switch feature
git rebase main
```

Git 将 `feature` 上需要重放的提交应用到新的基线后，结果可以表示为：

```text
A---B---C---F---G       main
                 \
                  D'---E'  feature
```

`D'`、`E'` 表达原来 `D`、`E` 的修改，但因为父提交等信息发生变化，它们是新的提交，具有新的提交标识。这里的 rebase 示例与前面的 merge 示例是从同一个初始状态出发的两种操作。参见 [Git 的 rebase 文档](https://git-scm.com/docs/git-rebase)。

merge 保留分叉历史，rebase 在新基线上重新组织提交。对已经共享的分支进行 rebase，会改变他人可能依赖的历史；尚未共享的功能分支则可以通过 rebase 整理提交关系。

两种操作都可能遇到冲突。冲突表示 Git 无法自动整合相应修改，需要确定文件的最终内容，暂存处理结果后再完成当前操作。

## 7. C++ 算子接入 Python 的实践记录

笔记中附有相关实践目录：[fast_scale：添加 C++ 算子到 Python](https://github.com/chadoshamot/ai_infra_guide_exp/tree/main/chap1/fast_scale%28%E6%B7%BB%E5%8A%A0c%2B%2B%E7%AE%97%E5%AD%90%E5%88%B0python%29)。
