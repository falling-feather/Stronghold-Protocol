// import java.awt.*;
// import java.awt.event.*;
// import java.io.*;
// import java.util.ArrayList;
// import java.util.Collections;
// import java.util.HashMap;
// import java.util.List;
// import java.util.Map;
// import java.util.Random;
// import java.util.concurrent.Executors;
// import java.util.concurrent.ScheduledExecutorService;
// import java.util.concurrent.TimeUnit;
// import javax.swing.*;

// public class 数据可视化 {
//     private static final List<String> choukaHistory = new ArrayList<>();
//     private static JFrame choukaFrame = null;
//     private static JFrame ziyuanFrame = null;
//     private static JFrame shanghaiFrame = null;
//     private static final String kachiFolder = "D:\\代码\\作业\\数据源\\卡池";
//     private static final String ziyuanFile = "D:\\代码\\作业\\数据源\\资源\\资源记录.txt";
//     private static final String choukaFile = "D:\\代码\\作业\\数据源\\抽卡状况记录.txt";
//     private static final String accountFile = "D:\\代码\\作业\\数据源\\账号密码.txt";
//     private static int weichu6xing = 0;
//     private static double bonus6xing = 0.0;
//     private static JLabel statusLabel;

//     static class ResourceRecord {
//         String type;
//         int quantity;
//         int[] changes;
        
//         public ResourceRecord(String type, int quantity, int[] changes) {
//             this.type = type;
//             this.quantity = quantity;
//             this.changes = changes != null && changes.length >= 3 ? changes : new int[3];
//         }
//     }

//     private static void saveResourceRecords(List<ResourceRecord> records) {
//         File resourceFile = new File(ziyuanFile);
//         File parentDir = resourceFile.getParentFile();
//         if (parentDir != null && !parentDir.exists()) {
//             parentDir.mkdirs();
//         }
        
//         try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(new FileOutputStream(ziyuanFile), "UTF-8"))) {
//             writer.println("资源类型,资源数量,变动情况1,变动情况2,变动情况3");
            
//             for (ResourceRecord record : records) {
//                 if (record.changes == null || record.changes.length < 3) {
//                     int[] safeChanges = new int[3];
//                     if (record.changes != null) {
//                         for (int i = 0; i < Math.min(3, record.changes.length); i++) {
//                             safeChanges[i] = record.changes[i];
//                         }
//                     }
//                     record.changes = safeChanges;
//                 }
                
//                 writer.println(record.type + "," + record.quantity + "," + 
//                             record.changes[0] + "," + record.changes[1] + "," + record.changes[2]);
//             }
//         } catch (IOException e) {
//             if (ziyuanFrame != null && ziyuanFrame.isDisplayable()) {
//                 JOptionPane.showMessageDialog(ziyuanFrame, "保存文件时发生错误: " + e.getMessage());
//             }
//             e.printStackTrace();
//         }
//     }

//     private static void createDefaultResourceFile(File file) {
//         File parentDir = file.getParentFile();
//         if (parentDir != null && !parentDir.exists()) {
//             parentDir.mkdirs();
//         }
//         try {
//             file.createNewFile();
//         } catch (IOException e) {
//             System.err.println("创建资源文件失败: " + e.getMessage());
//         }
//     }

//     private static void saveDrawRecords() {
//         File drawRecordFile = new File(choukaFile);
//         File parentDir = drawRecordFile.getParentFile();
//         if (parentDir != null && !parentDir.exists()) {
//             parentDir.mkdirs();
//         }
        
//         try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(new FileOutputStream(choukaFile), "UTF-8"))) {
//             for (String record : choukaHistory) {
//                 writer.println(record);
//             }
//         } catch (IOException e) {
//             if (choukaFrame != null && choukaFrame.isDisplayable()) {
//                 JOptionPane.showMessageDialog(choukaFrame, "保存抽卡记录时发生错误: " + e.getMessage());
//             }
//             e.printStackTrace();
//         }
//     }

//     private static void loadDrawRecords() {
//         File file = new File(choukaFile);
//         if (!file.exists()) {
//             return;
//         }
        
//         try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), "UTF-8"))) {
//             String line;
//             choukaHistory.clear();
//             weichu6xing = 0;
            
//             while ((line = reader.readLine()) != null) {
//                 line = line.trim();
//                 if (!line.isEmpty()) {
//                     choukaHistory.add(line);
                    
//                     if (line.startsWith("6星")) {
//                         weichu6xing = 0;
//                         bonus6xing = 0.0;
//                     } else {
//                         weichu6xing++;
//                     }
//                 }
//             }
//         } catch (IOException e) {
//             if (choukaFrame != null && choukaFrame.isDisplayable()) {
//                 JOptionPane.showMessageDialog(choukaFrame, "读取抽卡记录时发生错误: " + e.getMessage());
//             }
//             e.printStackTrace();
//         }
//     }

//     public static void main(String[] args) {
//         showLoginWindow();
//     }

//     private static void showLoginWindow() {
//         JFrame loginFrame = new JFrame("用户登录");
//         loginFrame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
//         loginFrame.setSize(400, 200);
//         loginFrame.setLocationRelativeTo(null);
        
//         JPanel panel = new JPanel(new GridBagLayout());
//         GridBagConstraints gbc = new GridBagConstraints();
        
//         JLabel userLabel = new JLabel("账号:");
//         JTextField userText = new JTextField(15);
        
//         JLabel passwordLabel = new JLabel("密码:");
//         JPasswordField passwordText = new JPasswordField(15);
        
//         JButton loginButton = new JButton("登录");
        
//         gbc.insets = new Insets(10, 10, 10, 10);
        
//         gbc.gridx = 0;
//         gbc.gridy = 0;
//         panel.add(userLabel, gbc);
        
//         gbc.gridx = 1;
//         panel.add(userText, gbc);
        
//         gbc.gridx = 0;
//         gbc.gridy = 1;
//         panel.add(passwordLabel, gbc);
        
//         gbc.gridx = 1;
//         panel.add(passwordText, gbc);
        
//         gbc.gridx = 1;
//         gbc.gridy = 2;
//         panel.add(loginButton, gbc);
        
//         loginFrame.add(panel);
//         loginFrame.setVisible(true);
        
//         loginButton.addActionListener(e -> {
//             String username = userText.getText();
//             String password = new String(passwordText.getPassword());
            
//             if (validateCredentials(username, password)) {
//                 loginFrame.dispose();
//                 showFunctionSelectionWindow();
//             } else {
//                 JPanel panel1 = new JPanel(new GridLayout(0, 1));
//                 panel1.add(new JLabel("账号密码输入错误，是否重新注册？"));
                
//                 int result = JOptionPane.showOptionDialog(
//                     loginFrame,
//                     panel1,
//                     "登录失败",
//                     JOptionPane.YES_NO_OPTION,
//                     JOptionPane.QUESTION_MESSAGE,
//                     null,
//                     new Object[]{"是", "否"},
//                     "否"
//                 );
                
//                 if (result == JOptionPane.YES_OPTION) {
//                     showRegistrationWindow(loginFrame);
//                 }
//             }
//         });
//     }
    
//     private static boolean validateCredentials(String username, String password) {
//         try {
//             File file = new File(accountFile);
//             if (!file.exists()) {
//                 file.getParentFile().mkdirs();
//                 try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(new FileOutputStream(file), "UTF-8"))) {
//                     writer.println("admin");
//                     writer.println("123456");
//                 }
//             }
            
