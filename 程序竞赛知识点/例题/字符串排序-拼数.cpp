// P1012 [NOIP 1998 提高组] 拼数
// 题目描述
// 设有 n 个正整数 a1…an ，将它们联接成一排，相邻数字首尾相接，组成一个最大的整数。
// 输入格式
// 第一行有一个整数，表示数字个数 。
// 第二行有 n 个整数，表示给出的  n 个整数 ai 。
// 输出格式
// 一个正整数，表示最大的整数
// 输入输出样例
// 输入 #1
// 3
// 13 312 343
// 输出 #1
// 34331213
// 输入 #2
// 4
// 7 13 4 246
// 输出 #2
// 7424613
// 说明/提示
// 对于全部的测试点，保证 1≤n≤20,1≤ai≤10^9 
// NOIP1998 提高组 第二题

#include <bits/stdc++.h>
using namespace std;

bool big(string a, string b)
{
    if (a + b > b + a)
    {
        return 1;
    }
    else
    {
        return 0;

    }
}
int main()
{
    int n ;
    cin >> n;
    string a[n];
    for (int i = 0; i < n; i++)
    {
        cin >> a[i];
    }
    sort(a, a + n, big);
    for (int i = 0; i < n; i++)
    {
        cout << a[i];
    }
    return 0;
}

