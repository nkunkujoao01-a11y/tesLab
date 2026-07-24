// Direct lecturer<->student messaging, one thread per (module, student)
// pair — see 0028_analytics_and_messaging.sql for the full schema
// reasoning, including why a thread belongs to "the module's admin side"
// collectively rather than one specific lecturer.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export type ModuleMessage = {
  id: string;
  senderRole: "lecturer" | "student";
  senderId: string;
  body: string;
  createdAt: string;
};

/** A single (module, student) conversation — every message plus the
 * current reply-permission state, real-time via Supabase Realtime so a
 * reply shows up without a manual refresh on either side. Used by both
 * the admin panel (any student) and the student's own view (always their
 * own id) — same hook, same query shape, just a different `studentId`
 * depending on who's asking. */
export function useModuleConversation(moduleId: string | null, studentId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ModuleMessage[]>([]);
  const [repliesAllowed, setRepliesAllowed] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!moduleId || !studentId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      const [messagesRes, conversationRes] = await Promise.all([
        supabase
          .from("module_messages")
          .select("id, sender_role, sender_id, body, created_at")
          .eq("module_id", moduleId)
          .eq("student_id", studentId)
          .order("created_at", { ascending: true }),
        supabase
          .from("module_conversations")
          .select("replies_allowed")
          .eq("module_id", moduleId)
          .eq("student_id", studentId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (messagesRes.error) console.error("Failed to load messages", messagesRes.error);
      if (conversationRes.error) {
        console.error("Failed to load conversation state", conversationRes.error);
      }
      setMessages(
        (messagesRes.data ?? []).map((m) => ({
          id: m.id,
          senderRole: m.sender_role,
          senderId: m.sender_id,
          body: m.body,
          createdAt: m.created_at,
        })),
      );
      // No conversation row yet means no lecturer has messaged this
      // student in this module at all — defaults to true (see
      // useSendModuleMessage's own comment on why the row is only ever
      // created lazily, on the first real message).
      setRepliesAllowed(conversationRes.data?.replies_allowed ?? true);
      setLoading(false);
    };
    void load();

    // Real-time: a message either side sends should appear for the other
    // without them needing to reopen the thread — this is a live
    // back-and-forth conversation, not a static log.
    const channel = supabase
      .channel(`module_messages:${moduleId}:${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "module_messages",
          filter: `student_id=eq.${studentId}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [moduleId, studentId]);

  const send = useCallback(
    async (body: string) => {
      if (!user || !moduleId || !studentId || !body.trim()) return false;
      const isLecturerSending = user.id !== studentId;
      if (isLecturerSending) {
        // The student-reply RLS policy checks for an *existing*
        // module_conversations row with replies_allowed = true (see
        // 0028_analytics_and_messaging.sql) — "no row" fails that check,
        // which would silently block replies to a thread the lecturer
        // never explicitly toggled. Lazily creates it here, on the first
        // real message, defaulting open — `ignoreDuplicates` so this
        // never clobbers a lecturer's own earlier "close replies" choice
        // on an already-existing row.
        const { error: conversationError } = await supabase
          .from("module_conversations")
          .upsert(
            { module_id: moduleId, student_id: studentId, replies_allowed: true },
            { onConflict: "module_id,student_id", ignoreDuplicates: true },
          );
        if (conversationError) {
          console.error("Failed to initialize conversation state", conversationError);
        }
      }
      const { error } = await supabase.from("module_messages").insert({
        id: crypto.randomUUID(),
        module_id: moduleId,
        student_id: studentId,
        sender_role: isLecturerSending ? "lecturer" : "student",
        sender_id: user.id,
        body: body.trim(),
      });
      if (error) {
        console.error("Failed to send message", error);
        toast.error(
          error.code === "42501"
            ? "Replies are currently turned off for this conversation."
            : "Couldn't send that message. Try again.",
        );
        return false;
      }
      return true;
    },
    [user, moduleId, studentId],
  );

  return { messages, repliesAllowed, loading, send };
}

/** Lecturer-only: opens or closes replies for one student's thread — the
 * "student can reply unless the admin refuses" lever. Upserts rather than
 * requiring the row to already exist, since a conversation's row is only
 * ever created lazily on its first real message (see useSendModuleMessage's
 * caller for that flow) — a lecturer might toggle this before or after
 * that first message exists. */
export function useSetRepliesAllowed(moduleId: string, studentId: string) {
  const [updating, setUpdating] = useState(false);

  const setRepliesAllowed = useCallback(
    async (allowed: boolean) => {
      setUpdating(true);
      try {
        const { error } = await supabase
          .from("module_conversations")
          .upsert({ module_id: moduleId, student_id: studentId, replies_allowed: allowed });
        if (error) {
          console.error("Failed to update reply permission", error);
          toast.error("Couldn't update that. Try again.");
          return false;
        }
        return true;
      } finally {
        setUpdating(false);
      }
    },
    [moduleId, studentId],
  );

  return { setRepliesAllowed, updating };
}
