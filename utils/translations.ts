
import { Language } from '../types';

export const translations = {
  // Global / Common
  'app.title': { TH: 'SPP Smart Tracker', EN: 'SPP Smart Tracker', CN: 'SPP 智能追踪系统' },
  'app.subtitle': { TH: 'AI Verification System', EN: 'AI Verification System', CN: 'AI 验证系统' },
  'app.division': { TH: 'กองจัดการโรงไฟฟ้า SPP/VSPP', EN: 'SPP/VSPP Division', CN: 'SPP/VSPP 部门' },
  'btn.save': { TH: 'บันทึก', EN: 'Save', CN: '保存' },
  'btn.cancel': { TH: 'ยกเลิก', EN: 'Cancel', CN: '取消' },
  'btn.back': { TH: 'ย้อนกลับ', EN: 'Back', CN: '返回' },
  'btn.confirm': { TH: 'ยืนยัน', EN: 'Confirm', CN: '确认' },
  'btn.edit': { TH: 'แก้ไข', EN: 'Edit', CN: '编辑' },
  'btn.report': { TH: 'ออกรายงาน', EN: 'Report', CN: '报告' },
  'status.pending': { TH: 'รอดำเนินการ', EN: 'Pending', CN: '待处理' },
  'status.completed': { TH: 'เสร็จสิ้น', EN: 'Completed', CN: '已完成' },
  'status.flagged': { TH: 'แจ้งเตือน', EN: 'Flagged', CN: '标记' },
  'loading': { TH: 'กำลังโหลด...', EN: 'Loading...', CN: '加载中...' },

  // Login
  'login.title': { TH: 'เข้าสู่ระบบ', EN: 'Sign In', CN: '登录' },
  'login.userid': { TH: 'รหัสผู้ใช้งาน / เบอร์โทรศัพท์', EN: 'User ID / Phone Number', CN: '用户ID / 电话号码' },
  'login.password': { TH: 'รหัสผ่าน', EN: 'Password', CN: '密码' },
  'login.otp': { TH: 'เข้าสู่ระบบด้วย OTP', EN: 'OTP Login', CN: 'OTP 登录' },
  'login.pass_mode': { TH: 'รหัสผ่าน', EN: 'Password', CN: '密码' },
  'login.request_otp': { TH: 'ขอรหัส OTP', EN: 'Request OTP', CN: '请求 OTP' },
  'login.submit': { TH: 'เข้าสู่ระบบ', EN: 'Sign In', CN: '登录' },
  'login.footer': { TH: 'การเข้าใช้งานถือว่ายอมรับ', EN: 'By accessing, you agree to', CN: '访问即表示同意' },

  // Navigation
  'nav.dashboard': { TH: 'ภาพรวม', EN: 'Dashboard', CN: '仪表板' },
  'nav.plants': { TH: 'โรงไฟฟ้า', EN: 'Plants', CN: '电厂' },
  'nav.tasks': { TH: 'งานตรวจ', EN: 'Tasks', CN: '任务' },
  'nav.tools': { TH: 'เครื่องมือ', EN: 'Tools', CN: '工具' },
  'nav.profile': { TH: 'บัญชี', EN: 'Account', CN: '账户' },
  'nav.logout': { TH: 'ออกจากระบบ', EN: 'Logout', CN: '登出' },

  // Dashboard
  'dash.title': { TH: 'ศูนย์ปฏิบัติการ', EN: 'Operational Dashboard', CN: '运营仪表板' },
  'dash.system_online': { TH: 'ระบบออนไลน์', EN: 'System Online', CN: '系统在线' },
  'dash.pending_tasks': { TH: 'งานรอตรวจ', EN: 'Pending Tasks', CN: '待处理任务' },
  'dash.completed_tasks': { TH: 'เสร็จสิ้น (เดือนนี้)', EN: 'Completed (Month)', CN: '已完成 (月)' },
  'dash.risk_alerts': { TH: 'จุดเสี่ยง', EN: 'Risk Alerts', CN: '风险警报' },
  'dash.items': { TH: 'รายการ', EN: 'items', CN: '项' },
  'dash.critical': { TH: 'วิกฤต', EN: 'critical', CN: '关键' },
  'dash.chart_title': { TH: 'ค่าความต้านทานดิน', EN: 'Grounding Resistance', CN: '接地电阻' },
  'dash.chart_subtitle': { TH: 'ภาพรวมสุขภาพระบบ (Ohm)', EN: 'System Health Overview (Ohm)', CN: '系统健康概览 (Ohm)' },
  'dash.limit': { TH: 'เกณฑ์ (5Ω)', EN: 'Limit (5Ω)', CN: '限制 (5Ω)' },
  'dash.management': { TH: 'การจัดการ', EN: 'Management', CN: '管理' },
  'dash.plant_registry': { TH: 'ทะเบียนโรงไฟฟ้า', EN: 'Plant Registry', CN: '电厂登记' },
  'dash.manage_db': { TH: 'จัดการฐานข้อมูล', EN: 'Manage Database', CN: '管理数据库' },
  'dash.equipment': { TH: 'อุปกรณ์เครื่องมือ', EN: 'Equipment', CN: '设备' },
  'dash.status_cal': { TH: 'สถานะและการตรวจสอบ', EN: 'Status & Inspection', CN: '状态与检查' },
  'dash.ai_active': { TH: 'AI Audit ทำงานอยู่', EN: 'AI Audit Active', CN: 'AI 审计激活' },
  'dash.ai_desc': { TH: 'Gemini กำลังตรวจสอบข้อมูลเพื่อหาความผิดปกติแบบเรียลไทม์', EN: 'Gemini is monitoring inspection data for anomalies in real-time.', CN: 'Gemini 正在实时监控检查数据中的异常。' },
  'dash.recent_activity': { TH: 'กิจกรรมล่าสุด', EN: 'Recent Activity', CN: '最近活动' },
  'dash.last_5': { TH: '5 รายการล่าสุด', EN: 'Last 5 entries', CN: '最近5条' },
  'dash.showing': { TH: 'แสดง', EN: 'Showing', CN: '显示' },
  'dash.no_data': { TH: 'ไม่มีข้อมูล', EN: 'No data', CN: '没有数据' },
  'dash.location': { TH: 'พิกัด', EN: 'Location', CN: '位置' },
  'dash.result': { TH: 'ผลตรวจ', EN: 'Result', CN: '结果' },
  'dash.away': { TH: 'ห่าง', EN: 'away', CN: '距离' },

  // Inspection Form
  'form.gps_title': { TH: 'ระบบยืนยันพิกัด GPS', EN: 'GPS Verification System', CN: 'GPS 验证系统' },
  'form.target': { TH: 'เป้าหมาย', EN: 'Target', CN: '目标' },
  'form.current': { TH: 'ปัจจุบัน', EN: 'Current', CN: '当前' },
  'form.distance': { TH: 'ระยะทางโดยประมาณ', EN: 'Est. Road Dist.', CN: '预计道路距离' },
  'form.ai_copilot': { TH: 'AI Voice Co-pilot', EN: 'AI Voice Co-pilot', CN: 'AI 语音助手' },
  'form.voltage': { TH: 'แรงดันไฟฟ้า', EN: 'Voltage', CN: '电压' },
  'form.ohm': { TH: 'ความต้านทานดิน', EN: 'Grounding Ohm', CN: '接地电阻' },
  'form.inspector': { TH: 'ผู้ตรวจสอบ', EN: 'Inspector', CN: '检查员' },
  'form.producer': { TH: 'ผู้ผลิตไฟฟ้า', EN: 'Producer', CN: '生产者' },
  'form.upload_photo': { TH: 'แตะเพื่อถ่ายรูปตู้ควบคุม', EN: 'Tap to capture control panel', CN: '点击拍摄控制面板' },
  'form.analyze_audit': { TH: 'วิเคราะห์ผลตรวจ', EN: 'Analyze Audit', CN: '分析审计' },
  'form.locked_dist': { TH: 'ล็อค (อยู่นอกระยะ)', EN: 'Locked (Distance Error)', CN: '锁定 (距离错误)' },

  // Profile & Settings
  'profile.title': { TH: 'ข้อมูลส่วนตัว', EN: 'My Profile', CN: '我的资料' },
  'profile.account': { TH: 'บัญชีผู้ใช้', EN: 'Account', CN: '账户' },
  'profile.other': { TH: 'อื่นๆ', EN: 'Other', CN: '其他' },
  'profile.notifications': { TH: 'การแจ้งเตือน', EN: 'Notifications', CN: '通知' },
  'profile.security': { TH: 'ความปลอดภัย', EN: 'Security', CN: '安全' },
  'profile.help': { TH: 'ช่วยเหลือ', EN: 'Help & Support', CN: '帮助与支持' },
  'profile.settings': { TH: 'ตั้งค่าระบบ', EN: 'App Settings', CN: '应用设置' },
  'profile.lang': { TH: 'ภาษา', EN: 'Language', CN: '语言' },
  'profile.lang_desc': { TH: 'เลือกภาษาที่แสดงผลในแอป', EN: 'Select app interface language', CN: '选择应用界面语言' },
  'profile.theme': { TH: 'ธีม', EN: 'Theme', CN: '主题' },
  'profile.theme_desc': { TH: 'รูปแบบการแสดงผล', EN: 'App Appearance', CN: '应用外观' },
  'profile.sync': { TH: 'ซิงค์ข้อมูลอัตโนมัติ', EN: 'Auto-Sync Data', CN: '自动同步数据' },
  'profile.sync_desc': { TH: 'ซิงค์ข้อมูลเมื่อเชื่อมต่อเน็ต', EN: 'Automatically sync data when online', CN: '在线时自动同步数据' },
  'profile.data_saver': { TH: 'โหมดประหยัดข้อมูล', EN: 'Data Saver', CN: '数据保存模式' },
  'profile.data_saver_desc': { TH: 'ลดความละเอียดภาพถ่าย', EN: 'Reduce image quality to save data', CN: '降低图像质量以节省数据' },
  'profile.perf': { TH: 'ประสิทธิภาพการทำงาน', EN: 'Performance', CN: '工作表现' },
  'profile.accuracy': { TH: 'ความแม่นยำ', EN: 'Accuracy', CN: '准确率' },
  'profile.completed': { TH: 'งานที่เสร็จสิ้น', EN: 'Tasks Done', CN: '已完成任务' },
  
  // Profile Edit
  'profile.name': { TH: 'ชื่อ-นามสกุล', EN: 'Name', CN: '姓名' },
  'profile.position': { TH: 'ตำแหน่ง', EN: 'Position', CN: '职位' },
  'profile.email': { TH: 'อีเมล', EN: 'Email', CN: '电子邮件' },
  'profile.phone': { TH: 'เบอร์โทรศัพท์', EN: 'Phone', CN: '电话' },
  'profile.zone': { TH: 'พื้นที่รับผิดชอบ', EN: 'Zone', CN: '区域' },

  // Plants
  'plant.registry': { TH: 'ทะเบียนโรงไฟฟ้า', EN: 'Plant Registry', CN: '电厂登记' },
  'plant.new': { TH: 'ลงทะเบียนใหม่', EN: 'Register New', CN: '注册新电厂' },
  'plant.search': { TH: 'ค้นหาชื่อ หรือ รหัส...', EN: 'Search name or ID...', CN: '搜索名称或ID...' },
  'plant.status': { TH: 'สถานะ', EN: 'Status', CN: '状态' },
  'plant.capacity': { TH: 'กำลังผลิต', EN: 'Capacity', CN: '产能' },
  'plant.zone': { TH: 'เขตพื้นที่', EN: 'Zone', CN: '区域' },

};

export type TranslationKey = keyof typeof translations;
