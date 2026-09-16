import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameSystemWithCount } from "@ttrpg-club/shared";
import { SystemCover } from "../../components/SystemCover";

export interface SystemGroup {
  label: string;
  systems: GameSystemWithCount[];
}

/**
 * A system dropdown in the site's own clothes. A native <select> renders its open list
 * in the OS's chrome — unstyleable, and next to our inputs it looks borrowed — so this
 * draws the list itself, which also makes room for each system's cover.
 *
 * Keyboard and screen-reader behaviour is the part a native select gives away for free,
 * so it's all reimplemented here: roles, arrows/Home/End, Enter and Escape, focus
 * returning to the trigger, and the active option scrolled into view.
 */
export function SystemPicker({
  groups,
  value,
  onChange,
  disabled,
  placeholder,
  labelledBy,
}: {
  groups: SystemGroup[];
  value: string;
  onChange: (systemId: string) => void;
  disabled?: boolean;
  placeholder: string;
  /** Id of the visible label above the picker — it isn't a form field, so no <label>. */
  labelledBy?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  const flat = groups.flatMap((group) => group.systems);
  const selected = flat.find((system) => system.systemId === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Keep the highlighted row visible while arrowing through a scrolled list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openAt(index: number) {
    setActiveIndex(Math.max(0, Math.min(index, flat.length - 1)));
    setOpen(true);
  }

  function choose(systemId: string) {
    onChange(systemId);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const selectedIndex = flat.findIndex((system) => system.systemId === value);
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(flat.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (flat[activeIndex]) choose(flat[activeIndex].systemId);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  let flatIndex = -1;

  return (
    <div ref={containerRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelledBy ? `${labelledBy} ${listboxId}-value` : undefined}
        aria-controls={open ? listboxId : undefined}
        onClick={() => (open ? setOpen(false) : openAt(flat.findIndex((s) => s.systemId === value)))}
        className={`flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left font-medium ${
          selected ? "text-ink" : "text-ink-muted"
        } hover:bg-surface-2`}
      >
        {selected && (
          <span className="h-9 w-7 flex-shrink-0 overflow-hidden rounded-md border border-border">
            <SystemCover system={selected} size="thumb" />
          </span>
        )}
        <span id={`${listboxId}-value`} className="min-w-0 flex-1 truncate">
          {selected ? selected.name : placeholder}
        </span>
        <span aria-hidden="true" className={`flex-shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={t("telegramApp.createPollSystem")}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {groups.map((group) => (
            <li key={group.label} role="presentation">
              {groups.length > 1 && (
                <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">
                  {group.label}
                </p>
              )}
              <ul role="presentation">
                {group.systems.map((system) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  const isSelected = system.systemId === value;
                  return (
                    <li
                      key={system.systemId}
                      role="option"
                      aria-selected={isSelected}
                      data-active={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(system.systemId)}
                      className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                        index === activeIndex ? "bg-surface-2" : ""
                      } ${isSelected ? "font-semibold text-accent" : "text-ink"}`}
                    >
                      <span className="h-9 w-7 flex-shrink-0 overflow-hidden rounded-md border border-border">
                        <SystemCover system={system} size="thumb" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{system.name}</span>
                      {isSelected && <span aria-hidden="true">✓</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
