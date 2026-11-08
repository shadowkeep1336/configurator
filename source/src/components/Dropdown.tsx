import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

export function Dropdown({
  open,
  setOpen,
  className = '',
  triggerClassName,
  trigger,
  panelClassName = '',
  disabled,
  children,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  className?: string;
  triggerClassName: string;
  trigger: ReactNode;
  panelClassName?: string;
  disabled?: boolean;
  children: ReactNode;
})
{
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() =>
  {
    if (!open) return;
    const onDown = (e: MouseEvent) =>
    {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    const panel = root.current?.querySelector('.dropdown-panel');
    panel?.querySelector<HTMLElement>('input, [aria-selected="true"], [role="option"]')?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, setOpen]);

  const onKeyDown = (e: KeyboardEvent) =>
  {
    if (e.key === 'Escape' && open)
    {
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (!open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    const options = [...(root.current?.querySelectorAll<HTMLElement>('[role="option"]:not(:disabled)') ?? [])];
    if (!options.length) return;
    e.preventDefault();
    const at = options.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? Math.min(at + 1, options.length - 1) : at <= 0 ? 0 : at - 1;
    options[next].focus();
    options[next].scrollIntoView({ block: 'nearest' });
  };

  return (
    <div className={`dropdown ${open ? 'open' : ''} ${className}`} ref={root} onKeyDown={onKeyDown}>
      <button
        ref={button}
        className={triggerClassName}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open && <div className={`dropdown-panel ${panelClassName}`}>{children}</div>}
    </div>
  );
}
