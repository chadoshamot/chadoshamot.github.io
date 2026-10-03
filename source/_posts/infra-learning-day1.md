---
title: Infra学习day1
date: 2026-10-03
categories:
  - 学习
tags:
  - Note
  - Infra
  - Python
  - Summary
description: Infra 学习第一天的 Python 前置知识笔记，涵盖对象引用、函数参数、拷贝、闭包、类与数据模型、生成器、装饰器和异常处理。
excerpt: Infra 学习第一天，先补齐 Python 前置知识。从 is 与 == 开始，梳理对象引用、可变默认参数、浅拷贝与深拷贝，以及闭包、生成器和异常链。
---

Infra 学习第一天，先补齐 Python 的前置知识。

今天的学习内容围绕 Python 的对象引用、函数参数、拷贝、闭包、类与数据模型，以及迭代器、生成器、装饰器和异常处理展开。

<!-- more -->

## 1. `is` 与 `==`

`is` 判断两个引用是否指向同一个对象，`==` 判断两个对象的值是否相等。两个列表可以具有相同的内容，同时分别属于不同的对象。

```python
a = [1, 2]
b = [1, 2]
c = a

print(a == b)  # True
print(a is b)  # False
print(a is c)  # True
```

判断一个值是否为 `None` 时，可以使用 `value is None`。

## 2. 函数参数与对象引用

Python 调用函数时，形参会绑定到传入的对象。修改这个对象与重新绑定形参，会产生不同的结果。

### 修改传入的对象

```python
def f(a: list[int]) -> None:
    a.append(1)

data = []
f(data)
print(data)  # [1]
```

调用 `f(data)` 后，`data` 和形参 `a` 指向同一个列表。`a.append(1)` 修改了这个列表，因此通过 `data` 也能看到修改后的内容。

```text
data ──┐
       ├────► 同一个列表：[] → [1]
a    ──┘
```

### 重新绑定形参

```python
def f2(a: list[int]) -> None:
    a = [1, 2]

data = [1]
f2(data)
print(data)  # [1]
```

`a = [1, 2]` 创建了一个新列表，并让局部变量 `a` 指向它。这个赋值不会改变 `data` 的绑定，也没有修改原来的列表。

```text
data ─────► [1]
a    ─────► [1, 2]
```

## 3. 默认参数的创建时机

函数的默认参数表达式在函数定义执行时求值，而不是在每次调用时求值。使用列表作为默认参数时，省略该参数的多次调用会共享同一个列表。

```python
def collect_shared(x: int, result: list[int] = []) -> list[int]:
    result.append(x)
    return result

print(collect_shared(1))  # [1]
print(collect_shared(2))  # [1, 2]
print(collect_shared(3))  # [1, 2, 3]
```

如果需要每次省略参数时都创建一个新列表，可以用 `None` 表示未提供列表，再在函数体内创建它。

```python
def collect(x: int, result: list[int] | None = None) -> list[int]:
    if result is None:
        result = []
    result.append(x)
    return result

print(collect(1))  # [1]
print(collect(2))  # [2]
print(collect(3))  # [3]
```

这里的新列表是在每次 `result is None` 的调用中创建的。显式传入列表时，函数会向该列表追加元素。

## 4. 浅拷贝与深拷贝

浅拷贝创建新的外层容器，但其中的元素仍然引用原来的对象。深拷贝递归复制内部对象；在下面的嵌套列表示例中，内层列表也会被复制。

```python
import copy

src = [[1], [2]]
shallow = src.copy()
deep = copy.deepcopy(src)

shallow[0].append(9)

print(src)      # [[1, 9], [2]]
print(shallow)  # [[1, 9], [2]]
print(deep)     # [[1], [2]]
```

`src` 与 `shallow` 是两个外层列表，但它们的第一个元素指向同一个内层列表。因此，`shallow[0].append(9)` 的结果也会出现在 `src` 中。`deep` 的内层列表独立于原列表，不受这次修改影响。

## 5. 闭包与延迟绑定

### 闭包

内部函数可以引用外层函数作用域中的变量。当内部函数被返回后，即使外层函数已经执行结束，它仍然可以访问这些变量。

```python
from collections.abc import Callable

def make_multiplier(scale: float) -> Callable[[float], float]:
    def multiply(x: float) -> float:
        return x * scale
    return multiply

double = make_multiplier(2.0)
print(double(3.0))  # 6.0
```

