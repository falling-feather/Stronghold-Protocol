n=int(input())
m=int(input())

fu=0

if n<m:
    n,m=m,n
    fu=1

a=list(map(int,str(n)[::-1]))
b=list(map(int,str(m)[::-1]))
    
l=min(len(a),len(b))
dl=max(len(a),len(b))

new=[]
jin=0
chang=0

while(chang<dl):
    if(chang<l):
        ans=a[chang]-b[chang]-jin
    else:
        ans=a[chang]-jin
    jin=0
    if ans<0:
        jin+=1
        ans+=10
    chang+=1
    new.append(ans)

result="".join(map(str,new[::-1])).lstrip("0")
if result=="":
    result="0"

if fu==1:
    result="-"+result

print(result)