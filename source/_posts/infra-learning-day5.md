---
title: Infra学习day5
date: 2026-10-06 10:33:47
categories:
  - 学习
tags:
  - Note
  - Infra
  - Linux
  - Summary
description: Infra 学习第五天的 Linux 前置知识笔记，涵盖文件与日志操作、Bash 引号与退出码、权限、进程、tmux、资源检查、环境变量、SSH、rsync 和调试工具。
excerpt: Infra 学习第五天，补齐 Linux 与 Bash 基础。从文件操作和日志检索出发，梳理权限、进程与远程会话，再学习环境变量、SSH 文件同步以及 GDB / strace 调试。
---

第五天学习 Linux 前置知识，内容包括文件与目录操作、日志检索、Shell 引号与退出码、权限、进程管理、资源检查、环境变量，以及 SSH、文件同步和调试工具。以下 Shell 示例以 Bash 为背景。

<!-- more -->

## 1. 文件与目录操作

```bash
pwd                         # 显示当前工作目录
ls -lah                     # 显示包含隐藏项的详细列表
mkdir -p runs/exp01/logs     # 创建目录及缺少的父目录
cp -a configs runs/exp01/   # 递归复制，并尽可能保留属性
mv old_name new_name        # 移动或重命名
rm -i file                  # 删除前交互确认
```

`ls -lah` 中，`-l` 使用详细列表格式，`-a` 包含隐藏项，`-h` 将大小显示为便于阅读的单位。`mkdir -p` 可以创建多层目录，目标目录已经存在时不会因此报错。

`mv` 可以将文件或目录移动到另一个位置；在同一父目录下修改名称时，表现为重命名。`rm -i` 会在删除前请求确认，操作对象由命令中指定的路径决定。

### 按文件名与内容搜索

```bash
find runs -type f -name '*.log'
rg 'CUDA error|out of memory' runs
```

`find` 从 `runs` 开始遍历，`-type f` 限定普通文件，`-name '*.log'` 按名称匹配日志文件。这里的引号让通配符交给 `find` 处理，而不是先由 Shell 展开。

`rg` 搜索文件内容，表达式中的 `|` 表示匹配 `CUDA error` 或 `out of memory`。它默认遵循忽略规则，并跳过部分隐藏项和二进制文件，因此搜索范围不一定包含目录中的每个文件。

## 2. 重定向、管道与日志

程序通常通过标准输出和标准错误输出信息，对应文件描述符 `1` 和 `2`。

```bash
python train.py >train.log 2>train.err
```

这条命令将标准输出写入 `train.log`，将标准错误写入 `train.err`。`>` 会创建文件，或截断已有文件；需要追加时可以使用 `>>`。

```bash
python train.py >train.all.log 2>&1
```

这里先将标准输出重定向到文件，再让标准错误指向标准输出当前的目标，从而合并两路输出。重定向按从左到右的顺序处理，调换顺序可能改变结果。

```bash
rg 'loss=' train.log | tail -n 20
```

管道 `|` 将左侧命令的标准输出连接到右侧命令的标准输入。上面的命令先筛选包含 `loss=` 的日志行，再显示匹配结果中的最后 20 行。

当一个流程需要重复运行和维护时，可以将命令保存为脚本，并通过版本控制记录修改。

## 3. 引号、变量与退出码

### 引号与变量展开

```bash
name='experiment 01'
printf '%s\n' "$name"
printf '%s\n' '$name'
```

双引号中的 `$name` 会展开为变量值，并作为一个参数传入 `printf`，输出 `experiment 01`。单引号抑制变量展开，第二次输出的是字面文本 `$name`。

未加引号的变量展开可能继续发生单词分割和通配符展开。例如，包含空格的变量值可能变成多个参数。`"$variable"` 用于保留变量值作为一个整体参数。

### 读取命令退出码

```bash
python check_data.py
status=$?
printf 'exit code: %s\n' "$status"
```

退出状态为 `0` 通常表示命令成功，非零值表示失败或其他由命令定义的状态。`$?` 保存最近执行的命令或管道的退出状态，因此需要在执行其他命令之前记录它。

### 脚本解释器与错误处理选项

```bash
#!/usr/bin/env bash
set -euo pipefail
```

脚本通过可执行文件方式启动时，首行指定使用 `/usr/bin/env` 在 `PATH` 中查找 Bash 作为解释器。`set -euo pipefail` 启用以下行为：

