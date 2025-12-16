# 7-4 训练时间
# 在深度学习任务中，我们有 n 个模型需要训练，每个模型的训练时间已知，记作数组 a[i]（表示第 i 个模型的训练时间）。 现在，我们有 m 张 GPU 可供并行训练。
# 为了减少训练总时长，我们需要合理地将 n 个模型顺序地分配给 m 张 GPU，使得所有 GPU 训练完成的最长时间尽可能小。
# 注意：

# 任务必须从左到右连续分配，即某个 GPU 负责的模型必须是数组 a 中的一段连续子序列。
# 每个模型必须且只能被分配给一个 GPU 进行训练。
# GPU 之间可以并行训练，但我们关心的是最晚完成任务的 GPU，即所有 GPU 训练完成的最短可能时间。
# 输入格式:
# 第一行：两个整数 n 和 m（1≤m≤n≤10 5），分别表示模型数和GPU数。
# 第二行：n 个整数 a[i](1≤a[i]≤10 9)，表示每个模型的训练时间，每个数之间用一个空格分隔。

# 输出格式:
# 一个整数，表示最优任务分配方案下，所有 GPU 训练完成的最短可能时间。

# 输入样例:
# 4 2
# 3 1 4 7
# 输出样例:
# 8

# 样例解释
# 可能的任务分配方式如下：

# 方案 1：【3】，【1，4，7】，最长时间12。
# 方案 2：【3，1】，【4，7】，最长时间11。
# 方案 3：【3，1，4】，【7】，最长时间8。
# 最终，最优方案的完成时间为 8。

# 这类问题的解题关键在于判断函数can_split(mid) ，这个函数相当于是对段数进行从头到尾的排判断
# 每次出现超过段数的情况时就停止计算，再开一段，如果最后发现段数超过了题目给出的数量，也就是无法完成分配，那么就返回flase
def can_split(mid):
    count = 1       # 当前用了几段（至少 1 段）
    current_sum = 0 # 当前这一段加起来的时间

    for time in a:  # 遍历每个模型的训练时间
        if current_sum + time > mid:
            # 放不下啦！必须新开一段
            count += 1
            current_sum = time  # 新的一段从当前模型开始
            if count > m:
                return False  # 段数超了，不行！
        else:
            current_sum += time  # 还能放得下，继续加
    return True  # 成功分完，没超段数

n,m=map(int,input().split())
a=list(map(int,input().split()))

left = max(a)
right = sum(a)
answer = right

while left <= right:
    mid = (left + right) // 2
    if can_split(mid):
        answer = mid
        right = mid - 1
    else:
        left = mid + 1

print(answer)