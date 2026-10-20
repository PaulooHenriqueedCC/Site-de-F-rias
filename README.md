# SICOF — Sistema Integrado de Controle de Férias

Controle de férias, pagamento de férias, dispensa como recompensa e desconto em férias para unidade militar.

- **Frontend:** React + Next.js 14 (App Router) + Tailwind CSS + Framer Motion
- **Backend:** Next.js API Routes (Node.js)
- **Banco de dados:** PostgreSQL via Prisma
- **Autenticação:** JWT em cookie httpOnly (biblioteca `jose`) + senhas com bcrypt
- **Exportação:** CSV nativo e PDF com `jspdf` + `jspdf-autotable` (carregados só no navegador)

---

## 0. Atualizando de uma versão anterior

Se você já tem o SICOF rodando, faça estes três passos na pasta do projeto:

```bash
npm install      # bibliotecas de PDF (jspdf, jspdf-autotable)
npm run db:push  # campo novo: como o Nr Ord do plano é calculado
npm run db:secoes # renomeia as seções antigas (CL IX / CL V → DIV)
```

Nenhum dos três apaga dados. O `db:secoes` só precisa ser rodado uma vez.

---

## 1. O que você precisa instalar antes

| Programa | Versão | Onde baixar |
|---|---|---|
| Node.js | 18.17 ou superior | https://nodejs.org |
| VS Code | qualquer | https://code.visualstudio.com |
| PostgreSQL | 14 ou superior | https://www.postgresql.org/download/ — **ou** use Supabase/Railway na nuvem, sem instalar nada |

Confira no terminal:

```bash
node -v
npm -v
```

---

## 2. Abrir o projeto no VS Code

1. Descompacte o arquivo `sicof.zip`.
2. Abra o VS Code → **Arquivo → Abrir Pasta** → escolha a pasta `sicof`.
3. Abra o terminal integrado com **Ctrl + '** (ou **Terminal → Novo Terminal**).

---

## 3. Instalar as dependências

```bash
npm install
```

---

## 4. Configurar o banco de dados

Copie o arquivo de exemplo e edite os valores:

```bash
# Windows (PowerShell)
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Abra o `.env` e ajuste:

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/sicof?schema=public"
JWT_SECRET="uma-string-longa-e-aleatoria-que-so-voce-conhece"
ADMIN_GERAL_IDENTIDADE="111.689.137-3"
ADMIN_GERAL_SENHA="Sicof@2025"
```

**Onde conseguir a `DATABASE_URL`:**

- **PostgreSQL local:** crie o banco com `createdb sicof` ou pelo pgAdmin, e use a URL acima com a sua senha.
- **Supabase:** Project Settings → Database → Connection string → URI.
- **Railway:** aba Variables do serviço PostgreSQL → `DATABASE_URL`.
- **Neon:** painel do projeto → Connection string.

---

## 5. Criar as tabelas e o Administrador Geral

```bash
npm run setup
```

Esse comando faz três coisas: gera o cliente Prisma, cria as tabelas no banco e cadastra o Administrador Geral com a identidade e a senha do `.env`.

Se preferir rodar passo a passo:

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

---

## 6. Rodar o sistema

```bash
npm run dev
```

Abra **http://localhost:3000**.

**Primeiro acesso:**

- Usuário: `111.689.137-3`
- Senha: a que estiver em `ADMIN_GERAL_SENHA` (padrão `Sicof@2025`)

Troque essa senha em **Configurações → Alterar senha** logo no primeiro acesso.

---

## 7. Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | Roda em modo desenvolvimento |
| `npm run build` | Gera a versão de produção |
| `npm start` | Roda a versão de produção |
| `npm run db:studio` | Abre o Prisma Studio (banco em interface visual) |
| `npm run db:push` | Aplica mudanças do schema no banco |
| `npm run db:seed` | Recria o Administrador Geral |
| `npm run db:secoes` | Renomeia as seções antigas (CL IX / CL V → DIV) |

---

## 8. Como o sistema funciona

### Perfis de acesso

| Perfil | O que pode fazer |
|---|---|
| **Administrador Geral** (identidade `111.689.137-3`) | Tudo. Cadastra administradores, define o que cada um acessa e edita, aprova a fila de inclusões e gera senhas temporárias. |
| **Administrador** | Só o que o Administrador Geral liberar — as abas não autorizadas nem aparecem no menu. |
| **Usuário** | Vê apenas **Página inicial**, **Calendário**, **Plano de férias** e **Configurações**, sempre em modo consulta. Edita apenas o próprio perfil e a própria senha. |

