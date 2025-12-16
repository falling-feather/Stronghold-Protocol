# P2557 [AHOI2002] 芝麻开门
# 时间限制1.00s
# 内存限制125.00MiB
# 题目描述
# 周末小可可参加智力大冲浪活动，经过努力终于来到最后一关“芝麻开门”。门上的电子显示屏写着这么一段话：如果你能把 n^k 的所有正整数因子的和正确地写在门上，并念一声“芝麻开门”，门就能够自由打开。
# 例如：n=2，k=3，则 n^k=8，它的正因子有 1,2,4,8，如果小可可把它们的和 15 写在门上，然后念一声“芝麻开门”，门就能够自动打开。
# 已知门上的 n,k 都是每过一段时间就会变化一次，请你编写程序协助小可可在规定的时间内求出答案，从而获得智力大冲浪的最终大奖。
# 输入格式
# 一行两个正整数 n,k。
# 输出格式
# 一行一个整数表示答案。
# 输入输出样例
# 输入#1
# 1 1
# 输出#1
# 1
# 输入#2
# 2 2
# 输出#2
# 7
# 说明/提示
# 1≤n≤2^16，1≤k<20。
# 解的位数不超过 100 位。



# AI版解析：
# 问题本质
# 这道题要求计算 n^k 的所有正因子之和。例如当 n=6, k=2 时，需要计算 36 的所有因子 (1,2,3,4,6,9,12,18,36) 之和为 91。

# 两种解法对比
# 方法一：暴力枚举法（基础思路）
# python
# def sousuo(n):
#     sumans = 0
#     i = 1
#     while (i * i <= n):
#         if n % i == 0:
#             sumans += i
#             if i != n // i:
#                 sumans += n // i
#         i += 1
#     return sumans

# m = n ** k
# print(sousuo(m))
# 思路：直接计算出 n^k，然后枚举所有可能的因子
# 时间复杂度：O(√(n^k))，当k较大时效率极低
# 问题：n^k 可能非常大，导致计算缓慢甚至溢出
# 方法二：数论优化法（推荐思路）
# 基于约数和函数的积性性质进行优化：

# 质因数分解：将 n 分解为 p1^a1 × p2^a2 × ... × pm^am
# 幂次变换：n^k = p1^(a1×k) × p2^(a2×k) × ... × pm^(am×k)
# 约数和公式：利用 σ(p^a) = (p^(a+1)-1)/(p-1) 计算每个质因子贡献
# 核心数学原理
# 约数和函数性质
# 对于质数幂 p^a，其所有因子和为：σ(p^a) = 1 + p + p² + ... + p^a
# 利用等比数列求和公式：σ(p^a) = (p^(a+1) - 1) / (p - 1)
# 约数和函数具有积性：σ(a×b) = σ(a) × σ(b) （当a,b互质时）
# 实例演示
# 以 n=6, k=2 为例：

# 6 = 2¹ × 3¹
# 6² = 2² × 3²
# σ(2²) = 1+2+4 = 7，σ(3²) = 1+3+9 = 13
# σ(36) = σ(2²) × σ(3²) = 7 × 13 = 91
# 优化效果
# 时间复杂度：从 O(√(n^k)) 优化到 O(√n)
# 空间复杂度：O(log n)（存储质因数）
# 适用场景：特别适合 k 值较大的情况
# 这种优化体现了从计算思维到数学思维的转变，通过深入理解问题的数学本质来大幅提升算法效率。





n, k = map(int, input().split())
ans = []
yinshu = []

def sousuo(n):
    factors = {}  
    temp = n
    i = 2
    while i * i <= temp:
        if temp % i == 0:
            if i not in factors:
                yinshu.append(i)  
                factors[i] = 0
            while temp % i == 0:
                temp //= i
                factors[i] += 1
        i += 1
    if temp > 1:
        if temp not in factors:
            yinshu.append(temp)
            factors[temp] = 1
    
    for prime in factors:
        factors[prime] *= k  
    
    result = 1
    for prime in yinshu:  
        power = factors[prime]
        if prime == 1:
            prime_sum = power + 1
        else:
            prime_sum = (pow(prime, power + 1) - 1) // (prime - 1)
        result *= prime_sum
    
    return result

print(sousuo(n)) 
