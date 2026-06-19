# @luizeduos/n8n-nodes-suhai

[![npm](https://img.shields.io/npm/v/@luizeduos/n8n-nodes-suhai.svg)](https://www.npmjs.com/package/@luizeduos/n8n-nodes-suhai)

Node community do [n8n](https://n8n.io) para a **API SOAP da Suhai Seguradora**.

Em uma única operação, consulta o veículo pela tabela FIPE e gera a cotação de seguro auto/moto — substituindo a combinação de nodes HTTP Request (com login/senha hardcoded) e a lógica de mapeamento em nodes Code que normalmente é necessária para falar com a API SOAP da Suhai.

## Sumário

- [O que inclui](#o-que-inclui)
- [Instalação](#instalação)
- [Configuração da credencial](#configuração-da-credencial)
- [Uso do node](#uso-do-node)
- [Saída (resposta)](#saída-resposta)
- [Como funciona por dentro](#como-funciona-por-dentro)
- [Build a partir do código](#build-a-partir-do-código)
- [Escopo e limitações](#escopo-e-limitações)
- [Licença](#licença)

## O que inclui

- **Credencial `Suhai API`** — guarda de forma segura `login` e `senha` e centraliza a configuração de negócio (tabela de comissão, código de cobertura, desconto, valores de danos, classe de bônus) e as URLs dos serviços SOAP.
- **Node `Suhai`** — recurso **Cotação** › operação **Realizar Cotação** (tudo-em-um):
  1. `ConsultaVeiculos` (SOAP) a partir do código FIPE + categoria → obtém marca, modelo e código FIPE.
  2. `IncluirCotacaoSuhai` (SOAP) com todos os dados → gera a cotação.
- O node recebe respostas em **texto livre** (sexo, estado civil, garagem/uso) e converte automaticamente para os códigos numéricos esperados pela Suhai.

## Instalação

### n8n self-hosted (Community Nodes)

**Settings → Community Nodes → Install** e informe:

```
@luizeduos/n8n-nodes-suhai
```

### Teste local (pasta custom)

```bash
npm pack                       # gera o .tgz na raiz do projeto
# na pasta de custom nodes do n8n (ex.: ~/.n8n/custom):
npm install /caminho/para/luizeduos-n8n-nodes-suhai-x.y.z.tgz
```

Reinicie o n8n após instalar.

## Configuração da credencial

Crie uma credencial **Suhai API**. Campos:

| Campo | Obrigatório | Padrão | Descrição |
|---|---|---|---|
| `Login` | sim | — | Login do corretor na Suhai (ex.: `15246638839`) |
| `Senha` | sim | — | Senha do corretor |
| `URL ConsultaVeiculos (FIPE)` | sim | `https://suhaiseguradoracotacao.com.br:5156/veiculosfipe.svc?wsdl` | Endpoint SOAP de consulta FIPE |
| `URL IncluirCotacaoSuhai` | sim | `https://suhaiseguradoracotacao.com.br:5156/MultiCalculos.svc` | Endpoint SOAP da cotação |
| `Tabela De Comissão` | não | `tab 36` | Tabela de comissão |
| `Código De Cobertura (cdCobertura)` | não | `10091` | Código da cobertura |
| `Valor De Desconto (%)` | não | `6` | Desconto aplicado |
| `Valor Danos Materiais` | não | `100000.00` | Cobertura de danos materiais |
| `Valor Danos Corporais` | não | `100000.00` | Cobertura de danos corporais |
| `Valor Danos Morais` | não | `10000.00` | Cobertura de danos morais |
| `Classe De Bônus` | não | `0` | Classe de bônus do segurado |

> A credencial **não tem botão Test** — uma chamada de teste exigiria uma cotação real. Valide executando o node com dados de exemplo.

## Uso do node

1. Adicione o node **Suhai** e selecione a credencial **Suhai API**.
2. Preencha os campos da cotação:

| Campo | Exemplo | Observação |
|---|---|---|
| Código FIPE | `004445-0` | Código FIPE do veículo |
| Categoria do Veículo | `Carro` | Carro / Moto / Caminhão / Van |
| Ano do Modelo | `2020` | |
| Ano de Fabricação | `2019` | |
| Veículo Zero Km | `false` | |
| CPF/CNPJ | `12345678900` | |
| Nome | `João da Silva` | |
| Data de Nascimento | `09051989` | Formato **DDMMAAAA** (só dígitos) |
| CEP | `01001000` | Completado com zeros à esquerda se vier com menos de 8 dígitos |
| Sexo | `Masculino` | Masculino / Feminino / Pessoa Jurídica |
| Estado Civil | `Solteiro(a)` | Solteiro(a) / Casado(a) / Divorciado(a) |
| Garagem na Residência | texto livre | Mapeado para `pergunta1` |
| Guarda no Trabalho | texto livre | Mapeado para `pergunta2` e utilização |
| Guarda na Faculdade/Colégio | texto livre | Mapeado para `pergunta3` e utilização |
| Guarda Quando Não Em Serviço | `Sim`/`Não` | Mapeado para `pergunta4` (usado em caminhão/van) |
| Possui Outro Veículo | `1` | |

3. Execute. O node faz as duas chamadas SOAP em sequência e retorna o resultado.

## Saída (resposta)

> **A partir da v0.2.0**, o node retorna **100% do XML cru** devolvido pela Suhai nas duas chamadas, sem nenhum parse de saída — nada é descartado.

Cada item de saída tem o formato:

```json
{
  "consultaVeiculosXml": "<s:Envelope ...>...</s:Envelope>",
  "cotacaoXml": "<s:Envelope ...>...IncluirCotacaoSuhaiResult...</s:Envelope>"
}
```

- `consultaVeiculosXml` — resposta SOAP integral da `ConsultaVeiculos` (FIPE).
- `cotacaoXml` — resposta SOAP integral da `IncluirCotacaoSuhai` (a cotação).

Como a saída é **string XML** (e não JSON estruturado), para extrair campos específicos use o node **XML** do n8n ou uma expressão logo após o node Suhai.

> **Migração da v0.1.x:** antes a saída era `{ veiculo, cotacao }` (um subconjunto já parseado, que descartava atributos e XML aninhado/escapado). Se você consumia esses campos, ajuste o fluxo para tratar `cotacaoXml`/`consultaVeiculosXml`.

## Como funciona por dentro

- A API da Suhai é **SOAP/XML**. O node monta os envelopes manualmente e faz o escape correto dos valores.
- A resposta da `ConsultaVeiculos` é parseada internamente (com `fast-xml-parser`) **apenas** para extrair `marca`, `modelo` e `codFipe`, necessários para montar o envelope da cotação. Esse parse não afeta a saída — você recebe o XML cru.
- Erros são reportados: **SOAP Fault** em qualquer das duas chamadas e ausência de `TabelaFipe` (código FIPE/categoria inválidos) interrompem a execução com mensagem clara. Com **Continue On Fail** ligado, o erro é devolvido no campo `error` do item.

## Build a partir do código

```bash
npm install
npm run build      # tsc + cópia dos ícones (gera dist/)
npm run lint       # opcional
```

## Escopo e limitações

Este pacote cobre **apenas a API da Suhai**. As etapas de **API PLACA** (consulta de placa → fornece `codigoFipe`, `categoria`, `anoModelo`, `anoFabricacao`), **WTS Chat**, **Google Sheets** e a formatação comercial via **OpenAI** continuam como nodes separados no seu workflow.

## Licença

[MIT](LICENSE.md)
