import React, { useState } from "react";
import { Sparkles, Menu, X, ArrowRight, Layers, BookOpen, Compass, Info, Cpu, ExternalLink } from "lucide-react";

interface ContentPaysUsLayoutProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  children: React.ReactNode;
}

export function ContentPaysUsLayout({ currentRoute, onNavigate, children }: ContentPaysUsLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: "Home", path: "/", icon: Compass },
    { name: "Learn", path: "/learn", icon: BookOpen },
    { name: "Applications", path: "/applications", icon: Layers },
    { name: "About", path: "/about", icon: Info },
    { name: "Workspace", path: "/workspace", icon: Cpu }
  ];

  const handleNavClick = (path: string) => {
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Notification Banner */}
      <div className="bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-slate-900 border-b border-indigo-500/20 px-4 py-2 text-center text-xs font-medium text-indigo-200">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
          <strong>ContentPaysUs Ecosystem:</strong> One connected platform of AI-powered tools and creator education.
          <button 
            onClick={() => onNavigate("/applications")} 
            className="underline hover:text-white ml-1 font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            Explore 16 Apps <ArrowRight className="h-3 w-3" />
          </button>
        </span>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo / Brand */}
          <button 
            onClick={() => handleNavClick("/")}
            className="flex items-center gap-3 text-left group cursor-pointer"
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent block">
                ContentPaysUs
              </span>
              <span className="text-[11px] font-medium text-indigo-400 tracking-wide block">
                Ecosystem & AI Applications
              </span>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 border border-slate-800/80 p-1.5 rounded-full shadow-inner">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentRoute === link.path || (link.path !== "/" && currentRoute.startsWith(link.path));
              return (
                <button
                  key={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {link.name}
                </button>
              );
            })}
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => onNavigate("/applications")}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 transition-all cursor-pointer shadow-sm"
            >
              Explore 16 Apps
            </button>
            <button
              onClick={() => onNavigate("/create")}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-1.5 cursor-pointer"
            >
              Launch ThreadsWorks <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-800 bg-slate-950/95 px-4 pt-3 pb-6 space-y-2 animate-fade-in">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentRoute === link.path || (link.path !== "/" && currentRoute.startsWith(link.path));
              return (
                <button
                  key={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.name}
                </button>
              );
            })}
            <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
              <button
                onClick={() => handleNavClick("/applications")}
                className="w-full py-3 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 text-slate-200 text-center"
              >
                Explore 16 Apps
              </button>
              <button
                onClick={() => handleNavClick("/create")}
                className="w-full py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center flex items-center justify-center gap-1.5"
              >
                Launch ThreadsWorks <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 text-slate-400 py-16 px-4 sm:px-6 lg:px-8 mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                CP
              </div>
              <span className="text-base font-extrabold text-white tracking-tight">ContentPaysUs</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              A unified ecosystem of creator education and AI-powered specialized applications designed to help creators turn knowledge into sustainable businesses.
            </p>
            <p className="text-[11px] text-slate-500">
              © {new Date().getFullYear()} ContentPaysUs Ecosystem. All rights reserved.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">Ecosystem</h4>
            <ul className="space-y-2.5 text-xs">
              <li><button onClick={() => onNavigate("/")} className="hover:text-white transition-colors cursor-pointer">Home Overview</button></li>
              <li><button onClick={() => onNavigate("/learn")} className="hover:text-white transition-colors cursor-pointer">Creator Journey (Learn)</button></li>
              <li><button onClick={() => onNavigate("/applications")} className="hover:text-white transition-colors cursor-pointer">Application Directory (16 Apps)</button></li>
              <li><button onClick={() => onNavigate("/about")} className="hover:text-white transition-colors cursor-pointer">About ContentPaysUs</button></li>
              <li><button onClick={() => onNavigate("/workspace")} className="hover:text-white transition-colors cursor-pointer">Unified Workspace (Status)</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">Featured Applications</h4>
            <ul className="space-y-2.5 text-xs">
              <li><button onClick={() => onNavigate("/applications/threadsworks")} className="hover:text-white transition-colors cursor-pointer">ThreadsWorks (Available)</button></li>
              <li><button onClick={() => onNavigate("/applications/productworks")} className="hover:text-white transition-colors cursor-pointer">ProductWorks (In Development)</button></li>
              <li><button onClick={() => onNavigate("/applications/creatorworks")} className="hover:text-white transition-colors cursor-pointer">CreatorWorks (Foundation)</button></li>
              <li><button onClick={() => onNavigate("/applications/offerworks")} className="hover:text-white transition-colors cursor-pointer">OfferWorks (Monetization)</button></li>
              <li><button onClick={() => onNavigate("/applications/projectz")} className="hover:text-white transition-colors cursor-pointer">Project Z (Concept)</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">Governing Principles</h4>
            <ul className="space-y-2 text-[11px] text-slate-400">
              <li>• One unified creator ecosystem</li>
              <li>• One persistent creator identity</li>
              <li>• One shared intelligence layer</li>
              <li>• Shared cross-app projects</li>
              <li>• Measurable creator business outcomes</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-slate-900">
              <button
                onClick={() => onNavigate("/create")}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 cursor-pointer"
              >
                Open ThreadsWorks App <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
