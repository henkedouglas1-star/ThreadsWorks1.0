import React, { useState } from "react";
import { Menu, X, Sun, Moon, ArrowRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import PageShareButton from "../PageShareButton";

interface ContentPaysUsLayoutProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  isAuthenticated?: boolean;
  onOpenAuth?: (mode: "signin" | "signup") => void;
  children: React.ReactNode;
}

export function ContentPaysUsLayout({
  currentRoute,
  onNavigate,
  isAuthenticated = false,
  onOpenAuth,
  children
}: ContentPaysUsLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Applications", path: "/applications" },
    { name: "Learn", path: "/learn" },
    { name: "About", path: "/about" }
  ];

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setMobileMenuOpen(false);
    onNavigate(targetPath);
  };

  const handleAuthAction = (
    e: React.MouseEvent<HTMLAnchorElement>,
    mode: "signin" | "signup"
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setMobileMenuOpen(false);
    if (onOpenAuth) {
      onOpenAuth(mode);
    } else {
      onNavigate(`/?auth=${mode}`);
    }
  };

  return (
    <div className="cpu-public-site min-h-screen bg-[#fafaf9] dark:bg-[#09090b] text-slate-950 dark:text-zinc-100 flex flex-col antialiased selection:bg-indigo-600 selection:text-white transition-colors duration-200">
      {/* Single-Row Top Bar (Clean 3-Zone Header) */}
      <header className="sticky top-0 z-50 border-b border-slate-200/90 dark:border-zinc-800/90 bg-[#fafaf9]/90 dark:bg-[#09090b]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Clean Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, "/")}
            className="inline-flex items-center gap-2.5 text-slate-950 dark:text-white hover:opacity-90 transition-opacity shrink-0"
            aria-label="ContentPaysUs Home on ThreadsWorks.com"
          >
            <img
              src="/threadsworks-logo.svg"
              alt="ContentPaysUs and ThreadsWorks mark"
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg shrink-0"
            />
            <span className="text-[17px] font-extrabold tracking-tight leading-none">
              ContentPaysUs
            </span>
          </a>

          {/* Center: Clean Text Navigation Links */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => {
              const isActive =
                link.path === "/"
                  ? currentRoute === "/" || currentRoute === "/home"
                  : currentRoute === link.path || currentRoute.startsWith(`${link.path}/`);
              return (
                <a
                  key={link.path}
                  href={link.path}
                  onClick={(e) => handleLinkClick(e, link.path)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative py-1 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-slate-950 dark:text-white font-semibold after:absolute after:left-0 after:right-0 after:-bottom-[19px] after:h-[2px] after:bg-indigo-600 dark:after:bg-indigo-400"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white"
                  }`}
                >
                  {link.name}
                </a>
              );
            })}
          </nav>

          {/* Right: Theme Toggle + Auth / Primary CTA */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <PageShareButton />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {isAuthenticated ? (
              <a
                id="public-nav-open-workspace"
                href="/workspace"
                onClick={(e) => handleLinkClick(e, "/workspace")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors"
              >
                Open Workspace <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : (
              <>
                <a
                  id="public-nav-signin"
                  href="/?auth=signin"
                  onClick={(e) => handleAuthAction(e, "signin")}
                  className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition-colors"
                >
                  Sign In
                </a>
                <a
                  id="public-nav-get-started"
                  href="/?auth=signup"
                  onClick={(e) => handleAuthAction(e, "signup")}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors"
                >
                  Get Started Free
                </a>
              </>
            )}
          </div>

          {/* Mobile Controls */}
          <div className="flex md:hidden items-center gap-2">
            <PageShareButton />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] px-4 py-4 space-y-1">
            <nav aria-label="Mobile navigation" className="space-y-1">
              {navLinks.map((link) => {
                const isActive =
                  link.path === "/"
                    ? currentRoute === "/" || currentRoute === "/home"
                    : currentRoute === link.path || currentRoute.startsWith(`${link.path}/`);
                return (
                  <a
                    key={link.path}
                    href={link.path}
                    onClick={(e) => handleLinkClick(e, link.path)}
                    aria-current={isActive ? "page" : undefined}
                    className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive
                        ? "bg-slate-200/70 dark:bg-zinc-800 text-slate-950 dark:text-white font-semibold"
                        : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {link.name}
                  </a>
                );
              })}
            </nav>

            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-zinc-800 flex flex-col gap-2">
              {isAuthenticated ? (
                <a
                  href="/workspace"
                  onClick={(e) => handleLinkClick(e, "/workspace")}
                  className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-indigo-600 text-white text-center inline-flex items-center justify-center gap-1.5"
                >
                  Open Workspace <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <>
                  <a
                    href="/?auth=signin"
                    onClick={(e) => handleAuthAction(e, "signin")}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-center"
                  >
                    Sign In
                  </a>
                  <a
                    href="/?auth=signup"
                    onClick={(e) => handleAuthAction(e, "signup")}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-indigo-600 text-white text-center"
                  >
                    Get Started Free
                  </a>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Page Content */}
      <main id="main-content" className="flex-1">
        {children}
      </main>

      {/* Quiet, Structured Footer */}
      <footer className="border-t border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#070709] text-slate-600 dark:text-zinc-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="space-y-3 md:col-span-1">
              <a
                href="/"
                onClick={(e) => handleLinkClick(e, "/")}
                className="inline-flex items-center gap-2 text-slate-950 dark:text-white font-extrabold text-base tracking-tight"
              >
                <img
                  src="/threadsworks-logo.svg"
                  alt="ThreadsWorks and ContentPaysUs mark"
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-md"
                />
                ContentPaysUs
              </a>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                The AI-powered ecosystem for building your creator business. Official home of ThreadsWorks and ContentPaysUs at ThreadsWorks.com.
              </p>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-zinc-200 mb-3.5">
                Ecosystem
              </h2>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="/" onClick={(e) => handleLinkClick(e, "/")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    Home
                  </a>
                </li>
                <li>
                  <a href="/applications" onClick={(e) => handleLinkClick(e, "/applications")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    Applications (20-App Roadmap)
                  </a>
                </li>
                <li>
                  <a href="/learn" onClick={(e) => handleLinkClick(e, "/learn")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    ContentPaysUs Academy
                  </a>
                </li>
                <li>
                  <a href="/about" onClick={(e) => handleLinkClick(e, "/about")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    About &amp; Mission
                  </a>
                </li>
                <li>
                  <a href="/pricing" onClick={(e) => handleLinkClick(e, "/pricing")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    ThreadsWorks Pricing
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-zinc-200 mb-3.5">
                Live &amp; Active Tools
              </h2>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="/ai-threads-post-generator" onClick={(e) => handleLinkClick(e, "/ai-threads-post-generator")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    AI Threads Post Generator
                  </a>
                </li>
                <li>
                  <a href="/threads-scheduler" onClick={(e) => handleLinkClick(e, "/threads-scheduler")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    Meta Threads Scheduler
                  </a>
                </li>
                <li>
                  <a href="/content-ideas" onClick={(e) => handleLinkClick(e, "/content-ideas")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    Content Ideas &amp; Library
                  </a>
                </li>
                <li>
                  <a href="/productworks" onClick={(e) => handleLinkClick(e, "/productworks")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    ProductWorks (In Development)
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-zinc-200 mb-3.5">
                Account &amp; Legal
              </h2>
              <ul className="space-y-2.5 text-sm">
                <li>
                  {isAuthenticated ? (
                    <a href="/workspace" onClick={(e) => handleLinkClick(e, "/workspace")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                      Open Workspace
                    </a>
                  ) : (
                    <a href="/?auth=signin" onClick={(e) => handleAuthAction(e, "signin")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                      Sign In
                    </a>
                  )}
                </li>
                <li>
                  <a href="/create" onClick={(e) => handleLinkClick(e, "/create")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    Launch ThreadsWorks
                  </a>
                </li>
                <li>
                  <a href="/privacy" onClick={(e) => handleLinkClick(e, "/privacy")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms" onClick={(e) => handleLinkClick(e, "/terms")} className="hover:text-slate-950 dark:hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-slate-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-500">
            <p>© {new Date().getFullYear()} ThreadsWorks &amp; ContentPaysUs. All rights reserved.</p>
            <p>ThreadsWorks is where it started. ContentPaysUs is what we’re building together.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
