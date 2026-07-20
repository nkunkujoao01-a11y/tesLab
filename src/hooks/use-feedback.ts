import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

// Real, deliberate limits — a bug report needs a screenshot or two, not a
// photo dump, and this app has always treated uploads (course PDFs, 25MB)
// as something worth capping rather than trusting the browser alone.
export const MAX_FEEDBACK_IMAGES = 4;
export const MAX_IMAGE_MB = 8;

export type FeedbackImage = { id: string; file: File; previewUrl: string };

export function makeFeedbackImage(file: File): FeedbackImage {
  return { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) };
}

/** Submits a feedback/bug report, optionally with screenshots, straight to
 * Supabase — online-only (see 0009_feedback.sql's own comment on why this
 * skips the app's usual local-first sync pattern: there's no local read
 * path for a report the student never sees again after sending it). */
export function useSubmitFeedback() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = useCallback(
    async (message: string, images: FeedbackImage[]) => {
      if (!user) return false;
      setSubmitting(true);
      const feedbackId = crypto.randomUUID();
      try {
        const imagePaths: string[] = [];
        for (const [index, image] of images.entries()) {
          const path = `${user.id}/${feedbackId}/${index}-${image.file.name}`;
          const { error } = await supabase.storage.from("feedback-images").upload(path, image.file);
          if (error) throw error;
          imagePaths.push(path);
        }

        const { error } = await supabase.from("feedback").insert({
          id: feedbackId,
          user_id: user.id,
          message: message.trim(),
          image_paths: imagePaths,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;

        toast.success("Thanks — your feedback has been sent.");
        return true;
      } catch (err) {
        console.error("Failed to submit feedback", err);
        toast.error("Couldn't send your feedback. Try again.");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [user],
  );

  return { submitFeedback, submitting };
}
