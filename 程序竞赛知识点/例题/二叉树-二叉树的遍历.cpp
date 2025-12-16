//note 二叉树的遍历
//! 时间限制
// 1.00s
//! 内存限制
// 128.00MiB
//! 题目描述
// 有一个 n(n≤10^6) 个结点的二叉树。给出每个结点的两个子结点编号（均不超过 n），建立一棵二叉树（根节点的编号为 1），如果是叶子结点，则输入 0 0。
// 建好树这棵二叉树之后，依次求出它的前序、中序、后序列遍历。
//! 输入格式
// 第一行一个整数 n，表示结点数。
// 之后 n 行，第 i 行两个整数 l、r，分别表示结点 i 的左右子结点编号。若 l=0 则表示无左子结点，r=0 同理。
//! 输出格式
// 输出三行，每行 n 个数字，用空格隔开。
// 第一行是这个二叉树的前序遍历。
// 第二行是这个二叉树的中序遍历。
// 第三行是这个二叉树的后序遍历。
//! 输入输出样例
//? 输入#1
// 7
// 2 7
// 4 0
// 0 0
// 0 3
// 0 0
// 0 5
// 6 0
//? 输出#1
// 1 2 4 3 7 6 5
// 4 3 2 1 6 5 7
// 3 4 2 5 6 7 1 

// todo AI解析
// note 二叉树遍历详解
// 题目背景
// 这道题是关于二叉树的三种遍历方式：前序遍历、中序遍历和后序遍历。通过递归的方式实现对二叉树的完整遍历。

//zw 树的存储结构

// struct Node
// {
//     int left, right;
// }tree[1000005];

// 使用静态数组存储二叉树
// 每个 Node 结构体包含两个整数：left（左子节点编号）和 right（右子节点编号）
// tree[i] 表示编号为 i 的节点
// 用 0 表示空节点（即没有子节点）

// 这种设计基于二叉树的定义：

//? 二叉树特性：每个节点最多只有两个子节点——左子节点和右子节点
//? 索引映射：用数组下标直接对应节点编号，实现 O(1) 时间复杂度的节点访问
//? 存储效率：只存储必要的连接信息，避免额外的指针开销


// 三种遍历算法
//zw 1. 前序遍历 (Pre-order Traversal)
// void leftans(int root)
// {
//     if (root == 0) return;
//     else 
//     {
//         leftroot.push_back(root);  // 先访问根节点
//         leftans(tree[root].left);  // 再遍历左子树
//         leftans(tree[root].right); // 最后遍历右子树
//     }
// }
//? 遍历顺序：根 → 左子树 → 右子树

//zw 2. 中序遍历 (In-order Traversal)
// 代码略
//? 遍历顺序：左子树 → 根 → 右子树

//zw 3. 后序遍历 (Post-order Traversal)
// 代码略
//? 遍历顺序：左子树 → 右子树 → 根

// 执行流程
// leftans(1);   // 从根节点1开始前序遍历
// midans(1);    // 从根节点1开始中序遍历
// rightans(1);  // 从根节点1开始后序遍历
// 结果输出
// for (int i = 0; i < n; i++)
// {
//     cout << leftroot[i] << " ";
// }
// cout << endl;
// // 类似输出中序和后序结果

//! 图解示例
// 假设有如下二叉树：

//       1
//      / \
//     2   3
//    / \
//   4   5
// 对应的输入：

// 5
// 2 3    // 节点1的左右子节点
// 4 5    // 节点2的左右子节点
// 0 0    // 节点3的左右子节点
// 0 0    // 节点4的左右子节点
// 0 0    // 节点5的左右子节点

// 遍历结果：

// 前序遍历：1 2 4 5 3（根→左→右）
// 中序遍历：4 2 5 1 3（左→根→右）
// 后序遍历：4 5 2 3 1（左→右→根）
// 关键知识点
//zw 递归思想：三种遍历都采用递归实现，将复杂问题分解为相同类型的子问题
//zw 终止条件：当节点编号为 0 时停止递归（空节点）
//zw 访问时机：
//zw 前序：在递归调用前访问节点
//zw 中序：在两次递归调用中间访问节点
//zw 后序：在两次递归调用后访问节点
//zw 数组模拟树：使用静态数组存储树结构，节省空间且访问效率高
// 这种实现方式特别适合处理静态二叉树问题，是算法竞赛中的常用技巧。


#include <bits/stdc++.h>
using namespace std;

struct Node
{
    int left, right;
}tree[1000005];

vector<int> leftroot, midroot, rightroot;
void leftans(int root)
{
    if (root == 0) return;
    else 
    {
        leftroot.push_back(root);
        leftans(tree[root].left);
        leftans(tree[root].right);
    }
}
void midans(int root)
{
    if (root == 0) return;
    else 
    {
        midans(tree[root].left);
        midroot.push_back(root);
        midans(tree[root].right);
    }
}
void rightans(int root)
{
    if (root == 0) return;
    else 
    {
        rightans(tree[root].left);
        rightans(tree[root].right);
        rightroot.push_back(root);
    }
}
int main() 
{
    int n;
    cin >> n;
    for (int i = 1; i <= n; i++)    
    {
        int l, r;
        cin >> tree[i].left >> tree[i].right;
    }
    leftans(1);
    midans(1);
    rightans(1);

    for (int i = 0; i < n; i++)
    {
        cout << leftroot[i] << " ";
    }
    cout << endl;
    for (int i = 0; i < n; i++)
    {
        cout << midroot[i] << " ";
    }
    cout << endl;
    for (int i = 0; i < n; i++)
    {
        cout << rightroot[i] << " ";
    }
    return 0;
}