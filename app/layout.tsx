import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SpinFlow",
  description: "Il tuo assistente AI per creare sessioni di spinning perfette.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <footer
          style={{ textAlign: "center", padding: "8px", fontSize: "11px" }}
        >
          <a
            href="https://tunebat.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#555", textDecoration: "none" }}
          >
            Music data by Tunebat
          </a>
        </footer>
      </body>
    </html>
  );
}