**Dois níveis por área.** Para cada área o Administrador Geral marca:

- **Acessar** — a aba aparece no menu e a API daquela área responde;
- **Editar** — o administrador pode lançar, alterar e excluir.

Marcar *Editar* já liga *Acessar*; desmarcar *Acessar* retira também a edição. Página inicial e
Plano de férias são abas livres: todo mundo enxerga, e a permissão decide só quem edita.

O controle não é apenas visual. Digitar a URL na mão (`/dashboard/efetivo`, por exemplo) devolve o
usuário à página inicial, e as APIs das áreas restritas respondem 403 para quem não tem acesso.

Contas criadas antes desta versão, quando a permissão era um simples "pode editar", continuam
funcionando: o valor antigo é lido como *acessar + editar*.

### Telas

- **Página inicial** — quadro de férias no formato de planilha: Nr, Posto/Grad, Nome, Militar Substituto, dias de desconto, dias de dispensa, início, término, pronto para o serviço, ano/período aquisitivo, dias de férias, pagamento (filtro SIM/NÃO) e seção. Os botões **Exportar CSV** e **Exportar PDF** geram o arquivo no **modelo do ANEXO A** (ver seção 8.1).
- **Plano de férias** — reprodução do ANEXO A do plano de férias, com os blocos de militares da ativa e de PTTC e uma tabela por seção. O `Nr Ord` pode se renumerar sozinho pela antiguidade dos postos ou seguir uma ordem manual, e os dias saem do intervalo entre início e término. Todos os campos são editáveis pelos administradores (ver seção 8.1).
- **Calendário** — os 12 meses do ano com os dias de férias pintados por militar, como no Google Agenda. Clicar em um dia mostra quem está de férias, o período e o substituto.
- **Dispensa como recompensa** — períodos por militar, com soma dos dias gozados, motivo e campo de comentário.
- **Desconto em férias** — mesma estrutura, para os dias descontados. Os dias lançados aqui são **abatidos automaticamente** das linhas do plano de férias (ver seção 8.2).
- **Pagamento de férias** — DIEx informado pelo Administrador Geral, com data e situação (pago/pendente).
- **Efetivo** — lista completa, inclusão manual e importação de planilha ou PDF, com filtros por nome, por posto/graduação e por seção.
- **Configurações** — perfil editável e troca de senha.
- **Aprovações** — fila da verificação em duas etapas (ver seção 8.3).
- **Administradores** — só aparece para o Administrador Geral.

### 8.1 Plano de férias (ANEXO A)

A aba **Plano de férias** reproduz o documento oficial, com os dois blocos usados pela unidade:

| Bloco | Colunas |
|---|---|
| **a. Militares da Ativa** | Nr Ord, P/G, Nome Completo, Substituto, Período Aquisitivo / Ano, Mês_Ano, Per, Dias, Desc, Início, Término |
| **b. Prestadores de Tarefa por Tempo Certo (PTTC)** | as mesmas colunas do bloco **a** |

Os dois blocos têm **Substituto** e **Período Aquisitivo / Ano**, então uma linha de PTTC
também pode registrar quem substitui o militar.

Dentro de cada bloco, as linhas são agrupadas em uma tabela por **seção**, e a
numeração `Nr Ord` reinicia a cada grupo. O título de cada tabela sai como
`SEÇÃO – NOME DA SEÇÃO`, na tela, no CSV e no PDF. A coluna `Per` aceita `ÚNICO`, `1º`, `2º` e `3º`
(no bloco PTTC o documento usa `1ª`, `2ª`, `3ª`, e o sistema acompanha).

**Como o `Nr Ord` é calculado.** Logo acima da planilha há o seletor **Nr Ord**, com duas opções:

| Opção | O que faz |
|---|---|
| **Por antiguidade** (padrão) | A planilha se renumera sozinha: dentro de cada seção, do posto mais antigo para o mais moderno e, em caso de empate, por ordem alfabética. |
| **Manual** | A numeração segue a ordem definida por você. Há dois jeitos de mudá-la: **digitar o Nr Ord** direto na planilha ou usar as **setas ↑ ↓** no fim de cada linha. |

**Digitar o Nr Ord.** No modo manual, a primeira coluna vira um campo editável. Digite o número
que a linha deve ocupar — em quantas linhas quiser — e clique em **Atualizar numeração**, que
aparece ao lado do seletor com a contagem de alterações pendentes. `Enter` no campo também aplica,
e **Descartar** desfaz o que ainda não foi salvo.

