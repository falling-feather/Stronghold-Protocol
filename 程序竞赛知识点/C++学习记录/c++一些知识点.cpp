// todo : 用于标记待办事项
// ? ：用于标记临时修改的代码
// note ：标题
// ! ：用于标记重要注释
// zw : 正文


// NOTE : 1，创建动态数组：
vector<int> b
对于一些一般的静态数组，我们判定首位末位时会采用类似a，a+a.size()的方式
但是对于动态数组不能这样做，我们会采用b.begin(),b.end()的方式

// NOTE：2.c++排序：
c++中也可以使用sort进行排序，使用规则是：
sort(首位，末位，规则)
其中首位会是指向待排序数组第一个元素的指针，而末位会是指向待排序数组最后一个元素的下一位的指针。就类似1中所说的a和a+n
规则位置其实是作为排序准则的参数，可写可不写
例如：
如果我们考虑将一个数组进行降序排列，就可以在规则位置写入greater<int>()  (升序是less)
即：
    int num[10] = {6,5,9,1,2,8,7,3,4,0};
        sort(num,num+10,greater<int>());
从而实现对于num数组的降序排列
类似的，我们也可以实现对于数组内元素个位数的排序，通过定义一个bool的规则来实现：
即：
    bool cmp(int x,int y){
        return x % 10 > y % 10;
    }

    int main(){
        int num[10] = {65,59,96,13,21,80,72,33,44,99};
        sort(num,num+10,cmp);
        for(int i=0;i<10;i++){
            cout<<num[i]<<" ";
        }//输出结果：59 99 96 65 44 13 33 72 21 80
        
        return 0;
        
3，c++中没有类似python中result=" ".join()的输出方法，如果想按照“用空格隔开且首尾没有多余的空格”的方式输出，只能纯粹的通过计数符等方法来实现。

4,在python中，我们可以利用字典{a：1}来实现一个类似字母计数查询的效果
在c++中没有字典，但是可以通过map来实现
其用法为：map<数据类型1,数据类型2> name;
这样就会创建一个名为name的map，数据类型1为键，数据类型2为值，实现类似字典的功能

5，c++中我们在进行循环遍历时，可以直接对char型变量进行赋值遍历，这一点往往是要配合第4点使用
具体为：
    for(char i='a';i<='z';i++)
这样i就会在a到z之间进行遍历

6，在c++中我们实现类似python的for i in a用法可以借助“：”迭代，具体方案为：
假设已经有一个数组a
    for(int i:a)
    {
        
    }
这样i就会以此在a中每一位进行迭代取值，实现遍历的效果。

// note: 7，快读：
    ios::sync_with_stdio(false);
    cin.tie(0);
    这两段代码的作用是关闭cin和cout的缓冲区，使得cin和cout的输入输出速度更快。
// note: 8,队列与双端队列
在C++中，队列(queue)和双端队列(deque)是两种常用的容器适配器。以下是它们的设置方法和常见操作函数：
队列(queue)的设置与操作
    #include <queue>
    std::queue<int> q;  // 声明一个存储int类型的队列
常见操作函数
    q.push(element)：在队尾添加元素
    q.pop()：移除队首元素
    q.front()：访问队首元素
    q.back()：访问队尾元素
    q.empty()：检查队列是否为空
    q.size()：返回队列中元素个数
双端队列(deque)的设置与操作
    #include <deque>
    std::deque<int> dq;  // 声明一个存储int类型的双端队列
常见操作函数
    dq.push_front(element)：在队首插入元素
    dq.push_back(element)：在队尾插入元素
    dq.pop_front()：删除队首元素
    dq.pop_back()：删除队尾元素
    dq.front()：访问队首元素
    dq.back()：访问队尾元素
    dq.at(index)：访问指定位置元素
    dq.empty()：检查是否为空
    dq.size()：返回元素个数
    dq.clear()：清空所有元素

1. 基本二分查找函数
C++ STL 提供了几个常用的二分查找函数，都定义在 <algorithm> 头文件中：

binary_search: 判断元素是否存在
lower_bound: 查找第一个不小于目标值的位置
upper_bound: 查找第一个大于目标值的位置
equal_range: 同时返回 lower_bound 和 upper_bound
2. binary_search 函数
cpp
// 基本语法
bool binary_search(iterator first, iterator last, const T& value);
bool binary_search(iterator first, iterator last, const T& value, Compare comp);
功能: 在已排序的范围内查找指定元素
前提: 容器必须已经排序
返回值: 找到返回 true，否则返回 false
cpp
vector<int> vec = {1, 3, 5, 7, 9};
bool found = binary_search(vec.begin(), vec.end(), 5); // true
3. lower_bound 函数
cpp
// 基本语法
iterator lower_bound(iterator first, iterator last, const T& value);
iterator lower_bound(iterator first, iterator last, const T& value, Compare comp);
功能: 返回指向第一个不小于 value 元素的迭代器
用途: 可用于插入位置的查找
cpp
vector<int> vec = {1, 3, 5, 7, 9};
auto it = lower_bound(vec.begin(), vec.end(), 6);
// it 指向元素 7，即 vec[3]
4. upper_bound 函数
cpp
// 基本语法
iterator upper_bound(iterator first, iterator last, const T& value);
iterator upper_bound(iterator first, iterator last, const T& value, Compare comp);
功能: 返回指向第一个大于 value 元素的迭代器
区别: 与 lower_bound 的区别在于边界条件
cpp
vector<int> vec = {1, 3, 5, 5, 7, 9};
auto it1 = lower_bound(vec.begin(), vec.end(), 5); // 指向第一个5
auto it2 = upper_bound(vec.begin(), vec.end(), 5); // 指向7
5. equal_range 函数
cpp
// 基本语法
pair<iterator, iterator> equal_range(iterator first, iterator last, const T& value);
pair<iterator, iterator> equal_range(iterator first, iterator last, const T& value, Compare comp);
功能: 同时返回 lower_bound 和 upper_bound
返回值: pair 类型，first 成员是 lower_bound，second 成员是 upper_bound
cpp
vector<int> vec = {1, 3, 5, 5, 7, 9};
auto range = equal_range(vec.begin(), vec.end(), 5);
// range.first 指向第一个5，range.second 指向7
6. 使用注意事项
预排序: 所有二分查找函数都要求容器预先排序
时间复杂度: O(log n)
返回类型: 返回迭代器，需要检查是否有效
自定义比较: 可以传入自定义比较函数
7. 实际应用示例
cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    vector<int> data = {1, 2, 4, 4, 4, 6, 8};
    
    // 查找元素是否存在
    if (binary_search(data.begin(), data.end(), 4)) {
        cout << "找到了元素4" << endl;
    }
    
    // 查找插入位置
    auto pos = lower_bound(data.begin(), data.end(), 5);
    cout << "应在位置 " << (pos - data.begin()) << " 插入5" << endl;
    
    // 统计某个元素出现次数
    auto range = equal_range(data.begin(), data.end(), 4);
    int count = range.second - range.first;
    cout << "元素4出现了 " << count << " 次" << endl;
    
    return 0;
}
这些二分查找函数是处理有序数据的重要工具，在算法竞赛和实际开发中都有广泛应用。


