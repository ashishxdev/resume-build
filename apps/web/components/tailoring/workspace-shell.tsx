"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./tailoring.module.css";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            className={styles.brand}
            href="/dashboard"
            aria-label="Make My Resume dashboard"
          >
            M
          </Link>
          <nav aria-label="Workspace navigation">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard#resumes">Resumes</Link>
            <Link href="/dashboard#activity">Activity</Link>
          </nav>
          <span className={styles.creditPill}>0 / 2 tailored</span>
        </div>
      </header>
      {children}
      <footer className={styles.footer}>
        <span>© Make My Resume</span>
        <nav>
          <Link href="/privacy">Privacy</Link>
          <Link href="/#integrity">Methodology</Link>
        </nav>
      </footer>
    </div>
  );
}