O número digitado é a posição de destino: pedir o 3º lugar coloca a linha *no* 3º lugar e empurra
quem estava ali, para cima ou para baixo conforme a direção do movimento. Depois de aplicar, o
grupo inteiro é renumerado de 1 em diante, sem buracos. Um número maior que o total joga a linha
para o fim, e repetir o número atual não muda nada.

**Setas ↑ ↓.** Cada linha traz, no fim, duas setas que a sobem ou descem uma posição dentro do
próprio grupo, com efeito imediato. Servem para acertos pontuais; para mudanças maiores, digitar
os números costuma ser mais rápido.

A reordenação acontece sempre **dentro do mesmo bloco e da mesma seção** — mudar alguém de seção é
feito na edição da linha, não aqui.

A escolha é do documento, não de cada usuário: fica gravada no cabeçalho do plano e vale para a
tela, para o CSV e para o PDF. Só quem tem permissão de editar o plano pode trocá-la.

Na antiguidade, o posto usado é o do **militar vinculado** quando a linha tem vínculo com o
efetivo; sem vínculo, o sistema interpreta o texto livre da coluna `P/G` (`Cel R/1` conta como
*Cel*, `Maj QAO` como *Maj*). Quem não for reconhecido vai para o fim da lista.

**Dias.** A coluna `Dias` não é mais digitada: ela sai do intervalo entre **Início** e **Término**,
contando as duas pontas — 01/12 a 30/12 dá 30 dias. No formulário o campo aparece somente para
leitura, logo abaixo das datas. Linhas antigas ou importadas que não tenham as duas datas
preservam o número que já estava gravado.

**Período aquisitivo ou ano.** A 5ª coluna aceita as duas formas, escolhidas linha a linha:

| Opção | Como preencher | Como sai no documento |
|---|---|---|
| **Período aquisitivo** | data de início, data de término e nº do período | `01/05/2026 a 30/04/2027 (1º período)` |
| **Ano** | apenas o ano | `2027` |

O texto é montado automaticamente a partir desses campos, mas o campo final continua
editável — dá para reescrever à mão quando o documento pedir outra redação.

**Tudo é editável pelo administrador:**

- Os campos `P/G`, `Substituto`, `Período Aquisitivo` e `Mês_Ano` são texto livre, para
  reproduzir o documento exatamente como ele é publicado (`Cel R/1`, `Férias após completar
  1(um) ano`, e assim por diante).
- Escolher um militar do efetivo apenas **preenche** o nome, o P/G e a seção — os campos
  continuam editáveis depois disso. Também é possível digitar o nome direto, sem vincular
  ninguém do efetivo.
- A ordem da linha **não é mais digitada no formulário**: linhas novas entram no fim do grupo e
  são posicionadas depois, pelo Nr Ord da planilha ou pelas setas ↑ ↓.
- O cabeçalho institucional (Ministério da Defesa, Exército Brasileiro, Comando Logístico,
  Departamento e identificação do anexo) é editado no botão **Cabeçalho** e vale também para
  a exportação da página inicial.

Os botões **Exportar CSV** e **Exportar PDF** geram o arquivo já no formato acima, com o
cabeçalho, os blocos e as tabelas por seção. O PDF sai em **A4 deitado, pronto para imprimir**:
o cabeçalho da tabela se repete a cada página, o rodapé traz a data de emissão e a numeração
`Página X de Y`, e a exportação respeita os filtros de ano e de seção que estiverem ativos na tela.

**Importar planilha.** O botão **Importar planilha** aceita `.xlsx`, `.xlsm`, `.xls`, `.csv` e `.ods`. O sistema:

- lê **todas as abas** do arquivo;
- reconhece variações de nome de coluna (`P/G`, `Posto/Grad`, `Seção`, `Período Aquisitivo`,
  `Mês_Ano`, `Per`, `Dias`, `Início`, `Término`…);
- descobre o bloco pelo título da aba ou por textos como *a. Militares da Ativa* e
  *b. Prestadores de Tarefa por Tempo Certo*;
- pega a seção do título `SEÇÃO – …` quando ela não vier como coluna (o formato antigo, `C/Asse/Seç – …`, das planilhas já emitidas, continua sendo reconhecido);
- entende datas do Excel, `31/12/2026` e `31/12/26`, e converte `ÚNICO`, `1º` e `2ª` na coluna `Per`;
- marca como **ANO** a coluna de referência quando ela traz só um ano, e como **período aquisitivo**
  quando traz a faixa completa;
- mostra uma **prévia** antes de gravar, onde você desmarca linhas e corrige bloco, seção, P/G,
  substituto e período aquisitivo.

