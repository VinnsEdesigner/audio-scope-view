import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utilities";

export interface InlineSelectOption {
  value: string | number | undefined;
  label: string;
}

interface InlineSelectProperties {
  value: string | number | null | undefined;
  options: readonly InlineSelectOption[];
  onChange: (value: string | number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function InlineSelect({
  value,
  options,
  onChange,
  placeholder = "Select option",
  disabled = false,
  className,
}: InlineSelectProperties): React.ReactElement {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerReference = React.useRef<HTMLDivElement>(null);
  const dropdownReference = React.useRef<HTMLDivElement>(null);

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const displayValue = selectedOption?.label ?? placeholder;

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerReference.current &&
        !containerReference.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Position dropdown, flipping/clamping to stay within the viewport.
  React.useEffect(() => {
    if (isOpen && containerReference.current && dropdownReference.current) {
      const container = containerReference.current;
      const dropdown = dropdownReference.current;
      const containerRect = container.getBoundingClientRect();

      dropdown.style.minWidth = `${containerRect.width}px`;
      dropdown.style.left = "0";

      const gap = 4;
      const viewportHeight = window.innerHeight;
      // Measure the dropdown's natural height by temporarily rendering it open.
      const naturalHeight = dropdown.scrollHeight;
      const spaceBelow = viewportHeight - (containerRect.bottom + gap);
      const spaceAbove = containerRect.top - gap;

      if (spaceBelow >= naturalHeight || spaceBelow >= spaceAbove) {
        // Open downward, clamped to the available space so it never runs off-screen.
        dropdown.style.top = `${containerRect.height + gap}px`;
        dropdown.style.bottom = "";
        dropdown.style.maxHeight = `${Math.max(spaceBelow, 120)}px`;
      } else {
        // Not enough room below — open upward, clamped to the space above the trigger.
        dropdown.style.top = "";
        dropdown.style.bottom = `${containerRect.height + gap}px`;
        dropdown.style.maxHeight = `${Math.max(spaceAbove, 120)}px`;
      }
    }
  }, [isOpen]);

  const handleSelect = React.useCallback(
    (optionValue: string | number | undefined) => {
      onChange(optionValue);
      setIsOpen(false);
    },
    [onChange],
  );

  return (
    <div ref={containerReference} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-border bg-transparent px-3 py-1 text-sm text-foreground",
          "placeholder:text-text-tertiary",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "ring-1 ring-ring",
          !selectedOption && "text-text-tertiary",
        )}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown
          size={16}
          className={cn(
            "text-text-tertiary flex-shrink-0 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div
          ref={dropdownReference}
          className="absolute z-50 bg-bg-secondary border border-border-subtle rounded-md shadow-lg overflow-hidden"
        >
          <div className="overflow-y-auto py-1" style={{ maxHeight: "inherit" }}>
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-tertiary">No options available</div>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors",
                      isSelected
                        ? "bg-bg-hover text-foreground"
                        : "text-text-secondary hover:bg-bg-hover hover:text-foreground",
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check size={16} className="text-icon flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
