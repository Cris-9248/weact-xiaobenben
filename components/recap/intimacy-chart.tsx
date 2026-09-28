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
 * 亲密度 = 共同活动次数 + 互动频率 + 最近一次见面的时间衰减。
 * The scoring itself lives server-side once there is data; this only draws it.
 */
export function IntimacyChart({ data }: { data: IntimacyScore[] }) {
  const rows = data.map((d) => ({ name: d.friend.nickname, score: d.score }));

  return (
    <ChartContainer config={chartConfig} className="h-56 w-full">
      <BarChart data={rows} margin={{ left: -20, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="score" fill="var(--color-score)" radius={6} />
      </BarChart>
    </ChartContainer>
  );
}
