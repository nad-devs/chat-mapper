import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans'; // Use Geist Sans for clean typography
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // Import Toaster

export const metadata: Metadata = {
  title: 'ChatMapper', // Updated App Name
  description: 'Understand and map your ChatGPT conversations.', // Updated Description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark"> {/* Add dark class here */}
      {/*
       * Use the `GeistSans.variable` to access the CSS variable
       * (--font-geist-sans) and apply it to the body.
       */}
      <body className={`${GeistSans.variable} font-sans antialiased`}>
        {children}
        <Toaster /> {/* Add Toaster component here */}
      </body>
    </html>
  );
}
