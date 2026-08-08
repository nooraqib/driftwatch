"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GithubButton from "./GithubButton";

function DiffMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-mkt-signal">
      <rect x="2" y="5" width="8" height="2" rx="1" fill="currentColor" />
      <rect x="6" y="9" width="8" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
];

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        setUser(res.ok ? await res.json() : null);
      } catch {
        setUser(null);
      }
    })();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setDropdownOpen(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-mkt-line bg-mkt-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <DiffMark />
          <span className="font-display text-[18px] font-medium tracking-tight text-mkt-text">Driftwatch</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noreferrer" : undefined}
              className="text-sm text-mkt-muted transition-colors hover:text-mkt-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex">
          {user === undefined ? null : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-mkt-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full border border-mkt-line" />
                <span className="font-mono text-sm text-mkt-muted">@{user.login}</span>
              </button>
              {dropdownOpen ? (
                <div className="absolute right-0 mt-2 w-40 rounded-[10px] border border-mkt-line bg-mkt-surface py-1">
                  <Link href="/dashboard" className="block px-3 py-2 text-sm text-mkt-text hover:bg-mkt-bg">
                    Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full px-3 py-2 text-left text-sm text-mkt-text hover:bg-mkt-bg"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <GithubButton />
          )}
        </div>

        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex items-center justify-center rounded-md p-2 text-mkt-text md:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-mkt-bg md:hidden">
          <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-4">
            <span className="flex items-center gap-2">
              <DiffMark />
              <span className="font-display text-[18px] font-medium text-mkt-text">Driftwatch</span>
            </span>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="p-2 text-mkt-text">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="flex flex-1 flex-col justify-between px-6 pb-10 pt-6">
            <nav className="flex flex-col gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noreferrer" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className="font-display text-2xl text-mkt-text"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {user ? (
              <Link href="/dashboard" className="text-sm font-medium text-mkt-signal">
                Go to dashboard →
              </Link>
            ) : (
              <GithubButton />
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
