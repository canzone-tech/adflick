import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ADFLICK PLAYOUT CMS',
  description: 'AJOOBA DIGITAL signage and campaign management workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