//             try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), "UTF-8"))) {
//                 String storedUsername = reader.readLine();
//                 String storedPassword = reader.readLine();
                
//                 return username.equals(storedUsername) && password.equals(storedPassword);
//             }
//         } catch (IOException e) {
//             e.printStackTrace();
//             return false;
//         }
//     }
    
//     private static void showRegistrationWindow(JFrame loginFrame) {
//         JFrame registerFrame = new JFrame("用户注册");
//         registerFrame.setSize(400, 200);
//         registerFrame.setLocationRelativeTo(loginFrame);
        
//         JPanel panel = new JPanel(new GridBagLayout());
//         GridBagConstraints gbc = new GridBagConstraints();
        
//         JLabel userLabel = new JLabel("新账号:");
//         JTextField userText = new JTextField(15);
        
//         JLabel passwordLabel = new JLabel("新密码:");
//         JPasswordField passwordText = new JPasswordField(15);
        
//         JLabel confirmPasswordLabel = new JLabel("确认密码:");
//         JPasswordField confirmPasswordText = new JPasswordField(15);
        
//         JButton registerButton = new JButton("注册");
        
//         gbc.insets = new Insets(5, 5, 5, 5);
        
//         gbc.gridx = 0;
//         gbc.gridy = 0;
//         panel.add(userLabel, gbc);
        
//         gbc.gridx = 1;
//         panel.add(userText, gbc);
        
//         gbc.gridx = 0;
//         gbc.gridy = 1;
//         panel.add(passwordLabel, gbc);
        
//         gbc.gridx = 1;
//         panel.add(passwordText, gbc);
        
//         gbc.gridx = 0;
//         gbc.gridy = 2;
//         panel.add(confirmPasswordLabel, gbc);
        
//         gbc.gridx = 1;
//         panel.add(confirmPasswordText, gbc);
        
//         gbc.gridx = 1;
//         gbc.gridy = 3;
//         panel.add(registerButton, gbc);
        
//         registerFrame.add(panel);
//         registerFrame.setVisible(true);
        
//         registerButton.addActionListener(e -> {
//             String username = userText.getText();
//             String password = new String(passwordText.getPassword());
//             String confirmPassword = new String(confirmPasswordText.getPassword());
            
//             if (username.isEmpty() || password.isEmpty()) {
//                 JOptionPane.showMessageDialog(registerFrame, "账号和密码不能为空！");
//                 return;
//             }
            
//             if (!password.equals(confirmPassword)) {
//                 JOptionPane.showMessageDialog(registerFrame, "两次输入的密码不一致！");
//                 return;
//             }
            
//             try (PrintWriter writer = new PrintWriter(new OutputStreamWriter(new FileOutputStream(accountFile), "UTF-8"))) {
//                 writer.println(username);
//                 writer.println(password);
//                 JOptionPane.showMessageDialog(registerFrame, "注册成功！");
//                 registerFrame.dispose();
//             } catch (IOException ex) {
//                 JOptionPane.showMessageDialog(registerFrame, "注册失败：" + ex.getMessage());
//             }
//         });
//     }

//     private static void showFunctionSelectionWindow() {
//         JFrame nextFrame = new JFrame("功能选择");
//         nextFrame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);

//         JPanel panel = new JPanel();
//         panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
//         panel.setBorder(BorderFactory.createEmptyBorder(20, 20, 20, 20));

//         JLabel label = new JLabel("您需要实现哪种功能");
//         label.setAlignmentX(Component.CENTER_ALIGNMENT);

//         JButton button1 = new JButton("资源统计");
//         JButton button2 = new JButton("概率模拟");
//         JButton button3 = new JButton("伤害计算器");

//         Dimension buttonSize = new Dimension(200, 50);
//         button1.setPreferredSize(buttonSize);
//         button2.setPreferredSize(buttonSize);
//         button3.setPreferredSize(buttonSize);

//         button1.addActionListener(e -> showResourceStatisticsWindow());
//         button2.addActionListener(e -> openProbabilitySimulationWindow());
//         button3.addActionListener(e -> showLogosDamageCalculatorInfo());

//         panel.add(label);
//         panel.add(Box.createRigidArea(new Dimension(0, 20)));
//         panel.add(button1);
//         panel.add(Box.createRigidArea(new Dimension(0, 10)));
//         panel.add(button2);
//         panel.add(Box.createRigidArea(new Dimension(0, 10)));
//         panel.add(button3);

//         nextFrame.add(panel);
//         nextFrame.pack();
//         nextFrame.setLocationRelativeTo(null);
//         nextFrame.setVisible(true);
//     }

//     private static void showResourceStatisticsWindow() {
//         File resourceDir = new File(ziyuanFile).getParentFile();
//         if (resourceDir != null && !resourceDir.exists()) {
//             resourceDir.mkdirs();
//         }
//         if (ziyuanFrame != null && ziyuanFrame.isDisplayable()) {
//             ziyuanFrame.toFront();
//             return;
//         }

//         ziyuanFrame = new JFrame("资源统计");
//         ziyuanFrame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
//         ziyuanFrame.setSize(800, 600);
//         ziyuanFrame.setLocationRelativeTo(null);

//         JPanel mainPanel = new JPanel(new BorderLayout(10, 10));
//         mainPanel.setBorder(BorderFactory.createEmptyBorder(20, 20, 20, 20));

//         List<ResourceRecord> resourceRecords = new ArrayList<>();
//         try {
//             File file = new File(ziyuanFile);
//             if (!file.exists()) {
//                 createDefaultResourceFile(file);
//                 if (!file.exists()) {
//                     JOptionPane.showMessageDialog(ziyuanFrame, "文件不存在且无法创建！");
//                     ziyuanFrame.dispose();
//                     return;
//                 }
//             }

//             try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), "UTF-8"))) {
//                 String line;
//                 reader.readLine();

//                 while ((line = reader.readLine()) != null) {
//                     String[] data = line.split(",");
//                     if (data.length >= 5) {
//                         try {
//                             ResourceRecord record = new ResourceRecord(
//                                 data[0].trim(), 
//                                 Integer.parseInt(data[1].trim()), 
//                                 new int[]{
//                                     Integer.parseInt(data[2].trim()), 
//                                     Integer.parseInt(data[3].trim()), 
//                                     Integer.parseInt(data[4].trim())
//                                 }
//                             );
//                             resourceRecords.add(record);
//                         } catch (NumberFormatException e) {
//                             System.err.println("解析行数据时出错: " + line);
//                         }
//                     }
//                 }
//             }
//         } catch (IOException e) {
//             JOptionPane.showMessageDialog(ziyuanFrame, "读取文件时发生错误: " + e.getMessage());
//             e.printStackTrace();
//             ziyuanFrame.dispose();
//             return;
//         }

//         final CustomTablePanel tablePanel = new CustomTablePanel(resourceRecords);
//         JScrollPane scrollPane = new JScrollPane(tablePanel);

//         JPanel buttonPanel = new JPanel(new FlowLayout());
//         JButton queryButton = new JButton("查询");
//         JButton modifyButton = new JButton("修改");
        
//         buttonPanel.add(queryButton);
//         buttonPanel.add(modifyButton);
        
