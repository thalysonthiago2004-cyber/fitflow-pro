"use client";

import { Archive, ArchiveRestore, UserMinus } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import type { StudentStatus } from "@/lib/supabase/database.types";
import { removeStudent, setStudentStatus } from "../actions";

type Props = { studentId: string; studentName: string; status: StudentStatus };

export function StudentStatusActions({ studentId, studentName, status }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {status === "active" ? (
        <ConfirmAction
          trigger={
            <Button variant="outline">
              <Archive aria-hidden />
              Arquivar aluno
            </Button>
          }
          title={`Arquivar ${studentName}?`}
          description="O aluno sai da lista de ativos, mas o histórico e o acesso dele são mantidos. Você pode reativar quando quiser."
          confirmLabel="Arquivar"
          successMessage="Aluno arquivado."
          onConfirm={() => setStudentStatus(studentId, "archived")}
        />
      ) : (
        <ConfirmAction
          trigger={
            <Button variant="outline">
              <ArchiveRestore aria-hidden />
              Reativar aluno
            </Button>
          }
          title={`Reativar ${studentName}?`}
          description="O aluno volta para a lista de ativos."
          confirmLabel="Reativar"
          successMessage="Aluno reativado."
          onConfirm={() => setStudentStatus(studentId, "active")}
        />
      )}
      <ConfirmAction
        trigger={
          <Button variant="destructive">
            <UserMinus aria-hidden />
            Remover do meu espaço
          </Button>
        }
        title={`Remover ${studentName}?`}
        description="O vínculo é encerrado e os dados de acompanhamento deste aluno no seu espaço são apagados. A conta do aluno continua existindo. Esta ação não pode ser desfeita."
        confirmLabel="Remover aluno"
        destructive
        onConfirm={() => removeStudent(studentId)}
      />
    </div>
  );
}
