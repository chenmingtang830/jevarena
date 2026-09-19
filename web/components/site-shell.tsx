"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, FlaskConical, Github } from "lucide-react";

export const REPO = "https://github.com/chenmingtang830/jevarena";
export function SiteHeader() {
  const pathname = usePathname();
  const pages = [
    ["/", "Playground"],
    ["/cases", "Cases"],
    ["/results", "Results"],
    ["/methodology", "Methodology"],
  ];
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="JevArena home">
        <FlaskConical size={25} />
        <span>
          Jev<span className="wordmark-light">Arena</span>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        {pages.map(([href, title]) => (
          <Link key={href} href={href} aria-current={
            (href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))
              ? "page" : undefined
          }>{title}</Link>
        ))}
        <a className="github-link" href={REPO} target="_blank" rel="noreferrer" aria-label="JevArena on GitHub (opens in a new tab)">
          <Github size={17} />
          <span>GitHub</span>
          <ArrowUpRight size={13} />
        </a>
      </nav>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Open experiments. Better judgments.</span>
      <div>
        <Link href="/contribute">Contribute</Link>
        <a href={`${REPO}/discussions`}>Community</a>
        <span>Independent, community-built.</span>
      </div>
    </footer>
  );
}
