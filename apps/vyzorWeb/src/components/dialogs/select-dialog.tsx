import * as React from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utilities";

interface SelectDialogProperties {
  readonly value: string | number | null;
  readonly options: readonly { readonly value: number | string; readonly label: string }[];
  readonly placeholder?: string;
  readonly onChange: (value: string | number) => void;
  readonly onSuccess?: (message: string) => void;
  readonly formatMessage?: (value: string | number) => string;
  readonly triggerLabel?: string;
  readonly disabled?: boolean;
}

export function SelectDialog({
  value,
  options,
  placeholder = "Select option",
  onChange,
  onSuccess,
  formatMessage,
  triggerLabel,
  disabled = false,
}: SelectDialogProperties): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const displayValue = selectedOption?.label ?? placeholder;

  const handleSelect = React.useCallback(
    (optionValue: string | number) => {
      onChange(optionValue);

      if (onSuccess) {
        const message = formatMessage
          ? formatMessage(optionValue)
          : (options.find((o) => o.value === optionValue)?.label ?? String(optionValue));
        onSuccess(message);
      }

      setIsOpen(false);
    },
    [onChange, onSuccess, formatMessage, options],
  );

  const handleTriggerClick = React.useCallback(() => {
    if (!disabled) {
      setIsOpen(true);
    }
  }, [disabled]);

  const handleOverlayClick = React.useCallback((event_: React.MouseEvent) => {
    if (event_.target === event_.currentTarget) {
      setIsOpen(false);
    }
  }, []);

  React.useEffect(() => {
    const handleEscape = (event_: KeyboardEvent) => {
      if (event_.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const dialogReference = React.useRef<HTMLDivElement>(null);
  const triggerReference = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!isOpen || !dialogReference.current || !triggerReference.current) return;

    const dialog = dialogReference.current;
    const trigger = triggerReference.current;

    const positionDialog = () => {
      const triggerRect = trigger.getBoundingClientRect();

      const left = triggerRect.left;
      let top = triggerRect.bottom + 4;

      const dialogRect = dialog.getBoundingClientRect();

      if (top + dialogRect.height > window.innerHeight - 16) {
        top = triggerRect.top - dialogRect.height - 4;
      }
      if (top < 16) top = 16;

      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;
    };

    requestAnimationFrame(positionDialog);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        ref={triggerReference}
        onClick={handleTriggerClick}
        disabled={disabled}
        className={cn(
          "w-full sm:w-auto sm:min-w-[180px] flex items-center justify-between gap-3 bg-background border border-border-subtle rounded-md px-4 py-2.5 text-sm font-medium text-foreground cursor-pointer hover:border-border-hover focus:outline-none transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className={cn(!selectedOption && "text-text-tertiary")}>{displayValue}</span>
        <ChevronDown className="w-4 h-4 text-text-tertiary flex-shrink-0" />
      </button>

      {isOpen && (
        <>
          {}
          <div className="fixed inset-0 z-50" onClick={handleOverlayClick} />
          <div
            ref={dialogReference}
            className="fixed z-[60] w-full max-w-md bg-bg-secondary border border-border-subtle rounded-lg shadow-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <h3 className="text-base font-semibold text-foreground">
                {triggerLabel ?? "Select Option"}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-text-tertiary hover:text-foreground hover:bg-bg-hover transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto py-2">
              {options.length === 0 ? (
                <div className="px-5 py-3 text-sm text-text-tertiary">No options available</div>
              ) : (
                options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={cn(
                        "w-full flex items-center justify-between px-5 py-3 text-sm transition-colors",
                        isSelected
                          ? "bg-bg-hover text-foreground"
                          : "text-text-secondary hover:bg-bg-hover hover:text-foreground",
                      )}
                    >
                      <span>{option.label}</span>
                      {isSelected && <Check size={16} className="text-rose-500" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
