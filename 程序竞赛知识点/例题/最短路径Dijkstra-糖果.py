# 7-2 糖果

# 有 n 个小朋友，编号 1∼n。
# 老师要给他们发糖果。
# 小朋友们的攀比心都很重，现在给出 m 条攀比信息。
# 每条信息包含三个整数 a,b,c，含义是小朋友 a 认为小朋友 b 的糖果数量最多只可以比他多 c 个，否则他就生气。
# 老师在发糖果时，必须照顾所有小朋友的情绪，让他们都感到满意。
# 请问，小朋友 n 最多比小朋友 1 多分到多少个糖果。

# 输入格式:
# 第一行包含两个整数 n,m。
# 接下来 m 行，每行包含三个整数 a,b,c，表示一条攀比信息。
# 2≤n≤30000,1≤m≤150000,1≤a,b≤n,1≤c≤10000。保证一定有解。

# 输出格式:
# 一个整数，表示小朋友 n 最多比小朋友 1 多分到的糖果数量的最大可能值。

# 输入样例:
# 2 2
# 1 2 5
# 2 1 4
# 输出样例:
# 5

import heapq

n,m=map(int,input().split())
point=list(range(1,n+1))
phe=[[]for _ in range (n)]

for _ in range (m):
    a,b,c=map(int,input().split())
    a-=1
    b-=1
    phe[a].append((b,c))

def dij(s,t):
    minl=[float("inf")]*n
    minl[s]=0
    now=[(0,s)]

    while now:
        w,u=heapq.heappop(now)
        if w>minl[u]:
            continue
        for v,wei in phe[u]:
            if minl[v]>minl[u]+wei:
                minl[v]=minl[u]+wei
                heapq.heappush(now,(minl[v],v))
    return minl[t]

result=dij(0,n-1)
print(result)