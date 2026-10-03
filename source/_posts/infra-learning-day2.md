---
title: Infra学习day2
date: 2026-10-04
categories:
  - 学习
tags:
  - Note
  - Infra
  - Python
  - Summary
description: Infra 学习第二天的 Python 前置知识笔记，涵盖并发与并行、线程与进程、asyncio、CPU 与 GPU 性能计时，以及性能分析与优化顺序。
excerpt: Infra 学习第二天，从并发、并行与 GIL 出发，梳理多进程和 asyncio 的适用场景，再学习 CPU / GPU 计时、性能分析工具与优化顺序。
---

第二天继续学习 Python 前置知识，内容包括并发与并行、线程与进程、`asyncio`，以及 CPU 和 GPU 的性能计时、性能分析与优化顺序。

<!-- more -->

## 1. 并发与并行

并发指多个任务在同一段时间内推进，任务之间可以交替执行；并行指多个任务在同一时刻执行。并发不一定要求多个计算核心，而并行通常依赖多个 CPU 核心或 GPU 等计算资源。

任务的主要耗时来源，会影响执行模型的选择：

- **大量等待网络或磁盘的任务**：例如下载、API 请求和小文件读写，可以使用线程；具有异步接口的 I/O 也可以使用 `asyncio`。
- **纯 Python 的 CPU 计算**：例如 Python 循环和主要由 Python 代码完成的解析，可以使用多进程分配计算任务。
- **NumPy、PyTorch 的 CPU 运算**：例如矩阵计算，并行能力通常由底层原生算子及其线程池提供，实际行为取决于算子和后端配置。
- **GPU 计算**：例如 PyTorch CUDA 运算，计算并行主要发生在 GPU 上，Python 负责提交任务与调度。

## 2. 多线程、GIL 与共享内存

