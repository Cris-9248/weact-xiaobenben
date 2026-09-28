"use client";

import { useRef, useState } from "react";
import { ImagePlus, Mic, Send, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

/**
 * 发表感想：文字 / 图片 / 语音，三者至少有一个。
 * Upload targets (object storage) and the Server Action are not wired yet.
 */
export function MomentComposer() {
  const [body, setBody] = useState("");
  const [recording, setRecording] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const canSend = body.trim().length > 0 || recording;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    toast("发布尚未接入后端", { description: "上传与写入待实现。" });
  }

  return (
    <Card>
      <CardContent className="py-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={body}
            rows={3}
            placeholder="记录点什么…"
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={() =>
                toast("图片上传尚未接入", { description: "需要对象存储。" })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="添加图片"
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus />
            </Button>
            <Button
              type="button"
              variant={recording ? "destructive" : "ghost"}
              size="icon-sm"
              aria-label={recording ? "停止录音" : "录制语音"}
              onClick={() => {
                setRecording((r) => !r);
                toast(recording ? "已停止录音" : "录音尚未接入", {
                  description: "需要麦克风权限与上传接口。",
                });
              }}
            >
              {recording ? <Square /> : <Mic />}
            </Button>
            <Button type="submit" size="sm" className="ml-auto" disabled={!canSend}>
              <Send data-icon="inline-start" />
              发布
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
