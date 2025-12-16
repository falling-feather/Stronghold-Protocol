#7-6 高精度加法
# 给定两个正整数（不含前导 0），计算它们的和。

# 输入格式:
# 共两行，每行包含一个整数。
# 1≤整数长度≤100000

# 输出格式:
# 共一行，包含所求的和。

# 输入样例:
# 12
# 23
# 输出样例:
# 35

#用数组来模拟高精度加法的数位运算，题解如下：

a=list(map(int,input()[::-1]))
b=list(map(int,input()[::-1]))
l=min(len(a),len(b))
dl=max(len(a),len(b))

if len(a)<len(b):
    a,b=b,a

new=[]
jin=0
chang=0

while(chang<dl):
    if(chang<l):
        ans=a[chang]+b[chang]+jin
        jin=0
        if ans>=10:
            jin+=1
            ans%=10
    else:
        ans=a[chang]+jin
        jin=0
    chang+=1
    new.append(ans)
if jin>0:
    new.append(jin)
result="".join(map(str,new[::-1]))
print(result)