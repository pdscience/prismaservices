# Canais de contato e pagamento por país — design

**Data:** 2026-11-09
**Status:** aprovado pelo parceiro humano

## Intenção

O app opera no Brasil e nos EUA. No Brasil o canal de atendimento é WhatsApp e o
pagamento informal usa chave PIX; nos EUA não existe PIX e WhatsApp é incomum —
prioridade para SMS e email. A experiência precisa mostrar e usar os canais
certos em cada mercado, sem duplicar o app.

## Decisões (confirmadas com o parceiro)

1. **País pelo idioma:** `pt-BR` → Brasil · `en`/`es` → EUA. Já é o padrão do
   landing (seções US) e da moeda (BRL/USD em `usePlans`).
2. **Comportamento, não só informação:** botões e formulários também mudam.
3. **PIX nos EUA:** apenas escondido — sem campo substituto.
4. **Formulário de contato (landing):** en/es abre `mailto:` com mensagem
   pronta + botão secundário que abre `sms:`. pt-BR mantém `wa.me`.
5. **Contato direto cliente↔profissional:** nos EUA usa SMS (o telefone existe
   dos dois lados em todos os fluxos).
6. **Notificação de pros:** `notify-pros.ts` (WhatsApp) só para pros do Brasil;
   `notify-pros-sms.ts` (Twilio) só para pros do exterior, com corpo em inglês.
   `country_code` vazio/nulo conta como BR (base legada é brasileira).

## Abordagens consideradas

- **Seletor de país explícito / geolocalização** — rejeitado: mais fiel, porém
  custo alto e o app já padronizou idioma como proxy de mercado.
- **Backend de email (ex: Resend)** — rejeitado para o escopo atual: infra
  nova; `mailto:`/`sms:` seguem o padrão do `wa.me` atual (abre o app do
  visitante com a mensagem pronta, sem sair da página).
- **Renomear chaves i18n** (`openWhatsApp` → `openSms` etc.) — rejeitado: as
  chaves são identificadores estáveis; o texto traduzido muda por idioma.

## Mudanças

1. `src/lib/contact.ts` (novo): `isBrazilMarket(lang)`, `buildSmsLink(phone, text)`
   (formato `sms:+1555...?&body=` compatível iOS/Android), `buildContactLink(phone, text, lang)`
   (delega para `wa.me` ou `sms:`), `buildSupportEmail(subject, body)`
   (`mailto:` com destinatário `VITE_SUPPORT_EMAIL`). Testes unitários via TDD.
2. `.env.example`: `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_SMS`.
3. i18n en/es: ~25 chaves trocam "WhatsApp" por "SMS"/"email" (jornada, FAQ,
   contato, views). `es` remove PIX de `step3ProDesc`/`feat3Desc` (en já neutro).
   Chaves novas nos 3 catálogos: `landing.sendByEmail`, `landing.sendBySms`,
   `pro.contactPhone`.
4. `LandingView.vue`: submit do formulário em en/es abre `mailto:` + botão
   secundário SMS; toast de email aberto; `lead_email`/`lead_sms` no analytics.
5. Botões diretos cliente↔pro (`SolicitarView`, `MeusPedidosView`,
   `HistoricoView`, `PedidosProView`): `buildWhatsAppLink` → `buildContactLink`.
6. `ProfileEditModal` e `ReceiptModal`: campo/linha PIX só em pt-BR.
7. `PerfilProView`: label "WhatsApp:" → `pro.contactPhone` (pt WhatsApp /
   en+es SMS); botão de compartilhar indicação via `wa.me` escondido em en/es
   (o botão de copiar link continua).
8. `functions/notify-pros.ts`: filtra pros `country_code = BR` (vazio = BR).
   `functions/notify-pros-sms.ts`: só exterior + corpo em inglês. Template
   WhatsApp mantém `pt_BR` (agora coerente com o destino).

## Não-metas

- Checkout de planos (Stripe cartão nos dois países, já correto).
- Backend de envio de email para notificação de pros.
- Botão WhatsApp desativado no `ProfessionalCard` (`false &&`) e fallback
  `wa.me` do `share.ts`.

## Pendências do parceiro

- Preencher `VITE_SUPPORT_EMAIL` e `VITE_SUPPORT_SMS` reais no deploy.
- Redeployar as duas functions no InsForge.

## Notas do implementador

- As mensagens SMS reutilizam os textos formatados para WhatsApp (com
  asteriscos de negrito) no primeiro momento; polir depois se incomodar.
- Functions Deno não têm harness de teste; verificação manual via curl
  documentada no plano.