Como toda inclusão, a importação passa pela aprovação do Administrador Geral (seção 8.3).

### 8.1.2 Renomeação das seções

Quatro seções mudaram de nome:

| Nome antigo | Nome atual |
|---|---|
| CL IX BLD | DIV BLD |
| CL IX MOTO | DIV MOTO |
| CL V ARMT LEVE | DIV ARMT LEVE |
| CL V ARMT PESADO | DIV ARMT PESADO |

**No que já está gravado.** Rode uma vez:

```bash
npm run db:secoes
```

O script percorre as tabelas `militares` e `plano_ferias`, troca os nomes antigos pelos novos e
imprime um resumo do que mudou. Pode ser rodado quantas vezes for preciso — o que já foi
renomeado simplesmente não aparece de novo.

**No que entrar daqui para a frente.** A troca é aplicada sozinha em toda gravação: cadastro e
importação do efetivo, inclusão e edição de linha do plano e importação da planilha do plano. Não
é preciso corrigir planilhas antigas antes de importar.

A comparação ignora acentos, pontos e espaços repetidos, então `CL IX BLD`, `cl ix bld` e
`Cl. IX  Bld` são todos reconhecidos. Seções fora da lista passam intactas.

**Para incluir outras trocas no futuro**, acrescente o par em `RENOMEACOES_SECAO`, no arquivo
`src/lib/secoes.ts`, e rode `npm run db:secoes` de novo.

### 8.1.1 Lançamento de férias (página inicial)

No formulário *Lançar férias*:

| Campo | Como funciona |
|---|---|
| **Militar** e **Militar substituto** | Escolhidos com pesquisa por nome e filtros de posto/graduação e de seção. |
| **Ano/Período aquisitivo** | Preenchimento livre. Aceita tanto `2026` quanto a faixa completa, como `01/01/2025 a 31/12/2025`. |
| **Períodos** | `1ª Parcela`, `2ª Parcela`, `3ª Parcela` ou `Período único`. |

O campo *Períodos* alimenta a coluna `Per` do ANEXO A: as parcelas saem como `1º`, `2º` e `3º`
(ou `1ª`, `2ª`, `3ª` no bloco PTTC), e *Período único* sai como `ÚNICO`. Lançamentos feitos em
versões anteriores continuam válidos — os valores antigos `1`, `2` e `3` são lidos como as
parcelas correspondentes.

### 8.2 Ligação entre desconto em férias e plano de férias

Os dias lançados em **Desconto em férias** são abatidos automaticamente das linhas do plano:

1. Somam-se os dias descontados do militar **naquele ano**.
2. Esse total é consumido pelas linhas do plano do mesmo militar e do mesmo ano, na **ordem cronológica**.
3. A coluna `Desc` mostra quanto foi abatido; a coluna `Dias` já mostra o saldo.

Exemplo: um militar com duas parcelas de 15 dias em 2027 e 20 dias lançados em desconto fica
com a 1ª parcela zerada (15 abatidos) e a 2ª com 10 dias (5 abatidos).

O cálculo é feito na hora da leitura, então **não existe risco de o plano ficar dessincronizado**:
apagou o desconto, os dias voltam sozinhos. Se você precisar de um valor fixo, preencha o campo
`Desc (manual)` na linha do plano — ele passa a ter prioridade sobre o cálculo automático.

Na aba **Desconto em férias**, cada militar mostra um bloco *Reflexo no plano de férias* com o
resultado do abatimento.

### 8.3 Login

A tela de entrada tem duas abas:

- **Usuário** — entrada normal, com link para cadastro.
- **Administrador** — mesma identidade e senha, mas o servidor recusa a entrada se a conta não
  tiver perfil administrativo, com o aviso de usar a outra aba.

O fundo é uma animação de círculos concentricos desenhados como linhas onduladas, com bolinhas
percorrendo essas linhas. Quem tiver "reduzir movimento" ligado no sistema vê um quadro estático.

### 8.4 Verificação em duas etapas das inclusões

Toda **inclusão** feita por um **Administrador** fica pendente até o **Administrador Geral** aprovar:

| Etapa | Quem faz | O que acontece |
|---|---|---|
| 1 | Administrador | Preenche e salva. Nada é gravado ainda; a inclusão entra na fila. |
| 2 | Administrador Geral | Vai em **Aprovações**, confere os dados e aprova ou recusa. Só na aprovação o registro é gravado. |

Vale para: inclusão no efetivo, importação de planilha/PDF do efetivo, importação de planilha do
plano de férias, lançamento no quadro de férias, linha do plano de férias, dispensa como
recompensa, desconto em férias e pagamento de férias.

