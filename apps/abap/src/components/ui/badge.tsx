import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap", className)}
      {...props}
    />
  );
}
