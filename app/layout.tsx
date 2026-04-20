import type { Metadata } from "next";
import { Archivo_Black, Inter } from "next/font/google";
import "./globals.css";
import { WireframeStamp } from "@/components/wireframe/WireframeStamp";
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
  title: "cardbuy · buy & sell Pokémon cards",
  description: "Pre-launch wireframe — visual identity in progress.",
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
        <WireframeStamp />
        <main className="flex-1">{children}</main>
        <PageFooter />
      </body>
    </html>
  );
}
