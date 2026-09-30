import Link from "next/link";
import type { ComponentProps } from "react";

type ButtonLinkProps = ComponentProps<typeof Link>;

export function ButtonLink({ className = "", ...props }: ButtonLinkProps) {
  return (
    <Link
      className={`inline-flex rounded-lg bg-blue-700 px-5 py-3 font-medium text-white transition hover:bg-blue-800 ${className}`}
      {...props}
    />
  );
}
