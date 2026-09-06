const CAP =
  'inline-flex min-w-[15px] shrink-0 items-center justify-center rounded-[4px] border border-panel-edge bg-btn px-[3px] py-[2px] font-mono text-[9px] uppercase leading-none text-ink-dim shadow-[0_1px_0_var(--panel-edge)]';

export function HotkeyCap({ hotkey, hidden }: { hotkey: string; hidden?: boolean }) {
  return (
    <kbd aria-hidden={hidden} className={CAP}>
      {hotkey}
    </kbd>
  );
}
