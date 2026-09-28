import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default function NotFound() {
  return (
    <Empty className="min-h-dvh">
      <EmptyHeader>
        <EmptyTitle>页面不存在</EmptyTitle>
        <EmptyDescription>
          链接可能已失效，或者这个活动已经被删除了。
        </EmptyDescription>
      </EmptyHeader>
      {/* Styled link, not `<Button render={<Link />}>`: Base UI's Button
          enforces button semantics and logs an error when the rendered tag is
          an `<a>`. Upstream is explicit that links should be styled directly
          rather than routed through Button. */}
      <Link href="/activities" className={buttonVariants()}>
        回到活动列表
      </Link>
    </Empty>
  );
}
