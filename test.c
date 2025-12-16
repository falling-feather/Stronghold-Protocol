#include<iostream>
#include<algorithm>
#include<cstring>
#include<map>
#include<string>
#include<cmath>
using namespace std;
int main(){
	int n;
	int a[30]={0};
	cin>>n;
	string str;
	cin>>str;
	for(int i=0;i<str.length();i++)	
		a[str[i]-'a']++;
	int cnt=0;
	for(int i=0;i<30;i++)
		if(a[i]%2)
			cnt++;
	if(cnt>1)
		cout<<"Impossible"<<endl;
	else{
		int ans=0;
		while(str.size()>1)
		{
			string first;
			first+=str[0];
			str.erase(0,1);//删除第一个字母 
			if(str.find(first)==-1)//在字符串中找和第一个字母相同的字母，-1表示没找到 
				ans+=str.size()/2;//交换到中间的代价 							 
			else//如何找到了，就删除那个字母的位置，计算其代价 
			{
				string s(str.rbegin(),str.rend()); 
				int w=s.find(first);//寻找第一个字母的位置 
				ans+=w;
				str.erase(str.size()-w-1,1);
			}				
		}
		cout<<ans<<endl;
	}
	
} 