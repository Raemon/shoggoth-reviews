'use client';

import { FilterField } from './FilterField';

export function FilterRow({ value, onChange, label }: { value: string; onChange: (next: string) => void; label: string }) {
  return (
    <div className="border-b border-panel-edge px-1.5 py-[2px]">
      <FilterField value={value} onChange={onChange} placeholder="filter files" aria-label={label} />
    </div>
  );
}
