import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int T = scanner.nextInt();
        
        for (int t = 0; t < T; t++) {
            int n = scanner.nextInt();
            printMonsterHead(n);
            
            if (t != T - 1) {
                System.out.println();
            }
        }
        
        scanner.close();
    }
    
    public static void printMonsterHead(int n) {
        int width = 3 * n;
        
        for (int i = 0; i < n - 1; i++) System.out.print(" ");
        System.out.print("*");
        for (int i = 0; i < n; i++) System.out.print(" ");
        System.out.print("*");
        System.out.println();
        
        for (int i = 0; i < n - 2; i++) {
            for (int j = 0; j < n - 2 - i; j++) System.out.print(" ");
            System.out.print("*");
            for (int j = 0; j < i; j++) System.out.print(" ");
            System.out.print("*");
            for (int j = 0; j < n; j++) System.out.print(" ");
            System.out.print("*");
            for (int j = 0; j < i; j++) System.out.print(" ");
            System.out.print("*");
            System.out.println();
        }
        
        for (int i = 0; i < width; i++) System.out.print("*");
        System.out.println();
        
        for (int i = 0; i < n - 2; i++) {
            System.out.print("*");
            for (int j = 0; j < width - 2; j++) System.out.print(" ");
            System.out.println("*");
        }
        
        for (int i = 0; i < width; i++) System.out.print("*");
        System.out.println();
    }
}