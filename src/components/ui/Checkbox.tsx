import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <label
        htmlFor={inputId}
        className="flex items-center gap-2 text-sm text-foreground"
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn(
            "h-4 w-4 rounded border-border bg-background-elevated text-primary accent-primary focus:outline-none focus:ring-2 focus:ring-primary",
            className,
          )}
          {...props}
        />
        {label}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