//         mainPanel.add(scrollPane, BorderLayout.CENTER);
//         mainPanel.add(buttonPanel, BorderLayout.SOUTH);
//         ziyuanFrame.add(mainPanel);
//         ziyuanFrame.setVisible(true);
        
//         queryButton.addActionListener(e -> {
//             if (ziyuanFrame == null || !ziyuanFrame.isDisplayable()) {
//                 return;
//             }
            
//             String resourceType = JOptionPane.showInputDialog(ziyuanFrame, "请输入资源类型名称：");
//             if (resourceType != null && !resourceType.trim().isEmpty()) {
//                 boolean found = false;
//                 for (ResourceRecord record : resourceRecords) {
//                     if (record.type.equals(resourceType.trim())) {
//                         JOptionPane.showMessageDialog(ziyuanFrame, 
//                             resourceType + "的剩余数量为" + record.quantity);
//                         found = true;
//                         break;
//                     }
//                 }
//                 if (!found) {
//                     JOptionPane.showMessageDialog(ziyuanFrame, "该资源不存在");
//                 }
//             }
//         });
        
//         modifyButton.addActionListener(e -> {
//             if (ziyuanFrame == null || !ziyuanFrame.isDisplayable()) {
//                 return;
//             }
            
//             String resourceType = JOptionPane.showInputDialog(ziyuanFrame, "请输入资源类型名称：");
//             if (resourceType == null || resourceType.trim().isEmpty()) {
//                 return;
//             }
            
//             String changeStr = JOptionPane.showInputDialog(ziyuanFrame, "请输入增加或减少的数目（正数为增加，负数为减少）：");
//             if (changeStr == null || changeStr.trim().isEmpty()) {
//                 return;
//             }
            
//             try {
//                 int change = Integer.parseInt(changeStr.trim());
//                 boolean found = false;
                
//                 for (int i = 0; i < resourceRecords.size(); i++) {
//                     ResourceRecord record = resourceRecords.get(i);
//                     if (record.type.equals(resourceType.trim())) {
//                         found = true;
                        
//                         int newQuantity = record.quantity + change;
                        
//                         if (newQuantity < 0) {
//                             int actualRemoved = record.quantity;
//                             record.quantity = 0;
//                             if (ziyuanFrame != null && ziyuanFrame.isDisplayable()) {
//                                 JOptionPane.showMessageDialog(ziyuanFrame, 
//                                     resourceType + "数目不足" + (-change) + "，已全部取出共" + actualRemoved + "份");
//                             }
//                         } else {
//                             record.quantity = newQuantity;
//                             if (ziyuanFrame != null && ziyuanFrame.isDisplayable()) {
//                                 JOptionPane.showMessageDialog(ziyuanFrame, "修改成功");
//                             }
//                         }
                        
//                         if (record.changes == null || record.changes.length < 3) {
//                             record.changes = new int[]{0, 0, 0};
//                         }
                        
//                         record.changes[0] = record.changes[1];
//                         record.changes[1] = record.changes[2];
//                         record.changes[2] = change;
                        
//                         tablePanel.updateData(resourceRecords);
//                         saveResourceRecords(resourceRecords);
//                         break;
//                     }
//                 }
                
//                 if (!found && change > 0) {
//                     ResourceRecord newRecord = new ResourceRecord(resourceType.trim(), change, new int[]{0, 0, change});
//                     resourceRecords.add(newRecord);
                    
//                     if (ziyuanFrame != null && ziyuanFrame.isDisplayable()) {
//                         JOptionPane.showMessageDialog(ziyuanFrame, "新增资源成功");
//                     }
                    
//                     tablePanel.updateData(resourceRecords);
//                     saveResourceRecords(resourceRecords);
//                 } else if (!found && change <= 0) {
//                     JOptionPane.showMessageDialog(ziyuanFrame, "该资源不存在");
//                 }
//             } catch (NumberFormatException ex) {
//                 JOptionPane.showMessageDialog(ziyuanFrame, "输入的数量格式不正确");
//             } catch (Exception ex) {
//                 JOptionPane.showMessageDialog(ziyuanFrame, "修改过程中发生错误: " + ex.getMessage());
//                 ex.printStackTrace();
//             }
//         });

//         ziyuanFrame.addWindowListener(new WindowAdapter() {
//             @Override
//             public void windowClosed(WindowEvent e) {
//                 ziyuanFrame = null;
//                 resourceRecords.clear();
//             }
            
//             @Override
//             public void windowClosing(WindowEvent e) {
//                 ziyuanFrame = null;
//                 resourceRecords.clear();
//             }
//         });
//     }

//     private static void openProbabilitySimulationWindow() {
//         if (choukaFrame != null && choukaFrame.isDisplayable()) {
//             choukaFrame.toFront();
//             return;
//         }

//         choukaFrame = new JFrame("概率模拟");
//         choukaFrame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
//         choukaFrame.setSize(1280, 720);
//         choukaFrame.setLocationRelativeTo(null);

//         loadDrawRecords();

//         JPanel mainPanel = new JPanel(new BorderLayout(10, 10));
//         mainPanel.setBorder(BorderFactory.createEmptyBorder(20, 20, 20, 20));

//         JPanel topPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
//         JLabel fileLabel = new JLabel("请选择卡池：");
//         JComboBox<String> fileComboBox = new JComboBox<>();

//         File folder = new File(kachiFolder);
//         if (folder.exists() && folder.isDirectory()) {
//             File[] files = folder.listFiles((dir, name) -> name.toLowerCase().endsWith(".txt"));
//             if (files != null) {
//                 for (File file : files) {
//                     fileComboBox.addItem(file.getName().replace(".txt", ""));
//                 }
//             }
//         }

//         if (fileComboBox.getItemCount() > 0) {
//             fileComboBox.setSelectedIndex(0);
//         }

//         topPanel.add(fileLabel);
//         topPanel.add(fileComboBox);
//         mainPanel.add(topPanel, BorderLayout.NORTH);

//         statusLabel = new JLabel("您已进行" + choukaHistory.size() + "次抽卡，已有" + weichu6xing + "抽未出现6星角色，下一次出现6星的概率为" + String.format("%.2f", (bonus6xing + 0.02) * 100) + "%");
//         topPanel.add(statusLabel);

//         JPanel centerPanel = new JPanel();
//         centerPanel.setLayout(new BoxLayout(centerPanel, BoxLayout.Y_AXIS));
//         centerPanel.setAlignmentX(Component.CENTER_ALIGNMENT);

//         JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.CENTER, 20, 0));
//         JButton singleDrawButton = new JButton("抽一发");
//         JButton tenDrawsButton = new JButton("抽十发");

//         buttonPanel.add(singleDrawButton);
//         buttonPanel.add(tenDrawsButton);

//         centerPanel.add(Box.createGlue());
//         centerPanel.add(buttonPanel);
//         centerPanel.add(Box.createGlue());

//         mainPanel.add(centerPanel, BorderLayout.CENTER);

//         JPanel southPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
//         JButton recordButton = new JButton("模拟抽卡记录");
//         JButton clearRecordButton = new JButton("清空记录");
//         JButton analysisButton = new JButton("出货波动分析");
//         southPanel.add(recordButton);
//         southPanel.add(clearRecordButton);
//         southPanel.add(analysisButton);

//         mainPanel.add(southPanel, BorderLayout.SOUTH);

