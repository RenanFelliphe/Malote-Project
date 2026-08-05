# DEMANDAS.md

> Este documento reúne as demandas levantadas para evolução do sistema, além da especificação já formalizada em `Especificacao_Sistema_Emails_v3.md`. Diferente da especificação (que descreve o que **já foi decidido e está pronto para ser implementado**), este arquivo serve para registrar objetivos e ideias em diferentes estágios de maturidade — desde melhorias pontuais até a visão de longo prazo do projeto — para que não se percam entre uma conversa e outra.

---

## Objetivo de longo prazo do projeto

Hoje o sistema é uma ferramenta de **organização de destinatários**: ele importa planilhas, valida e-mails, identifica duplicados, e permite copiar a lista de e-mails selecionada para colar manualmente em outro programa (Outlook). O próprio envio nunca foi parte do escopo (ver seção 1 da especificação: *"O sistema não realizará o envio de e-mails"*).

A visão de longo prazo é transformar o sistema em um **disparador controlado de e-mails com proteção anti-spam** — ou seja, o sistema passa a enviar os e-mails de fato, não apenas organizar quem vai recebê-los. O objetivo por trás disso é evitar que envios em massa (dezenas ou centenas de e-mails de uma vez) façam com que o remetente seja identificado como spam pelos provedores (Gmail, Outlook, etc.), através de um envio **fatiado em blocos, espaçado no tempo**.

### Como o fluxo deve funcionar, na visão do usuário

1. O usuário seleciona os registros que devem receber o e-mail (os mesmos filtros/seleção que já existem hoje na tabela);
2. O usuário define (ou reaproveita) o **título** e o **conteúdo** do e-mail;
3. O usuário define em **quantos blocos** a lista selecionada deve ser dividida;
4. O usuário define o **intervalo de tempo** entre o envio de um bloco e o próximo;
5. O sistema realiza o envio **automaticamente**, bloco a bloco, respeitando o intervalo definido, sem exigir que o usuário repita nenhuma etapa manual.

**Exemplo concreto:**
- 100 e-mails selecionados;
- Divididos em 5 blocos de 20;
- Intervalo de 10 minutos entre blocos;
- Resultado: a cada 10 minutos, o sistema dispara automaticamente 20 e-mails, até completar os 5 blocos (40 minutos no total).

### Por que isso é uma mudança de escopo, e não só de interface

Vale deixar registrado o motivo de essa demanda não ser "só mais um botão": ela muda uma premissa fundamental do projeto.

- **Hoje, quem envia é o Outlook** — o sistema apenas prepara e-mails/título/corpo para serem colados manualmente. Não existe (e não é confiável tentar automatizar) uma forma de controlar o Outlook por fora para simular cliques de "enviar" em intervalos programados.
- **Envio automático de verdade exige que o próprio sistema envie o e-mail**, via integração real com um serviço de envio (ex.: Microsoft Graph API, já que o destino final é o Outlook/Microsoft 365, ou um serviço de SMTP).
- **Blocos com intervalo exigem um agendador** (algo que "lembre" de disparar o próximo bloco no horário certo), o que por sua vez exige um processo rodando de forma persistente — diferente do modelo atual, que só faz algo quando a página está aberta no navegador.

Ou seja: essa demanda pertence naturalmente à fase de evolução já prevista na seção **9. Planos Futuros** da especificação (que já antecipa a necessidade de backend e hospedação), só que estendendo aquela visão para incluir também o envio em si — algo que a especificação atual explicitamente exclui do escopo.

### O que essa implementação exigiria, tecnicamente

Registrando aqui os principais blocos de trabalho, para quando o projeto chegar nessa fase:

1. **Capacidade real de envio de e-mail**
   - Integração com Microsoft Graph API (`sendMail`), autenticando como a conta que hoje envia manualmente pelo Outlook. Exige registro de um aplicativo no Azure AD, consentimento OAuth e permissão `Mail.Send`.
   - Alternativa mais simples (porém mais limitada/menos "nativa" ao Outlook): envio via SMTP direto, se houver um servidor/relay disponível.

2. **Novo modelo de dados: "Disparo" (ou "Campanha")**
   - Registros selecionados (lista de IDs);
   - Título e corpo do e-mail (ligados à demanda de armazenamento de template, descrita abaixo);
   - Tamanho do bloco (ou número de blocos — um decorre do outro);
   - Intervalo entre blocos;
   - Status do disparo: pendente / em andamento / pausado / concluído / cancelado;
   - Progresso: quantos blocos já foram enviados, quando será o próximo;
   - Log de envio: data/hora de cada bloco, e-mails enviados com sucesso e com falha.

