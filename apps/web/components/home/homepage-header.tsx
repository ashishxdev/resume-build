"use client";

import Link from "next/link";
import { useEffect, type MouseEvent } from "react";

import { authClient } from "@/lib/auth/client";

import { SiteBrand } from "./site-brand";

const navigationItems = [
  ["Product", "#product"],
  ["How it works", "#how-it-works"],
  ["Match & ATS", "#match-and-ats"],
  ["FAQ", "#faq"],
] as const;

function SessionActions({
  isAuthenticated,
  isPending,
  mobile = false,
}: {
  isAuthenticated: boolean;
  isPending: boolean;
  mobile?: boolean;
}) {
  const className = mobile ? "mobile-menu-account" : "header-account-actions";

  if (isPending) {
    return (
      <div
        aria-label="Checking account status"
        aria-live="polite"
        className={`${className} session-actions-pending`}
      >
        <span aria-hidden="true" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className={`${className} is-authenticated`}>
        <Link className="button button-small dashboard-link" href="/dashboard">
          <svg aria-hidden="true" fill="none" viewBox="0 0 18 18">
            <rect height="5" rx="1" width="5" x="2" y="2" />
            <rect height="5" rx="1" width="5" x="11" y="2" />
            <rect height="5" rx="1" width="5" x="2" y="11" />
            <rect height="5" rx="1" width="5" x="11" y="11" />
          </svg>
          <span className="dashboard-label">Dashboard</span>
          <span className="dashboard-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className={className}>
      <Link className="login-link" href="/login">
        Log in
      </Link>
      <Link className="button button-small" href="/signup">
        Get started
      </Link>
    </div>
  );
}

export function HomepageHeader() {
  const { data, isPending, refetch } = authClient.useSession();
  const sessionActionProps = {
    isAuthenticated: Boolean(data?.user),
    isPending,
  };

  useEffect(() => {
    void refetch().catch(() => undefined);
  }, [refetch]);

  function closeMobileMenu(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <SiteBrand />
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navigationItems.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <SessionActions {...sessionActionProps} />
          <details className="mobile-menu">
            <summary>
              <span>Menu</span>
              <svg aria-hidden="true" fill="none" viewBox="0 0 18 18">
                <path d="M3 5h12M3 9h12M3 13h12" />
              </svg>
            </summary>
            <nav aria-label="Mobile navigation">
              <div className="mobile-menu-links">
                {navigationItems.map(([label, href]) => (
                  <a href={href} key={href} onClick={closeMobileMenu}>
                    {label}
                    <span aria-hidden="true">→</span>
                  </a>
                ))}
              </div>
              <SessionActions {...sessionActionProps} mobile />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
