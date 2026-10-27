import type { Metadata } from "next";
import { LEGAL_UPDATED_LABEL } from "@/lib/legal";
import { LegalContact } from "../contact";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <>
      <header className="grid gap-2">
        <h1>Política de privacidade</h1>
        <p>Atualizada em {LEGAL_UPDATED_LABEL}. Esta política explica quais dados o FitFlow Pro trata, por quê e quais são os seus direitos, conforme a LGPD (Lei nº 13.709/2018).</p>
      </header>

      <h2>1. Dados que tratamos</h2>
      <ul>
        <li><strong>Conta:</strong> nome, e-mail, senha (guardada de forma criptografada) e foto de perfil, se você enviar.</li>
        <li><strong>Acompanhamento:</strong> objetivos, nível, limitações informadas, planos de treino e alimentação, treinos e cardio registrados, consumo de água.</li>
        <li><strong>Dados de saúde (sensíveis):</strong> peso, medidas, sexo, altura, data de nascimento, valores de bioimpedância e fotos de evolução.</li>
        <li><strong>Técnicos:</strong> cookies essenciais de sessão e a sua preferência de tema. Não usamos cookies de publicidade.</li>
      </ul>

      <h2>2. Para que usamos</h2>
      <ul>
        <li>Prestar o serviço: permitir que o personal acompanhe o aluno e que o aluno siga seu plano (execução de contrato, art. 7º, V).</li>
        <li>Dados de saúde: apenas para o acompanhamento físico, com o seu consentimento específico, dado ao aceitar o convite (art. 11, I).</li>
        <li>Segurança, prevenção de fraudes e cumprimento de obrigações legais.</li>
      </ul>

      <h2>3. Quem vê seus dados</h2>
      <ul>
        <li>Você e, no caso de alunos, o personal que enviou o convite. Outros alunos e outros personais não têm acesso.</li>
        <li>
          Fornecedores que operam a infraestrutura em nosso nome: Supabase (banco de dados, autenticação e arquivos, com servidores em São Paulo)
          e Vercel (hospedagem do aplicativo). O login é feito pelo Google Firebase Authentication, que recebe apenas seu e-mail e sua senha
          (guardada de forma cifrada) para confirmar seu acesso e enviar os e-mails de confirmação e de redefinição de senha; ele pode tratar
          esses dados em servidores fora do Brasil, com as garantias previstas na LGPD. Quando ativado, o Sentry recebe relatórios técnicos
          de erros, sem dados de saúde.
          O assistente de IA usa a Anthropic (Claude): quando você faz uma pergunta, ela recebe a conversa, seu primeiro nome e, se a
          pergunta depender disso, seu plano de treino ou os nomes dos exercícios da biblioteca. Medidas, fotos, anamnese e dieta não são
          enviados. O FitFlow não guarda as conversas (elas ficam só na aba do seu navegador); a Anthropic trata os dados nos Estados Unidos,
          não os usa para treinar modelos e os mantém apenas pelo prazo previsto nos termos comerciais dela.
          Eles só tratam os dados para prestar esse serviço.
        </li>
        <li>Não vendemos dados pessoais.</li>
      </ul>

      <h2>4. Segurança e retenção</h2>
      <p>
        As permissões são verificadas no próprio banco de dados, fotos de evolução e vídeos ficam em armazenamento privado com links temporários,
        e as conexões são criptografadas. Os dados são mantidos enquanto a conta existir e apagados quando ela é excluída, salvo obrigação legal.
      </p>

      <h2>5. Seus direitos</h2>
      <ul>
        <li>Confirmar e acessar seus dados, e baixar uma cópia (Configurações → Privacidade e dados → Baixar meus dados).</li>
        <li>Corrigir dados incompletos ou desatualizados.</li>
        <li>Excluir sua conta e seus dados (Configurações → Privacidade e dados → Excluir conta).</li>
        <li>Revogar o consentimento para dados de saúde, o que encerra o acompanhamento por meio da plataforma.</li>
      </ul>

      <h2>6. Menores de idade</h2>
      <p>Alunos com menos de 18 anos só devem usar a plataforma com autorização e acompanhamento do responsável legal.</p>

      <h2>7. Contato</h2>
      <LegalContact />
    </>
  );
}
