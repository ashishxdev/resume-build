import type { AtsAnalysisService } from "./ats-analysis-service.js";

export function startAtsAnalysisLoop(
  service: AtsAnalysisService,
  intervalMilliseconds = 1_000,
) {
  let stopped = false;
  let timeout: NodeJS.Timeout | null = null;
  const run = async () => {
    if (stopped) return;
    const processed = await service.processNext().catch(() => false);
    timeout = setTimeout(run, processed ? 0 : intervalMilliseconds);
  };
  void run();
  return () => {
    stopped = true;
    if (timeout) clearTimeout(timeout);
  };
}
