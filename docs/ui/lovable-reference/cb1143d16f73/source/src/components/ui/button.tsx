import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex max-w-full items-center justify-center gap-2 whitespace-normal rounded-xl text-sm font-medium cursor-pointer transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-card hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border bg-card shadow-card hover:bg-accent hover:text-accent-foreground",
        secondary: "border border-border bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-ink-soft hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        signal: "bg-synced text-primary-foreground shadow-card hover:bg-synced/90",
        attention: "bg-attention text-primary-foreground shadow-card hover:bg-attention/90",
      },
      size: {
        default: "min-h-12 px-5 py-2",
        sm: "min-h-12 px-3 py-2 text-xs",
        lg: "min-h-12 px-8 text-base",
        icon: "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