//         choukaFrame.add(mainPanel);
//         choukaFrame.setVisible(true);

//         singleDrawButton.addActionListener(e -> {
//             Object selectedItem = fileComboBox.getSelectedItem();
//             if (selectedItem == null) {
//                 JOptionPane.showMessageDialog(choukaFrame, "请先选择一个配置文件！");
//                 return;
//             }
//             try {
//                 simulateDraw(selectedItem.toString(), false);
//             } catch (IOException ex) {
//                 JOptionPane.showMessageDialog(choukaFrame, "文件读取错误: " + ex.getMessage());
//             }
//         });

//         tenDrawsButton.addActionListener(e -> {
//             Object selectedItem = fileComboBox.getSelectedItem();
//             if (selectedItem == null) {
//                 JOptionPane.showMessageDialog(choukaFrame, "请先选择一个配置文件！");
//                 return;
//             }

//             List<String> results = new ArrayList<>();

//             try {
//                 for (int i = 0; i < 10; i++) {
//                     simulateDraw(selectedItem.toString(), true);
//                     if (!choukaHistory.isEmpty()) {
//                         results.add(choukaHistory.get(choukaHistory.size() - 1));
//                     }
//                 }

//                 showMultipleDrawResults(results);

//             } catch (IOException ex) {
//                 JOptionPane.showMessageDialog(choukaFrame, "文件读取错误: " + ex.getMessage());
//             }
//         });

//         recordButton.addActionListener(e -> showDrawHistory());
        
//         clearRecordButton.addActionListener(e -> {
//             int result = JOptionPane.showConfirmDialog(
//                 choukaFrame,
//                 "确定要清空所有抽卡记录吗？此操作不可恢复。",
//                 "确认清空",
//                 JOptionPane.YES_NO_OPTION,
//                 JOptionPane.QUESTION_MESSAGE
//             );
            
//             if (result == JOptionPane.YES_OPTION) {
//                 choukaHistory.clear();
//                 weichu6xing = 0;
//                 bonus6xing = 0.0;
                
//                 File recordFile = new File(choukaFile);
//                 if (recordFile.exists()) {
//                     recordFile.delete();
//                 }
                
//                 SwingUtilities.invokeLater(() -> {
//                     double nextChance = (0.02 + bonus6xing) * 100;
//                     statusLabel.setText("您已进行" + choukaHistory.size() + "次抽卡，已有" + weichu6xing + "抽未出现6星角色，下一次出现6星的概率为" + String.format("%.2f", nextChance) + "%");
//                 });
                
//                 JOptionPane.showMessageDialog(choukaFrame, "抽卡记录已清空");
//             }
//         });
        
//         analysisButton.addActionListener(e -> showDrawAnalysis());

//         choukaFrame.addWindowListener(new WindowAdapter() {
//             @Override
//             public void windowClosed(WindowEvent e) {
//                 choukaFrame = null;
//             }
//         });
//     }

//     private static void showMultipleDrawResults(List<String> results) {
//         JFrame frame = new JFrame("十连抽结果");
//         frame.setSize(500, 600);
//         frame.setLocationRelativeTo(null);
        
//         MultipleDrawResultPanel resultPanel = new MultipleDrawResultPanel(results);
//         JScrollPane scrollPane = new JScrollPane(resultPanel);
        
//         frame.add(scrollPane);
//         frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
//         frame.setVisible(true);
//     }

//     private static void simulateDraw(String fileName, boolean silent) throws IOException {
//         File file = new File(kachiFolder, fileName + ".txt");

//         try (
//             FileInputStream fis = new FileInputStream(file);
//             InputStreamReader isr = new InputStreamReader(fis, "UTF-8");
//             BufferedReader reader = new BufferedReader(isr)
//         ) {
//             Map<String, List<String>> starMap = parseCharacterFile(reader);

//             Random rand = new Random();
//             double weight = rand.nextDouble();

//             double p3 = 0.35;
//             double p4 = 0.55;
//             double p5 = 0.08;
//             double p6 = 0.02;

//             if (weichu6xing >= 50) {
//                 bonus6xing += 0.02;
//                 if (bonus6xing >= 0.98) {
//                     bonus6xing = 0.98;
//                 }
//                 double remaining = 1.0 - (p6 + bonus6xing);
//                 p3 = 0.35 / 0.98 * remaining;
//                 p4 = 0.55 / 0.98 * remaining;
//                 p5 = 0.08 / 0.98 * remaining;
//             }

//             String selectedStar;
//             double cumulativeP3 = p3;
//             double cumulativeP4 = cumulativeP3 + p4;
//             double cumulativeP5 = cumulativeP4 + p5;

//             if (weight <= cumulativeP3) {
//                 selectedStar = "3星";
//             } else if (weight <= cumulativeP4) {
//                 selectedStar = "4星";
//             } else if (weight <= cumulativeP5) {
//                 selectedStar = "5星";
//             } else {
//                 selectedStar = "6星";
//                 weichu6xing = 0;
//                 bonus6xing = 0.0;
//             }

//             List<String> characters = starMap.getOrDefault(selectedStar, Collections.emptyList());
//             if (characters.isEmpty()) {
//                 if (!silent) {
//                     JOptionPane.showMessageDialog(null, "该星级角色列表为空！");
//                 }
//                 return;
//             }

//             String result = characters.get(rand.nextInt(characters.size()));
//             String fullResult = selectedStar + "：" + result;

//             if (!silent) {
//                 showDrawResult(fullResult);
//             }

//             choukaHistory.add(fullResult);

//             if (!selectedStar.equals("6星")) {
//                 weichu6xing++;
//             } else {
//                 weichu6xing = 0;
//                 bonus6xing = 0.0;
//             }

//             saveDrawRecords();

//             SwingUtilities.invokeLater(() -> {
//                 double nextChance = (0.02 + bonus6xing) * 100;
//                 statusLabel.setText("您已进行" + choukaHistory.size() + "次抽卡，已有" + weichu6xing + "抽未出现6星角色，下一次出现6星的概率为" + String.format("%.2f", nextChance) + "%");
//             });
//         }
//     }

//     private static Map<String, List<String>> parseCharacterFile(BufferedReader reader) throws IOException {
//         Map<String, List<String>> result = new HashMap<>();
//         List<String> currentList = null;

//         String line;
//         while ((line = reader.readLine()) != null) {
//             line = line.trim();

//             if (line.startsWith("[") && line.endsWith("]")) {
//                 String key = line.substring(1, line.length() - 1).trim();
//                 currentList = new ArrayList<>();
//                 result.put(key, currentList);
//             } else if (!line.isEmpty() && currentList != null) {
//                 currentList.add(line);
//             }
//         }

//         return result;
//     }

//     private static void showDrawResult(String result) {
//         JFrame resultFrame = new JFrame("抽卡结果");
//         resultFrame.setSize(400, 200);
//         resultFrame.setLocationRelativeTo(null);
        
//         DrawResultPanel resultPanel = new DrawResultPanel(result);
        
//         resultFrame.add(resultPanel);
//         resultFrame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
//         resultFrame.setVisible(true);
//     }
    
//     private static void showDrawHistory() {
//         if (choukaHistory.isEmpty()) {
//             JOptionPane.showMessageDialog(null, "暂无抽卡记录！");
//             return;
//         }
        
