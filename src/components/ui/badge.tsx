import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'outline' }
>(({ className, variant = 'default', ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
      variant === 'default' && "border-transparent bg-primary text-primary-foreground",
      variant === 'outline' && "border-current",
      className
    )}
    {...props}
  />
))
Badge.displayName = "Badge"

export { Badge }
