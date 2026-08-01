"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LoginButton from "./LoginButton";

const NAV_LINKS = [
  { href: "/", label: "Find Games" },
  { href: "/#create-game", label: "Create" },
  { href: "/my-games", label: "My Games" },
];

export default function SiteHeader({ apiStatus }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              ⚽
            </span>
            <span className="text-xl font-bold text-green-700">FootyFinder</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <LoginButton />
            <span
              className={`hidden rounded-full px-2.5 py-1 text-xs font-medium sm:inline ${
                apiStatus === "ok"
                  ? "bg-green-100 text-green-800"
                  : apiStatus === "checking"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              API: {apiStatus}
            </span>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto pb-1">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : link.href.startsWith("/my-games")
                  ? pathname.startsWith("/my-games")
                  : false;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-green-600 text-white"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
