'use client';

import { setSetting, useSetting } from './settingsStore';
import type { BlankLineSetting, Settings, ThemeSetting } from './settings';
import { useDesktopBridge } from '@/features/desktop/desktopBridge';
import { codeSegments, withMargins } from '@/features/pull-requests/codeSegments';
import { commentMargins } from '@/features/pull-requests/commentMargins';
import { useTokenized, type ThemedToken } from '@/features/pull-requests/diffHighlight';
import { blankRowHeight, HALF_ROW_HEIGHT, ROW_HEIGHT } from '@/features/pull-requests/diffMetrics';
import { SegmentSpan } from '@/features/pull-requests/SegmentSpan';
import { SEMIBLANK_CODE, semiblankKind, type SemiblankKind } from '@/features/pull-requests/semiblankLines';
import { PageHeading, SECTION_LABEL } from '@/features/sources/PageHeading';
import { ACCENT_CHOICE, CHOICE } from '@/features/surface-ui/buttonStyles';

const THEME_LABELS: Record<ThemeSetting, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const BLANK_LINE_LABELS: Record<BlankLineSetting, string> = { full: 'Full height', half: 'Half height', 'extra-small': 'Extra small' };

type ChoiceName = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];
type ToggleName = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const PREVIEW_LINES = [
  "import { parse } from './parse';",
  '',
  '/**',
  ' * Reads the tree out of some text.',
  ' */',
  'export function read(text) {',
  '  // Strict mode rejects stray keys.',
  '  const tree = parse(text, [',
  '    {',
  '      strict: true,',
  '    },',
  '  ]);',
  '',
  '  return tree.root;',
  '}',
];
const PREVIEW_TEXT = PREVIEW_LINES.join('\n');
const PREVIEW_KINDS = PREVIEW_LINES.map((text, index) => semiblankKind(text, PREVIEW_LINES[index - 1] ?? null, PREVIEW_LINES[index + 1] ?? null));

export function SettingsPage() {
  return (
    <section className="max-w-2xl">
      <PageHeading eyebrow="reposcope" title="Settings" />
      <SavedWhere />
      <SettingChoices name="theme" legend="Theme" labels={THEME_LABELS} />
      <SettingChoices name="blankLines" legend="Blank lines in diffs" labels={BLANK_LINE_LABELS} />
      <SettingToggle name="semiblankLines" legend="Semiblank lines in diffs" label="Draw lines of only brackets or comment marks at half height, and comment margins to match" />
      <DiffLinesPreview />
    </section>
  );
}

function SavedWhere() {
  const where = useDesktopBridge() ? 'to ~/.reposcope/settings.json' : 'in a cookie in this browser';
  return <p className="mt-2 text-xs leading-5 text-ink-dim">Changes apply at once and are saved {where}.</p>;
}

function SettingChoices<K extends ChoiceName>({ name, legend, labels }: { name: K; legend: string; labels: Record<Settings[K], string> }) {
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

function Choice<K extends ChoiceName>({ name, value, label, checked }: { name: K; value: Settings[K]; label: string; checked: boolean }) {
  return (
    <label className={`${checked ? ACCENT_CHOICE : CHOICE} cursor-pointer has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-accent`}>
      <input type="radio" name={name} checked={checked} onChange={() => setSetting(name, value)} className="sr-only" />
      {label}
    </label>
  );
}

function SettingToggle({ name, legend, label }: { name: ToggleName; legend: string; label: string }) {
  const on = useSetting(name);
  return (
    <fieldset className="mt-5">
      <legend className={`mb-1 ${SECTION_LABEL}`}>{legend}</legend>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-ink">
        <input type="checkbox" checked={on} onChange={(event) => setSetting(name, event.target.checked)} className="size-3 accent-accent" />
        {label}
      </label>
    </fieldset>
  );
}

function DiffLinesPreview() {
  const blank = blankRowHeight(useSetting('blankLines'));
  const semiblanks = useSetting('semiblankLines');
  const tokens = useTokenized(PREVIEW_TEXT, 'typescript');
  return (
    <div aria-hidden className="mt-3 w-80 rounded bg-panel py-1 text-[11px] leading-[15px] text-ink">
      {PREVIEW_LINES.map((_, index) => (
        <PreviewLine key={index} index={index} tokens={tokens?.[index] ?? null} blank={blank} semiblanks={semiblanks} />
      ))}
    </div>
  );
}

function PreviewLine({ index, tokens, blank, semiblanks }: { index: number; tokens: ThemedToken[] | null; blank: number; semiblanks: boolean }) {
  const text = PREVIEW_LINES[index] ?? '';
  const kind = semiblanks ? PREVIEW_KINDS[index] : null;
  const segments = previewSegments(text, tokens, semiblanks);
  return (
    <div className="diff-code flex items-start whitespace-pre px-2" style={{ height: previewLineHeight(text, blank, kind) }}>
      <span className={kind ? SEMIBLANK_CODE[kind] : undefined}>
        {segments.map((segment, at) => (
          <SegmentSpan key={at} segment={segment} side="right" />
        ))}
      </span>
    </div>
  );
}

function previewSegments(text: string, tokens: ThemedToken[] | null, semiblanks: boolean) {
  return withMargins(codeSegments(text, tokens, null), semiblanks ? commentMargins(text, tokens) : []);
}

function previewLineHeight(text: string, blank: number, kind: SemiblankKind | null | undefined): number {
  if (!text) return blank;
  return kind ? HALF_ROW_HEIGHT : ROW_HEIGHT;
}
