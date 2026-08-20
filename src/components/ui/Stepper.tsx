import { cn } from "@/lib/utils";

export interface StepperProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <ol className={cn("flex items-center w-full", className)}>
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step}
            className={cn("flex items-center", !isLast && "flex-1")}
          >
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  isCompleted &&
                    "bg-primary border-primary text-black",
                  isCurrent &&
                    "border-primary text-primary bg-primary-muted",
                  !isCompleted &&
                    !isCurrent &&
                    "border-border text-foreground-muted",
                )}
              >
                {isCompleted ? "✓" : stepNumber}
              </div>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  isCurrent ? "text-foreground font-medium" : "text-foreground-muted",
                )}
              >
                {step}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  "mx-2 h-px flex-1",
                  isCompleted ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
