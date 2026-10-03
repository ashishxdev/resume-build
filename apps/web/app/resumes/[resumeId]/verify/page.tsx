import { ResumeVerificationPage } from "@/components/resume/resume-verification-page";

export default async function VerifyResumePage({
  params,
}: {
  params: Promise<{ resumeId: string }>;
}) {
  const { resumeId } = await params;
  return <ResumeVerificationPage resumeId={resumeId} />;
}
