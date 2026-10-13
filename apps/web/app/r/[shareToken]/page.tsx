import type { Metadata } from "next";

import { PublicResumePage } from "@/components/resume/public-resume-page";

export const metadata: Metadata = {
  title: "Private resume | Make My Resume",
  description: "An unlisted resume shared through Make My Resume.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function SharedResumeRoute() {
  return <PublicResumePage />;
}
