/**
 * 活动域的假数据。
 *
 * 用户和会话已经是真的了 —— `users` / `sessions` 表，读它们走 lib/auth/session.ts。
 * 这个文件里剩下的全是活动域的：活动、感想、初步计划、投票、分账、行程报价、
 * 回顾都还没有表，所以在那些表建起来之前，它们的 fixture 只能留在这里。
 *
 * **`me` 和 `users` 故意不再 `export`。** 它们是上面那些 fixture 的演员表：
 * `activities[0].hostId` 指向 `me.id`，`moments[0].author` 是 `users[0]`，
 * 假数据内部要互相引用，所以它们必须存在。但真实界面上的「我」来自会话，
 * 永远不是这里。去掉 `export` 让「真实界面误读 mock 用户」在**编译期**就不可能，
 * 而不是靠一句注释提醒 —— 谁再写 `import { me }`，tsc 立刻报错。
 *
 * 好友关系也搬走了：`friendships` / `myFriendships` 已删除，真身在
 * `friendships` 表和 lib/friends/dal.ts，按 `ownerId` 过滤是 DAL 的职责。
 */

import type {
  Activity,
  IntimacyScore,
  Moment,
  ProposalWithVotes,
  ShareLink,
  SplitBill,
  TravelQuote,
  User,
  YearlyRecap,
} from "@/lib/types";

const me: User = {
  id: "u_me",
  phone: "13800138000",
  nickname: "小笨笨",
  passwordSetAt: "2026-01-04T10:00:00+08:00",
};

const users: User[] = [
  { id: "u_2", phone: "13900139000", nickname: "阿哲" },
  { id: "u_3", phone: "13700137000", nickname: "小林" },
  { id: "u_4", phone: "13600136000", nickname: "婷婷" },
  { id: "u_5", phone: "13500135000", nickname: "老王" },
  { id: "u_6", phone: "13400134000", nickname: "大鹏" },
];

export const activities: Activity[] = [
  {
    id: "a_1",
    type: "travel",
    title: "洱海环湖三日",
    startsAt: "2026-10-02T08:00:00+08:00",
    endsAt: "2026-10-05T18:00:00+08:00",
    location: { label: "大理 · 洱海", address: "云南省大理白族自治州" },
    budgetTotal: 6800,
    budgetPerPerson: 1700,
    description: "租车环湖，住双廊，第三天去喜洲看稻田。早晚温差大，带外套。",
    hostId: me.id,
    members: [me, users[0], users[1], users[2]],
    status: "planning",
    createdAt: "2026-09-12T21:14:00+08:00",
  },
  {
    id: "a_2",
    type: "dining",
    title: "老王家火锅局",
    startsAt: "2026-09-26T19:00:00+08:00",
    endsAt: "2026-09-26T22:30:00+08:00",
    location: { label: "蜀大侠 · 春熙路店", address: "成都市锦江区" },
    budgetTotal: 640,
    budgetPerPerson: 160,
    description: "老王的生日局，他请客但大家 AA 蛋糕。",
    hostId: users[3].id,
    members: [me, users[0], users[3], users[1]],
    status: "finished",
    createdAt: "2026-09-18T10:02:00+08:00",
  },
  {
    id: "a_3",
    type: "play",
    title: "周末剧本杀",
    startsAt: "2026-10-11T14:00:00+08:00",
    endsAt: "2026-10-11T19:00:00+08:00",
    location: { label: "迷雾剧场", address: "成都市武侯区" },
    budgetTotal: 480,
    budgetPerPerson: 120,
    description: "6 人本《雾鸦馆》，提前半小时到场读本。",
    hostId: users[0].id,
    members: [me, users[0], users[2], users[1]],
    status: "planning",
    createdAt: "2026-09-25T16:40:00+08:00",
  },
  {
    id: "a_4",
    type: "travel",
    title: "五一 · 青海湖骑行",
    startsAt: "2026-05-01T07:00:00+08:00",
    endsAt: "2026-05-04T20:00:00+08:00",
    location: { label: "青海湖", address: "青海省海南藏族自治州" },
    budgetTotal: 5200,
    budgetPerPerson: 1300,
    description: "环湖 360km，骑了三天，第二天逆风骑到崩溃。",
    hostId: me.id,
    members: [me, users[1], users[2]],
    status: "finished",
    createdAt: "2026-04-10T19:20:00+08:00",
  },
];

export const proposals: ProposalWithVotes[] = [
  {
    id: "p_1",
    activityId: "a_3",
    author: users[0],
    title: "迷雾剧场《雾鸦馆》",
    detail: "6 人硬核推理，有 NPC 互动，含服装。",
    location: { label: "迷雾剧场", address: "成都市武侯区" },
    startsAt: "2026-10-11T14:00:00+08:00",
    estimatedPerPerson: 120,
    createdAt: "2026-09-25T16:45:00+08:00",
    votedByMe: true,
    votes: [
      { id: "v_1", proposalId: "p_1", voter: me, createdAt: "2026-09-25T17:00:00+08:00" },
      { id: "v_2", proposalId: "p_1", voter: users[2], createdAt: "2026-09-25T17:30:00+08:00" },
      { id: "v_3", proposalId: "p_1", voter: users[1], createdAt: "2026-09-26T09:10:00+08:00" },
    ],
  },
  {
    id: "p_2",
    activityId: "a_3",
    author: users[2],
    title: "欢乐本《青楼》",
    detail: "轻松搞笑本，3 小时，适合不想烧脑的时候。",
    location: { label: "谜之屋", address: "成都市青羊区" },
    startsAt: "2026-10-11T15:00:00+08:00",
    estimatedPerPerson: 98,
    createdAt: "2026-09-26T11:20:00+08:00",
    votedByMe: false,
    votes: [
      { id: "v_4", proposalId: "p_2", voter: users[3], createdAt: "2026-09-26T12:00:00+08:00" },
    ],
  },
  {
    id: "p_3",
    activityId: "a_3",
    author: users[1],
    title: "密室逃脱 + 夜宵",
    detail: "先密室后串串，人均 150 左右。",
    startsAt: "2026-10-11T13:30:00+08:00",
    estimatedPerPerson: 150,
    createdAt: "2026-09-27T08:05:00+08:00",
    votedByMe: false,
    votes: [],
  },
];

