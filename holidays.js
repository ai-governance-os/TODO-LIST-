// 马来西亚公共假期 (Cuti Umum) 与教育部 KPM B组州属学校假期 (Cuti Sekolah Kumpulan B)
// 涵盖 2026 年与 2027 年，支持用户在 App 内额外添加【特假 Cuti Peristiwa】或【州属专属假期】

const DEFAULT_HOLIDAYS = [
  // ==================== 2026 马来西亚公共假期 & 节日 ====================
  { id: 'h-2026-0101', date: '2026-01-01', endDate: '2026-01-01', title: '元旦 Tahun Baru 2026', type: 'public' },
  { id: 'h-2026-0201', date: '2026-02-01', endDate: '2026-02-02', title: '大宝森节 & 联邦直辖区日 Thaipusam', type: 'public' },
  { id: 'h-2026-0217', date: '2026-02-17', endDate: '2026-02-18', title: '农历新年 Tahun Baru Cina', type: 'public' },
  { id: 'h-2026-0216', date: '2026-02-16', endDate: '2026-02-20', title: 'KPM 农历新年学校节日假 Cuti Perayaan TBC', type: 'school' },
  { id: 'h-2026-0320', date: '2026-03-20', endDate: '2026-03-21', title: '开斋节 Hari Raya Aidilfitri', type: 'public' },
  { id: 'h-2026-0321-s', date: '2026-03-21', endDate: '2026-03-29', title: '第一学期期中假 Cuti Penggal 1 (Kumpulan B)', type: 'school' },
  { id: 'h-2026-0501', date: '2026-05-01', endDate: '2026-05-01', title: '劳动节 Hari Pekerja', type: 'public' },
  { id: 'h-2026-0527', date: '2026-05-27', endDate: '2026-05-27', title: '哈芝节 Hari Raya Aidiladha', type: 'public' },
  { id: 'h-2026-0531', date: '2026-05-31', endDate: '2026-05-31', title: '卫塞节 Hari Wesak', type: 'public' },
  { id: 'h-2026-0601', date: '2026-06-01', endDate: '2026-06-01', title: '最高元首华诞 Hari Keputeraan YDP Agong', type: 'public' },
  { id: 'h-2026-0523-s', date: '2026-05-23', endDate: '2026-06-07', title: '年中假期 Cuti Pertengahan Tahun (Kumpulan B)', type: 'school' },
  { id: 'h-2026-0617', date: '2026-06-17', endDate: '2026-06-17', title: '回历元旦 Awal Muharram', type: 'public' },
  { id: 'h-2026-0825', date: '2026-08-25', endDate: '2026-08-25', title: '先知穆罕默德诞辰 Maulidur Rasul', type: 'public' },
  { id: 'h-2026-0831', date: '2026-08-31', endDate: '2026-08-31', title: '国庆日 Hari Kebangsaan', type: 'public' },
  { id: 'h-2026-0829-s', date: '2026-08-29', endDate: '2026-09-06', title: '第二学期期中假 Cuti Penggal 2 (Kumpulan B)', type: 'school' },
  { id: 'h-2026-0916', date: '2026-09-16', endDate: '2026-09-16', title: '马来西亚日 Hari Malaysia', type: 'public' },
  { id: 'h-2026-1108', date: '2026-11-08', endDate: '2026-11-09', title: '屠妖节 Deepavali (含补假)', type: 'public' },
  { id: 'h-2026-1109-s', date: '2026-11-09', endDate: '2026-11-10', title: 'KPM 屠妖节学校节日假 Cuti Tambahan KPM Deepavali', type: 'school' },
  { id: 'h-2026-1205-s', date: '2026-12-05', endDate: '2026-12-31', title: '2026 年终学校假期 Cuti Akhir Persekolahan 2026 (Kumpulan B)', type: 'school' },
  { id: 'h-2026-1225', date: '2026-12-25', endDate: '2026-12-25', title: '圣诞节 Hari Krismas', type: 'public' },

  // ==================== 2027 马来西亚公共假期 & 预计学校假期 ====================
  { id: 'h-2027-0101', date: '2027-01-01', endDate: '2027-01-01', title: '元旦 Tahun Baru 2027', type: 'public' },
  { id: 'h-2027-0121', date: '2027-01-21', endDate: '2027-01-21', title: '大宝森节 Thaipusam', type: 'public' },
  { id: 'h-2027-0206', date: '2027-02-06', endDate: '2027-02-08', title: '农历新年 Tahun Baru Cina (含补假)', type: 'public' },
  { id: 'h-2027-0204-s', date: '2027-02-04', endDate: '2027-02-10', title: 'KPM 农历新年学校节日假 Cuti Perayaan TBC', type: 'school' },
  { id: 'h-2027-0310', date: '2027-03-10', endDate: '2027-03-11', title: '开斋节 Hari Raya Aidilfitri', type: 'public' },
  { id: 'h-2027-0306-s', date: '2027-03-06', endDate: '2027-03-14', title: '第一学期期中假 Cuti Penggal 1 (Kumpulan B)', type: 'school' },
  { id: 'h-2027-0501', date: '2027-05-01', endDate: '2027-05-01', title: '劳动节 Hari Pekerja', type: 'public' },
  { id: 'h-2027-0517', date: '2027-05-17', endDate: '2027-05-17', title: '哈芝节 Hari Raya Aidiladha', type: 'public' },
  { id: 'h-2027-0520', date: '2027-05-20', endDate: '2027-05-20', title: '卫塞节 Hari Wesak', type: 'public' },
  { id: 'h-2027-0529-s', date: '2027-05-29', endDate: '2027-06-13', title: '年中假期 Cuti Pertengahan Tahun (Kumpulan B)', type: 'school' },
  { id: 'h-2027-0606', date: '2027-06-06', endDate: '2027-06-07', title: '回历元旦 & 元首华诞 Awal Muharram & Agong', type: 'public' },
  { id: 'h-2027-0814', date: '2027-08-14', endDate: '2027-08-14', title: '先知穆罕默德诞辰 Maulidur Rasul', type: 'public' },
  { id: 'h-2027-0831', date: '2027-08-31', endDate: '2027-08-31', title: '国庆日 Hari Kebangsaan', type: 'public' },
  { id: 'h-2027-0828-s', date: '2027-08-28', endDate: '2027-09-05', title: '第二学期期中假 Cuti Penggal 2 (Kumpulan B)', type: 'school' },
  { id: 'h-2027-0916', date: '2027-09-16', endDate: '2027-09-16', title: '马来西亚日 Hari Malaysia', type: 'public' },
  { id: 'h-2027-1028', date: '2027-10-28', endDate: '2027-10-28', title: '屠妖节 Deepavali', type: 'public' },
  { id: 'h-2027-1027-s', date: '2027-10-27', endDate: '2027-10-29', title: 'KPM 屠妖节学校节日假 Cuti Perayaan Deepavali', type: 'school' },
  { id: 'h-2027-1204-s', date: '2027-12-04', endDate: '2027-12-31', title: '2027 年终学校假期 Cuti Akhir Persekolahan 2027', type: 'school' },
  { id: 'h-2027-1225', date: '2027-12-25', endDate: '2027-12-25', title: '圣诞节 Hari Krismas', type: 'public' }
];

