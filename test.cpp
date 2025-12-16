#include <bits/stdc++.h>
using namespace std;
#define endl "\n"

void bfs(int start, vector<vector<int>>& ans, vector<bool>& visited) 
{
    queue<int> q;
    q.push(start);
    visited[start] = true;
    
    while (!q.empty()) 
    {
        int node = q.front();
        q.pop();
        cout << node << " ";
        
        for (int i : ans[node]) 
        {
            if (!visited[i]) 
            {
                visited[i] = true;
                q.push(i);
            }
        }
    }
}

int main() 
{
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    cout.tie(nullptr);
    
    int n, e;
    cin >> n >> e;
    
    vector<vector<int>> ans(n);
    
    for (int i = 0; i < e; i++) 
    {
        int a, b;
        cin >> a >> b;
        ans[a].push_back(b);
    }
    
    for (int i = 0; i < n; i++) 
    {
        sort(ans[i].begin(), ans[i].end());
    }
    
    vector<bool> visited(n, false);
    
    bfs(0, ans, visited);
    
    for (int i = 1; i < n; i++) 
    {
        if (!visited[i]) 
        {
            bfs(i, ans, visited);
        }
    }
    
    return 0;
}