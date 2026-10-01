import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Use · Make My Resume",
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.home} href="/">
          ← Make My Resume
        </Link>
      </header>
      <article className={styles.article}>
        <p>Last updated · October 1, 2026</p>
        <h1>Terms of Use</h1>
        <p className={styles.lede}>
          These terms govern your use of Make My Resume and its resume-tailoring
          tools.
        </p>
        <section>
          <h2>Your account</h2>
          <p>
            Provide accurate account information, keep your credentials secure,
            and notify the service operator if you believe your account has been
            compromised.
          </p>
        </section>
        <section>
          <h2>Your content and responsible use</h2>
          <p>
            You remain responsible for the accuracy and legality of content you
            submit and approve. Do not upload material you lack permission to
            use or attempt to misuse, disrupt, or bypass the service.
          </p>
        </section>
        <section>
          <h2>AI-assisted suggestions</h2>
          <p>
            Suggestions are drafting assistance, not a guarantee of employment,
            interview performance, or applicant-tracking results. Review every
            proposed change and submit only claims you can support.
          </p>
        </section>
        <section>
          <h2>Availability and changes</h2>
          <p>
            Features may change as the product develops. Access may be limited
            to protect users, comply with law, or respond to misuse. Material
            changes to these terms will be reflected on this page.
          </p>
        </section>
      </article>
    </main>
  );
}
