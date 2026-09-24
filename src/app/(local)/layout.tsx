import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { desktopMode } from '@/features/desktop/desktopMode';

export default function LocalLayout({ children }: { children: ReactNode }) {
  if (!desktopMode()) notFound();
  return children;
}
