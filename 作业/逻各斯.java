// import java.awt.*;
// import java.util.ArrayList;
// import java.util.List;
// import java.util.concurrent.Executors;
// import java.util.concurrent.ScheduledExecutorService;
// import java.util.concurrent.TimeUnit;
// import javax.swing.*;

// // 主类
// public class 逻各斯 {
//     private static JFrame frame;
//     private static JLabel magicLabel;
//     private static JLabel elementLabel;
//     private static ChartPanel chartPanel;
//     private static ScheduledExecutorService scheduler;
    
//     // 存储模拟结果
//     private static List<Long> magicDamageList = new ArrayList<>();
//     private static List<Long> elementDamageList = new ArrayList<>();
//     private static int simulationCount = 0;
//     private static long totalMagicDamage = 0;
//     private static long totalElementDamage = 0;
//     private static final int MAX_SIMULATIONS = 100000;
//     private static final int SIMULATIONS_PER_UPDATE = 100;
//     private static final int Y_AXIS_MAX = 100000; // 固定Y轴最大值

//     public static void main(String[] args) {
//         // 创建GUI界面
//         createGUI();
        
//         // 开始模拟过程
//         startSimulation();
//     }
    
//     private static void createGUI() {
//         frame = new JFrame("角色伤害模拟（蒙特卡洛法动态模拟）");
//         magicLabel = new JLabel("平均总法术伤害: 0");
//         elementLabel = new JLabel("平均总元素伤害: 0");
        
//         JPanel labelPanel = new JPanel();
//         labelPanel.setLayout(new BoxLayout(labelPanel, BoxLayout.Y_AXIS));
//         labelPanel.add(magicLabel);
//         labelPanel.add(elementLabel);
//         labelPanel.add(new JLabel("模拟次数: 0/" + MAX_SIMULATIONS));
//         labelPanel.add(new JLabel("状态: 模拟进行中..."));

//         chartPanel = new ChartPanel(new ArrayList<>(), new ArrayList<>());

//         frame.setLayout(new BorderLayout());
//         frame.add(labelPanel, BorderLayout.NORTH);
//         frame.add(chartPanel, BorderLayout.CENTER);
//         frame.setSize(900, 600); // 调整窗口高度为600
//         frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
//         frame.setVisible(true);
//     }
    
//     private static void startSimulation() {
//         scheduler = Executors.newSingleThreadScheduledExecutor();
        
//         // 每1000ms（1秒）执行一次模拟更新
//         scheduler.scheduleAtFixedRate(() -> {
//             // 执行一批模拟（最多SIMULATIONS_PER_UPDATE次）
//             int simulationsThisRound = Math.min(SIMULATIONS_PER_UPDATE, MAX_SIMULATIONS - simulationCount);
            
//             for (int i = 0; i < simulationsThisRound; i++) {
//                 long[] result = runSingleSimulation();
//                 totalMagicDamage += result[0];
//                 totalElementDamage += result[1];
                
//                 // 保存每次模拟的结果
//                 magicDamageList.add(result[0]);
//                 elementDamageList.add(result[1]);
//                 simulationCount++;
//             }
            
//             // 更新UI
//             updateUI();
            
//             // 检查是否完成所有模拟
//             if (simulationCount >= MAX_SIMULATIONS) {
//                 scheduler.shutdown();
//                 SwingUtilities.invokeLater(() -> {
//                     JLabel statusLabel = (JLabel) ((JPanel) frame.getContentPane().getComponent(0)).getComponent(3);
//                     statusLabel.setText("状态: 模拟已完成");
//                 });
//             }
//         }, 0, 1000, TimeUnit.MILLISECONDS); // 立即开始，每1000ms执行一次
//     }
    
//     private static long[] runSingleSimulation() {
//         // 初始化伤害计算器
//         AttackCalculator calculator = new AttackCalculator(855);
//         calculator.activateSkill();

//         int attackCount = 0;
//         long simTotalMagicDamage = 0;
//         long simTotalElementDamage = 0;

//         // 单次30秒模拟
//         while (attackCount * 1600 < 30000) { // 每次攻击间隔1.6秒，最多18次
//             Damage damage = calculator.calculateAttack();
//             simTotalMagicDamage += damage.magicDamage;
//             simTotalElementDamage += damage.elementDamage;
//             attackCount++;
//         }

//         calculator.deactivateSkill();
        
//         return new long[]{simTotalMagicDamage, simTotalElementDamage};
//     }
    
