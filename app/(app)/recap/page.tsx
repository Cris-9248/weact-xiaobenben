import { PageHeader, Placeholder } from "@/components/page-header";
import { IntimacyChart } from "@/components/recap/intimacy-chart";
import { TypeStats } from "@/components/recap/type-stats";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { intimacy, yearlyRecap } from "@/lib/mock-data";

export const metadata = { title: "回顾" };

export default function RecapPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${yearlyRecap.year} 年回顾`}
        description="这一年你和朋友们一起做过的事。"
      />

      <TypeStats
        totalActivities={yearlyRecap.totalActivities}
        byType={yearlyRecap.byType}
      />

      <Card>
        <CardHeader>
          <CardTitle>和朋友们的亲密度</CardTitle>
        </CardHeader>
        <CardContent>
          <IntimacyChart data={intimacy} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>年度之最</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {yearlyRecap.highlights.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
            >
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <span className="text-right">
                <span className="font-heading font-semibold">{item.value}</span>
                {item.hint ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Placeholder>
        待接入：定时任务（每年/每季度）生成回顾快照；亲密度按共同活动、
        评论互动和最近见面时间计算。当前展示的是静态示例数据。
      </Placeholder>
    </div>
  );
}

