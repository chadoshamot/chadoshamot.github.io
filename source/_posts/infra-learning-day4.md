---
title: Infra学习day4
date: 2026-10-05 16:56:03
categories:
  - 学习
tags:
  - Note
  - Infra
  - C++
  - Python
  - Summary
description: Infra 学习第四天的 C++ 与 Python 前置知识笔记，涵盖 CMake 目标配置与构建、RAII 互斥锁、跨语言调用、ctypes、pybind11 和零拷贝接口。
excerpt: Infra 学习第四天，从 CMake 的目标配置与构建流程出发，学习 RAII 互斥锁，再梳理 Python/C++ 互操作中的调用粒度、数据布局、零拷贝与所有权。
---

第四天学习 C++ 与 Python 相关的前置知识，内容包括 CMake 的目标配置与构建流程、使用 RAII 管理互斥锁，以及 Python/C++ 互操作中的调用方式、数据布局和所有权。

<!-- more -->

## 1. CMake 的项目结构

CMake 根据项目配置生成构建系统，再由构建工具调用编译器完成编译和链接。一个库项目可以采用以下目录结构：

```text
vector_ops/
├── CMakeLists.txt
├── include/
│   └── vector_ops.h
└── src/
    └── vector_ops.cpp
```

`CMakeLists.txt` 描述构建目标及其配置，`include/vector_ops.h` 保存头文件，`src/vector_ops.cpp` 保存实现代码。

## 2. 用 target 描述编译要求

笔记中的配置如下：

```cmake
cmake_minimum_required(VERSION 3.20)
project(vector_ops LANGUAGES CXX)

add_library(vector_ops src/vector_ops.cpp)
target_include_directories(vector_ops PUBLIC include)
target_compile_features(vector_ops PUBLIC cxx_std_20)

if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_compile_options(vector_ops PRIVATE -Wall -Wextra -Wpedantic)
endif()
```

### 项目与库目标

`cmake_minimum_required(VERSION 3.20)` 声明最低 CMake 版本为 3.20。

`project(vector_ops LANGUAGES CXX)` 设置项目名称，并启用 C++ 语言。

`add_library(vector_ops src/vector_ops.cpp)` 定义名为 `vector_ops` 的库目标，将指定源文件加入该目标。这一步描述要构建的内容，实际编译发生在后续构建阶段。

### 头文件路径与配置传播

```cmake
target_include_directories(vector_ops PUBLIC include)
```

这条命令将 `include` 加入目标的头文件搜索路径。`PUBLIC` 表示该路径既用于构建 `vector_ops`，也作为使用要求传递给通过 CMake 依赖关系链接该目标的消费者。

目标配置的作用范围分为三种：

- `PRIVATE`：用于目标自身。
- `INTERFACE`：提供给依赖该目标的消费者。
- `PUBLIC`：同时用于目标自身和消费者。