**Acessos administrativos são a exceção da exceção.** Tanto o **cadastro de administrador** quanto
a **concessão de privilégios** a quem já está no efetivo vão para a fila **mesmo quando é o próprio
Administrador Geral que envia**, e só valem depois de aprovados na aba Aprovações. Nenhum perfil
administrativo novo entra no sistema sem a segunda etapa.

No cadastro, a senha é cifrada antes de entrar na fila, então ela nunca fica em texto puro no banco
nem aparece na tela de detalhes da solicitação.

**Filtros da aba Aprovações.** Quatro situações — *Pendentes*, *Aprovadas*, *Recusadas* e *Todas*,
cada uma com a contagem ao lado — mais uma busca por nome, seção, posto e graduação de quem
enviou, e seletores de posto/graduação e de seção.

- **Edições e exclusões continuam imediatas** — a verificação é só para inclusões.
- O Administrador Geral grava direto, já que é ele quem aprova.
- O menu lateral mostra um contador com as pendências.
- O Administrador acompanha em **Aprovações** o que ele mesmo enviou, e pode cancelar enquanto estiver pendente.
- Ao recusar, o Administrador Geral pode registrar o motivo.

### Assinatura do plano de férias

Na aba **Plano de férias**, o botão **PDF com assinatura** abre a escolha de quem assina e do que
ele é. O bloco sai centralizado no fim do documento: **nome completo sublinhado, com o nome de
guerra em negrito**, e a função na linha de baixo.

```
     Paulo Henrique do Carmo Costa – Cel
          Chefe da turma de apoio
```

O posto ou graduação entra no fim do nome, fora do negrito e dentro do traço. Militares sem posto
cadastrado saem apenas com o nome.

O traço muda de lugar conforme o caminho escolhido: no PDF **para assinar em papel** ele fica
**acima do nome**, servindo de linha para a assinatura de próprio punho; no PDF **assinado
digitalmente** ele fica **abaixo**, fechando o nome, já que ali não há o que assinar à mão.

O nome de guerra é localizado dentro do nome completo ignorando acentos e maiúsculas, dando
preferência à ocorrência isolada — assim `COSTA` não é destacado dentro de `ACOSTA`. Se o nome de
guerra não aparecer no nome completo, o nome sai inteiro sem negrito, em vez de destacar o trecho
errado. O modal mostra uma prévia de como ficará antes de você enviar.

A partir daí há dois caminhos:

| Botão | O que faz |
|---|---|
| **Exportar para assinar em papel** | Baixa o PDF na hora, com espaço em branco acima do nome para a assinatura de próprio punho. |
| **Enviar para assinatura digital** | Manda o documento para o militar assinar dentro do sistema. |

#### Como funciona a assinatura digital

1. O administrador envia. As linhas que estão na tela e o cabeçalho são **congelados** naquele
   momento, junto com um código de conferência. Mexer no plano depois disso não altera o que foi
   enviado.
2. O militar indicado passa a ver a aba **Aprovar e assinar**, que só existe no menu enquanto
   houver documento esperando por ele. Lá ele confere o documento — inclusive baixando a prévia em
   PDF — e então **assina** ou **recusa** com um motivo.
3. Assim que assina, o documento aparece para o administrador na aba **Assinados**, pronto para
   exportar. O PDF sai com o carimbo *"Assinado digitalmente no SICOF em … às …"* e o código de
   conferência.

A aba **Assinados** é permanente e sempre visível ao administrador: guarda todo documento enviado —
assinado, recusado ou ainda pendente — com quem pediu, quem assina, a função, o recorte de filtros
e as datas. Como o conteúdo foi congelado, exportar hoje ou daqui a um ano devolve exatamente o
mesmo documento.

Só o militar indicado pode assinar, e só uma vez: documento respondido não volta atrás, porque é
ele que serve de histórico.

### Antiguidade da unidade

A ordem de antiguidade é definida na aba **Efetivo** e vale em **todo o sistema**: nas listas de
seleção de militar, na aba Efetivo e na numeração por antiguidade do plano de férias.

Com o efetivo inteiro à vista (sem busca e sem filtros), a coluna **Antiguidade** vira campo
editável. Digite os números e clique em **Atualizar antiguidade**, ou use as setas ↑ ↓ de cada
linha. Como no Nr Ord do plano, o número digitado é a posição de destino: pedir o 3º lugar coloca
o militar *no* 3º lugar e empurra quem estava ali.

