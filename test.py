# import gc
import sys
# 快速输入
input = sys.stdin.readline  # 替代 input()
# # 快速输出
def print(x):
    sys.stdout.write(str(x) + '\n')
# sys.stdout.write("\n")  # 替代 print()
# # 解除递归深度限制
sys.setrecursionlimit(1000000)  # 默认通常是1000
# 设置大整数转字符串的最大位数
# sys.set_int_max_str_digits(50000)
# # 设置浮点数字符串转换的最大位数
# # # sys.float_info  # 查看浮点数信息
# # # # 手动垃圾回收
# gc.collect()
# # 禁用垃圾回收（谨慎使用）
# gc.disable()
# # 设置输出缓冲区
# sys.stdout.flush()  # 强制刷新输出缓冲区

n = int(input())
for i in range(n):
    a, b, c = map(int, input().split())
    ans = (a + b + c) * 0.5
    print(int(ans))
        
