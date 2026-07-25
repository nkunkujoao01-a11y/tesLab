// A password <Input> with a show/hide toggle — real students on a phone
// keyboard mistype passwords often enough that "no way to check what you
// typed before submitting" is a real point of friction, especially for
// the NUST student-number login where a wrong password just silently
// fails with no hint why.
import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PasswordInput = forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          // Not part of the form's own tab order — a show/hide toggle
          // isn't something you'd tab to before the submit button.
          tabIndex={-1}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