Quem ainda não tem número definido entra depois de quem tem, na ordem hierárquica do posto e, no
empate, em ordem alfabética. Assim o sistema continua funcionando antes de a antiguidade ser
lançada pela primeira vez.

A antiguidade só pode ser mexida com a lista completa na tela: reordenar um recorte filtrado
produziria uma numeração incoerente com o resto do efetivo.

### Data, hora e identificação

- O menu lateral mostra, logo abaixo do brasão e do nome SICOF, quem está usando o sistema: **posto
  ou graduação, nome de guerra, identidade e perfil** (Usuário, Administrador ou
  Administrador Geral).
- O cabeçalho à direita traz **data, hora e o botão Sair**.
- O relógio usa o **fuso do lugar de onde o sistema está sendo acessado**, lido do próprio
  navegador. O nome do fuso não é escrito na tela; ele aparece apenas na dica que surge ao passar o
  mouse sobre a data, junto com o estado da sincronização. A hora é **sincronizada com o servidor**
  (rota `/api/hora`) a cada dez minutos, descontando metade do tempo de ida e volta, de modo que
  todas as máquinas da unidade mostrem a mesma hora mesmo com o relógio do computador desacertado.
  Sem rede, o relógio cai para a hora local.

### Identidade visual

O brasão do **Comando Logístico** aparece em:

- **telas de acesso** (login, cadastro e redefinição de senha), acima do nome SICOF;
- **barra lateral** do painel, ao lado do nome SICOF, e no cabeçalho da versão para celular;
- **cabeçalho dos PDFs** exportados, como timbre à esquerda do texto institucional;
- **ícone da aba do navegador** (favicon).

Os arquivos são `public/brasao-cologo.png` (telas), `src/app/icon.png` (favicon) e
`src/lib/brasao.ts` (o mesmo brasão em base64, porque o jsPDF não busca imagens pela rede na hora
de montar o documento). O fundo branco do arquivo original foi removido para que o brasão fique
bem sobre o tema escuro do sistema.

**Para trocar o brasão** — por exemplo, pelo da sua OM —, substitua os três arquivos. O
`brasao-cologo.png` e o `icon.png` são imagens comuns; o `brasao.ts` pode ser regerado com:

```bash
node -e "const f=require('fs');const b=f.readFileSync('public/brasao-cologo.png').toString('base64');console.log(b)"
```

e colando o resultado no lugar do conteúdo de `BRASAO_BASE64`. Ajuste também `BRASAO_LARGURA` e
`BRASAO_ALTURA` para as dimensões do novo arquivo, para que a proporção no PDF continue correta.

### Sessão, saída e inatividade

- **Sair** — o botão no rodapé do menu abre uma confirmação (*"Deseja realmente sair, Cel Silva?"*)
  antes de encerrar a sessão. Cancelar mantém tudo como estava.
- **Encerramento automático** — passados **15 minutos sem uso** (sem mouse, teclado, rolagem ou
  toque), o sistema derruba a sessão e volta para a tela de login, que exibe o aviso
  *"Sua sessão foi encerrada por inatividade"*. No **último minuto** aparece um alerta no canto da
  tela com a contagem regressiva e o botão **Continuar conectado**, para quem estava só lendo.
- O rodapé do menu mostra o **posto/graduação antes do nome de guerra** do militar conectado.

### Senha esquecida

O militar procura o Administrador Geral, que vai em **Administradores → Gerar senha temporária**, escolhe o militar e entrega a senha gerada. Ao entrar, o sistema leva direto para a troca de senha.

### Conceder privilégios a quem já está no efetivo

Na aba **Administradores**, o botão **Conceder privilégios** permite escolher um militar já
cadastrado no efetivo — com pesquisa por nome e filtros de posto/graduação e seção — e marcar o que
ele poderá *Acessar* e *Editar*. Não é preciso refazer o cadastro: a identidade e a senha continuam
as mesmas, só o perfil muda.

A concessão **passa pela verificação em duas etapas**, exatamente como o *Cadastrar administrador*:
ela vai para a aba **Aprovações** mesmo quando é o próprio Administrador Geral que envia, e o
militar só vira administrador depois de aprovada. Na fila, a solicitação aparece rotulada como
**Concessão de privilégios**, para não ser confundida com o cadastro de uma conta nova.

Depois de aprovada, as permissões podem ser ajustadas a qualquer momento nas caixas
*Acessar/Editar* da própria lista — esses ajustes continuam imediatos, assim como o botão
*Retirar permissões*.

### Importação do efetivo

Aceita `.xlsx`, `.xls`, `.csv`, `.ods` e `.pdf`. O sistema:

- lê **todas as abas** da planilha;
- reconhece variações de nome de coluna (`Nome de guerra`, `NG`, `Guerra`, `Posto/Grad`, `P/G`, `Idt`, `Identidade`…);
- se o cabeçalho não for reconhecido, analisa o conteúdo das colunas para descobrir o que é identidade, posto e nome;
- exige apenas o **nome**: quem vier sem identidade entra marcado como *pendente*, para você completar depois;
- mostra uma **prévia** antes de gravar, onde você desmarca linhas, corrige a identidade e ajusta o posto;
- atualiza quem já existe em vez de duplicar.

### Filtros de pesquisa

- **Página inicial** — no botão *Lançar férias*, tanto **Militar** quanto **Militar substituto**
  são escolhidos com pesquisa por **nome** (completo ou de guerra) e filtros de
  **posto/graduação** e de **seção**.
- **Dispensa como recompensa** e **Desconto em férias** — no botão *Lançar período*, o militar é
  escolhido com pesquisa por **nome** (completo ou de guerra), **graduação/posto** e **seção**.
  A busca por texto ignora acentos.
- **Administradores** — em *Conceder privilégios*, o militar do efetivo é escolhido com os mesmos
  filtros.
- **Efetivo** — filtro por **posto/graduação** (em ordem hierárquica) e por **seção**, além da
  busca por nome, nome de guerra, graduação/posto e identidade.
- **Pagamento de férias** — a lista tem busca por nome, posto/graduação, seção e número do DIEx,
  mais seletores de posto/graduação e de seção. Em *Informar DIEx*, o militar é escolhido com os
  mesmos filtros de pesquisa.
- **Aprovações** — busca por nome, seção, posto e graduação, com seletores de posto/graduação e seção.
- **Plano de férias** — busca por nome, P/G, substituto e seção, com filtros por **ano**, por
  **seção** e por **posto/graduação** (em ordem hierárquica). O filtro de posto usa o militar
  vinculado quando existe; sem vínculo, interpreta o texto livre da coluna P/G, de modo que
  `Cel R/1` entra em *Cel*.

### Postos e quadros

A lista segue a ordem hierárquica: Gen Ex, Gen Div, Gen Bda, Cel, Ten Cel, Maj, Cap, 1º Ten, 2º Ten, Asp, S Ten, 1º Sgt, 2º Sgt, 3º Sgt, Cb, Sd EP, Sd EV.

O posto **Marechal** não é mais oferecido em nenhuma tela do sistema, nem é reconhecido na
importação de planilhas. O valor continua existindo no enum do banco apenas por compatibilidade
com registros antigos — remover o valor do enum exigiria uma migração e quebraria o
`prisma db push` se algum cadastro ainda o usasse.

O campo **Quadro** tem três opções: **Ativa** (padrão), **QAO** e **PTTC**. No banco a opção
*Ativa* continua gravada como `NENHUM`, por isso a troca do rótulo não exigiu migração.

- **QAO** só fica disponível para Cap, 1º Ten e 2º Ten.
- **PTTC** só fica disponível de Gen Ex a 2º Sgt.

Nas listagens, o **nome de guerra aparece sempre em negrito**.

---

## 9. Publicar na nuvem

### Frontend + backend na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Em https://vercel.com → **New Project** → importe o repositório.
3. Em **Environment Variables**, cadastre `DATABASE_URL`, `JWT_SECRET`, `ADMIN_GERAL_IDENTIDADE` e `ADMIN_GERAL_SENHA`.
4. Deploy. O script de build já roda `prisma generate`.

Depois do primeiro deploy, rode o seed uma vez apontando para o banco de produção:

```bash
DATABASE_URL="sua-url-de-producao" npm run db:seed
```

### Banco no Supabase ou Railway

Crie o PostgreSQL, copie a connection string para a `DATABASE_URL` e rode `npx prisma db push` a partir da sua máquina.

---

## 10. Estrutura de pastas