这种传播依赖目标之间的关系，并不表示项目中的所有文件都会自动获得该配置。参见 [CMake 的 target_include_directories 文档](https://cmake.org/cmake/help/latest/command/target_include_directories.html)。

### C++ 标准要求

```cmake
target_compile_features(vector_ops PUBLIC cxx_std_20)
```

这条命令声明目标需要至少支持 C++20 的编译模式，并将要求传递给消费者。CMake 根据编译器情况选择所需选项，因此不能将其固定理解为一定添加 `-std=c++20`。参见 [CMake 的 target_compile_features 文档](https://cmake.org/cmake/help/latest/command/target_compile_features.html)。

### 编译警告选项

配置通过 `CMAKE_CXX_COMPILER_ID` 判断编译器标识是否匹配 `GNU` 或 `Clang`，匹配时添加：

```cmake
target_compile_options(vector_ops PRIVATE -Wall -Wextra -Wpedantic)
```

这些选项启用相应的编译诊断。这里使用 `PRIVATE`，表示警告选项用于编译 `vector_ops` 自身，不作为使用要求传递给消费者。

在目标配置方式中，`target_include_directories` 描述头文件搜索路径，`target_compile_features` 描述语言特性要求，`target_link_libraries` 描述链接依赖。不同目标可以拥有各自的配置，而不必让整个项目共享同一组设置。

## 3. 配置与构建是两个阶段

在项目目录中执行：

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
```

第一条命令完成配置和生成：

- `-S .` 指定当前目录为源码目录，读取其中的 `CMakeLists.txt`。
- `-B build` 指定构建目录为 `build/`，目录不存在时会创建它。
- `-DCMAKE_BUILD_TYPE=Release` 为单配置生成器指定 Release 配置。

构建目录中保存 CMake 缓存、生成的构建系统文件，以及后续产生的编译输出。具体生成 Makefile、Ninja 文件还是其他项目文件，取决于生成器。

第二条命令启动实际构建。`--build build` 指定已有构建目录，`--parallel` 启用并行构建，具体并行度由底层构建工具等因素决定。

Release 通常启用优化，Debug 通常用于调试，具体编译选项取决于工具链配置。对于 Visual Studio 等多配置生成器，构建时通过 `--config` 选择配置：

```bash
cmake -S . -B build
cmake --build build --config Release --parallel
```

参见 [CMake 命令行文档](https://cmake.org/cmake/help/latest/manual/cmake.1.html)。

## 4. C++ 并发：使用 RAII 管理互斥锁

多个线程访问共享状态时，可以通过互斥锁保护需要互斥执行的代码段。

```cpp
#include <mutex>

std::mutex mutex;
int counter = 0;

void increment() {
    std::lock_guard<std::mutex> guard(mutex);
    ++counter;
}
```

`std::lock_guard<std::mutex>` 在构造时获取 `mutex`，在析构时释放它。`guard` 是局部对象，因此离开 `increment()` 的作用域时会自动解锁；因异常展开栈而离开作用域时，也会进行析构。

这延续了 RAII 的资源管理方式：锁的持有时间与 `guard` 的生命周期绑定。`++counter` 位于锁保护的范围内，使用同一把锁的线程不能同时执行这段操作。

这项保护要求其他可能并发冲突的访问也遵循相同的同步规则。仅在某一个写入位置加锁，并不能自动保护所有对 `counter` 的访问。

## 5. Python/C++ 互操作与调用粒度

Python/C++ 互操作是让 Python 调用原生代码，同时规定参数、返回值和资源如何穿过语言边界。

跨语言调用可能涉及函数分派、参数检查、类型转换和对象管理等开销。如果每处理一个元素都调用一次 C++，这些开销会随着调用次数重复发生。

批量接口将一组数据一次传入原生函数，再由原生代码完成整批处理。它减少了跨边界调用次数，但实际成本仍然取决于数据是否需要转换或复制。

## 6. `ctypes` 与 `pybind11`

### `ctypes`：调用 C 风格动态库接口

`ctypes` 是 Python 标准库提供的外部函数接口，可以加载动态库，并调用其中导出的函数。

调用方需要正确声明参数类型、返回类型、调用约定，以及指针所指数据的布局和有效期。C++ 实现也可以提供 C 风格的导出接口供它调用；普通 C++ 类接口并不会因此自动映射为 Python 类。参见 [Python 的 ctypes 文档](https://docs.python.org/3/library/ctypes.html)。

### `pybind11`：绑定 C++ 函数与类

`pybind11` 用于将 C++ 函数和类暴露为 Python 扩展模块，提供类型转换以及 NumPy、缓冲区等接口支持。

绑定接口仍然需要明确数据转换、返回值所有权和生命周期规则。进入由 Python 调用的 C++ 函数时，GIL 默认仍然被持有；需要释放 GIL 的计算区间，要在满足相应条件时显式处理。参见 [pybind11 的 GIL 文档](https://pybind11.readthedocs.io/en/stable/advanced/misc.html#global-interpreter-lock-gil)。

## 7. 零拷贝的数据接口

零拷贝表示 Python 与 C++ 访问同一块底层内存，而不是为跨语言传递重新复制数据。共享内存仍然需要明确接口约束。

跨语言传递数组时，接口描述包含以下信息：

- **地址**：数据存放在哪里。
- **元素类型**：每个元素的类型与大小。
- **形状**：各维度的元素数量。
- **步长**：沿各维度移动一个元素时，地址变化多少。
- **设备**：数据位于 CPU 内存还是 GPU 等设备内存。
- **生命周期**：谁拥有数据，数据何时失效。
- **可变性**：接收方是否可以修改数据。

仅提供首地址无法表达这些信息。例如，转置后的 NumPy 数组可能不是 C 连续布局。如果 C++ 只按首地址连续读取，就可能忽略实际步长，得到与逻辑数组顺序不同的结果。

如果绑定接口要求特定元素类型或连续布局，传入不符合要求的数组时，可能发生转换和复制，也可能被接口拒绝，具体行为取决于绑定设置。参见 [pybind11 的 NumPy 与缓冲区文档](https://pybind11.readthedocs.io/en/stable/advanced/pycpp/numpy.html)。

共享底层内存时，还需要保证所有者在原生代码使用数据期间保持存活，并明确修改权限。数据布局和所有权共同构成跨语言接口的一部分。