- `-e`：命令失败时，在满足相应规则的情况下退出脚本。它存在例外，例如部分条件判断、`&&`、`||` 和管道上下文，不能理解为所有非零状态都会立即退出。
- `-u`：展开未设置的变量时通常报错；可以通过 `${variable:-default}` 等写法提供默认值。
- `-o pipefail`：管道中有命令失败时，管道返回最右侧失败命令的非零状态；全部成功时返回 `0`。

这些选项改变 Shell 的错误处理规则，但具体命令的退出状态仍需要结合命令语义理解。

## 4. 文件与目录权限

```bash
ls -l script.sh
# -rwxr-x---  owner group ... script.sh

chmod u+x script.sh
chmod 640 config.yaml
```

权限字符串的首位表示文件类型，后面的三组权限分别对应所有者、组和其他用户。`chmod u+x` 给所有者增加执行权限。数字权限 `640` 表示所有者可读写、组可读、其他用户无权限。

`r`、`w`、`x` 对文件与目录的含义不同：

- 对文件，分别表示读取内容、修改内容和执行。
- 对目录，分别表示列出目录项名称、修改目录项，以及搜索或穿越目录。

访问路径还受到父目录权限影响，目录项的创建与删除通常涉及目录的写权限和执行权限。定位权限问题时，可以结合 `ls -l`、`id` 和父目录权限查看访问条件。`chmod 777` 会向所有者、组和其他用户开放全部三类权限。

## 5. 进程、后台作业与信号

### 查看进程

```bash
ps -ef | rg 'train\.py'
pgrep -af 'train\.py'
top
```

`ps -ef` 列出进程信息，管道中的 `rg` 筛选相关行。`pgrep -af` 按完整命令行匹配，并显示 PID 与命令行。示例对点号进行转义，使其匹配文件名中的字面点号。

`top` 动态显示进程和资源使用情况；安装了 `htop` 时，也可以使用它查看。

### 当前 Shell 的作业管理

```bash
python train.py &
jobs
fg %1
```

末尾的 `&` 让命令在后台执行，Shell 可以继续接收命令。`jobs` 显示当前 Shell 管理的作业，`fg %1` 将编号为 1 的作业切回前台。作业编号与操作系统分配的 PID 是不同的标识。

后台执行本身并不保证任务在 SSH 断开后继续运行，任务还可能依赖终端连接和标准输入输出。

### 信号与进程控制

Linux 使用信号通知进程发生某类事件。笔记涉及三种终止相关信号：

- `SIGTERM`：请求终止进程。程序可以捕获该信号并执行退出处理，但是否保存状态取决于程序实现。
- `SIGINT`：通常由终端中的 `Ctrl-C` 发送给前台进程组，程序可以处理该信号。
- `SIGKILL`：不能被捕获、阻塞或忽略，进程无法借助信号处理函数执行应用层清理。

