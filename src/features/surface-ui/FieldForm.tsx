'use client';

import type { FormEvent } from 'react';
import { FORM_ACTION } from './buttonStyles';
import { MONO_FIELD } from './fieldStyles';

export function FieldForm({
  name,
  label,
  placeholder,
  action,
  type = 'text',
  disabled = false,
  onValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  action: string;
  type?: 'text' | 'password';
  disabled?: boolean;
  onValue: (value: string, form: HTMLFormElement) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onValue(String(new FormData(event.currentTarget).get(name) ?? '').trim(), event.currentTarget);
  };
  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 gap-2">
      <input name={name} type={type} placeholder={placeholder} aria-label={label} className={`${MONO_FIELD} min-w-0 flex-1`} />
      <button type="submit" disabled={disabled} className={FORM_ACTION}>
        {action}
      </button>
    </form>
  );
}
