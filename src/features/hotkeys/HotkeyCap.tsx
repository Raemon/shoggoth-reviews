const CAP =
  'inline-grid size-[14px] shrink-0 place-items-center rounded-[2px] border border-panel-edge bg-btn font-mono text-[9px] uppercase leading-none text-ink-dim';

export function HotkeyCap({ hotkey, hidden }: { hotkey: string; hidden?: boolean }) {
  return (
    <kbd aria-hidden={hidden} className={CAP}>
      {hotkey}
    </kbd>
  );
}
