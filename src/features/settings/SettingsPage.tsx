'use client';

import { setSetting, useSetting } from './settingsStore';
import type { BlankLineSetting, Settings, ThemeSetting } from './settings';
import { useDesktopBridge } from '@/features/desktop/desktopBridge';
import { blankRowHeight, ROW_HEIGHT } from '@/features/pull-requests/diffMetrics';
import { PageHeading, SECTION_LABEL } from '@/features/sources/PageHeading';
import { ACCENT_CHOICE, CHOICE } from '@/features/surface-ui/buttonStyles';

const THEME_LABELS: Record<ThemeSetting, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const BLANK_LINE_LABELS: Record<BlankLineSetting, string> = { full: 'Full height', half: 'Half height', 'extra-small': 'Extra small' };

const PREVIEW_LINES = ["import { parse } from './parse';", '', 'export function read(text) {', '  const tree = parse(text);', '', '  return tree.root;', '}'];

export function SettingsPage() {
  return (
    <section className="max-w-2xl">
      <PageHeading eyebrow="reposcope" title="Settings" />
      <SavedWhere />
      <SettingChoices name="theme" legend="Theme" labels={THEME_LABELS} />
      <SettingChoices name="blankLines" legend="Blank lines in diffs" labels={BLANK_LINE_LABELS} />
      <BlankLinePreview />
    </section>
  );
}

function SavedWhere() {
  const where = useDesktopBridge() ? 'to ~/.reposcope/settings.json' : 'in a cookie in this browser';
  return <p className="mt-2 text-xs leading-5 text-ink-dim">Changes apply at once and are saved {where}.</p>;
}

function SettingChoices<K extends keyof Settings>({ name, legend, labels }: { name: K; legend: string; labels: Record<Settings[K], string> }) {
  const current = useSetting(name);
  const choices = Object.entries(labels) as [Settings[K], string][];
  return (
    <fieldset className="mt-5">
      <legend className={`mb-1 ${SECTION_LABEL}`}>{legend}</legend>
      <div className="flex gap-1">
        {choices.map(([value, label]) => (
          <Choice key={value} name={name} value={value} label={label} checked={value === current} />
        ))}
      </div>
    </fieldset>
  );
}

function Choice<K extends keyof Settings>({ name, value, label, checked }: { name: K; value: Settings[K]; label: string; checked: boolean }) {
  return (
    <label className={`${checked ? ACCENT_CHOICE : CHOICE} cursor-pointer has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-accent`}>
      <input type="radio" name={name} checked={checked} onChange={() => setSetting(name, value)} className="sr-only" />
      {label}
    </label>
  );
}

function BlankLinePreview() {
  const blank = blankRowHeight(useSetting('blankLines'));
  return (
    <div aria-hidden className="mt-2 w-80 rounded bg-panel py-1 text-[11px] leading-[15px] text-ink">
      {PREVIEW_LINES.map((text, index) => (
        <div key={index} className="diff-code whitespace-pre px-2" style={{ height: text ? ROW_HEIGHT : blank }}>
          {text}
        </div>
      ))}
    </div>
  );
}