//         JFrame frame = new JFrame("抽卡记录");
//         frame.setSize(550, 450);
//         frame.setLocationRelativeTo(null);
        
//         DrawHistoryPanel historyPanel = new DrawHistoryPanel(new ArrayList<>(choukaHistory));
//         JScrollPane scrollPane = new JScrollPane(historyPanel);
        
//         frame.add(scrollPane);
//         frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
//         frame.setVisible(true);
//     }
    
//     private static void showDrawAnalysis() {
//         if (choukaHistory.isEmpty()) {
//             JOptionPane.showMessageDialog(choukaFrame, "暂无抽卡记录！");
//             return;
//         }
        
//         List<DrawAnalysisRecord> records = parseDrawHistory();
        
//         if (records.isEmpty()) {
//             JOptionPane.showMessageDialog(choukaFrame, "暂无六星记录！");
//             return;
//         }
        
//         JFrame analysisFrame = new JFrame("出货波动分析");
//         analysisFrame.setSize(600, 500);
//         analysisFrame.setLocationRelativeTo(choukaFrame);
        
//         JPanel mainPanel = new JPanel(new BorderLayout());
        
//         DrawAnalysisPanel tablePanel = new DrawAnalysisPanel(records);
//         JScrollPane scrollPane = new JScrollPane(tablePanel);
        
//         JPanel buttonPanel = new JPanel();
//         JButton fluctuationButton = new JButton("抽卡波动分析");
//         buttonPanel.add(fluctuationButton);
        
//         mainPanel.add(scrollPane, BorderLayout.CENTER);
//         mainPanel.add(buttonPanel, BorderLayout.SOUTH);
        
//         analysisFrame.add(mainPanel);
//         analysisFrame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
//         analysisFrame.setVisible(true);
        
//         fluctuationButton.addActionListener(event -> showFluctuationChart(records));
//     }
    
//     private static List<DrawAnalysisRecord> parseDrawHistory() {
//         List<DrawAnalysisRecord> records = new ArrayList<>();
        
//         int fiveStarCount = 0;
//         int drawCount = 0;
//         String currentSixStar = null;
        
//         for (String record : choukaHistory) {
//             drawCount++;
            
//             if (record.startsWith("6星")) {
//                 if (currentSixStar != null) {
//                     records.add(new DrawAnalysisRecord(
//                         currentSixStar.replace("6星：", ""),
//                         drawCount,
//                         fiveStarCount
//                     ));
//                 }
                
//                 currentSixStar = record;
//                 fiveStarCount = 0;
//                 drawCount = 1;
//             } else if (record.startsWith("5星")) {
//                 fiveStarCount++;
//             }
//         }
        
//         if (currentSixStar != null) {
//             records.add(new DrawAnalysisRecord(
//                 currentSixStar.replace("6星：", ""),
//                 drawCount,
//                 fiveStarCount
//             ));
//         }
        
//         return records;
//     }
    
//     private static void showFluctuationChart(List<DrawAnalysisRecord> records) {
//         List<Integer> drawCounts = new ArrayList<>();
//         List<Integer> sixStarCounts = new ArrayList<>();
        
//         int totalDraws = 0;
//         int totalSixStars = 0;
        
//         drawCounts.add(0);
//         sixStarCounts.add(0);
        
//         for (DrawAnalysisRecord record : records) {
//             totalDraws += record.drawCount;
//             totalSixStars++;
            
//             drawCounts.add(totalDraws);
//             sixStarCounts.add(totalSixStars);
//         }
        
//         JFrame chartFrame = new JFrame("抽卡波动分析");
//         chartFrame.setSize(900, 600);
//         chartFrame.setLocationRelativeTo(null);
        
//         DrawFluctuationChartPanel chartPanel = new DrawFluctuationChartPanel(drawCounts, sixStarCounts);
        
//         chartFrame.add(chartPanel);
//         chartFrame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
//         chartFrame.setVisible(true);
//     }

//     private static void showLogosDamageCalculatorInfo() {
//         JFrame infoFrame = new JFrame("逻各斯伤害计算器说明");
//         infoFrame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
//         infoFrame.setSize(600, 400);
//         infoFrame.setLocationRelativeTo(null);
        
//         JPanel panel = new JPanel();
//         panel.setLayout(new BorderLayout());
        
//         JTextArea textArea = new JTextArea();
//         textArea.setEditable(false);
//         textArea.setFont(new Font("楷体", Font.PLAIN, 14));
//         textArea.setLineWrap(true);
//         textArea.setWrapStyleWord(true);
//         textArea.setText("本计算器将模拟计算《明日方舟》中的角色逻各斯的3技能总伤数值。其伤害规则如下：\n" +
//                         "1，逻各斯是一名术士，攻击会造成法术伤害，面板攻击力数值为855，攻击间隔1.6秒。任何法术伤害的百分之8会对敌人追加元素损伤。\n" +
//                         "2，当一名敌人受到的元素损伤累积到1000点时，会收到持续15秒，每秒造成800点元素伤害的元素爆发。\n" +
//                         "3，逻各斯第一天赋语汇演化效果：每次主动攻击时有百分之60的概率造成一次攻击力百分之60的额外攻击，若该额外攻击的目标处于元素爆发期间，则再额外追加百分之60的额外元素伤害。\n" +
//                         "4，逻各斯第二天赋剜魂具辞效果：对目标造成任何伤害时都会追加150点法术伤害。\n" +
//                         "5，逻各斯开启3技能延异视阈时，攻击力会变为4倍，该技能持续30秒。\n\n" +
//                         "接下来，程序会开始尝试十万次蒙特卡洛法模拟来进行对逻各斯总伤害数值的计算并绘制折线图。");
        
//         JScrollPane scrollPane = new JScrollPane(textArea);
        
//         JPanel buttonPanel = new JPanel();
//         JButton startButton = new JButton("我已知悉，请开始计算");
//         buttonPanel.add(startButton);
        
//         panel.add(scrollPane, BorderLayout.CENTER);
//         panel.add(buttonPanel, BorderLayout.SOUTH);
        
//         infoFrame.add(panel);
//         infoFrame.setVisible(true);
        
//         startButton.addActionListener(e -> {
//             infoFrame.dispose();
//             openDamageCalculatorWindow();
//         });
//     }

//     private static void openDamageCalculatorWindow() {
//         if (shanghaiFrame != null && shanghaiFrame.isDisplayable()) {
//             shanghaiFrame.toFront();
//             return;
//         }

//         shanghaiFrame = new JFrame("伤害计算器 - 逻各斯模拟");
//         shanghaiFrame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);
//         shanghaiFrame.setSize(900, 600);
//         shanghaiFrame.setLocationRelativeTo(null);
        
//         DamageCalculatorPanel calculatorPanel = new DamageCalculatorPanel();
//         shanghaiFrame.add(calculatorPanel);
//         shanghaiFrame.setVisible(true);
        
//         shanghaiFrame.addWindowListener(new WindowAdapter() {
//             @Override
//             public void windowClosed(WindowEvent e) {
//                 shanghaiFrame = null;
//             }
//         });
//     }
// }

// class DrawAnalysisRecord {
//     String sixStarName;
//     int drawCount;
//     int fiveStarCount;
    
