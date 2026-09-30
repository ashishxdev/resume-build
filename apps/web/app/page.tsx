import { ResumeCanvas } from "@make-my-resume/resume-renderer";

import { ButtonLink } from "@/components/ui/button-link";

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_0.85fr]">
      <section id="foundation">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Make My Resume
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-slate-950">
          Tailor your resume for every job—without making anything up.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          The project foundation is running. Resume importing, evidence-based AI
          suggestions, and editing will be added in focused implementation
          phases.
        </p>
        <div className="mt-8">
          <ButtonLink href="#foundation">Project scaffold ready</ButtonLink>
        </div>
      </section>

      <ResumeCanvas className="min-h-96 rounded-2xl border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/60">
        <div className="h-4 w-40 rounded bg-slate-900" />
        <div className="mt-3 h-2 w-28 rounded bg-blue-500" />
        <div className="mt-10 space-y-3">
          <div className="h-2 rounded bg-slate-200" />
          <div className="h-2 rounded bg-slate-200" />
          <div className="h-2 w-4/5 rounded bg-slate-200" />
        </div>
        <div className="mt-10 h-px bg-slate-200" />
        <div className="mt-8 space-y-4">
          <div className="h-3 w-32 rounded bg-slate-800" />
          <div className="h-2 rounded bg-slate-200" />
          <div className="h-2 w-11/12 rounded bg-slate-200" />
        </div>
      </ResumeCanvas>
    </main>
  );
}
