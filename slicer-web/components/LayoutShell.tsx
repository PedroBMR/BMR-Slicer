'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { APP_NAME } from '../lib/config';

import type { PropsWithChildren } from 'react';

const NAVIGATION = [
  { href: '/', label: 'Dashboard' },
  { href: '/viewer', label: 'Viewer' },
  { href: '/estimates', label: 'Estimates' },
];

export function LayoutShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        color: '#f8fafc',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 2rem',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
        }}
      >
        <Link href="/" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          {APP_NAME}
        </Link>
        <nav style={{ display: 'flex', gap: '1.5rem' }}>
          {NAVIGATION.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  color: active ? '#38bdf8' : '#e2e8f0',
                  fontWeight: active ? 600 : 500,
                  transition: 'color 150ms ease',
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main
        style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}
      >
        {children}
      </main>
      <footer style={{ padding: '1rem 2rem', color: '#94a3b8', fontSize: '0.875rem' }}>
        Built with Next.js 15, Three.js, and BMR Slicer domain modules.
      </footer>
    </div>
  );
}
