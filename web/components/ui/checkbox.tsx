import * as React from "react"

import { cn } from "@/lib/utils"

// Native checkbox semantics, with the same composable interface as our other
// shadcn-style primitives. Never inherit text-input padding or height here.
const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "type">>(
  ({ className, ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "m-0 size-4 min-h-0 shrink-0 cursor-pointer rounded border border-input p-0 accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  )
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
