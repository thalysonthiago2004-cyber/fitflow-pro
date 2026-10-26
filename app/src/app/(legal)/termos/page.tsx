import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_UPDATED_LABEL } from "@/lib/legal";
import { LegalContact } from "../contact";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <>
      <header className="grid gap-2">
        <h1>Termos de uso</h1>
        <p>Atualizados em {LEGAL_UPDATED_LABEL}.</p>
      </header>

      <h2>1. O que é o FitFlow Pro</h2>
      <p>
        Plataforma para personal trainers acompanharem seus alunos: treinos, cardio, hidratação, alimentação, medidas e fotos de evolução.
        O personal cria a conta e convida os alunos; cada aluno vê apenas os próprios dados e o que o seu personal compartilhou com ele.
      </p>

      <h2>2. Versão de testes</h2>
      <p>
        O FitFlow Pro está em versão beta gratuita. Funcionalidades podem mudar, ficar indisponíveis ou ser removidas.
        Avisaremos antes de qualquer cobrança; nada será cobrado sem que você contrate um plano.
      </p>

      <h2>3. Não é orientação médica</h2>
      <p>
        Metas de hidratação, planos alimentares, estimativas de calorias, de gordura corporal e de taxa metabólica são estimativas
        ou metas definidas pelo personal. Não são diagnóstico nem prescrição médica ou nutricional. Procure um profissional de saúde
        antes de iniciar ou mudar sua rotina de exercícios, especialmente se tiver alguma condição de saúde.
      </p>

      <h2>4. Responsabilidades</h2>
      <ul>
        <li>O personal é responsável pelos treinos, metas e orientações que cadastra para seus alunos.</li>
        <li>O aluno é responsável pelas informações que registra e por respeitar seus limites durante os exercícios.</li>
        <li>Cada pessoa é responsável por manter sua senha em sigilo.</li>
        <li>Fotos e vídeos enviados precisam ser seus ou ter autorização de uso, e não podem expor terceiros sem consentimento.</li>
      </ul>

      <h2>5. Uso adequado</h2>
      <p>Não é permitido usar a plataforma para fins ilegais, acessar dados de outras pessoas sem autorização ou tentar burlar a segurança do serviço.</p>

      <h2>6. Encerramento</h2>
      <p>
        Você pode excluir sua conta a qualquer momento em Configurações → Privacidade e dados. Ao excluir uma conta de personal,
        o espaço de trabalho e os dados dos alunos vinculados a ele também são apagados; os alunos mantêm o acesso à própria conta.
      </p>

      <h2>7. Privacidade</h2>
      <p>
        O tratamento de dados pessoais segue a <Link href="/privacidade" className="font-medium text-foreground underline underline-offset-4">Política de privacidade</Link>,
        de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
      </p>

      <h2>8. Contato</h2>
      <LegalContact />
    </>
  );
}
