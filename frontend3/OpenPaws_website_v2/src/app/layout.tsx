import type { Metadata } from "next";
import { DM_Serif_Display, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider, themeInitScript } from "@/components/theme";

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.openpaws.ai"),
  title: {
    default: "Open Paws — Building AI for Animal Advocates",
    template: "%s — Open Paws",
  },
  description:
    "Open source tools, hackathons, and research to power the animal advocacy movement.",
  openGraph: {
    title: "Open Paws — Building AI for Animal Advocates",
    description:
      "Open source tools, hackathons, and research to power the animal advocacy movement.",
    type: "website",
    siteName: "Open Paws",
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Paws — Building AI for Animal Advocates",
    description:
      "Open source tools, hackathons, and research to power the animal advocacy movement.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSerif.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        {/* Apply the saved/OS theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-black text-white">
        <ThemeProvider>
          <SiteNav />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
