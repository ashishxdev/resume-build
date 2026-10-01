import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy · Make My Resume",
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.home} href="/">
          ← Make My Resume
        </Link>
      </header>
      <article className={styles.article}>
        <p>Last updated · October 1, 2026</p>
        <h1>Privacy Policy</h1>
        <p className={styles.lede}>
          This policy explains the information Make My Resume uses to provide
          secure accounts and evidence-backed resume tools.
        </p>
        <section>
          <h2>Information we process</h2>
          <p>
            We process account details such as your name and email address,
            authentication and security records, and the resume, job, and
            supporting material you choose to submit to the service.
          </p>
        </section>
        <section>
          <h2>How information is used</h2>
          <p>
            Information is used to operate and secure your account, provide
            requested resume features, diagnose reliability issues, and improve
            the service. We do not use your resume to invent qualifications.
          </p>
        </section>
        <section>
          <h2>Storage and service providers</h2>
          <p>
            Authorized infrastructure and authentication providers may process
            information only as needed to operate the service. Retention and
            deletion controls will follow the capabilities available in your
            account and applicable legal requirements.
          </p>
        </section>
        <section>
          <h2>Your choices and questions</h2>
          <p>
            You may stop using the service or request help through the support
            channel provided by the deployment you use. This policy will be
            updated when the product adds material data-processing features.
          </p>
        </section>
      </article>
    </main>
  );
}