//     public DrawAnalysisRecord(String sixStarName, int drawCount, int fiveStarCount) {
//         this.sixStarName = sixStarName;
//         this.drawCount = drawCount;
//         this.fiveStarCount = fiveStarCount;
//     }
// }

// class DrawAnalysisPanel extends JPanel {
//     private List<DrawAnalysisRecord> records;
//     private String[] headers;
    
//     public DrawAnalysisPanel(List<DrawAnalysisRecord> records) {
//         this.records = records;
//         this.headers = new String[]{"六星名称", "出货消耗", "获得五星数"};
//         setPreferredSize(new Dimension(500, Math.max(200, 50 + records.size() * 30)));
//     }
    
//     @Override
//     protected void paintComponent(Graphics g) {
//         super.paintComponent(g);
//         Graphics2D g2d = (Graphics2D) g.create();
//         g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
//         int width = getWidth();
        
//         Font headerFont = new Font("楷体", Font.BOLD, 16);
//         Font cellFont = new Font("楷体", Font.PLAIN, 14);
        
//         int rowHeight = 30;
//         int headerHeight = 40;
//         int tableWidth = Math.min(width - 40, 450);
//         int col1Width = tableWidth / 3;
//         int col2Width = tableWidth / 3;
//         int startX = 20;
//         int startY = 20;
        
//         g2d.setFont(headerFont);
//         g2d.setColor(Color.LIGHT_GRAY);
//         g2d.fillRect(startX, startY, tableWidth, headerHeight);
//         g2d.setColor(Color.BLACK);
//         g2d.drawRect(startX, startY, tableWidth, headerHeight);
        
//         g2d.drawString(headers[0], startX + 10, startY + 25);
//         g2d.drawString(headers[1], startX + col1Width + 10, startY + 25);
//         g2d.drawString(headers[2], startX + col1Width + col2Width + 10, startY + 25);
        
//         g2d.drawLine(startX + col1Width, startY, startX + col1Width, startY + headerHeight);
//         g2d.drawLine(startX + col1Width + col2Width, startY, startX + col1Width + col2Width, startY + headerHeight);
        
//         g2d.setFont(cellFont);
//         for (int i = 0; i < records.size(); i++) {
//             int rowY = startY + headerHeight + i * rowHeight;
//             DrawAnalysisRecord record = records.get(i);
            
//             if (i % 2 == 0) {
//                 g2d.setColor(new Color(240, 240, 240));
//                 g2d.fillRect(startX, rowY, tableWidth, rowHeight);
//             }
            
//             g2d.setColor(Color.BLACK);
//             g2d.drawRect(startX, rowY, tableWidth, rowHeight);
            
//             g2d.drawString(record.sixStarName, startX + 10, rowY + 20);
//             g2d.drawString(String.valueOf(record.drawCount), startX + col1Width + 10, rowY + 20);
//             g2d.drawString(String.valueOf(record.fiveStarCount), startX + col1Width + col2Width + 10, rowY + 20);
            
//             g2d.drawLine(startX + col1Width, rowY, startX + col1Width, rowY + rowHeight);
//             g2d.drawLine(startX + col1Width + col2Width, rowY, startX + col1Width + col2Width, rowY + rowHeight);
//         }
        
//         g2d.drawRect(startX, startY, tableWidth, headerHeight + records.size() * rowHeight);
        
//         g2d.dispose();
//     }
// }

// class DrawFluctuationChartPanel extends JPanel {
//     private List<Integer> drawCounts;
//     private List<Integer> sixStarCounts;
//     private static final int Y_AXIS_MAX = 20;
    
//     public DrawFluctuationChartPanel(List<Integer> drawCounts, List<Integer> sixStarCounts) {
//         this.drawCounts = drawCounts;
//         this.sixStarCounts = sixStarCounts;
//         setPreferredSize(new Dimension(800, 500));
//     }
    
//     @Override
//     protected void paintComponent(Graphics g) {
//         super.paintComponent(g);
//         Graphics2D g2d = (Graphics2D) g;
//         g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
//         int width = getWidth();
//         int height = getHeight();
        
//         if (drawCounts.isEmpty() || sixStarCounts.isEmpty()) {
//             g2d.setColor(Color.BLACK);
//             g2d.drawString("暂无数据", width/2 - 30, height/2);
//             return;
//         }
        
//         int maxDrawCount = Collections.max(drawCounts);
//         if (maxDrawCount == 0) maxDrawCount = 1;
        
//         g2d.setColor(Color.LIGHT_GRAY);
//         for (int i = 0; i <= 10; i++) {
//             int y = height - 50 - i * ((height - 100) / 10);
//             g2d.drawLine(50, y, width - 50, y);
//         }
        
//         for (int i = 0; i <= 10; i++) {
//             int x = 50 + i * ((width - 100) / 10);
//             g2d.drawLine(x, 50, x, height - 50);
//         }
        
//         g2d.setColor(Color.BLUE);
//         g2d.setStroke(new BasicStroke(2));
//         for (int i = 1; i < drawCounts.size(); i++) {
//             int x1 = 50 + (int)((double)drawCounts.get(i-1) / maxDrawCount * (width - 100));
//             int y1 = height - 50 - (int)((double)sixStarCounts.get(i-1) * (height - 100) / Y_AXIS_MAX);
//             int x2 = 50 + (int)((double)drawCounts.get(i) / maxDrawCount * (width - 100));
//             int y2 = height - 50 - (int)((double)sixStarCounts.get(i) * (height - 100) / Y_AXIS_MAX);
//             g2d.drawLine(x1, y1, x2, y2);
//         }
        
//         g2d.setColor(Color.RED);
//         for (int i = 0; i < drawCounts.size(); i++) {
//             int x = 50 + (int)((double)drawCounts.get(i) / maxDrawCount * (width - 100));
//             int y = height - 50 - (int)((double)sixStarCounts.get(i) * (height - 100) / Y_AXIS_MAX);
//             g2d.fillOval(x - 3, y - 3, 6, 6);
//         }
        
//         g2d.setColor(Color.BLACK);
//         g2d.setStroke(new BasicStroke(1));
//         g2d.drawLine(50, height - 50, width - 50, height - 50);
//         g2d.drawLine(50, 50, 50, height - 50);
        
//         for (int i = 0; i <= 10; i++) {
//             int x = 50 + i * ((width - 100) / 10);
//             int value = i * maxDrawCount / 10;
//             g2d.drawString(String.valueOf(value), x - 10, height - 30);
//             g2d.drawLine(x, height - 50, x, height - 45);
//         }
        
//         for (int i = 0; i <= Math.min(10, Y_AXIS_MAX); i++) {
//             int y = height - 50 - i * ((height - 100) / Math.min(10, Y_AXIS_MAX));
//             int value = i;
//             g2d.drawString(String.valueOf(value), 10, y + 5);
//             g2d.drawLine(45, y, 50, y);
//         }
        
//         g2d.drawString("累计抽数", width / 2 - 30, height - 10);
//         g2d.drawString("六星数量", 10, 30);
//     }
// }

// class CustomTablePanel extends JPanel {
//     private List<数据可视化.ResourceRecord> records;
//     private String[] headers;
    
//     public CustomTablePanel(List<数据可视化.ResourceRecord> records) {
//         this.records = new ArrayList<>(records);
//         this.headers = new String[]{"资源类型", "资源数量", "变动情况"};
//         setPreferredSize(new Dimension(700, Math.max(200, 50 + records.size() * 30)));
//     }
    
