# note 进击的奶牛
# !题目描述
# Farmer John 建造了一个有 N（2≤N≤10 5) 个隔间的牛棚，这些隔间分布在一条直线上，坐标是 x 1,x 2,⋯,x N （0≤x i​ ≤10 9 ）。
# 他的 C（2≤C≤N）头牛不满于隔间的位置分布，它们为牛棚里其他的牛的存在而愤怒。
# 为了防止牛之间的互相打斗，Farmer John 想把这些牛安置在指定的隔间，所有牛中相邻两头的最近距离越大越好。那么，这个最大的最近距离是多少呢？

# !输入格式
# 第 1 行：两个用空格隔开的数字 N 和 C。
# 第 2∼N+1 行：每行一个整数，表示每个隔间的坐标。

# !输出格式
# 输出只有一行，即相邻两头牛最大的最近距离。

# !样例 
# !样例输入 
# 5 3
# 1
# 2
# 8
# 4
# 9
# !样例输出 
# 3

# ?这道题与训练时间问题类似，都是通过判断函数实现二分分配法，
# ?但是区别在于训练时间是一个直接排列的数据，而这道题则是要考虑数据的差值，因此在写判断函数的时候也需要从差值的变化考虑，true与false的判断也正好相反。

n,m=map(int,input().split())
a=[]
for _ in range (n):
    t=int(input())
    a.append(t)
a.sort()

def pd(long):
    count=1
    mina=a[0]
    for i in range (1,n):
        if a[i]-mina>=long:
            count+=1
            mina=a[i]
            if count==m:
                return True
    return False

l=0
r=a[n-1]-a[0]
ans=0
while l<r:
    mid=(l+r)//2
    if pd(mid):
        ans=mid
        l=mid+1
    else:
        r=mid
print(ans)