import * as React from "react";

import { cn } from "~/lib/utils";

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "border-input bg-transparent h-9 w-full rounded-md border border-gray-300 px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-black focus-visible:ring-black/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Select };