在启用 GIL 的 CPython 中，一个进程可以包含多个线程，但同一时刻只有一个线程能够执行 Python 字节码。GIL 是解释器层面的全局锁，并不是因为线程存在等待才需要添加的锁。这里讨论的是启用 GIL 的构建；自由线程构建的行为有所不同。参见 [Python 线程文档](https://docs.python.org/3/library/threading.html)。

线程执行阻塞 I/O 时，相关实现通常会释放 GIL，让其他线程继续执行。例如，一个线程等待网络响应时，另一个线程可以处理自己的任务。因此，线程可以使多个 I/O 任务的等待时间重叠。

多个线程共享同一进程的内存。当它们同时读写共享状态时，仍然可能产生竞态条件。GIL 不保证由多步操作组成的业务逻辑具有原子性，需要根据共享状态的访问方式使用锁等同步机制。

## 3. 多进程与任务批次

### 主入口保护

多进程可以将纯 Python 计算分配到不同进程，每个进程拥有自己的解释器和 GIL，从而利用多个 CPU 核心。

进程启动方式包括 `spawn`、`fork` 和 `forkserver`，支持情况与默认值取决于平台和 Python 版本。Windows 使用 `spawn`，子进程会启动新的解释器并导入主模块。因此，创建进程的代码应放在主入口保护中，避免导入模块时再次创建进程：

```python
if __name__ == "__main__":
    main()
```

主入口保护与子进程导入主模块有关，并不能简单归因于 `fork`。参见 [Python 多进程文档](https://docs.python.org/3/library/multiprocessing.html)。

### 多进程的成本

多进程除了计算本身，还可能涉及以下开销：

- 创建进程；使用 `spawn` 时还要启动独立解释器并导入模块。
- 在进程间传递参数和结果时进行序列化与反序列化。
- 复制、映射或管理共享内存。
- 进程间通信与同步。

如果单个任务耗时很短，调度和数据传输成本可能超过计算本身。将多个小任务合并为一个批次，可以减少提交任务和通信的次数。批次大小也会影响内存占用和任务分配的均衡程度。

### CUDA 与进程启动

CUDA 上下文与进程启动方式有关。父进程初始化 CUDA 后再使用 `fork`，可能导致子进程初始化或运行异常；多个进程建立各自的 CUDA 上下文，也可能增加显存占用。

PyTorch 在 CUDA 子进程场景中要求使用 `spawn` 或 `forkserver`。使用数据加载和分布式能力时，启动方式应与框架要求一致。参见 [PyTorch 多进程文档](https://docs.pytorch.org/docs/stable/notes/multiprocessing.html)。

## 4. `asyncio` 与事件循环

`asyncio` 通过事件循环调度协程。在同一个事件循环线程中，协程执行到需要等待的异步操作时，可以暂停并让其他任务继续运行。

```python
import asyncio

async def worker(name: str, delay: float) -> str:
    await asyncio.sleep(delay)  # 模拟异步等待
    return name

async def main() -> None:
    results = await asyncio.gather(
        worker("a", 0.2),
        worker("b", 0.1),
    )
    print(results)

asyncio.run(main())
```

两个 `worker` 的等待过程可以重叠。虽然 `b` 的等待时间较短，但 `asyncio.gather` 按传入任务的顺序返回结果，因此输出为：

```text
['a', 'b']
```

`await` 不会把普通的阻塞 I/O 或 CPU 计算自动变成非阻塞操作，也不保证每次执行都会切换任务。是否让出控制权，取决于等待的对象是否实际挂起当前协程。

在事件循环线程中直接执行阻塞 I/O 或长时间 CPU 计算，会阻碍同一循环中的其他任务推进。阻塞操作可以交给线程执行，CPU 密集计算可以交给进程执行，再异步等待结果。参见 [asyncio 开发文档](https://docs.python.org/3/library/asyncio-dev.html)。

## 5. CPU 性能计时：预热与重复测量

单次运行的耗时可能受到首次初始化、缓存状态和系统调度等因素影响。预热后重复测量，可以观察多次运行的耗时，并使用统计量描述结果。

```python
from statistics import median
from time import perf_counter

def benchmark(fn, warmup: int = 5, repeat: int = 20) -> float:
    for _ in range(warmup):
        fn()

    samples = []
    for _ in range(repeat):
        start = perf_counter()
        fn()
        samples.append(perf_counter() - start)

    return median(samples)
```

这段代码先执行 5 次预热，再记录 20 次调用的耗时，返回以秒为单位的**中位数**，而不是算术平均值。`perf_counter()` 用于测量经过的时间。

如果被测函数会修改输入或内部状态，多次调用可能对应不同的工作量；测量时需要明确每轮调用的条件。

## 6. GPU 性能计时：等待计算完成

PyTorch 的 CUDA 操作通常相对于 CPU 异步执行。CPU 提交 GPU 工作后可以继续运行，因此仅在 `model(x)` 前后进行 CPU 计时，可能主要记录提交任务的时间，而没有包含完整的 GPU 执行时间。

可以在计时前后同步 CUDA：

```python
import torch
from time import perf_counter

# 前提：model 和 x 已准备好，并在目标 CUDA 设备上完成预热。
torch.cuda.synchronize()
start = perf_counter()

model(x)

torch.cuda.synchronize()
elapsed = perf_counter() - start
print(elapsed)
```

计时前的同步用于等待此前提交的工作完成；计时后的同步用于等待本次工作完成。这个时间区间包含 CPU 提交开销以及等待 GPU 完成的时间，不等同于单个 GPU kernel 的执行时间。参见 [PyTorch CUDA 文档](https://docs.pytorch.org/docs/stable/notes/cuda.html)。

## 7. 从整体计时到局部分析

性能分析可以逐步缩小观察范围：

1. **端到端计时**：测量完整流程，确认整体耗时及其变化。
2. **阶段计时**：分别记录数据处理、计算、通信和保存等阶段的耗时。
3. **函数级分析**：使用 `cProfile` 观察函数调用次数及耗时。
4. **行级或采样分析**：进一步定位热点代码行或原生调用栈。
5. **内存分析**：使用 `tracemalloc` 等工具观察 Python 内存分配。
6. **GPU 分析**：使用 PyTorch Profiler、Nsight Systems、Nsight Compute 等工具分析 GPU 工作。

### 使用 `cProfile` 分析函数耗时

`cProfile` 可以记录函数调用次数、函数自身耗时，以及包含子函数调用的累计耗时。累计耗时较高的函数，可能把时间花在其调用的其他函数中，需要结合调用关系理解结果。

```bash
python -m cProfile -o profile.out train.py
python -m pstats profile.out
```

进入 `pstats` 交互界面后，按累计耗时排序并显示前 30 项：

```text
sort cumulative
stats 30
```

参见 [Python 性能分析工具文档](https://docs.python.org/3/library/profile.html)。

### 使用 `tracemalloc` 观察内存分配

```python
import tracemalloc

tracemalloc.start()
# 在这里运行待检查代码。
snapshot = tracemalloc.take_snapshot()

for stat in snapshot.statistics("lineno")[:10]:
    print(stat)
```

这段代码启动追踪后获取内存快照，按源码行汇总当前追踪到的分配，并显示占用较大的前 10 项。单个快照描述一个时刻的分配情况；观察增长需要比较不同时间的快照。

`tracemalloc` 主要追踪 Python 内存分配，不直接代表进程全部内存或 GPU 显存占用。参见 [tracemalloc 文档](https://docs.python.org/3/library/tracemalloc.html)。

## 8. 性能优化的处理顺序

笔记中的优化顺序从算法和数据处理开始，再逐步进入底层实现：

1. 调整算法复杂度和数据结构，减少计算量或数据访问成本。
2. 减少不必要的 I/O、复制和序列化。
3. 将细粒度 Python 循环改为批处理或向量化原生算子。
4. 减少 Python 与 C++、GPU 之间频繁的调用和数据传递。
5. 在分析结果确认热点后，针对相应部分编写 C++、CUDA 或 Triton 扩展。

每次修改后，使用一致的输入、计时范围和测量方法重新测量，以记录修改前后的性能变化。
