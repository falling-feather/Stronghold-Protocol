# 7-7 二分边界

# 给你一个整数数组 nums ,和一个整数 target ，请在数组中找到元素等于 target 的区域。
# 若 nums 查找不到 target，则返回 []。
# 请使用O(log n) 的算法解决本题~

# 输入:
# 第一行输入2个整数，分别表示数组长度 n 和目标值 target
# 第二行输入 n 个整数表示数组 nums  

# 6 8
# 5 7 7 8 8 10
# 输出:
# 输出找到的目标值区域

# [3, 4]
# 范围:
# 0 <= nums.length <= 10 6
# -10 9<= nums[i] <= 10 9
# nums 是一个非递减数组
# -10 9<= target <= 10 9
# 这是一个经典的 二分查找变种（二分边界） 题，目标是：

# 在一个非递减有序数组中找到所有等于 target 的元素的起始和结束下标。
# 要求时间复杂度为 O(log n)。
# 正确思路：两次二分查找
# 我们可以分别写两个函数：

# 1. 找第一个等于 target 的位置（左边界）
# 当 nums[mid] < target 时，往右找
# 否则，往左收缩范围
# 2. 找最后一个等于 target 的位置（右边界）
# 当 nums[mid] > target 时，往左找
# 否则，往右收缩范围

def fl(nums, target):
    l, r = 0, len(nums) - 1
    while l <= r:
        mid = (l + r) // 2
        if nums[mid] < target:
            l = mid + 1
        else:
            r = mid - 1
    return l if l < len(nums) and nums[l] == target else -1

def fr(nums, target):
    l, r = 0, len(nums) - 1
    while l <= r:
        mid = (l + r) // 2
        if nums[mid] > target:
            r = mid - 1
        else:
            l = mid + 1
    return r if nums[r] == target else -1

n, target = map(int, input().split())
nums = list(map(int, input().split()))

left = fl(nums, target)
if left == -1:
    print("[]")
else:
    right = fr(nums, target)
    print(f"[{left}, {right}]")