//     public void updateData(List<数据可视化.ResourceRecord> records) {
//         this.records = new ArrayList<>(records);
//         setPreferredSize(new Dimension(700, Math.max(200, 50 + records.size() * 30)));
//         revalidate();
//         repaint();
//     }
    
//     @Override
//     protected void paintComponent(Graphics g) {
//         super.paintComponent(g);
//         Graphics2D g2d = (Graphics2D) g.create();
//         g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
//         int width = getWidth();
        
//         Font headerFont = new Font("楷体", Font.BOLD, 16);
//         Font cellFont = new Font("楷体", Font.PLAIN, 14);
        
//         int rowHeight = 30;
//         int headerHeight = 40;
//         int tableWidth = Math.min(width - 40, 600);
//         int col1Width = tableWidth / 3;
//         int col2Width = tableWidth / 3;
        
//         int startX = 20;
//         int startY = 20;
        
//         g2d.setFont(headerFont);
//         g2d.setColor(Color.LIGHT_GRAY);
//         g2d.fillRect(startX, startY, tableWidth, headerHeight);
//         g2d.setColor(Color.BLACK);
//         g2d.drawRect(startX, startY, tableWidth, headerHeight);
        
//         g2d.drawString(headers[0], startX + 10, startY + 25);
//         g2d.drawString(headers[1], startX + col1Width + 10, startY + 25);
//         g2d.drawString(headers[2], startX + col1Width + col2Width + 10, startY + 25);
        
//         g2d.drawLine(startX + col1Width, startY, startX + col1Width, startY + headerHeight);
//         g2d.drawLine(startX + col1Width + col2Width, startY, startX + col1Width + col2Width, startY + headerHeight);
        
//         g2d.setFont(cellFont);
//         for (int i = 0; i < records.size(); i++) {
//             int rowY = startY + headerHeight + i * rowHeight;
//             数据可视化.ResourceRecord record = records.get(i);
            
//             if (i % 2 == 0) {
//                 g2d.setColor(new Color(240, 240, 240));
//                 g2d.fillRect(startX, rowY, tableWidth, rowHeight);
//             }
            
//             g2d.setColor(Color.BLACK);
//             g2d.drawRect(startX, rowY, tableWidth, rowHeight);
            
//             g2d.drawString(record.type, startX + 10, rowY + 20);
//             g2d.drawString(String.valueOf(record.quantity), startX + col1Width + 10, rowY + 20);
//             String changesText = record.changes[0] + "/" + record.changes[1] + "/" + record.changes[2];
//             g2d.drawString(changesText, startX + col1Width + col2Width + 10, rowY + 20);
            
//             g2d.drawLine(startX + col1Width, rowY, startX + col1Width, rowY + rowHeight);
//             g2d.drawLine(startX + col1Width + col2Width, rowY, startX + col1Width + col2Width, rowY + rowHeight);
//         }
        
//         g2d.drawRect(startX, startY, tableWidth, headerHeight + records.size() * rowHeight);
        
//         g2d.dispose();
//     }
// }

// class DrawResultPanel extends JPanel {
//     private String result;
    
//     public DrawResultPanel(String result) {
//         this.result = result;
//         setPreferredSize(new Dimension(380, 180));
//     }
    
//     @Override
//     protected void paintComponent(Graphics g) {
//         super.paintComponent(g);
//         Graphics2D g2d = (Graphics2D) g.create();
//         g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
//         int width = getWidth();
//         int height = getHeight();
        
//         Font resultFont = new Font("楷体", Font.BOLD, 24);
//         g2d.setFont(resultFont);
        
//         if (result.startsWith("6星")) {
//             g2d.setColor(Color.RED);
//         } else {
//             g2d.setColor(Color.BLACK);
//         }
        
//         FontMetrics fm = g2d.getFontMetrics();
//         int textWidth = fm.stringWidth(result);
//         int x = (width - textWidth) / 2;
//         int y = (height + fm.getAscent()) / 2 - 10;
        
//         g2d.drawString(result, x, y);
        
//         g2d.dispose();
//     }
// }

// class MultipleDrawResultPanel extends JPanel {
//     private List<String> results;
    
//     public MultipleDrawResultPanel(List<String> results) {
//         this.results = results;
//         setPreferredSize(new Dimension(450, Math.max(200, results.size() * 40 + 20)));
//     }
    
//     @Override
//     protected void paintComponent(Graphics g) {
//         super.paintComponent(g);
//         Graphics2D g2d = (Graphics2D) g.create();
//         g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
//         int startY = 10;
//         int lineHeight = 30;
//         Font resultFont = new Font("楷体", Font.PLAIN, 16);
//         g2d.setFont(resultFont);
        
//         for (int i = 0; i < results.size(); i++) {
//             String result = results.get(i);
//             int y = startY + i * lineHeight + 20;
            
//             if (result.startsWith("6星")) {
//                 g2d.setColor(Color.RED);
//             } else {
//                 g2d.setColor(Color.BLACK);
//             }
            
//             g2d.drawString(result, 20, y);
//         }
        
//         g2d.dispose();
//     }
// }

// class DrawHistoryPanel extends JPanel {
//     private List<String> history;
    
//     public DrawHistoryPanel(List<String> history) {
//         this.history = history;
//         setPreferredSize(new Dimension(500, Math.max(200, history.size() * 30 + 20)));
//     }
    
//     @Override
//     protected void paintComponent(Graphics g) {
//         super.paintComponent(g);
//         Graphics2D g2d = (Graphics2D) g.create();
//         g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
//         int startY = 10;
//         int lineHeight = 25;
//         Font historyFont = new Font("楷体", Font.PLAIN, 16);
//         g2d.setFont(historyFont);
        
//         for (int i = 0; i < history.size(); i++) {
//             String record = history.get(i);
//             int y = startY + i * lineHeight + 20;
            
//             if (record.startsWith("6星")) {
//                 g2d.setColor(Color.RED);
//             } else {
//                 g2d.setColor(Color.BLACK);
//             }
            
//             g2d.drawString(record, 20, y);
//         }
        
//         g2d.dispose();
//     }
// }

// class Damage {
//     public final int magicDamage;
//     public final int elementDamage;

//     public Damage(double magicDamage, double elementDamage) {
//         this.magicDamage = (int) magicDamage;
//         this.elementDamage = (int) elementDamage;
//     }
// }

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
//         double totalMagicDamage = attack + 150;

//         if (Math.random() < 0.6) {
//             totalMagicDamage += attack * 0.6;
//         }

//         int magicToElement = (int) (totalMagicDamage * 0.08);
//         elementDamageAccumulated += magicToElement;

//         if (elementDamageAccumulated >= 1000 && !elementBurstActive) {
//             elementBurstActive = true;
//             burstStartTime = System.currentTimeMillis();
//             elementDamageAccumulated = 0;
//         }

//         int totalElementDamage = magicToElement;
//         if (isElementBurstActive()) {
//             totalElementDamage += (int) totalMagicDamage;
//         }

//         return new Damage(totalMagicDamage, totalElementDamage);
//     }
// }

// class ChartPanel extends JPanel {
//     private List<Integer> magicData;
//     private List<Integer> elementData;
//     private int startIndex;
//     private int endIndex;
//     private static final int Y_AXIS_MAX = 100000;

