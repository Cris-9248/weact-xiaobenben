"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { IntimacyScore } from "@/lib/types";

const chartConfig = {
  score: {
    label: "亲密度",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

/**
 * X 轴刻度上放的是好友昵称，最长 20 字。绘图区在 320px 下只剩约 208px，
 * 五个柱子每个约 41px —— recharts 既不旋转也不截断，原样画出来就是几团叠在
 * 一起、互相盖住的字，而且还盖在旁边的柱子上。
 *
 * 截到 4 个字加省略号，配合 `interval={0}`：recharts 默认会按可用宽度自动抽稀
 * 刻度，抽掉的那个柱子看起来就像「没有名字」。完整昵称仍然读得到 —— 悬停时
 * tooltip 的第一行就是它（components/ui/chart.tsx:157，`label` 没有命中 config
 * 时会原样显示 X 轴的值）。
 *
 * 横向滚动或旋转 45° 都比截断更「完整」，但在一个 208px 宽的框里，前者要把图表
 * 从卡片里拽出来，后者要吃掉 60px 的高度，而这一页的重点是柱子的高低，不是名字。
 */
function truncateName(value: string): string {
  return value.length > 4 ? `${value.slice(0, 4)}…` : value;
}

/**
 * 亲密度 = 共同活动次数 + 互动频率 + 最近一次见面的时间衰减。
 * The scoring itself lives server-side once there is data; this only draws it.
 */
export function IntimacyChart({ data }: { data: IntimacyScore[] }) {
  const rows = data.map((d) => ({ name: d.friend.nickname, score: d.score }));

  return (
    <ChartContainer config={chartConfig} className="h-56 w-full">
      {/* 不要用负的 `margin.left` 去抢宽度。之前是 `margin={{ left: -20 }}` 配
          `YAxis width={40}`，想把轴那 40px 里没用上的部分收回来 —— 但负 margin 是把
          整张图往左推，刻度本身跟着出框，而 `<svg>` 的 `overflow` 是 hidden，
          于是最大值 `100` 被裁成了 `00`。收宽度要收 `YAxis` 的 `width`：轴自己变窄，
          刻度仍然落在框内。28px 够放下三位数（12px 字号约 21px）。 */}
      <BarChart data={rows} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          tickFormatter={truncateName}
        />
        <YAxis tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="score" fill="var(--color-score)" radius={6} />
      </BarChart>
    </ChartContainer>
  );
}
