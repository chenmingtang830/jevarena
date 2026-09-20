import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/site-shell";

export const metadata: Metadata = {
  metadataBase: new URL("https://jevarena-lab.vercel.app"),
  title: {
    default: "JevArena — Put judgment to the test",
    template: "%s · JevArena",
  },
  description:
    "An open, bring-your-own-key playground for comparing Jev with other AI judges. Quality first. Speed and cost revealed after your vote.",
  openGraph: {
    title: "JevArena — Put judgment to the test",
    description:
      "Explore where Jev excels, and where it needs work. Independent, open-source, BYOK.",
    type: "website",
    url: "/",
    siteName: "JevArena",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "JevArena — Put judgment to the test",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JevArena — Put judgment to the test",
    description:
      "Ask a question, compare Jev with another judge, then reveal quality, speed, and cost.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
