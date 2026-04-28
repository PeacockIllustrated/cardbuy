import type { Metadata } from "next";
import { Archivo_Black, Inter } from "next/font/google";
import "./globals.css";
import { PageFooter } from "@/components/wireframe/PageFooter";

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "cardbuy · buy & sell Pokémon cards",
    template: "%s · cardbuy",
  },
  description:
    "Buy graded and raw Pokémon cards from a UK dealer, or sell yours for an instant GBP offer.",
  applicationName: "cardbuy",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "cardbuy",
    title: "cardbuy · buy & sell Pokémon cards",
    description:
      "Buy graded and raw Pokémon cards from a UK dealer, or sell yours for an instant GBP offer.",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "cardbuy · buy & sell Pokémon cards",
    description:
      "Buy graded and raw Pokémon cards from a UK dealer, or sell yours for an instant GBP offer.",
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} ${inter.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans text-[15px] leading-[1.55]">
        <main className="flex-1">{children}</main>
        <PageFooter />
      </body>
    </html>
  );
}