`make_multiplier` 接收一个 `float` 类型的 `scale`，返回一个接收 `float` 并返回 `float` 的函数。返回的 `multiply` 保留了对外层变量 `scale` 的访问，这构成了闭包。

### 延迟绑定

闭包中的自由变量通常在函数实际执行时读取。在循环中创建多个函数时，它们可能引用同一个循环变量。

```python
functions = [lambda: i for i in range(3)]
print([fn() for fn in functions])  # [2, 2, 2]
```

这些函数在列表推导式结束后执行，此时它们读取到的 `i` 都是 `2`。

可以利用默认参数在每次创建函数时保存当前值：

```python
functions = [lambda i=i: i for i in range(3)]
print([fn() for fn in functions])  # [0, 1, 2]
```

这里每个函数的参数 `i` 都有各自的默认值，分别是 `0`、`1` 和 `2`。

## 6. 类、数据模型与协议

`class` 语句用于定义类。`@...` 是装饰器语法，可以作用于函数或类；它的具体作用取决于所使用的装饰器。

Python 数据模型通过特殊方法将对象与语言操作连接起来。例如，`len(obj)` 对应长度协议中的 `__len__`，迭代涉及 `__iter__` 和 `__next__`，调用对象涉及 `__call__`。对象实现相应的方法后，就可以参与对应的操作。

`@classmethod` 和 `@staticmethod` 的参数绑定方式不同：

- `@classmethod` 定义类方法，隐式接收类本身作为第一个参数，通常命名为 `cls`。类方法可以用来实现备选构造器。
- `@staticmethod` 定义静态方法，不隐式接收实例或类，可以用于组织与类相关的函数。

这两种装饰器本身都不意味着方法一定会创建实例，是否创建实例取决于方法体的实现。

## 7. 迭代器与生成器

迭代器通过 `next()` 逐个提供元素，耗尽时抛出 `StopIteration`。包含 `yield` 的函数是生成器函数，调用后返回一个生成器对象，生成器也是迭代器。

下面的生成器按批次读取文本文件：

```python
from collections.abc import Iterator

def read_batches(path: str, batch_size: int) -> Iterator[list[str]]:
    batch: list[str] = []
    with open(path, encoding="utf-8") as file:
        for line in file:
            batch.append(line.rstrip("\n"))
            if len(batch) == batch_size:
                yield batch
                batch = []
    if batch:
        yield batch
```

这段代码以正整数 `batch_size` 为批次大小。每当一个批次达到指定大小，就通过 `yield` 产出该列表；文件读取结束后，如果还有不足一个完整批次的数据，也会产出。

调用 `read_batches(...)` 时，函数体尚未执行。第一次调用 `next()` 或开始迭代时，函数体才开始运行。执行到 `yield` 后，函数产出一个值并暂停；下一次迭代从暂停处继续。

逐批消费且不保留所有批次时，函数内保存的数据量通常与单个批次相关。生成器耗尽后不能从头重新遍历，需要重新调用生成器函数创建新的对象。函数体中的异常也会在执行到相关语句的迭代阶段出现。

使用 `list(read_batches(...))` 会消费生成器并保存所有产出的批次，使全部结果同时驻留内存。

## 8. 装饰器

装饰器接收一个函数，并返回用于替换原函数的对象。常见用法是返回一个包装函数，在调用原函数前后添加计时等行为。

```python
@timed
def process():
    ...
```

在 `timed` 已定义的前提下，上面的写法相当于：

```python
def process():
    ...

process = timed(process)
```

装饰后的 `process` 绑定到 `timed(process)` 的返回值，调用时执行该返回对象提供的行为。

## 9. 异常处理与异常链

`try` 包含需要捕获异常的代码，`except` 用于处理匹配的异常类型。如果需要将底层异常转换为另一种异常，同时保留原因，可以在处理过程中使用 `raise ... from ...`。

```python
try:
    value = int("abc")
except ValueError as exc:
    raise ValueError("输入无法转换为整数") from exc
```

这里的 `except ValueError as exc` 捕获转换失败产生的异常，`raise ... from exc` 抛出新的异常，并将 `exc` 记录为它的直接原因。`from` 属于 `raise` 的语法。

异常处理的性能需要区分正常执行路径与异常发生路径。抛出和捕获异常会产生额外开销；在频繁执行的代码中，如果异常不断发生，就需要关注这部分成本。是否使用异常处理，应结合实际异常频率与测量结果判断。
