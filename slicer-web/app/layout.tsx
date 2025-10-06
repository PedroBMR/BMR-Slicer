import { LayoutShell } from '../components/LayoutShell';
import { APP_NAME } from '../lib/config';

import '../styles/globals.css';

import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Web-based slicer viewer and estimation toolkit for BMR.',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
