import { MessageSquare } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { listComments } from "@/lib/workouts/comments";
import { CommentForm, DeleteCommentButton } from "./comment-form";

// Conversation about one recorded workout between the student and their trainer.
export async function WorkoutComments({ logId, viewerId }: { logId: string; viewerId: string }) {
  const comments = await listComments(logId);
  return (
    <section aria-labelledby={`comments-${logId}`} className="grid gap-4 surface p-4">
      <h2 id={`comments-${logId}`} className="flex items-center gap-2 font-heading text-lg font-semibold">
        <MessageSquare className="size-5" aria-hidden />
        Comentários
      </h2>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum comentário ainda. Conte como foi ou deixe uma orientação.</p>
      ) : (
        <ul className="grid gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.authorId === viewerId ? "Você" : c.authorName}</span> · {formatDateTime(c.createdAt)}
                </p>
                <p className="text-sm whitespace-pre-line">{c.body}</p>
              </div>
              {c.authorId === viewerId && <DeleteCommentButton commentId={c.id} />}
            </li>
          ))}
        </ul>
      )}
      <CommentForm logId={logId} />
    </section>
  );
}
