# Sistema de Organização e Envio de E-mails

## Visão geral

Este projeto é uma aplicação local para organizar, visualizar e gerenciar listas de e-mails importadas de planilhas em formato CSV ou XLSX. A ideia é transformar uma tabela de origem em uma interface web para:

- consultar registros de forma organizada;
- buscar e filtrar por nome, e-mail e status;
- ordenar os dados;
- selecionar registros para copiar e-mails;
- atualizar status manualmente ou em massa;
- manter um arquivo JSON como fonte oficial dos dados.

O sistema não envia e-mails automaticamente. Sua função é apenas preparar e organizar os destinatários para envio posterior.

## Objetivo do projeto

O projeto foi pensado para facilitar o trabalho de lidar com grandes listas de contatos vindas de planilhas, especialmente em cenários onde:

- a planilha é a fonte inicial dos dados;
- o usuário precisa revisar, classificar e organizar os registros;
- há necessidade de remover duplicidades, validar e-mails e manter um histórico de alterações.

A proposta inicial está descrita em [public/Especificacao_Sistema_Emails_v3.md](public/Especificacao_Sistema_Emails_v3.md) e nas etapas de desenvolvimento em [public/etapas.txt](public/etapas.txt).

---

## Tecnologias utilizadas

- React 19
- TypeScript
- Vite
- React Router
- Node.js para o script de sincronização
- Bibliotecas auxiliares para leitura de CSV/XLSX

---

## Como executar o projeto

### 1. Pré-requisitos

Tenha instalado:

- Node.js
- npm

### 2. Instalar dependências

Na raiz do projeto, execute:

```powershell
npm install
```

### 3. Rodar a aplicação localmente

```powershell
npm run dev
```

A aplicação ficará disponível em:

```text
http://localhost:5173/
```

### 4. Construir para produção

```powershell
npm run build
```

O build será gerado na pasta `dist/`.

---

## Fluxo de funcionamento

O fluxo principal do projeto é este:

1. Uma planilha CSV/XLSX é colocada na pasta [data](data).
2. Um script Node lê essa planilha.
3. Os dados são transformados em registros e sincronizados com o arquivo [data/emails.json](data/emails.json).
4. A interface React lê esse JSON e exibe os registros em tela.
5. O usuário pode buscar, filtrar, ordenar, selecionar e alterar status dos registros.

### Fluxo de dados

```text
Planilha (.csv/.xlsx)
   ↓
Script de sincronização
   ↓
data/emails.json
   ↓
Interface React
```

---

## Como sincronizar uma nova planilha

Sempre que você tiver uma nova tabela para importar, siga estes passos:

1. Coloque o arquivo na pasta [data](data).
2. Abra o terminal na raiz do projeto.
3. Execute o comando abaixo:

```powershell
Set-Location 'c:\Users\DELL030\Desktop\Felliphe Pasta\sistema-emails'
$env:TS_NODE_PROJECT='tsconfig.scripts.json'
node --loader ts-node/esm src/scripts/sync.ts data/seu-arquivo.csv
```

Substitua `seu-arquivo.csv` pelo nome do arquivo real.

Esse comando:

- lê a planilha;
- identifica colunas como nome, e-mail e ID;
- atualiza o arquivo [data/emails.json](data/emails.json);
- recalcula status básicos como válido, inválido e duplicado.

> Observação: no Windows PowerShell, a variável de ambiente `TS_NODE_PROJECT` precisa ser definida explicitamente, como no exemplo acima.

---

## Estrutura do projeto

### Pastas principais

- [data](data): arquivos de entrada e saída do sistema, como planilhas e o JSON oficial.
- [public](public): documentação e especificações do projeto.
- [src](src): código-fonte da aplicação.

### Arquivos principais

#### Raiz

- [package.json](package.json): define scripts e dependências.
- [vite.config.ts](vite.config.ts): configuração do Vite e API local para persistência de dados.
- [tsconfig.json](tsconfig.json): configuração base do TypeScript.