//     public ChartPanel(List<Integer> magicData, List<Integer> elementData) {
//         this.magicData = magicData;
//         this.elementData = elementData;
//         setPreferredSize(new Dimension(800, 500));
//     }

//     @Override
//     protected void paintComponent(Graphics g) {
//         super.paintComponent(g);
//         Graphics2D g2d = (Graphics2D) g;
//         g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

//         int width = getWidth();
//         int height = getHeight();
        
//         if (magicData.isEmpty() || elementData.isEmpty()) {
//             g2d.setColor(Color.BLACK);
//             g2d.drawString("等待模拟数据...", width/2 - 50, height/2);
//             return;
//         }

//         int globalMax = Y_AXIS_MAX;

//         g2d.setColor(Color.LIGHT_GRAY);
//         for (int i = 0; i <= 5; i++) {
//             int y = height - i * (height / 5);
//             g2d.drawLine(0, y, width, y);
//         }

//         g2d.setColor(Color.BLUE);
//         g2d.setStroke(new BasicStroke(2));
//         for (int i = 1; i < magicData.size(); i++) {
//             int x1 = (i - 1) * width / Math.max(1, magicData.size() - 1);
//             int y1 = height - (int)((double)magicData.get(i - 1) * height / globalMax);
//             int x2 = i * width / Math.max(1, magicData.size() - 1);
//             int y2 = height - (int)((double)magicData.get(i) * height / globalMax);
//             g2d.drawLine(x1, y1, x2, y2);
//         }

//         g2d.setColor(Color.RED);
//         g2d.setStroke(new BasicStroke(2));
//         for (int i = 1; i < elementData.size(); i++) {
//             int x1 = (i - 1) * width / Math.max(1, elementData.size() - 1);
//             int y1 = height - (int)((double)elementData.get(i - 1) * height / globalMax);
//             int x2 = i * width / Math.max(1, elementData.size() - 1);
//             int y2 = height - (int)((double)elementData.get(i) * height / globalMax);
//             g2d.drawLine(x1, y1, x2, y2);
//         }

//         g2d.setColor(Color.BLACK);
//         g2d.setStroke(new BasicStroke(1));
//         g2d.drawLine(0, height - 1, width, height - 1);
//         g2d.drawLine(0, 0, 0, height);

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
        
//         for (int i = 0; i <= 5; i++) {
//             int yValue = i * 20000;
//             int y = height - i * (height / 5);
//             g2d.drawString(String.valueOf(yValue), 5, y + 5);
//             g2d.drawLine(0, y, 5, y);
//         }
        
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

// class DamageCalculatorPanel extends JPanel {
//     private JLabel magicLabel;
//     private JLabel elementLabel;
//     private ChartPanel chartPanel;
//     private ScheduledExecutorService scheduler;
    
//     private List<Long> magicDamageList = new ArrayList<>();
//     private List<Long> elementDamageList = new ArrayList<>();
//     private int simulationCount = 0;
//     private long totalMagicDamage = 0;
//     private long totalElementDamage = 0;
//     private static final int MAX_SIMULATIONS = 100000;
//     private static final int SIMULATIONS_PER_UPDATE = 100;
//     private static final int Y_AXIS_MAX = 100000;

//     public DamageCalculatorPanel() {
//         setLayout(new BorderLayout());
//         initializeComponents();
//         startSimulation();
//     }
    
//     private void initializeComponents() {
//         magicLabel = new JLabel("平均总法术伤害: 0");
//         elementLabel = new JLabel("平均总元素伤害: 0");
        
//         JPanel labelPanel = new JPanel();
//         labelPanel.setLayout(new BoxLayout(labelPanel, BoxLayout.Y_AXIS));
//         labelPanel.add(magicLabel);
//         labelPanel.add(elementLabel);
//         labelPanel.add(new JLabel("模拟次数: 0/" + MAX_SIMULATIONS));
//         labelPanel.add(new JLabel("状态: 模拟进行中..."));

//         chartPanel = new ChartPanel(new ArrayList<>(), new ArrayList<>());

//         add(labelPanel, BorderLayout.NORTH);
//         add(chartPanel, BorderLayout.CENTER);
//     }
    
//     private void startSimulation() {
//         scheduler = Executors.newSingleThreadScheduledExecutor();
        
//         scheduler.scheduleAtFixedRate(() -> {
//             int simulationsThisRound = Math.min(SIMULATIONS_PER_UPDATE, MAX_SIMULATIONS - simulationCount);
            
//             for (int i = 0; i < simulationsThisRound; i++) {
//                 long[] result = runSingleSimulation();
//                 totalMagicDamage += result[0];
//                 totalElementDamage += result[1];
                
//                 magicDamageList.add(result[0]);
//                 elementDamageList.add(result[1]);
//                 simulationCount++;
//             }
            
//             updateUI();
            
//             if (simulationCount >= MAX_SIMULATIONS) {
//                 scheduler.shutdown();
//                 SwingUtilities.invokeLater(() -> {
//                     JLabel statusLabel = (JLabel) ((JPanel) getComponent(0)).getComponent(3);
//                     statusLabel.setText("状态: 模拟已完成");
//                 });
//             }
//         }, 0, 1000, TimeUnit.MILLISECONDS);
//     }
    
//     private long[] runSingleSimulation() {
//         AttackCalculator calculator = new AttackCalculator(855);
//         calculator.activateSkill();

//         int attackCount = 0;
//         long simTotalMagicDamage = 0;
//         long simTotalElementDamage = 0;

//         while (attackCount * 1600 < 30000) {
//             Damage damage = calculator.calculateAttack();
//             simTotalMagicDamage += damage.magicDamage;
//             simTotalElementDamage += damage.elementDamage;
//             attackCount++;
//         }

//         calculator.deactivateSkill();
        
//         return new long[]{simTotalMagicDamage, simTotalElementDamage};
//     }
    
//     @Override
//     public void updateUI() {
//         if (simulationCount == 0) return;

//         SwingUtilities.invokeLater(() -> {
//             double avgMagicDamage = (double) totalMagicDamage / simulationCount;
//             double avgElementDamage = (double) totalElementDamage / simulationCount;
//             magicLabel.setText("平均总法术伤害: " + String.format("%.2f", avgMagicDamage));
//             elementLabel.setText("平均总元素伤害: " + String.format("%.2f", avgElementDamage));

//             JLabel countLabel = (JLabel) ((JPanel) getComponent(0)).getComponent(2);
//             countLabel.setText("模拟次数: " + simulationCount + "/" + MAX_SIMULATIONS);

//             int dataSize = Math.min(1000, magicDamageList.size());
//             List<Integer> chartMagicData = new ArrayList<>();
//             List<Integer> chartElementData = new ArrayList<>();

//             int pointsPerAverage = Math.max(1, dataSize / 100);
//             for (int i = 0; i < dataSize; i += pointsPerAverage) {
//                 long magicSum = 0;
//                 long elementSum = 0;
//                 int count = 0;

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

//             chartPanel.updateData(chartMagicData, chartElementData, simulationCount - dataSize, simulationCount);
//             repaint();
//         });
//     }
    
//     @Override
//     public void removeNotify() {
//         super.removeNotify();
//         if (scheduler != null && !scheduler.isShutdown()) {
//             scheduler.shutdown();
//         }
//     }
// }