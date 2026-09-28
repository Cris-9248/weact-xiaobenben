"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Sharing is copy-link plus the native share sheet.
 *
 * WeChat's JS-SDK route (自定义分享卡片) needs a verified 公众号, an
 * ICP-filed domain bound to it, and a server-side signature endpoint — none of
 * which a self-hosted app has by default. On iOS/Android the OS share sheet
 * lists WeChat anyway, and inside WeChat's own browser the built-in "…" menu
 * shares the page normally, so this covers the same ground without the SDK.
 */
export function ShareDialog({
  shareUrl,
  activityTitle,
}: {
  shareUrl: string;
  activityTitle: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast("链接已复制");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败，请手动选中链接复制");
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: activityTitle, url: shareUrl });
    } catch {
      // The user dismissed the sheet — not an error worth surfacing.
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <Share2 data-icon="inline-start" />
        分享
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分享这个活动</DialogTitle>
          <DialogDescription>
            拿到链接的人无需登录即可查看活动概况。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="share-url">分享链接</Label>
          <div className="flex gap-2">
            <Input id="share-url" readOnly value={shareUrl} />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copy}
              aria-label="复制链接"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={nativeShare}>用其他应用分享</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