export const moments: Moment[] = [
  {
    id: "m_1",
    activityId: "a_4",
    author: me,
    body: "第二天逆风骑了 80 公里，腿已经不是自己的了，但湖真的蓝得不像话。",
    attachments: [
      { kind: "image", url: "/placeholder-lake.jpg", width: 1200, height: 900 },
    ],
    createdAt: "2026-05-02T21:40:00+08:00",
  },
  {
    id: "m_2",
    activityId: "a_4",
    author: users[1],
    body: "这段风声是那天下午录的，值得收藏。",
    attachments: [{ kind: "voice", url: "/placeholder-voice.m4a", duration: 27 }],
    createdAt: "2026-05-03T18:12:00+08:00",
  },
  {
    id: "m_3",
    activityId: "a_2",
    author: users[3],
    body: "谢谢大家来给我过生日，蛋糕是阿哲挑的，好吃。",
    attachments: [],
    createdAt: "2026-09-26T23:05:00+08:00",
  },
];

export const splitBill: SplitBill = {
  activityId: "a_2",
  total: 640,
  shares: [
    { user: me, amount: 160, paid: 0 },
    { user: users[0], amount: 160, paid: 320 },
    { user: users[1], amount: 160, paid: 0 },
    { user: users[3], amount: 160, paid: 320 },
  ],
  settlements: [],
};

export const travelQuotes: TravelQuote[] = [
  {
    id: "t_1",
    kind: "transport",
    title: "成都 → 大理",
    provider: "中国国航 CA4411",
    fromLabel: "成都天府 T2",
    toLabel: "大理荒草坝",
    departAt: "2026-10-02T08:15:00+08:00",
    arriveAt: "2026-10-02T09:50:00+08:00",
    price: 620,
    currency: "CNY",
    fetchedAt: "2026-09-28T09:00:00+08:00",
    bookingUrl: "https://example.com/flight/CA4411",
  },
  {
    id: "t_2",
    kind: "transport",
    title: "成都南 → 大理",
    provider: "D875 动车",
    fromLabel: "成都南",
    toLabel: "大理",
    departAt: "2026-10-01T22:40:00+08:00",
    arriveAt: "2026-10-02T08:12:00+08:00",
    price: 285,
    currency: "CNY",
    fetchedAt: "2026-09-28T09:00:00+08:00",
  },
  {
    id: "t_3",
    kind: "lodging",
    title: "双廊海景民宿 · 两晚",
    provider: "海地生活",
    fromLabel: "10-02",
    toLabel: "10-04",
    price: 1160,
    currency: "CNY",
    fetchedAt: "2026-09-28T09:00:00+08:00",
    bookingUrl: "https://example.com/hotel",
  },
];

/**
 * Share tokens must be opaque and unguessable in production — never the
 * activity id, which would expose the whole id space to enumeration.
 */
export const shareLinks: ShareLink[] = [
  {
    token: "shr_9fK2mQ4tZx",
    activityId: "a_3",
    createdBy: me.id,
    createdAt: "2026-09-27T10:00:00+08:00",
    includeMembers: true,
    includeBill: false,
  },
  {
    token: "shr_7pL0wR8nVc",
    activityId: "a_2",
    createdBy: users[3].id,
    createdAt: "2026-09-20T10:00:00+08:00",
    includeMembers: false,
    includeBill: false,
  },
];

export const yearlyRecap: YearlyRecap = {
  year: 2026,
  totalActivities: 24,
  byType: { dining: 13, play: 7, travel: 4 },
  totalDistanceKm: 1840,
  topCompanion: users[1],
  monthlyCounts: [2, 1, 3, 2, 4, 1, 2, 3, 2, 2, 1, 1],
  highlights: [
    { label: "最长的一次旅行", value: "4 天", hint: "青海湖骑行" },
    { label: "最贵的一顿", value: "¥860", hint: "老王家火锅局" },
    { label: "出勤率最高", value: "小林", hint: "24 次里来了 19 次" },
  ],
};

export const intimacy: IntimacyScore[] = [
  { friend: users[1], score: 92, sharedActivities: 14, lastSeenAt: "2026-09-26T22:30:00+08:00" },
  { friend: users[0], score: 78, sharedActivities: 11, lastSeenAt: "2026-09-25T17:00:00+08:00" },
  { friend: users[2], score: 61, sharedActivities: 7, lastSeenAt: "2026-05-04T20:00:00+08:00" },
  { friend: users[3], score: 44, sharedActivities: 4, lastSeenAt: "2026-09-26T23:05:00+08:00" },
];
