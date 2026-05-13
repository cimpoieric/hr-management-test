import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientToaster } from "@/components/ClientToaster";
import { I18nProvider } from "@/components/I18nProvider";
import "@/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HR Management",
  description: "Sistem management HR — detasare forță de muncă UE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <I18nProvider>
          {children}
          <ClientToaster richColors position="top-center" />
        </I18nProvider>
      </body>
    </html>
  );
}
