import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Code Intelligence GraphRAG',
  description: 'Portfolio-ready GraphRAG system for repository intelligence.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-[var(--font-inter)]`}>
        <Script id="theme-init" strategy="beforeInteractive">{`
          try {
            var storedTheme = window.localStorage.getItem('code-intel-theme');
            var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            var theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : (systemDark ? 'dark' : 'light');
            document.documentElement.dataset.theme = theme;
          } catch (error) {}
        `}</Script>
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  )
}