#### Pasta [src](src)

- [src/App.tsx](src/App.tsx): ponto de entrada da aplicação e definição das rotas.
- [src/main.tsx](src/main.tsx): bootstrap do React.
- [src/pages/emails.tsx](src/pages/emails.tsx): página principal que controla a lista de registros.
- [src/components](src/components): componentes da interface, como tabela, toolbar, modais e ícones.
- [src/components/utils/emailData.ts](src/components/utils/emailData.ts): funções de busca, filtro, ordenação e contagem.
- [src/components/EmailStatus.ts](src/components/EmailStatus.ts): regras de status e normalização de e-mail.
- [src/components/EmailTable.tsx](src/components/EmailTable.tsx): renderização da tabela principal.
- [src/components/EmailToolbar.tsx](src/components/EmailToolbar.tsx): barra de controles da interface.
- [src/components/DuplicadosModal.tsx](src/components/DuplicadosModal.tsx): modal para visualizar registros duplicados.
- [src/services/emailsApi.ts](src/services/emailsApi.ts): camada para salvar alterações no JSON via API local.
- [src/scripts/sync.ts](src/scripts/sync.ts): script de sincronização principal.
- [src/scripts/utils/readSheet.ts](src/scripts/utils/readSheet.ts): leitura de CSV/XLSX.
- [src/scripts/utils/identifyColumns.ts](src/scripts/utils/identifyColumns.ts): identificação das colunas da planilha.
- [src/scripts/utils/validateEmail.ts](src/scripts/utils/validateEmail.ts): validação sintática de e-mails.
- [src/types/email.ts](src/types/email.ts): definição dos tipos e status usados no sistema.

---

## Regras de negócio atuais

O sistema atualmente trabalha com os seguintes conceitos:

- status possíveis: válido, inválido, duplicado, deletado e enviado;
- validação simples de e-mail por regex;
- identificação de duplicados por endereço de e-mail;
- sincronização por ID, preservando alterações manuais quando necessário;
- persistência imediata em [data/emails.json](data/emails.json).

---

## Limitações atuais

Esta versão ainda é local e tem alguns limites importantes:

- não há backend real nem banco de dados;
- não há importação via interface, apenas por terminal;
- o sistema não envia e-mails;
- a sincronização depende da estrutura das colunas da planilha;
- se a nova planilha tiver nomes de colunas muito diferentes, pode ser necessário ajustar o código de identificação de colunas;
- a persistência é feita em um arquivo JSON local, não em um serviço remoto.

---

## Melhorias e planos futuros

Com base na especificação pública, os próximos passos naturais são:

- adicionar importação via interface, sem depender do terminal;
- permitir múltiplas fontes/planilhas e organização por slug ou projeto;
- criar uma camada de backend para persistência mais robusta;
- suportar melhor a leitura de diferentes formatos de planilha;
- implementar visualizações e fluxos mais avançados de envio;
- hospedar a aplicação em ambiente remoto.

---

## Observações úteis

- O arquivo [data/emails.json](data/emails.json) é a fonte oficial de dados consultada pela interface.
- O arquivo [data/ibm.csv](data/ibm.csv) é um exemplo de planilha já usada no processo de sincronização.
- A documentação de referência está em [public/Especificacao_Sistema_Emails_v3.md](public/Especificacao_Sistema_Emails_v3.md).

---

## Resumo rápido

Se você quiser usar o projeto rapidamente:

```powershell
npm install
npm run dev
```

E, para importar uma nova tabela:

```powershell
$env:TS_NODE_PROJECT='tsconfig.scripts.json'
node --loader ts-node/esm src/scripts/sync.ts data/nova-planilha.csv
```

---

Se quiser, no próximo passo eu posso montar também uma versão mais visual do README, com uma seção de “como usar no dia a dia” e capturas de tela do fluxo da interface.
