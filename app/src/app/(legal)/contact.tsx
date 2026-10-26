import { LEGAL_CONTACT_EMAIL } from "@/lib/legal";

export function LegalContact() {
  return LEGAL_CONTACT_EMAIL ? (
    <p>
      Fale conosco pelo e-mail{" "}
      <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-4">{LEGAL_CONTACT_EMAIL}</a>.
    </p>
  ) : (
    <p>Você pode exercer os direitos acima diretamente no app, em Configurações → Privacidade e dados, ou pedir ajuda ao seu personal.</p>
  );
}