// 预设华小 GPK Pentadbiran 示范数据（首次打开时展示，方便立即体验同日多色、交代老师跟进、配合其他Bidang及附件功能）
const SAMPLE_TASKS = [
  {
    id: 'sample-1',
    title: 'Mesyuarat Kurikulum Bil. 4/2026 (第4次课程会议)',
    date: '2026-11-12',
    time: '14:00',
    category: 'bidang', // 'bidang' (蓝色) | 'school' (青色) | 'personal' (紫色)
    actionType: 'my_prep', // 'my_prep' (我需准备) | 'delegate' (交代老师) | 'event' (行程/活动)
    assignee: 'GPK Pentadbiran',
    status: 'pending', // 'pending' | 'in_progress' | 'done'
    priority: 'high',
    prepDays: 2,
    notes: '准备议程：1. 检讨 UASA 成绩分析 2. 2027 排课与科任意愿表 3. PBD 年终总结报告。',
    attachments: [
      {
        name: 'Surat_Panggilan_Kurikulum_Bil4.pdf',
        url: 'https://drive.google.com',
        type: 'link',
        size: 'Google Drive 公文'
      }
    ]
  },
  {
    id: 'sample-2',
    title: '各科主任提交年终 Panitia 报告 & 2027 预算',
    date: '2026-11-12',
    time: '16:00',
    category: 'bidang',
    actionType: 'delegate',
    assignee: '全体 Ketua Panitia (华/国/英/数/科)',
    status: 'in_progress',
    priority: 'high',
    prepDays: 0,
    notes: '已收：华文、数学。未交：国文、英文、科学（需在群组温馨提醒）。',
    attachments: [
      {
        name: 'Senarai_Semak_Panitia_2026.xlsx',
        url: 'https://docs.google.com/spreadsheets',
        type: 'sheet',
        size: 'Google Sheet 工作表'
      }
    ]
  },
  {
    id: 'sample-3',
    title: '配合 GPK Koko：毕业典礼暨颁奖礼 (Hari Anugerah) 学术奖项名单核对',
    date: '2026-11-12',
    time: '10:30',
    category: 'school',
    actionType: 'my_prep',
    assignee: '配合 GPK Kokurikulum & GPK HEM',
    status: 'pending',
    priority: 'medium',
    prepDays: 1,
    notes: '需从 PBD & UASA 总表筛选出各年级模范生与最佳进步奖名单，交给颁奖礼负责老师。',
    attachments: []
  },
  {
    id: 'sample-4',
    title: '下班后带家人晚餐 & 购买日常用品',
    date: '2026-11-12',
    time: '18:30',
    category: 'personal',
    actionType: 'event',
    assignee: '个人/家庭',
    status: 'pending',
    priority: 'normal',
    prepDays: 0,
    notes: '顺便去药局拿维他命。',
    attachments: []
  },
  {
    id: 'sample-5',
    title: '科任老师完成 idMe / PBD 年终评估输入',
    date: '2026-11-18',
    time: '17:00',
    category: 'bidang',
    actionType: 'delegate',
    assignee: '全体科任老师 (Guru Mata Pelajaran)',
    status: 'pending',
    priority: 'high',
    prepDays: 3,
    notes: '截止前 3 天检查 idMe 系统完成率，确保 100% 达标后呈交校长验证。',
    attachments: []
  },
  {
    id: 'sample-6',
    title: '配合 HEM：一年级新生证实与分班人数协调',
    date: '2026-11-20',
    time: '09:00',
    category: 'school',
    actionType: 'my_prep',
    assignee: '配合 GPK HEM',
    status: 'pending',
    priority: 'medium',
    prepDays: 0,
    notes: '确认 2027 一年级开班数量，以便安排 2027 级任与科任节数 (Agihan Tugas Guru)。',
    attachments: []
  }
];
