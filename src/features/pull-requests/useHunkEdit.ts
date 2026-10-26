'use client';

import { useEffect, useState } from 'react';
import { commitMessageFor, editableBlockAt, editLabel, type BlockBounds, type EditableBlock } from './editableBlocks';
import type { EditTargetValue } from './editTarget';
import { defaultBranchEditPath, pullEditPath } from './pullPaths';
import type { DiffRow } from './splitDiff';
import { apiPostJson } from '@/features/sources/apiClient';
import { errorMessage } from '@/features/sources/errorMessage';

export interface HunkEdit {
  block: EditableBlock;
  draft: string;
}

export interface HunkEditControls {
  edit: HunkEdit | null;
  message: string | null;
  committing: boolean;
  failure: string | null;
  begin: (rowIndex: number, bounds: BlockBounds) => void;
  askToCommit: () => void;
  commit: () => void;
  close: () => void;
  dismissModal: () => void;
  setDraft: (draft: string) => void;
  setMessage: (message: string) => void;
}

export function useHunkEdit({
  owner,
  repo,
  target,
  rows,
  filename,
  token,
}: {
  owner: string;
  repo: string;
  target: EditTargetValue | null;
  rows: DiffRow[];
  filename: string;
  token: string | null;
}): HunkEditControls {
  const [edit, setEdit] = useState<HunkEdit | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const dismissModal = () => {
    setMessage(null);
    setFailure(null);
  };

  const close = () => {
    setEdit(null);
    dismissModal();
  };

  useEffect(close, [rows, filename]);

  function begin(rowIndex: number, bounds: BlockBounds) {
    if (!target || committing || (edit && edit.draft !== edit.block.text)) return;
    const block = editableBlockAt(rows, rowIndex, bounds);
    if (block) setEdit({ block, draft: block.text });
  }

  function askToCommit() {
    if (!edit || !target || committing) return;
    if (edit.draft === edit.block.text) close();
    else setMessage(commitMessageFor(editLabel(target.pull, filename), edit.block.text, edit.draft));
  }

  // Optimistic: dismiss the modal right away and leave the editor showing the
  // committed content until the refreshed diff replaces it.
  async function commit() {
    if (!edit || !target || message === null || committing) return;
    const refresh = target.onCommitted;
    setCommitting(true);
    setFailure(null);
    setMessage(null);
    try {
      await postHunkCommit({ owner, repo, target, filename, token, edit, message });
    } catch (issue: unknown) {
      setMessage(message);
      setFailure(errorMessage(issue));
      setCommitting(false);
      return;
    }
    try {
      if (refresh) await refresh();
    } finally {
      close();
      setCommitting(false);
    }
  }

  return {
    edit,
    message,
    committing,
    failure,
    begin,
    askToCommit,
    commit,
    close,
    dismissModal,
    setDraft: (draft: string) => setEdit((was) => (was ? { ...was, draft } : was)),
    setMessage,
  };
}

function postHunkCommit({
  owner,
  repo,
  target,
  filename,
  token,
  edit,
  message,
}: {
  owner: string;
  repo: string;
  target: EditTargetValue;
  filename: string;
  token: string | null;
  edit: HunkEdit;
  message: string;
}) {
  const route = target.pull ? pullEditPath(owner, repo, target.pull.number) : defaultBranchEditPath(owner, repo);
  return apiPostJson(route, token, {
    path: filename,
    headRef: target.headRef,
    startLine: edit.block.startLine,
    endLine: edit.block.endLine,
    original: edit.block.text,
    updated: edit.draft,
    message,
  });
}
