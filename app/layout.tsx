import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Akwam Proxy Streamer',
  description: 'نظام بث ومproxy متكامل لموقع أكوام مع تخطي حماية الروابط.',
  openGraph: {
    title: 'Akwam Proxy Streamer',
    description: 'نظام بث ومproxy متكامل لموقع أكوام مع تخطي حماية الروابط.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Akwam Proxy Streamer',
    description: 'نظام بث ومproxy متكامل لموقع أكوام مع تخطي حماية الروابط.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-gray-900 text-white min-h-screen font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
