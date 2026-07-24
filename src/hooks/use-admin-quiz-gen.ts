// AI quiz generation for the admin console — reuses the exact same
// generation pipeline (cloud-first, on-device fallback, one question per
// model call, QA-grounded answer checking, malformed-output resample)
// already proven out for a student's own personal-document quizzes (see
// use-quiz.ts's useGenerateQuiz, which this mirrors closely). The one
// real difference: this returns a *draft* for the lecturer to review and
// edit before anything goes out to students, rather than saving straight
// to a personal practice-quiz table — a quiz an admin publishes here goes
// to an entire class at once, so it gets a review step a student's own
// private practice quiz never needed.
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  buildSingleQuestionPrompt,
  buildQuestionSource,
  parseQuizResponse,
  parseCloudQuizJson,
  matchAnswerToOption,
  pickQuizQuestionCount,
  type QuizQuestion,
} from "@/lib/quiz-gen";
import { askChatModel } from "@/lib/ai-chat";
import { WorkerBusyError, answerQuestionViaWorker } from "@/lib/ai-worker-client";
import { generateViaCloud, CloudUnavailableError } from "@/lib/ai-cloud";
import {
  classifyModelError,
  isFatalCategory,
  fatalErrorUserMessage,
} from "@/lib/ai-error-classifier";
import { useAuth } from "@/hooks/use-auth";

const CLOUD_SOURCE_CHARS = 12_000;
const QUIZ_MAX_NEW_TOKENS = 150;
const MIN_QA_SCORE = 0.1;

export type ModuleQuizGenProgress = { current: number; total: number } | null;

/** Generates a draft quiz from `sourceText` — same generation discipline
 * as use-quiz.ts's useGenerateQuiz (see its own comments for the full
 * reasoning on each step), just handed back as a plain array instead of
 * written anywhere, so the caller can show it for review/editing first. */
export function useGenerateModuleQuizDraft() {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ModuleQuizGenProgress>(null);

  const generateDraft = useCallback(
    async (sourceText: string): Promise<QuizQuestion[]> => {
      if (!user) return [];
      setGenerating(true);
      setProgress(null);
      const questions: QuizQuestion[] = [];
      const questionCount = pickQuizQuestionCount();
      try {
        try {
          const raw = await generateViaCloud(
            "quiz",
            sourceText.slice(0, CLOUD_SOURCE_CHARS),
            user.id,
            questionCount,
          );
          const cloudQuestions = parseCloudQuizJson(raw);
          if (cloudQuestions.length > 0) {
            questions.push(...cloudQuestions);
          }
        } catch (err) {
          if (!(err instanceof CloudUnavailableError)) {
            console.error("Unexpected error calling cloud AI for module quiz generation", err);
          }
        }

        const usedCloud = questions.length > 0;
        for (let i = 1; !usedCloud && i <= questionCount; i++) {
          setProgress({ current: i, total: questionCount });
          const prompt = buildSingleQuestionPrompt(
            sourceText,
            i,
            questions.map((q) => q.question),
            questionCount,
          );
          try {
            let raw: string;
            try {
              raw = await askChatModel(
                [{ role: "user", content: prompt }],
                undefined,
                QUIZ_MAX_NEW_TOKENS,
              );
            } catch (err) {
              if (!(err instanceof WorkerBusyError)) throw err;
              console.error(`Question ${i} hit a busy worker, retrying once`, err);
              await new Promise((resolve) => setTimeout(resolve, 1000));
              raw = await askChatModel(
                [{ role: "user", content: prompt }],
                undefined,
                QUIZ_MAX_NEW_TOKENS,
              );
            }
            let parsed = parseQuizResponse(raw);
            if (parsed.length === 0) {
              const resampled = await askChatModel(
                [{ role: "user", content: prompt }],
                undefined,
                QUIZ_MAX_NEW_TOKENS,
                true,
              );
              parsed = parseQuizResponse(resampled);
            }
            if (parsed.length > 0) {
              const parsedQuestion = parsed[0];
              try {
                const { answer, score } = await answerQuestionViaWorker(
                  parsedQuestion.question,
                  buildQuestionSource(sourceText),
                );
                if (score >= MIN_QA_SCORE) {
                  const matchedIndex = matchAnswerToOption(answer, parsedQuestion.options);
                  if (matchedIndex >= 0 && matchedIndex !== parsedQuestion.correctIndex) {
                    parsedQuestion.correctIndex = matchedIndex;
                  }
                }
              } catch (err) {
                console.error(
                  `QA grounding failed for question ${i}, keeping the model's own answer`,
                  err,
                );
              }
              questions.push(parsedQuestion);
            }
          } catch (err) {
            console.error(`Failed to generate question ${i}`, err);
            const category = classifyModelError(err);
            if (isFatalCategory(category)) {
              toast.error(fatalErrorUserMessage(category, "this quiz"));
              return questions;
            }
          }
        }
        if (questions.length === 0) {
          toast.error("Couldn't generate a quiz from this material. Try again.");
        } else if (!usedCloud && questions.length < questionCount) {
          toast.warning(
            `Generated ${questions.length} of ${questionCount} questions — the rest timed out on this device. Connecting a free cloud AI key (Settings) avoids this.`,
          );
        }
        return questions;
      } catch (err) {
        console.error("Failed to generate module quiz draft", err);
        toast.error("Couldn't generate a quiz. Try again.");
        return questions;
      } finally {
        setGenerating(false);
        setProgress(null);
      }
    },
    [user],
  );

  return { generateDraft, generating, progress };
}
