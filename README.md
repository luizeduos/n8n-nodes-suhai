# @luizeduos/n8n-nodes-suhai

Node community do [n8n](https://n8n.io) para a **API SOAP da Suhai Seguradora**. Em uma única operação, consulta o veículo pela tabela FIPE e gera a cotação de seguro, substituindo os nodes HTTP Request com login/senha hardcoded e a lógica de mapeamento em nodes Code.

## O que inclui

- **Credencial `Suhai API`** — guarda de forma segura `login` e `senha` + a configuração de negócio (tabela de comissão, código de cobertura, desconto, valores de danos, classe de bônus) e as URLs dos serviços SOAP.
- **Node `Suhai`** — recurso **Cotação** › operação **Realizar Cotação** (tudo-em-um):
  1. `ConsultaVeiculos` (SOAP) a partir do código FIPE + categoria → extrai marca/modelo/cód. FIPE.
  2. `IncluirCotacaoSuhai` (SOAP) com todos os dados → retorna a cotação.
  - O node recebe as respostas em **texto** (sexo, estado civil, garagem/uso) e converte para os códigos numéricos da Suhai internamente.

> Escopo: apenas a API da Suhai. As etapas de **API PLACA** (consulta de placa → fornece `codigoFipe`, `categoria`, `anoModelo`, `anoFabricacao`), **WTS Chat**, **Google Sheets** e o **OpenAI** de formatação comercial continuam como nodes separados no seu workflow.

## Build

```bash
cd suhai-node
npm install
npm run build
```

## Instalação (n8n self-hosted)

Igual ao pacote da Pier — via Community Nodes (após publicar no npm):

**Settings → Community Nodes → Install** → `@luizeduos/n8n-nodes-suhai`

Ou, para teste local, via pasta custom montada no Docker (`npm pack` + `npm install <tgz>` na pasta `custom`).

## Uso

1. Crie uma credencial **Suhai API** com `login` e `senha`.
2. Adicione o node **Suhai**, escolha a credencial e preencha os campos da cotação (código FIPE, categoria, anos, CPF, nome, data de nascimento, CEP, sexo, estado civil e as respostas de garagem/uso).
3. A resposta da cotação (XML da Suhai) é retornada como JSON.

## Observações

- A API da Suhai é **SOAP/XML**; o node monta os envelopes e parseia as respostas com `fast-xml-parser`.
- A credencial não tem botão **Test** (uma chamada SOAP de teste exigiria uma cotação real). Valide rodando a operação com dados de exemplo.

## Licença

MIT