```
sicof/
├── prisma/
│   ├── schema.prisma          # Militar, Ferias, Dispensa, Desconto, Pagamento,
│   │                          # PlanoFerias, ConfiguracaoPlano, Solicitacao
│   └── seed.ts                # cria o Administrador Geral
├── src/
│   ├── app/
│   │   ├── icon.png           # favicon (brasão do COLOG)
│   │   ├── api/hora/          # hora de referência para o relógio do painel
│   │   ├── login/             # acesso com fundo de fumaça, faíscas e anéis giratórios
│   │   ├── cadastro/
│   │   ├── redefinir-senha/
│   │   ├── dashboard/         # telas internas (inclui plano-ferias e aprovacoes)
│   │   └── api/               # rotas do backend
│   ├── components/
│   │   ├── auth/              # fundo animado, anéis, moldura
│   │   ├── dashboard/         # menu, relógio, sentinela de inatividade, painéis
│   │   └── ui/                # modal, avisos, campos
│   ├── components/auth/       # moldura, fundo e a animação de órbitas onduladas
│   ├── lib/                   # autenticação, permissões (acessar/editar), postos, quadros, datas,
│   │                          # importação, plano-modelo (ANEXO A), importar-plano,
│   │                          # parcelas, pdf-plano (exportação em PDF), brasao (base64),
│   │                          # secoes (renomeações de seções),
│   │                          # criacoes, aprovacoes
│   └── middleware.ts          # protege as rotas do dashboard
├── public/
│   └── brasao-cologo.png      # brasão usado nas telas
└── .env                       # suas credenciais (não vai para o Git)
```

---

## 11. Problemas comuns

| Sintoma | Solução |
|---|---|
| `Can't reach database server` | PostgreSQL parado ou `DATABASE_URL` errada. Confira host, porta e senha. |
| `@prisma/client did not initialize yet` | Rode `npx prisma generate`. |
| `Identidade ou senha incorreta` no primeiro acesso | Rode `npm run db:seed` e confira `ADMIN_GERAL_SENHA` no `.env`. |
| Perdeu o acesso de Administrador Geral | Rode `npm run db:seed` de novo, ou abra `npm run db:studio` e ajuste o campo `perfil` para `ADMINISTRADOR_GERAL`. |
| Porta 3000 ocupada | `npm run dev -- -p 3001`. |
| Erro de fonte no build | O Next baixa as fontes do Google no build; é preciso conexão nesse momento. |
| `The table \`plano_ferias\` does not exist` | Rode `npm run db:push` para criar as tabelas novas desta versão. |
| Administrador salvou e "não apareceu nada" | É a verificação em duas etapas. O registro está em **Aprovações**, aguardando o Administrador Geral. |
| Cadastrei um administrador e ele não consegue entrar | O cadastro fica na fila. Aprove-o em **Aprovações** — só então a conta passa a existir. |
| Um administrador não vê uma aba | Em **Administradores**, marque *Acessar* naquela área. Só *Editar* marcado já liga *Acessar* junto. |
| Entrei pela aba Administrador e fui recusado | Aquela aba só aceita contas com perfil administrativo. Use a aba **Usuário**. |
| Fui deslogado sozinho | É o encerramento por inatividade, após 15 minutos sem uso. No último minuto aparece o aviso com o botão *Continuar conectado*. |
| O botão Exportar PDF não faz nada | Rode `npm install` de novo: as bibliotecas `jspdf` e `jspdf-autotable` foram acrescentadas nesta versão. |
| Quero conceder acesso a quem já está no efetivo | Use **Administradores → Conceder privilégios**. O *Cadastrar administrador* é só para contas novas. |
| Concedi privilégios e o militar continua usuário comum | A concessão fica em **Aprovações** até ser aprovada. Só então o perfil muda. |
| `Unknown argument ordemPorAntiguidade` ou coluna inexistente | Rode `npm run db:push`: esta versão acrescentou o campo que guarda como o `Nr Ord` é calculado. |
| O `Nr Ord` não obedece às setas | O plano está em **Por antiguidade**. Troque para **Manual** no seletor acima da planilha. |
| As setas ↑ ↓ e o Nr Ord editável não funcionam | Só existem no modo **Manual** e para quem tem permissão de editar o plano. |
| Digitei o Nr Ord e nada mudou | O número só vale depois de clicar em **Atualizar numeração** (ou apertar `Enter` no campo). |
| Sumiu o campo *Ordem na tabela* do formulário | Foi retirado de propósito. Use o Nr Ord da planilha ou as setas ↑ ↓. |
| Um militar ficou no fim da lista por antiguidade | O posto não foi reconhecido. Vincule a linha a alguém do efetivo ou ajuste o texto da coluna `P/G`. |
| A coluna Dias não deixa digitar | É o esperado: ela é calculada por Início e Término. Ajuste as datas para mudar o número. |
| Ainda aparece CL IX ou CL V nas seções | Rode `npm run db:secoes` uma vez para renomear o que já estava gravado. |
| Desconto lançado não abateu no plano | O desconto precisa ser do **mesmo ano** da linha do plano, e a linha não pode ter `Desc (manual)` preenchido. |