3. **Agendador (scheduler)**
   - Um processo que verifica periodicamente se algum disparo tem um bloco pendente cujo horário já chegou, e o executa.
   - Precisa sobreviver ao fechamento da aba/navegador — o que implica rodar como parte de um backend real, não apenas no client React.

4. **Tratamento de falhas e controle do usuário**
   - Registrar e-mails que falharam no envio de um bloco (sem travar o restante do disparo);
   - Permitir pausar, retomar ou cancelar um disparo em andamento;
   - Permitir reenviar apenas os e-mails que falharam.

5. **Boas práticas adicionais anti-spam** (fora do que foi pedido, mas relevante para o objetivo final)
   - Respeitar os limites diários de envio da própria conta usada (contas comuns do Microsoft 365/Gmail têm teto de e-mails por dia);
   - Considerar incluir link/opção de descadastro nos e-mails;
   - Evitar variações que possam disparar filtros de spam (links suspeitos, excesso de maiúsculas, etc.).

---

## Demanda imediata (fase manual — em andamento)

Enquanto a automação acima não é implementada, o envio continua manual pelo Outlook. A demanda imediata resolve um problema real desse fluxo manual: hoje o título e o corpo do e-mail ficam fora da plataforma (bloco de notas, Word, etc.), obrigando o usuário a transitar entre 3 ou mais janelas diferentes para montar um envio.

- **Modal/campo para guardar o título e o conteúdo do e-mail na própria página**, evitando depender de um bloco de notas ou editor de texto externo.
  - Reaproveitar o padrão já existente de cópia (`copiarTexto`, em `src/components/utils/clipboard.ts`) para adicionar botões de "copiar título" e "copiar corpo", análogos ao que já existe para copiar a lista de e-mails.
  - Persistir esses dados no mesmo esquema que já existe hoje para os registros (JSON via o middleware local descrito em `emailsApi.ts`), sem necessidade de botão "Salvar", seguindo a mesma regra de persistência imediata já definida na especificação (seção 2.2).
  - **Importante:** não é possível copiar e-mails + título + corpo em um único bloco e colar tudo de uma vez distribuído nos campos certos do Outlook (Destinatários / Assunto / Corpo). O "colar" sempre insere o conteúdo inteiro em um único campo — o campo onde estiver o cursor no momento. Por isso a solução é manter os três botões de cópia separados, cada um copiando exatamente o conteúdo do campo correspondente.

### Possível melhoria intermediária (opcional, ainda manual)

Como um passo intermediário entre o manual atual e a automação completa (útil caso a automação leve tempo para ser implementada): gerar um link `mailto:` a partir da seleção + template salvo (`mailto:?bcc=...&subject=...&body=...`), que abre o Outlook já com destinatários, assunto e corpo preenchidos automaticamente em um único clique — sem exigir três cópias/colagens separadas. Limitação a considerar: apenas texto puro (sem formatação) e limite de tamanho da URL (na prática, cerca de 2000 caracteres), o que pode ser insuficiente para listas grandes de destinatários.

---

## Resumo do roadmap

| Fase | O que é | Envio | Esforço |
|---|---|---|---|
| 1. Atual | Guardar título/corpo na plataforma + botões de cópia separados | Manual (Outlook) | Baixo |
| 2. Intermediária (opcional) | Link `mailto:` pré-preenchido em um clique | Manual (Outlook), mas 1 clique | Baixo/médio |
| 3. Futura | Disparador automático em blocos com intervalo, via API de envio real | Automático (pelo próprio sistema) | Alto |


(
   Agora veja como não fica nada legal essa toolbar de tabela com scroll.
Para facilitar, vamos usar a mesma estratégia que usamos na toolbar principal do modal: Seções + ver mais

Vamos agrupar alguns botões:
Inserir: A esquerda, a direita, acima, abaixo
Excluir: linha, coluna, tabela
Mesclar: Mesclar e dividir
Cabeçalho: Linha e coluna
Cor da célula
Tamanho: Altura, espessura e largura (E não precisa do placeholder, apenas o ícone e o input)
Duplicar: A direita, a esquerda
)