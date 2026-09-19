// Adapted from shadcn/ui new-york-v4 native-select (MIT).
import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full" data-slot="native-select-wrapper">
      <select data-slot="native-select" className={cn("appearance-none pr-9 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" aria-hidden="true" />
    </div>
  );
}

export { NativeSelect };
