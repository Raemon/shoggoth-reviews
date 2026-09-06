const CAP =
  'inline-flex h-[14px] min-w-[14px] shrink-0 items-center justify-center rounded-[4px] border border-panel-edge bg-btn px-[3px] pt-[2px] text-center font-mono text-[9px] uppercase leading-none text-ink-dim';

export function HotkeyCap({ hotkey, hidden }: { hotkey: string; hidden?: boolean }) {
  return (
    <kbd aria-hidden={hidden} className={CAP}>
      {hotkey}
    </kbd>
  );
}
