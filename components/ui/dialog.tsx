"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // LOCAL PATCH — re-running `shadcn add dialog --overwrite` will drop
          // `max-h-[calc(100dvh-2rem)]` and the inner scroll container. Without
          // the height cap this popup constrains width but not height, and the
          // overlay is a non-scrolling `fixed inset-0`, so a dialog taller than
          // the viewport is clipped at both ends and its content is unreachable.
          // Bites on landscape phones and whenever a soft keyboard shrinks the
          // visual viewport. `dvh` (not `vh`) so mobile URL-bar collapse counts.
          //
          // 滚动**不在这一层**，而在下面那个内层 div 上。关闭键是 `absolute`
          // 定位在这个 popup 上的，popup 自己一滚它就跟着内容滚出视野 —— 而手机上
          // 没有 Esc 键，能关掉弹窗的就只剩「点遮罩」这个不太显然的动作。
          // 把滚动收进内层之后，关闭键永远不动。
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {/* `min-h-0` 是必需的，不是保险：flex 子项的 `min-height` 默认是 `auto`，
            它拒绝收缩到内容高度以下，于是 `overflow-y-auto` 永远不生效、弹窗照旧
            被撑破。`flex flex-col gap-4` 和 `p-4` 是从 popup 那层原样搬过来的 ——
            `DialogFooter` 的 `-mx-4 -mb-4`（dialog.tsx:116）就是靠这个 p-4 抵消的，
            搬的时候漏掉一个，页脚就会缩进一圈。 */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {children}
        </div>
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    // `pr-12` 给右上角那个关闭键让位。它现在有 44×44（`size="icon-sm"` 跟着
    // components/ui/button.tsx 的触控地板一起抬了），从 `top-2 right-2` 起算，
    // 纵向盖住标题那一行、横向吃掉 52px —— 不留出这段，长一点的标题和说明文字的
    // 第一行会被它压住。
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 pr-12", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