//     private static void updateUI() {
//         if (simulationCount == 0) return;
        
//         SwingUtilities.invokeLater(() -> {
//             // 计算平均伤害
//             double avgMagicDamage = (double) totalMagicDamage / simulationCount;
//             double avgElementDamage = (double) totalElementDamage / simulationCount;
            
//             // 更新标签
//             magicLabel.setText("平均总法术伤害: " + String.format("%.2f", avgMagicDamage));
//             elementLabel.setText("平均总元素伤害: " + String.format("%.2f", avgElementDamage));
            
//             JLabel countLabel = (JLabel) ((JPanel) frame.getContentPane().getComponent(0)).getComponent(2);
//             countLabel.setText("模拟次数: " + simulationCount + "/" + MAX_SIMULATIONS);
            
//             // 准备图表数据（使用最近1000次模拟的数据，避免图表过于拥挤）
//             int dataSize = Math.min(1000, magicDamageList.size());
//             List<Integer> chartMagicData = new ArrayList<>();
//             List<Integer> chartElementData = new ArrayList<>();
            
//             // 计算移动平均，每10个数据点取一个平均值
//             int pointsPerAverage = Math.max(1, dataSize / 100);
//             for (int i = 0; i < dataSize; i += pointsPerAverage) {
//                 long magicSum = 0;
//                 long elementSum = 0;
//                 int count = 0;
                
//                 // 修复关键错误：正确计算数据索引
//                 int startIndex = magicDamageList.size() - dataSize;
//                 for (int j = 0; j < pointsPerAverage && (i + j) < dataSize; j++) {
//                     int index = startIndex + i + j;
//                     if (index < magicDamageList.size()) {
//                         magicSum += magicDamageList.get(index);
//                         elementSum += elementDamageList.get(index);
//                         count++;
//                     }
//                 }
                
//                 if (count > 0) {
//                     chartMagicData.add((int) (magicSum / count));
//                     chartElementData.add((int) (elementSum / count));
//                 }
//             }
            
//             // 更新图表
//             chartPanel.updateData(chartMagicData, chartElementData, simulationCount - dataSize, simulationCount);
            
//             // 刷新界面
//             frame.repaint();
//         });
//     }
// }

// // 伤害数据类（封装单次攻击造成的伤害）
// class Damage {
//     public final int magicDamage;
//     public final int elementDamage;

//     public Damage(double magicDamage, double elementDamage) {
//         this.magicDamage = (int) magicDamage;
//         this.elementDamage = (int) elementDamage;
//     }
// }

// // 攻击计算器类
// class AttackCalculator {
//     private double baseAttack;
//     private boolean skillActive;
//     private int elementDamageAccumulated;
//     private boolean elementBurstActive;
//     private long burstStartTime;

//     public AttackCalculator(double baseAttack) {
//         this.baseAttack = baseAttack;
//         this.skillActive = false;
//         this.elementBurstActive = false;
//     }

//     public void activateSkill() {
//         this.skillActive = true;
//     }

//     public void deactivateSkill() {
//         this.skillActive = false;
//     }

//     public boolean isElementBurstActive() {
//         if (elementBurstActive && System.currentTimeMillis() - burstStartTime >= 15000) {
//             elementBurstActive = false;
//         }
//         return elementBurstActive;
//     }

//     public Damage calculateAttack() {
//         double attack = skillActive ? baseAttack * 3 : baseAttack;
//         double totalMagicDamage = attack + 150; // 基础攻击+追加伤害

//         // 额外60%概率造成60%攻击伤害
//         if (Math.random() < 0.6) {
//             totalMagicDamage += attack * 0.6;
//         }

//         // 元素损伤累计（法术伤害的8%）
//         int magicToElement = (int) (totalMagicDamage * 0.08);
//         elementDamageAccumulated += magicToElement;

//         // 检查是否触发元素爆发
//         if (elementDamageAccumulated >= 1000 && !elementBurstActive) {
//             elementBurstActive = true;
//             burstStartTime = System.currentTimeMillis();
//             elementDamageAccumulated = 0; // 重置累计
//         }

//         int totalElementDamage = magicToElement;
//         if (isElementBurstActive()) {
//             totalElementDamage += (int) totalMagicDamage; // 追加等量元素伤害
//         }

//         return new Damage(totalMagicDamage, totalElementDamage);
//     }
// }

