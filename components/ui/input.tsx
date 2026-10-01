import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // `h-11` = 44px，`components/ui/button.tsx` 那条地板同样适用于输入框 —— 一个
        // 44px 的按钮旁边站着一个 32px 的输入框是没有道理的。
        //
        // **`text-base` 不要改成 `text-sm`。** 16px 是 iOS Safari 触发聚焦缩放的分界线，
        // 手机上小于它就会在点进输入框时把整个页面放大，而且不手动缩回去出不来。
        // `md:text-sm` 才是桌面那一档。
        "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
