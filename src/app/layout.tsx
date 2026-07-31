import type { Metadata, Viewport } from "next";
import { Alegreya, Yatra_One } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const alegreya = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const yatraOne = Yatra_One({
  variable: "--font-yatra-one",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Manthan Vidyashram — Parent Portal",
  description:
    "Attendance, leave, stay-back consent, fees, PTM bookings, results and school messages — one portal for Manthan Vidyashram parents.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/brand/favicon-32.png",
    apple: "/brand/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#540009",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${alegreya.variable} ${yatraOne.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-body antialiased">
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
