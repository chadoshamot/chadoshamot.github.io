---
title: Infra学习day3
date: 2026-10-04 21:43:27
categories:
  - 学习
tags:
  - Note
  - Infra
  - C++
  - Summary
description: Infra 学习第三天的 C++ 前置知识笔记，涵盖原生数组与指针、std::span、RAII、智能指针所有权和 const 成员函数。
excerpt: Infra 学习第三天，开始补齐 C++ 前置知识。从数组与指针的长度信息出发，梳理 std::span、RAII 资源管理、智能指针所有权，以及成员函数末尾的 const。
---

第三天学习 C++ 前置知识，内容包括原生数组与指针、`std::span`、RAII 资源管理、智能指针的所有权，以及成员函数末尾的 `const`。

<!-- more -->

## 1. 原生数组与长度信息

原生数组在大多数表达式中会转换为指向首元素的指针。单独的 `T*` 不携带数组长度，因此使用指针处理一段连续数据时，需要另外提供元素数量。

```cpp
#include <cstddef>

void scale(float* data, std::size_t size, float factor) {
    for (std::size_t i = 0; i < size; ++i) {
        data[i] *= factor;
    }
}
```

这里的 `data` 指向数据，`size` 表示要处理的元素数量，`factor` 是缩放系数。调用方需要保证从 `data` 开始至少有 `size` 个可访问的 `float` 元素。

数组与指针本身是不同的类型。数组类型包含元素数量，转换为普通指针后，这部分信息不再由指针类型表达。

## 2. 用 `std::span` 表达连续数据视图

`std::span` 是 C++20 引入的连续数据视图，可以将数据位置与元素数量放在同一个接口中。

```cpp
#include <span>

void scale(std::span<float> values, float factor) {
    for (float& value : values) {
        value *= factor;
    }
}
```

相比独立传递指针和长度，这个函数通过 `values` 获取要处理的范围。循环变量 `value` 是元素的引用，因此乘法赋值直接修改底层数据。

`std::span` 不拥有数据，可以将其理解为“数据位置与长度”的轻量视图。创建视图不会复制其中的元素，也不会延长底层数据的生命周期。使用期间，底层内存必须保持有效；如果原容器销毁或重新分配内存，已有视图可能失效。参见 [C++ 标准草案中的 span 定义](https://eel.is/c++draft/views.span)。

## 3. RAII：将资源管理绑定到对象生命周期

RAII 的全称是 **Resource Acquisition Is Initialization**，即“资源获取即初始化”。它通过对象管理资源：在初始化过程中获取资源，在对象析构时释放资源。

对于局部对象，这个过程可以描述为：

1. 进入作用域，构造对象并获取资源。
2. 对象存活期间使用资源。
3. 正常离开作用域，或因异常展开栈而离开作用域时，析构对象并释放资源。

这与 Python 中使用 `with` 管理资源具有相似之处。Python 的 `with` 通过上下文管理器在退出代码块时进行清理；C++ 的 RAII 则依靠对象的析构。参见 [C++ Core Guidelines 的 RAII 说明](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#Rr-raii)。

### 使用类管理文件句柄

```cpp
#include <cstdio>
#include <stdexcept>

class File {
public:
    explicit File(const char* path)
        : handle_(std::fopen(path, "rb")) {
        if (handle_ == nullptr) {
            throw std::runtime_error("failed to open file");
        }
    }

    ~File() {
        std::fclose(handle_);
    }

    File(const File&) = delete;
    File& operator=(const File&) = delete;

private:
    std::FILE* handle_;
};

void process() {
    File f("some_file.txt");
    // 执行需要保持文件打开的操作。
}  // f 析构，关闭文件。
```

构造函数调用 `std::fopen`，以二进制只读模式打开文件。如果打开失败，就抛出异常，此时 `File` 对象没有完成构造。成功构造后，`handle_` 保存文件句柄，析构函数通过 `std::fclose` 关闭文件。

### 禁止复制资源所有者

示例中的两个声明分别禁止复制构造和复制赋值：

```cpp
File(const File&) = delete;
File& operator=(const File&) = delete;
```

如果直接复制句柄，两个对象就可能保存同一个文件句柄，并分别在析构时关闭它。删除复制操作后，以下写法无法通过编译：

```cpp
File a("some_file.txt");
File b = a;  // 复制构造被禁止。

File c("another_file.txt");
c = a;       // 复制赋值被禁止。
```

### 标准库中的 RAII 类型

标准库已有多种通过生命周期管理资源的类型：

- `std::vector` 和 `std::string` 管理自身使用的动态存储。
- `std::fstream` 管理文件流资源。
- `std::lock_guard` 在构造时获取锁，在析构时释放锁。
- 智能指针按照各自的所有权规则管理对象生命周期。

## 4. 智能指针与所有权

所有权描述的是谁负责维持对象生命周期，以及在何时释放对象。不同指针类型表达不同的关系。

### `std::unique_ptr<T>`：独占所有权

`std::unique_ptr<T>` 表达独占所有权，同一个被管理对象由一个 `unique_ptr` 所有者负责。它不能复制，但可以通过移动转移所有权。管理对象的指针析构或被重置时，会调用删除器释放原对象。参见 [C++ Core Guidelines 的智能指针说明](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#Rr-smartptrs)。

### `std::shared_ptr<T>`：共享所有权

多个 `std::shared_ptr<T>` 可以共享同一对象的所有权。复制共享指针会增加共享所有者数量；最后一个共享所有者放弃所有权时，被管理对象被销毁。参见 [C++ 标准草案中的 shared_ptr 定义](https://eel.is/c++draft/util.smartptr.shared)。

### `std::weak_ptr<T>`：不拥有对象的观察者

`std::weak_ptr<T>` 观察由 `shared_ptr` 管理的对象，不增加共享所有者数量，也不负责延长对象生命周期。需要访问对象时，可以调用 `lock()` 尝试取得一个 `shared_ptr`；对象已经销毁时，得到的是空的共享指针。参见 [C++ 标准草案中的 weak_ptr 定义](https://eel.is/c++draft/util.smartptr.weak)。

### `T*` 与 `T&`：不自动管理生命周期

原始指针和引用通常用于访问由其他对象管理的数据，自身不会自动释放所指向的对象。

不过，原始指针类型本身并不强制规定所有权。前面的 `File` 类中，`handle_` 就是一个由 `File` 负责关闭的原始句柄。是否拥有资源，需要结合接口约定与封装逻辑判断。参见 [C++ Core Guidelines 关于原始指针的约定](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#Rr-ptr)。

## 5. 成员函数末尾的 `const`

成员函数参数列表后的 `const`，限制该函数通过当前对象修改其状态。

```cpp
#include <cstddef>

class TensorView {
public:
    std::size_t size() const {
        return size_;
    }

private:
    std::size_t size_{};
};
```

`size()` 读取并返回 `size_`，没有修改它。末尾的 `const` 使该成员函数可以通过常量对象调用，并使函数内的 `this` 指向常量对象。参见 [C++ 标准草案关于成员函数限定符的说明](https://eel.is/c++draft/class.mfct.non.static)。

这里的限制不能理解为“调用函数不会改变任何东西”。`const` 成员函数仍然可以修改 `mutable` 成员、外部状态，或在类型允许时修改成员指针所指向的其他对象。它约束的是通过当前对象进行修改的方式，并不等于函数完全没有副作用。