`SIGTERM` 和 `SIGINT` 默认都终止进程，可处理并不表示一定执行了保存或清理。进程终止后，内核仍会回收其管理的进程资源。参见 [Linux 信号手册](https://man7.org/linux/man-pages/man7/signal.7.html)。

## 6. 使用 tmux 保持远程会话

`tmux` 在服务器上管理终端会话，客户端可以分离后重新连接。

```bash
tmux new -s train
# 在会话内运行任务，例如 python train.py。
# 按 Ctrl-b，然后按 d：分离客户端，保持会话。

tmux attach -t train
```

SSH 终端作为客户端连接到服务器上的 tmux 会话，训练进程运行在该会话中。分离客户端不会关闭会话，之后可以通过 `attach` 重新接入。

这与直接使用 `&` 的后台作业不同。会话与任务仍依赖服务器和相关进程持续运行；集群任务也可以由调度系统管理。参见 [tmux 手册](https://man.openbsd.org/tmux)。

## 7. 查看 CPU、内存、磁盘与网络

不同命令提供不同范围的运行信息：

- **CPU 与负载**：`top`、`uptime`、`mpstat`。负载与 CPU 使用率不是同一个指标。
- **进程内存**：`ps`、`top`、`pmap -x PID`。
- **系统内存**：`free -h`、`vmstat`。
- **文件系统容量**：`df -h`。
- **目录占用**：`du -sh PATH` 汇总指定路径，`du -h --max-depth=1` 查看当前目录及第一层子目录的占用。
- **I/O 活动**：`iostat`、`iotop`。
- **监听端口**：`ss -lntp` 查看 TCP 监听套接字，使用数字地址和端口，并尝试显示关联进程。
- **连接测试**：`curl -v URL` 显示请求与连接细节；`nc -vz HOST PORT` 测试指定主机端口的连通性。

部分工具需要单独安装，部分信息的可见范围与当前用户权限有关。

## 8. 环境变量与命令查找

```bash
export CUDA_HOME=/usr/local/cuda
export PATH="$CUDA_HOME/bin:$PATH"
export LD_LIBRARY_PATH="$CUDA_HOME/lib64:${LD_LIBRARY_PATH:-}"

env | sort
which nvcc
type -a python
```

`export` 将变量标记为导出，使随后启动的子进程能够继承它们。`PATH` 参与可执行文件查找，`LD_LIBRARY_PATH` 参与 Linux 动态链接器的库搜索；`CUDA_HOME` 则由读取它的工具或脚本解释。

`${LD_LIBRARY_PATH:-}` 在变量未设置或为空时展开为空字符串，使这段写法能够处理未设置变量的情况。如果因此产生末尾冒号，Linux 动态链接器会将对应的空路径项解释为当前工作目录。

`env | sort` 显示并排序当前环境，`which nvcc` 查找路径中的命令，`type -a python` 可以显示 Shell 识别到的多个命令来源，包括别名、函数和路径中的可执行文件。

环境修改由当前进程传给之后创建的子进程，不会反向修改父进程，也不会自动更新已经运行的其他进程。修改 `~/.bashrc` 只是修改配置文件，需要重新加载配置或重启相应进程，配置才可能生效。

### 在简化环境中复现问题

```bash
env -i HOME="$HOME" PATH=/usr/bin:/bin bash --noprofile --norc
```

`env -i` 为这次启动的命令构造一个不继承原有环境变量的环境，再显式加入 `HOME` 和 `PATH`。它不会清空当前 Shell 的环境。

`--noprofile --norc` 禁止新 Bash 自动读取相应启动配置。可以在这个简化环境中逐步补充变量，观察哪些配置影响程序行为。

## 9. SSH 与文件同步

### 密钥与远程连接

```bash
ssh-keygen -t ed25519 -C "your-name"
ssh-copy-id user@server
ssh user@server
```

`ssh-keygen` 生成密钥对，`-C` 设置注释。`ssh-copy-id` 将公钥安装到远程账号的授权配置中；私钥保留在客户端。`ssh` 用于建立远程连接。

### 为服务器配置别名

在 `~/.ssh/config` 中保存连接配置：

```sshconfig
Host gpu-dev
    HostName 192.0.2.10
    User user
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
```

之后可以执行：

```bash
ssh gpu-dev
```

SSH 会读取别名对应的主机、用户和密钥设置。`ServerAliveInterval 60` 设置在未收到服务器数据时发送协议层存活探测消息的间隔；它不负责保存远程任务状态。示例中的地址需要替换为实际服务器地址。

### 使用 rsync 传输目录

```bash
rsync -av --progress ./project/ gpu-dev:~/project/
```

`rsync` 支持增量传输。`-a` 使用归档模式，`-v` 输出详细信息，`--progress` 显示传输进度。

源路径末尾的 `/` 表示复制目录内容到目标目录；不带末尾 `/` 时，通常将源目录名称作为目标层级的一部分。该命令没有使用 `--delete`，不会仅因源端缺少文件就删除目标端对应的额外文件。参见 [rsync 手册](https://download.samba.org/pub/rsync/rsync.1)。

传输范围由源路径和选项决定，私钥、敏感数据与项目文件需要明确区分。

## 10. 使用 GDB 与 strace 调试

### GDB：断点、单步与调用栈

GDB 中的常见操作包括：

```text
break main       # 在 main 设置断点
run              # 启动程序
next             # 单步，通常不进入被调用函数
step             # 单步，可以进入被调用函数
print variable   # 查看变量
bt               # 查看调用栈
continue         # 继续执行
```

源代码级调试依赖可用的调试信息，编译优化也可能影响变量显示和单步执行的表现。

### strace：观察系统调用

```bash
strace -f -o trace.log ./app
rg 'ENOENT|EACCES' trace.log
```

`strace` 记录程序的系统调用，`-f` 跟踪派生进程等执行上下文，`-o` 将输出保存到文件。

`ENOENT` 常见于文件或路径不存在，`EACCES` 常见于访问权限不足。结合相关系统调用和路径，可以观察程序尝试读取哪些配置文件或加载哪些动态库。

这些错误也可能来自程序正常执行的候选路径探测，因此需要结合后续调用结果与程序报错判断它们是否是实际失败原因。
