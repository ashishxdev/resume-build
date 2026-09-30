import type { PropsWithChildren } from "react";

export interface ResumeCanvasProps extends PropsWithChildren {
  className?: string;
}

export function ResumeCanvas({ children, className }: ResumeCanvasProps) {
  return (
    <article className={className} data-resume-renderer="canvas">
      {children}
    </article>
  );
}
