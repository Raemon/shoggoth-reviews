import { definitionView, peekSources, scanChangedFiles, type PeekSources, type PeekView } from './definitionContext';
import {
  locateDefinition,
  refineSite,
  resolveDefinition,
  type DefinitionSite,
  type Located,
  type Resolution,
  type ResolverFiles,
} from './definitionResolver';
import { memoPromise } from './promiseMemo';
import type { ChangedFileSet } from './pullRequests';
import type { TrimmableFiles } from './resolverFiles';
import { errorMessage } from '@/features/sources/errorMessage';

export interface PeekOrigin {
  path: string;
  ref: string;
  line: number;
  column: number;
  word: string;
}

export interface PeekFrame {
  word: string;
  site: DefinitionSite | null;
  sites: DefinitionSite[];
  view: PeekView | null;
  note: string | null;
  loading: boolean;
  failed?: boolean;
}

export interface FrameCache {
  settled(origin: PeekOrigin): PeekFrame | null;
  frameFor(origin: PeekOrigin): Promise<PeekFrame>;
  siteFrame(site: DefinitionSite, sites: DefinitionSite[], word: string): Promise<PeekFrame>;
  warm(origin: PeekOrigin): Promise<void>;
}

export function originKey(origin: PeekOrigin): string {
  return `${origin.ref}\0${origin.path}\0${origin.line}\0${origin.column}\0${origin.word}`;
}

export function definedAt(frame: PeekFrame, origin: PeekOrigin): boolean {
  const here = (site: DefinitionSite | null) =>
    site?.ref === origin.ref && site.path === origin.path && site.nameLine === origin.line;
  return here(frame.site) || frame.sites.some(here);
}

export function createFrameCache(files: TrimmableFiles, fileSet: { current: ChangedFileSet | null }): FrameCache {
  const sources = peekSources(files.readFile);
  const byOrigin = new Map<string, Promise<PeekFrame>>();
  const byTarget = new Map<string, Promise<PeekFrame>>();
  const done = new Map<string, PeekFrame>();
  const siteFrame = (site: DefinitionSite, sites: DefinitionSite[], word: string) =>
    files.tracked(frameAtSite(site, sites, word, files, sources, fileSet.current));
  const locate = (origin: PeekOrigin) => files.tracked(locateDefinition(origin, files));
  const framed = (origin: PeekOrigin, located: Located) =>
    memoPromise(byTarget, located.key, () => files.tracked(loadFrame(origin, files, fileSet.current, siteFrame)))
      .catch((issue: unknown) => emptyFrame(origin.word, errorMessage(issue), true))
      .then((frame) => remember(frame, origin, located, byOrigin, byTarget, done));
  const frameFor = (origin: PeekOrigin) =>
    memoPromise(byOrigin, originKey(origin), () => locate(origin).then((located) => framed(origin, located)));
  const warm = async (origin: PeekOrigin) => {
    if (byOrigin.has(originKey(origin))) return;
    const located = await locate(origin);
    if (!located.literal) await memoPromise(byOrigin, originKey(origin), () => framed(origin, located));
  };
  return { settled: (origin) => done.get(originKey(origin)) ?? null, frameFor, siteFrame, warm };
}

function remember(
  frame: PeekFrame,
  origin: PeekOrigin,
  located: Located,
  byOrigin: Map<string, Promise<PeekFrame>>,
  byTarget: Map<string, Promise<PeekFrame>>,
  done: Map<string, PeekFrame>,
): PeekFrame {
  if (!frame.failed) done.set(originKey(origin), frame);
  else {
    byOrigin.delete(originKey(origin));
    byTarget.delete(located.key);
  }
  return frame;
}

type SiteFramer = (site: DefinitionSite, sites: DefinitionSite[], word: string) => Promise<PeekFrame>;

async function loadFrame(
  origin: PeekOrigin,
  files: ResolverFiles,
  fileSet: ChangedFileSet | null,
  siteFrame: SiteFramer,
): Promise<PeekFrame> {
  const found = await resolveDefinition(origin, files).then(succeeded).catch(failedResolution);
  if (found.failed) return emptyFrame(origin.word, found.note, true);
  const sites = withPatchFallback(found.sites, found.note, origin, fileSet);
  const first = sites[0];
  if (!first) return emptyFrame(origin.word, found.note);
  return siteFrame(first, sites, origin.word);
}

async function frameAtSite(
  site: DefinitionSite,
  sites: DefinitionSite[],
  word: string,
  files: ResolverFiles,
  sources: PeekSources,
  fileSet: ChangedFileSet | null,
): Promise<PeekFrame> {
  try {
    const refined = site.rough ? await refineSite(site, word, files) : site;
    const view = await definitionView(refined, fileSet, sources);
    if (!view) return emptyFrame(word, 'file unavailable', true);
    return { word, site: refined, sites, view, note: null, loading: false };
  } catch (issue: unknown) {
    return emptyFrame(word, errorMessage(issue), true);
  }
}

export function loadingFrame(word: string): PeekFrame {
  return { word, site: null, sites: [], view: null, note: null, loading: true };
}

function emptyFrame(word: string, note: string | null, failed = false): PeekFrame {
  return { word, site: null, sites: [], view: null, note: note ?? `no definition found for ${word}`, loading: false, failed };
}

type Attempted = Resolution & { failed: boolean };

function succeeded(found: Resolution): Attempted {
  return { ...found, failed: false };
}

function failedResolution(issue: unknown): Attempted {
  return { sites: [], note: errorMessage(issue), failed: true };
}

function withPatchFallback(
  sites: DefinitionSite[],
  note: string | null,
  origin: PeekOrigin,
  fileSet: ChangedFileSet | null,
): DefinitionSite[] {
  if (sites.length > 0 || note !== null || !fileSet) return sites;
  return scanChangedFiles(fileSet, origin.word, origin.path);
}
