import React from "react";
import {
  HEADER_NAV_ROUTES,
  PUBLIC_MARKETING_ROUTES,
  PublicMarketingRoute,
  SITE_NAME
} from "../marketing/marketingRoutes";
import PageShareButton from "./PageShareButton";

export interface PublicMarketingPageProps {
  route: PublicMarketingRoute;
  /** Optional SPA navigation handler (absent during build-time static pre-render) */
  onNavigate?: (path: string) => void;
  /** Connects directly to the existing AuthScreen signup/sign-in flow without inventing routes */
  onOpenAuth?: (mode: "signin" | "signup") => void;
}

export default function PublicMarketingPage({
  route,
  onNavigate,
  onOpenAuth
}: PublicMarketingPageProps) {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, targetPath: string) => {
    if (!onNavigate) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(targetPath);
  };

  const handleAuthAction = (
    e: React.MouseEvent<HTMLAnchorElement>,
    mode: "signin" | "signup"
  ) => {
    if (!onOpenAuth) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpenAuth(mode);
  };

  const authHref = (mode: "signin" | "signup") =>
    mode === "signup" ? "/create?auth=signup" : "/create";

  const isHome = route.kind === "home";

  return (
    <div
      data-theme="dark"
      className="dark min-h-screen bg-[#06050b] text-zinc-100 font-sans antialiased selection:bg-purple-500/30"
    >
      {/* Primary Site Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#06050b]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, "/")}
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white hover:opacity-90 transition-opacity"
            aria-label="ThreadsWorks Home"
          >
            <img
              src="/threadsworks-logo.svg"
              alt="ThreadsWorks logo"
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg"
            />
            <span>
              Threads<span className="text-purple-400">Works</span>
            </span>
          </a>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
            {HEADER_NAV_ROUTES.map((item) => {
              const isActive = item.path === route.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  aria-current={isActive ? "page" : undefined}
                  className={`text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {item.navLabel}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={authHref("signin")}
              onClick={(e) => handleAuthAction(e, "signin")}
              className="text-sm font-medium text-zinc-300 hover:text-white transition-colors px-2 py-1.5"
            >
              Sign In
            </a>
            <a
              href={authHref("signup")}
              onClick={(e) => handleAuthAction(e, "signup")}
              className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-4 py-2 text-xs sm:text-sm font-bold tracking-wide text-white hover:bg-purple-500 transition-colors"
            >
              Start Creating Free
            </a>
            <div className="hidden md:inline-flex">
              <PageShareButton />
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center border-t border-zinc-900 px-4">
          <nav
            aria-label="Product pages"
            className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto py-2.5 text-xs"
          >
            {HEADER_NAV_ROUTES.map((item) => {
              const isActive = item.path === route.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  aria-current={isActive ? "page" : undefined}
                  className={`whitespace-nowrap font-medium ${
                    isActive ? "text-purple-300" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {item.navLabel}
                </a>
              );
            })}
          </nav>
          <div className="ml-3 shrink-0 border-l border-zinc-800 pl-3">
            <PageShareButton />
          </div>
        </div>
      </header>

      {/* Main Semantic Document Body */}
      <main id="main-content">
        {/* Bold, High-Contrast Hero Section (Single H1 per page) */}
        <section className="border-b border-zinc-900 bg-[radial-gradient(ellipse_at_top,_rgba(126,34,206,0.2),_transparent_62%)]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className={isHome ? "mx-auto max-w-4xl text-center" : ""}>
              <p className="text-sm font-semibold tracking-wide text-purple-300">
                {route.platformNote}
              </p>
              <h1
                className={`mt-4 max-w-4xl font-black tracking-tight text-white leading-[1.05] ${
                  isHome
                    ? "mx-auto text-4xl sm:text-6xl lg:text-7xl"
                    : "text-3xl sm:text-5xl"
                }`}
              >
                {route.h1}
              </h1>

              {route.heroSupportingHeadline && (
                <p
                  className={`mt-4 max-w-3xl text-xl font-extrabold tracking-tight text-zinc-100 sm:text-2xl lg:text-3xl leading-snug ${
                    isHome ? "mx-auto" : ""
                  }`}
                >
                  {route.heroSupportingHeadline}
                </p>
              )}

              <p
                className={`mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg ${
                  isHome ? "mx-auto" : ""
                }`}
              >
                {route.lead}
              </p>

              {route.heroOfferLine && (
                <p className="mt-6 font-mono text-sm sm:text-base font-extrabold tracking-wider text-purple-300">
                  {route.heroOfferLine}
                </p>
              )}

              <div className={isHome ? "mt-7 flex justify-center" : "mt-7"}>
                <a
                  href={authHref(route.kind === "legal" ? "signin" : "signup")}
                  onClick={(e) =>
                    handleAuthAction(e, route.kind === "legal" ? "signin" : "signup")
                  }
                  id="hero-primary-cta"
                  className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-7 py-4 text-sm sm:text-base font-extrabold tracking-wide text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-950/50"
                >
                  {route.primaryCtaLabel}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Compact Workflow Bar Immediately Below Hero */}
        {route.workflowSteps && route.workflowSteps.length > 0 && (
          <section className="border-b border-zinc-900 bg-zinc-950/60">
            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
              <div className={isHome ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
                <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  {route.workflowHeading}
                </h2>
                {route.workflowIntro && (
                  <p className="mt-2 text-sm sm:text-base text-zinc-400">
                    {route.workflowIntro}
                  </p>
                )}
              </div>

              <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {route.workflowSteps.map((item) => (
                  <li
                    key={item.step}
                    className="rounded-2xl border border-zinc-800/90 bg-[#0a0912] p-5"
                  >
                    <span className="font-mono text-xs font-bold tracking-wider text-purple-400">
                      {item.step}
                    </span>
                    <h3 className="mt-1.5 text-base font-bold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* Verified Writing Frameworks & Techniques Section (Homepage) */}
        {route.frameworkItems && route.frameworkItems.length > 0 && (
          <section
            id="writing-frameworks"
            className="border-b border-zinc-900 bg-[#08070f]"
          >
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
              <div className={isHome ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-purple-400">
                  VERIFIED WRITING TECHNIQUES
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl leading-[1.08]">
                  {route.frameworkHeading}
                </h2>
                {route.frameworkIntro && (
                  <p className="mt-3 text-base leading-relaxed text-zinc-300">
                    {route.frameworkIntro}
                  </p>
                )}
              </div>

              <div className="mt-10 grid gap-6 md:grid-cols-2">
                {route.frameworkItems.map((item) => (
                  <article
                    key={item.name}
                    className="flex flex-col justify-between rounded-2xl border border-zinc-800/90 bg-[#0d0c16] p-6 sm:p-7"
                  >
                    <div>
                      <p className="font-mono text-xs font-semibold uppercase tracking-wider text-purple-300">
                        {item.availabilityLabel}
                      </p>
                      <h3 className="mt-2 text-lg font-bold text-white leading-snug">
                        {item.name}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                        <strong className="font-semibold text-zinc-200">Problem solved: </strong>
                        {item.problemSolved}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                        {item.explanation}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-zinc-800/80 pt-4">
                      <p className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                        Structure example
                      </p>
                      <p className="mt-1.5 rounded-xl border border-zinc-800/80 bg-[#07060d] px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed text-zinc-200">
                        {item.example}
                      </p>
                      {item.featureLinkPath && item.featureLinkLabel && (
                        <div className="mt-3">
                          <a
                            href={item.featureLinkPath}
                            onClick={(e) => handleLinkClick(e, item.featureLinkPath!)}
                            className="inline-flex items-center text-xs font-semibold text-purple-300 hover:text-purple-200 underline underline-offset-4"
                          >
                            {item.featureLinkLabel} →
                          </a>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 3-Section Product Workflow Breakdown (Homepage) */}
        {route.screenshotSections && route.screenshotSections.length > 0 && (
          <div className="divide-y divide-zinc-900">
            {route.screenshotSections.map((section, idx) => {
              const showMedia = Boolean(section.hasGenuineAsset && section.screenshotSrc);
              const mediaFirstOnDesktop = idx % 2 === 1;
              return (
                <section
                  key={section.id}
                  id={section.id}
                  className={idx % 2 === 1 ? "bg-zinc-950/40" : "bg-[#06050b]"}
                >
                  <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
                    {showMedia ? (
                      <div className="grid items-center gap-10 lg:grid-cols-12">
                        {/* Copy Column */}
                        <div
                          className={`lg:col-span-5 ${
                            mediaFirstOnDesktop ? "lg:order-2" : "lg:order-1"
                          }`}
                        >
                          <p className="font-mono text-xs font-bold tracking-widest text-purple-400">
                            {section.stepLabel}
                          </p>
                          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl leading-[1.08]">
                            {section.heading}
                          </h2>
                          <p className="mt-4 text-base leading-relaxed text-zinc-300">
                            {section.description}
                          </p>
                          <ul className="mt-6 space-y-2.5 text-sm text-zinc-300">
                            {section.bullets.map((bullet) => (
                              <li key={bullet} className="flex items-start gap-2.5">
                                <span
                                  aria-hidden="true"
                                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400"
                                />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                          {section.featureLinkPath && section.featureLinkLabel && (
                            <div className="mt-6">
                              <a
                                href={section.featureLinkPath}
                                onClick={(e) => handleLinkClick(e, section.featureLinkPath!)}
                                className="inline-flex items-center text-sm font-semibold text-purple-300 hover:text-purple-200 underline underline-offset-4"
                              >
                                {section.featureLinkLabel} →
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Genuine Screenshot Column */}
                        <div
                          className={`lg:col-span-7 ${
                            mediaFirstOnDesktop ? "lg:order-1" : "lg:order-2"
                          }`}
                        >
                          <figure className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0b0a14] shadow-2xl">
                            <img
                              src={section.screenshotSrc}
                              alt={section.screenshotAlt || section.heading}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-auto block max-w-full"
                            />
                            {(section.screenshotCaption || section.screenshotAlt) && (
                              <figcaption className="px-4 py-3 text-xs text-zinc-400 bg-zinc-950/90">
                                {section.screenshotCaption || section.screenshotAlt}
                              </figcaption>
                            )}
                          </figure>
                        </div>
                      </div>
                    ) : (
                      /* Single Readable Column when no image asset is attached */
                      <div className={isHome ? "mx-auto max-w-3xl" : "max-w-3xl"}>
                        <div className={isHome ? "text-center" : ""}>
                          <p className="font-mono text-xs font-bold tracking-widest text-purple-400">
                            {section.stepLabel}
                          </p>
                          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl leading-[1.08]">
                            {section.heading}
                          </h2>
                          <p
                            className={`mt-4 text-base leading-relaxed text-zinc-300 ${
                              isHome ? "mx-auto max-w-2xl" : ""
                            }`}
                          >
                            {section.description}
                          </p>
                        </div>
                        <ul
                          className={`mt-6 space-y-2.5 text-sm text-zinc-300 ${
                            isHome ? "mx-auto max-w-2xl text-left" : ""
                          }`}
                        >
                          {section.bullets.map((bullet) => (
                            <li key={bullet} className="flex items-start gap-2.5">
                              <span
                                aria-hidden="true"
                                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400"
                              />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                        {section.featureLinkPath && section.featureLinkLabel && (
                          <div className={isHome ? "mt-6 text-center" : "mt-6"}>
                            <a
                              href={section.featureLinkPath}
                              onClick={(e) => handleLinkClick(e, section.featureLinkPath!)}
                              className="inline-flex items-center text-sm font-semibold text-purple-300 hover:text-purple-200 underline underline-offset-4"
                            >
                              {section.featureLinkLabel} →
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Standard Feature / Legal Sections (Feature, Pricing, Legal Pages) */}
        {route.features && route.features.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            {route.sectionsHeading && (
              <div className="max-w-3xl">
                <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {route.sectionsHeading}
                </h2>
                {route.sectionsIntro && (
                  <p className="mt-3 text-base leading-relaxed text-zinc-400">
                    {route.sectionsIntro}
                  </p>
                )}
              </div>
            )}

            <div
              className={`mt-8 grid gap-6 ${
                route.kind === "legal" ? "grid-cols-1" : "md:grid-cols-2"
              }`}
            >
              {route.features.map((feature) => (
                <article
                  key={feature.heading}
                  className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 p-6 sm:p-7"
                >
                  <h3 className="text-lg font-bold text-white leading-snug">
                    {feature.heading}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                    {feature.body}
                  </p>
                  {feature.highlights && feature.highlights.length > 0 && (
                    <ul className="mt-4 space-y-2 border-t border-zinc-800/80 pt-4 text-sm text-zinc-300">
                      {feature.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <span
                            aria-hidden="true"
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Prominent Free Plan Promotion Section (Homepage) */}
        {route.freePromo && (
          <section className="border-t border-zinc-900 bg-[radial-gradient(ellipse_at_bottom,_rgba(126,34,206,0.22),_transparent_65%)]">
            <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <div className="rounded-3xl border border-purple-500/35 bg-zinc-950/90 p-8 sm:p-12 shadow-2xl">
                <div className={isHome ? "mx-auto max-w-3xl text-center" : ""}>
                  <p className="font-mono text-xs font-bold uppercase tracking-widest text-purple-300">
                    FREE PLAN FOR META THREADS CREATORS
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl leading-[1.06]">
                    {route.freePromo.heading}
                  </h2>
                  <p
                    className={`mt-4 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg ${
                      isHome ? "mx-auto" : ""
                    }`}
                  >
                    {route.freePromo.subheading}
                  </p>
                </div>

                <ul className="mt-8 grid gap-3 sm:grid-cols-2 text-sm text-zinc-200 text-left">
                  {route.freePromo.benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-start gap-2.5 rounded-xl border border-zinc-800/90 bg-[#0b0a13] p-4"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-purple-400"
                      />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                <div
                  className={`mt-8 flex flex-col sm:flex-row gap-4 ${
                    isHome ? "items-center justify-center" : "sm:items-center"
                  }`}
                >
                  <a
                    href={authHref("signup")}
                    onClick={(e) => handleAuthAction(e, "signup")}
                    className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-7 py-4 text-sm sm:text-base font-extrabold tracking-wide text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-950/50"
                  >
                    {route.freePromo.ctaLabel}
                  </a>
                  <a
                    href="/pricing"
                    onClick={(e) => handleLinkClick(e, "/pricing")}
                    className="text-sm font-semibold text-zinc-300 hover:text-white underline underline-offset-4"
                  >
                    Compare Free &amp; Pro Plans
                  </a>
                </div>

                <p className={`mt-5 text-xs text-zinc-400 ${isHome ? "text-center" : ""}`}>
                  {route.freePromo.footnote}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Frequently Asked Questions (Non-home pages that define FAQs) */}
        {route.faqs && route.faqs.length > 0 && (
          <section className="border-t border-zinc-900">
            <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Frequently Asked Questions
              </h2>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                {route.faqs.map((faq) => (
                  <article
                    key={faq.question}
                    className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-6"
                  >
                    <h3 className="text-base font-bold text-white">
                      {faq.question}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-zinc-300">
                      {faq.answer}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Internal Links Between Relevant Marketing Pages */}
        {route.relatedLinks.length > 0 && (
          <section className="border-t border-zinc-900 bg-zinc-950/30">
            <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
              <h2
                className={`text-xl font-extrabold tracking-tight text-white ${
                  isHome ? "text-center" : ""
                }`}
              >
                Explore ThreadsWorks Features
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {route.relatedLinks.map((link) => (
                  <a
                    key={link.path}
                    href={link.path}
                    onClick={(e) => handleLinkClick(e, link.path)}
                    className="group rounded-xl border border-zinc-800/80 bg-[#0b0a13] p-5 hover:border-purple-500/50 transition-colors"
                  >
                    <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                      {link.label}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                      {link.description}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Bottom CTA Band for Non-Home Feature Pages */}
        {route.kind === "feature" && (
          <section className="border-t border-zinc-900">
            <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
              <div className="rounded-3xl border border-purple-500/25 bg-gradient-to-br from-purple-950/35 via-zinc-950 to-indigo-950/25 p-8 sm:p-10">
                <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Start Creating Meta Threads Posts Free
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300 sm:text-base">
                  Set your creator voice, write clearer posts and hooks, and schedule directly to
                  Meta Threads—no credit card required.
                </p>
                <div className="mt-6">
                  <a
                    href={authHref("signup")}
                    onClick={(e) => handleAuthAction(e, "signup")}
                    className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-6 py-3.5 text-sm font-extrabold tracking-wide text-white hover:bg-purple-500 transition-colors"
                  >
                    START CREATING FREE
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Accessible Footer */}
      <footer className="border-t border-zinc-900 bg-[#040308]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <a
                href="/"
                onClick={(e) => handleLinkClick(e, "/")}
                className="text-base font-bold text-white"
              >
                {SITE_NAME}
              </a>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Write, organize, and schedule Threads posts in one place.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Product
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                {PUBLIC_MARKETING_ROUTES.filter(
                  (r) => r.kind !== "legal" && r.path !== "/threads-hook-generator"
                ).map((item) => (
                  <li key={item.path}>
                    <a
                      href={item.path}
                      onClick={(e) => handleLinkClick(e, item.path)}
                      className="hover:text-white transition-colors"
                    >
                      {item.navLabel}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Legal &amp; Access
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                <li>
                  <a
                    href={authHref("signin")}
                    onClick={(e) => handleAuthAction(e, "signin")}
                    className="hover:text-white transition-colors"
                  >
                    Sign In
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy"
                    onClick={(e) => handleLinkClick(e, "/privacy")}
                    className="hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    onClick={(e) => handleLinkClick(e, "/terms")}
                    className="hover:text-white transition-colors"
                  >
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-zinc-900 pt-6 text-xs text-zinc-500">
            © {new Date().getFullYear()} {SITE_NAME}. Built for Meta Threads creators.
          </div>
        </div>
      </footer>
    </div>
  );
}
