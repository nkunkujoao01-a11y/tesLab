// Mounted once at the app root — auto-opens ResearchSurveyModal the
// first time useResearchSurveyPrompt's real-usage condition is met (see
// its own comment), and never again after being dismissed once, shown or
// not. Separate from the modal itself so Profile's voluntary "Take the
// survey" entry point can reuse ResearchSurveyModal directly without also
// pulling in this auto-trigger's own state.
import { useResearchSurveyPrompt } from "@/hooks/use-research-study";
import { ResearchSurveyModal } from "@/components/ResearchSurveyModal";

export function ResearchSurveyPrompt() {
  const { shouldShow, dismiss } = useResearchSurveyPrompt();

  if (!shouldShow) return null;

  return <ResearchSurveyModal onClose={dismiss} />;
}
