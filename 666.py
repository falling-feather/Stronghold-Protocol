def median(aList):
    aList = [int(x) for x in aList]
    
    n = len(aList)
    for i in range(n):
        mina = i
        for j in range(i+1, n):
            if aList[mina] > aList[j]:
                mina = j
        aList[i], aList[mina] = aList[mina], aList[i]
    if len(aList) % 2 != 0:
        return aList[n//2]
    else:
        s = (aList[n//2-1] + aList[n//2]) / 2
        return s
    
def main():
    age = list(map(int, input().split())) 
    print(median(age))
        
main()