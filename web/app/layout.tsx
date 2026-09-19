import type { Metadata } from "next";
import "@fontsource-variable/geist";
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