// // 折线图面板
// class ChartPanel extends JPanel {
//     private List<Integer> magicData;
//     private List<Integer> elementData;
//     private int startIndex;
//     private int endIndex;
//     private static final int Y_AXIS_MAX = 100000; // 固定Y轴最大值

//     public ChartPanel(List<Integer> magicData, List<Integer> elementData) {
//         this.magicData = magicData;
//         this.elementData = elementData;
//         setPreferredSize(new Dimension(800, 500)); // 调整图表高度
//     }

//     @Override
//     protected void paintComponent(Graphics g) {
//         super.paintComponent(g);
//         Graphics2D g2d = (Graphics2D) g;
//         g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

//         int width = getWidth();
//         int height = getHeight();
        
//         // 如果没有数据则不绘制
//         if (magicData.isEmpty() || elementData.isEmpty()) {
//             g2d.setColor(Color.BLACK);
//             g2d.drawString("等待模拟数据...", width/2 - 50, height/2);
//             return;
//         }

//         // 固定Y轴最大值为100000
//         int globalMax = Y_AXIS_MAX;

//         // 绘制水平网格线（每20000一个刻度）
//         g2d.setColor(Color.LIGHT_GRAY);
//         for (int i = 0; i <= 5; i++) {
//             int y = height - i * (height / 5);
//             g2d.drawLine(0, y, width, y);
//         }

//         // 绘制法术伤害曲线
//         g2d.setColor(Color.BLUE);
//         g2d.setStroke(new BasicStroke(2));
//         for (int i = 1; i < magicData.size(); i++) {
//             int x1 = (i - 1) * width / Math.max(1, magicData.size() - 1);
//             int y1 = height - (int)((double)magicData.get(i - 1) * height / globalMax);
//             int x2 = i * width / Math.max(1, magicData.size() - 1);
//             int y2 = height - (int)((double)magicData.get(i) * height / globalMax);
//             g2d.drawLine(x1, y1, x2, y2);
//         }

//         // 绘制元素伤害曲线
//         g2d.setColor(Color.RED);
//         g2d.setStroke(new BasicStroke(2));
//         for (int i = 1; i < elementData.size(); i++) {
//             int x1 = (i - 1) * width / Math.max(1, elementData.size() - 1);
//             int y1 = height - (int)((double)elementData.get(i - 1) * height / globalMax);
//             int x2 = i * width / Math.max(1, elementData.size() - 1);
//             int y2 = height - (int)((double)elementData.get(i) * height / globalMax);
//             g2d.drawLine(x1, y1, x2, y2);
//         }

//         // 绘制坐标轴
//         g2d.setColor(Color.BLACK);
//         g2d.setStroke(new BasicStroke(1));
//         g2d.drawLine(0, height - 1, width, height - 1); // X轴
//         g2d.drawLine(0, 0, 0, height); // Y轴

//         // 标注X轴刻度（显示模拟批次范围）
//         int totalRange = endIndex - startIndex;
//         for (int i = 0; i <= 10 && magicData.size() > 1; i++) {
//             int index = i * (magicData.size() - 1) / 10;
//             if (index < magicData.size()) {
//                 int x = i * (width / 10);
//                 int displayIndex = startIndex + (i * totalRange / 10);
//                 g2d.drawString(String.valueOf(displayIndex), x, height - 5);
//                 g2d.drawLine(x, height - 5, x, height);
//             }
//         }
        
//         // 标注Y轴刻度（每20000标一个点）
//         for (int i = 0; i <= 5; i++) {
//             int yValue = i * 20000;
//             int y = height - i * (height / 5);
//             g2d.drawString(String.valueOf(yValue), 5, y + 5);
//             g2d.drawLine(0, y, 5, y);
//         }
        
//         // 添加图例
//         g2d.setColor(Color.BLUE);
//         g2d.fillRect(width - 100, 10, 15, 15);
//         g2d.setColor(Color.BLACK);
//         g2d.drawString("法术伤害", width - 80, 22);
        
//         g2d.setColor(Color.RED);
//         g2d.fillRect(width - 100, 30, 15, 15);
//         g2d.setColor(Color.BLACK);
//         g2d.drawString("元素伤害", width - 80, 42);
//     }
    
//     public void updateData(List<Integer> magicData, List<Integer> elementData, int startIndex, int endIndex) {
//         this.magicData = new ArrayList<>(magicData);
//         this.elementData = new ArrayList<>(elementData);
//         this.startIndex = startIndex;
//         this.endIndex = endIndex;
//         repaint();
//     }
// }