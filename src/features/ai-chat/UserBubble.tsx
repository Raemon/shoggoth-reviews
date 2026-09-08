export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end px-1.5 py-1">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-field px-2 py-1.5 font-serif text-[13px] leading-[1.5] text-ink">{text}</p>
    </div>
  );
}
