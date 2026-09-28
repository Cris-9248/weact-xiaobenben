"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Next 16 renamed the error-boundary prop: `retry` re-fetches *and*
 * re-renders, where the old `reset` only cleared error state.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-md p-6">
      <Alert variant="destructive">
        <AlertTitle>出了点问题</AlertTitle>
        <AlertDescription>
          {error.message || "页面加载失败，请重试。"}
        </AlertDescription>
      </Alert>
      <Button className="mt-4" onClick={() => retry()}>
        重试
      </Button>
    </div>
  );
}
