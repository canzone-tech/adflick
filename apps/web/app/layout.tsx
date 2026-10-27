import type { Metadata } from 'next';
import { AppChrome } from '../components/app-chrome';
import './globals.css';
import './app-chrome.css';

export const metadata: Metadata = {
  title: 'ADFLICK | Operations Workspace',
  description: 'ADFLICK advertising, device operations, and account security workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AppChrome>{children}</AppChrome></body>
    </html>
  );
}
