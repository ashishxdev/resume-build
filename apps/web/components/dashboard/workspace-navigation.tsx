"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import styles from "@/app/dashboard/dashboard.module.css";

type WorkspaceDestination = "activity" | "dashboard" | "resumes";

const destinations: Array<{
  href: string;
  icon: "activity" | "dashboard" | "document";
  id: WorkspaceDestination;
  label: string;
}> = [
  {
    href: "/dashboard",
    icon: "dashboard",
    id: "dashboard",
    label: "Dashboard",
  },
  { href: "/resumes", icon: "document", id: "resumes", label: "Resumes" },
  { href: "/activity", icon: "activity", id: "activity", label: "Activity" },
];

function NavigationIcon({
  name,
}: {
  name: "activity" | "bell" | "dashboard" | "document" | "profile";
}) {
  const paths: Record<
    "activity" | "bell" | "dashboard" | "document" | "profile",
    ReactNode
  > = {
    activity: <path d="M3 12h4l2.2-6 3.6 12 2.2-6H21" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    document: (
      <>
        <path d="M6 2h8l4 4v16H6z" />
        <path d="M14 2v5h5M9 12h6M9 16h6" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22c0-4 3.6-7 8-7s8 3 8 7" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      fill="none"
      viewBox="0 0 24 24"
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {paths[name]}
      </g>
    </svg>
  );
}

export function WorkspaceNavigation({
  active,
  email,
  initials,
  isSigningOut,
  name,
  onNotifications,
  onSignOut,
}: {
  active: WorkspaceDestination;
  email: string;
  initials: string;
  isSigningOut: boolean;
  name?: string | null;
  onNotifications: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link
            aria-label="Make My Resume home"
            className={styles.brand}
            href="/"
          >
            M
          </Link>

          <nav aria-label="Workspace navigation" className={styles.desktopNav}>
            {destinations.map((destination) => (
              <Link
                aria-current={destination.id === active ? "page" : undefined}
                className={
                  destination.id === active ? styles.activeNav : undefined
                }
                href={destination.href}
                key={destination.id}
              >
                {destination.label}
              </Link>
            ))}
          </nav>

          <div className={styles.accountArea}>
            <button
              aria-label="Notifications — none unread"
              className={styles.iconButton}
              data-has-unread="false"
              onClick={onNotifications}
              type="button"
            >
              <NavigationIcon name="bell" />
            </button>
            <details className={styles.accountMenu}>
              <summary aria-label="Open account menu">
                <span>{initials}</span>
                <i aria-hidden="true" />
              </summary>
              <div>
                <strong>{name || "Your account"}</strong>
                <small>{email}</small>
                <button
                  disabled={isSigningOut}
                  onClick={onSignOut}
                  type="button"
                >
                  {isSigningOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>

      <nav
        aria-label="Mobile workspace navigation"
        className={styles.mobileNav}
      >
        {destinations.map((destination) => (
          <Link
            aria-current={destination.id === active ? "page" : undefined}
            className={
              destination.id === active ? styles.mobileActive : undefined
            }
            href={destination.href}
            key={destination.id}
          >
            <NavigationIcon name={destination.icon} />
            <span>{destination.label}</span>
          </Link>
        ))}
        <details>
          <summary>
            <NavigationIcon name="profile" />
            <span>Profile</span>
          </summary>
          <div>
            <small>{email}</small>
            <button disabled={isSigningOut} onClick={onSignOut} type="button">
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </details>
      </nav>
    </>
  );
}
