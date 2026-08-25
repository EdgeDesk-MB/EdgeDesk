import * as React from "react"

import { fieldControl } from "@/lib/ui/surface-styles"
import { cn } from "@/lib/utils"

function Input({ className, type, ref, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        fieldControl,
        "h-8 max-sm:h-10 w-full min-w-0 px-2.5 py-1 text-base outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:hover:bg-input/50 dark:disabled:bg-input/80",
        className
      )}
      {...props}
    />
  )
}

export { Input }
