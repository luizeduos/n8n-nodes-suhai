import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestOptions,
	NodeApiError,
	NodeOperationError,
	NodeConnectionType,
	JsonObject,
} from 'n8n-workflow';

import { XMLParser } from 'fast-xml-parser';

// =====================================================================
// Helpers de mapeamento (réplica determinística dos nodes
// "Categoria Veiculos" e "Categorias" do workflow original)
// =====================================================================

function mapCategoriaVeiculo(categoria: string): number {
	switch ((categoria || '').toLowerCase()) {
		case 'moto':
			return 2;
		case 'carro':
			return 1;
		case 'caminhao':
		case 'caminhão':
			return 3;
		case 'van':
			return 4;
		default:
			return 1;
	}
}

function mapSexo(sexo: string): number {
	switch (sexo) {
		case 'Masculino':
			return 2;
		case 'Feminino':
			return 1;
		case 'Pessoa Jurídica':
			return 3;
		default:
			return 2;
	}
}

function mapEstadoCivil(estadoCivil: string): number {
	switch (estadoCivil) {
		case 'Solteiro(a)':
			return 2;
		case 'Casado(a)':
			return 1;
		case 'Divorciado(a)':
			return 3;
		default:
			return 2;
	}
}

function naoUtiliza(texto: string): boolean {
	return /n[ãa]o utiliz/i.test(texto || '');
}

function mapUtilizacao(faculdade: string, trabalho: string): number {
	return naoUtiliza(faculdade) || naoUtiliza(trabalho) ? 3 : 1;
}

function mapPergunta1(residencia: string): number {
	switch (residencia) {
		case 'Garagem na residência':
		case 'Sim, garagem na residência':
			return 1;
		case 'Garagem em condomínio fechado':
		case 'Sim, garagem em condomínio fechado':
			return 2;
		case 'Estacionamento':
		case 'Sim, estacionamento':
		case 'Utilizo e guardo em estacionamento/garagem':
			return 3;
		case 'Não':
		case 'Não possui':
			return 4;
		default:
			return 4;
	}
}

function mapPergunta2(trabalho: string): number {
	switch (trabalho) {
		case 'Não utilizo para ir trabalhar':
		case 'Não utiliza para ir ao local de trabalho':
			return 1;
		case 'Utilizo e guardo no trabalho':
		case 'Utilizo e guardo em estacionamento/garagem':
		case 'Utiliza e guarda no local de trabalho/ serviços':
			return 2;
		case 'Utilizo mas não guardo no trabalho':
		case 'Utiliza mas não guarda quando em trabalho/ serviços externos':
			return 3;
		default:
			return 3;
	}
}

function mapPergunta3(faculdade: string): number {
	switch (faculdade) {
		case 'Não utilizo para ir pra faculdade/colégio':
		case 'Não utiliza para ir à escola':
			return 1;
		case 'Utilizo e guardo no estacionamento':
		case 'Utiliza para ir à escola e guarda em estacionamento':
			return 2;
		case 'Utilizo mas não guardo no estacionamento':
		case 'Utiliza para ir à escola mas não guarda':
			return 3;
		default:
			return 1;
	}
}

function mapPergunta4(servico: string): number {
	switch (servico) {
		case 'Sim':
		case 'S':
			return 1;
		case 'Não':
		case 'N':
			return 2;
		default:
			return 2;
	}
}

function onlyDigits(value: unknown): string {
	return String(value ?? '').replace(/[^0-9]/g, '');
}

// CEP: usa 8 dígitos; se vier com menos, preenche com zeros à esquerda
// (replica o `'0' + cep` do workflow).
function formatCep(cep: unknown): string {
	const d = onlyDigits(cep);
	return d.length >= 8 ? d.slice(0, 8) : d.padStart(8, '0');
}

function xmlEscape(value: unknown): string {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

// Acessa um caminho aninhado de forma segura
function get(obj: any, path: string[]): any {
	return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export class Suhai implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Suhai',
		name: 'suhai',
		icon: 'file:suhai.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Integração com a API SOAP da Suhai Seguradora',
		defaults: {
			name: 'Suhai',
		},
		inputs: ['main'] as unknown as NodeConnectionType[],
		outputs: ['main'] as unknown as NodeConnectionType[],
		credentials: [
			{
				name: 'suhaiApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Recurso',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Cotação',
						value: 'quote',
					},
				],
				default: 'quote',
			},
			{
				displayName: 'Operação',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['quote'] } },
				options: [
					{
						name: 'Realizar Cotação',
						value: 'create',
						action: 'Realizar uma cotação',
						description: 'Consulta o veículo (FIPE) e gera a cotação na Suhai',
					},
				],
				default: 'create',
			},

			// ===== Veículo =====
			{
				displayName: 'Código FIPE',
				name: 'codigoFipe',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Categoria Do Veículo',
				name: 'categoria',
				type: 'options',
				options: [
					{ name: 'Carro', value: 'carro' },
					{ name: 'Moto', value: 'moto' },
					{ name: 'Caminhão', value: 'caminhao' },
					{ name: 'Van', value: 'van' },
				],
				default: 'carro',
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Ano Do Modelo',
				name: 'anoModelo',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Ano De Fabricação',
				name: 'anoFabricacao',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Veículo Zero Km',
				name: 'zeroKm',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},

			// ===== Segurado =====
			{
				displayName: 'CPF/CNPJ',
				name: 'cpfCnpj',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Nome',
				name: 'nome',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Data De Nascimento',
				name: 'dataNascimento',
				type: 'string',
				default: '',
				placeholder: 'DDMMAAAA',
				description: 'Formato DDMMAAAA (somente dígitos), ex.: 09051989',
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'CEP',
				name: 'cep',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Sexo',
				name: 'sexo',
				type: 'options',
				options: [
					{ name: 'Masculino', value: 'Masculino' },
					{ name: 'Feminino', value: 'Feminino' },
					{ name: 'Pessoa Jurídica', value: 'Pessoa Jurídica' },
				],
				default: 'Masculino',
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Estado Civil',
				name: 'estadoCivil',
				type: 'options',
				options: [
					{ name: 'Solteiro(a)', value: 'Solteiro(a)' },
					{ name: 'Casado(a)', value: 'Casado(a)' },
					{ name: 'Divorciado(a)', value: 'Divorciado(a)' },
				],
				default: 'Solteiro(a)',
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},

			// ===== Garagem / Uso (texto cru — mapeado internamente) =====
			{
				displayName: 'Garagem Na Residência',
				name: 'residenciaVeiculoGuardado',
				type: 'string',
				default: '',
				description: 'Resposta em texto (ex.: "Garagem na residência"). Mapeado para pergunta1.',
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Guarda No Trabalho',
				name: 'trabalhoVeiculoGuardado',
				type: 'string',
				default: '',
				description: 'Resposta em texto. Mapeado para pergunta2 e utilização.',
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Guarda Na Faculdade/Colégio',
				name: 'faculdadeVeiculoGuardado',
				type: 'string',
				default: '',
				description: 'Resposta em texto. Mapeado para pergunta3 e utilização.',
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Guarda Quando Não Em Serviço',
				name: 'veiculoGuardadoServico',
				type: 'string',
				default: '',
				description: 'Resposta Sim/Não. Mapeado para pergunta4 (usado quando caminhão/van).',
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
			{
				displayName: 'Possui Outro Veículo',
				name: 'possuiOutroVeic',
				type: 'string',
				default: '1',
				displayOptions: { show: { resource: ['quote'], operation: ['create'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('suhaiApi');
		const login = String(credentials.login || '');
		const senha = String(credentials.senha || '');
		const consultaUrl = String(credentials.consultaUrl || 'https://suhaiseguradoracotacao.com.br:5156/veiculosfipe.svc?wsdl');
		const cotacaoUrl = String(credentials.cotacaoUrl || 'https://suhaiseguradoracotacao.com.br:5156/MultiCalculos.svc');

		const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				if (resource !== 'quote' || operation !== 'create') {
					throw new NodeOperationError(this.getNode(), `Operação não suportada: ${resource}/${operation}`, { itemIndex: i });
				}

				// ---- Parâmetros do item ----
				const codigoFipe = this.getNodeParameter('codigoFipe', i) as string;
				const categoria = this.getNodeParameter('categoria', i) as string;
				const anoModelo = this.getNodeParameter('anoModelo', i) as string;
				const anoFabricacao = this.getNodeParameter('anoFabricacao', i) as string;
				const zeroKm = (this.getNodeParameter('zeroKm', i) as boolean) ? 'S' : 'N';

				const cpfCnpj = this.getNodeParameter('cpfCnpj', i) as string;
				const nome = this.getNodeParameter('nome', i) as string;
				const dataNascimento = onlyDigits(this.getNodeParameter('dataNascimento', i));
				const cep = formatCep(this.getNodeParameter('cep', i));
				const sexoTxt = this.getNodeParameter('sexo', i) as string;
				const estadoCivilTxt = this.getNodeParameter('estadoCivil', i) as string;

				const residencia = this.getNodeParameter('residenciaVeiculoGuardado', i) as string;
				const trabalho = this.getNodeParameter('trabalhoVeiculoGuardado', i) as string;
				const faculdade = this.getNodeParameter('faculdadeVeiculoGuardado', i) as string;
				const servico = this.getNodeParameter('veiculoGuardadoServico', i) as string;
				const possuiOutroVeic = this.getNodeParameter('possuiOutroVeic', i) as string;

				// ---- Mapeamentos ----
				const codCategoria = mapCategoriaVeiculo(categoria);
				const sexo = mapSexo(sexoTxt);
				const estadoCivil = mapEstadoCivil(estadoCivilTxt);
				const utilizacao = mapUtilizacao(faculdade, trabalho);
				const pergunta1 = mapPergunta1(residencia);
				const pergunta2 = mapPergunta2(trabalho);
				const pergunta3 = mapPergunta3(faculdade);
				// pergunta4 só vale para caminhão (3) ou van (4); senão 0
				const pergunta4 = codCategoria === 3 || codCategoria === 4 ? mapPergunta4(servico) : 0;

				// ============================================================
				// 1) ConsultaVeiculos (FIPE)
				// ============================================================
				const consultaEnvelope =
					`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:suh="suhaiseguradoracotacao.com.br:5155">` +
					`<soapenv:Header/><soapenv:Body>` +
					`<suh:ConsultaVeiculos><suh:parametro>` +
					`<suh:login>${xmlEscape(login)}</suh:login>` +
					`<suh:senha>${xmlEscape(senha)}</suh:senha>` +
					`<suh:cod_fipe>${xmlEscape(codigoFipe)}</suh:cod_fipe>` +
					`<suh:cod_categoria_suhai>${codCategoria}</suh:cod_categoria_suhai>` +
					`</suh:parametro></suh:ConsultaVeiculos>` +
					`</soapenv:Body></soapenv:Envelope>`;

				const consultaOptions: IHttpRequestOptions = {
					method: 'POST',
					url: consultaUrl,
					headers: {
						'Content-Type': 'text/xml; charset=utf-8',
						SOAPAction: '"suhaiseguradoracotacao.com.br:5155/VeiculosFipe/ConsultaVeiculos"',
					},
					body: consultaEnvelope,
					// Impede que o n8n tente fazer parse automático da resposta:
					// queremos o XML cru, byte a byte, como a Suhai devolveu.
					json: false,
				};

				const consultaRaw = await this.helpers.httpRequest(consultaOptions);
				const consultaObj = parser.parse(typeof consultaRaw === 'string' ? consultaRaw : String(consultaRaw));

				const consultaBody = get(consultaObj, ['s:Envelope', 's:Body']) || get(consultaObj, ['soap:Envelope', 'soap:Body']) || get(consultaObj, ['Envelope', 'Body']);
				if (consultaBody && (consultaBody['s:Fault'] || consultaBody['soap:Fault'] || consultaBody.Fault)) {
					const fault = consultaBody['s:Fault'] || consultaBody['soap:Fault'] || consultaBody.Fault;
					throw new NodeOperationError(this.getNode(), `SOAP Fault na ConsultaVeiculos: ${JSON.stringify(fault)}`, { itemIndex: i });
				}

				let tabela = get(consultaBody, ['ConsultaVeiculosResponse', 'ConsultaVeiculosResult', 'TabelaFipe']);
				if (Array.isArray(tabela)) tabela = tabela[0];
				if (!tabela) {
					throw new NodeOperationError(
						this.getNode(),
						'ConsultaVeiculos não retornou TabelaFipe. Confira o código FIPE e a categoria.',
						{ itemIndex: i },
					);
				}

				const marca = String(tabela.marca ?? '');
				const modelo = String(tabela.modelo ?? '');
				const codFipe = String(tabela.cod_fipe ?? codigoFipe);

				// ============================================================
				// 2) IncluirCotacaoSuhai
				// ============================================================
				const cotacaoEnvelope =
					`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:suh="suhaiseguradoracotacao.com.br:5155">` +
					`<soapenv:Header/><soapenv:Body><suh:IncluirCotacaoSuhai><suh:cotacao>` +
					`<suh:login>${xmlEscape(login)}</suh:login>` +
					`<suh:senha>${xmlEscape(senha)}</suh:senha>` +
					`<suh:cdWorksite></suh:cdWorksite>` +
					`<suh:cpfCnpj>${xmlEscape(cpfCnpj)}</suh:cpfCnpj>` +
					`<suh:nome>${xmlEscape(nome)}</suh:nome>` +
					`<suh:dtNascimento>${xmlEscape(dataNascimento)}</suh:dtNascimento>` +
					`<suh:sexo>${sexo}</suh:sexo>` +
					`<suh:cepPernoite>${xmlEscape(cep)}</suh:cepPernoite>` +
					`<suh:estadoCivil>${estadoCivil}</suh:estadoCivil>` +
					`<suh:marca>${xmlEscape(marca)}</suh:marca>` +
					`<suh:modelo>${xmlEscape(modelo)}</suh:modelo>` +
					`<suh:codFipe>${xmlEscape(codFipe)}</suh:codFipe>` +
					`<suh:anoModelo>${xmlEscape(anoModelo)}</suh:anoModelo>` +
					`<suh:anoFabricacao>${xmlEscape(anoFabricacao)}</suh:anoFabricacao>` +
					`<suh:zeroKm>${zeroKm}</suh:zeroKm>` +
					`<suh:utilizacaoDut>${utilizacao}</suh:utilizacaoDut>` +
					`<suh:tipoUtilizacao>${utilizacao}</suh:tipoUtilizacao>` +
					`<suh:tipoContratacao>1</suh:tipoContratacao>` +
					`<suh:tabelaComissao>${xmlEscape(credentials.tabelaComissao || 'tab 36')}</suh:tabelaComissao>` +
					`<suh:classeBonus>${xmlEscape(credentials.classeBonus ?? '0')}</suh:classeBonus>` +
					`<suh:cpfCnpjPrincipalCondutor>${xmlEscape(cpfCnpj)}</suh:cpfCnpjPrincipalCondutor>` +
					`<suh:nomePrincipalCondutor>${xmlEscape(nome)}</suh:nomePrincipalCondutor>` +
					`<suh:dtNascimentoPrincipalCondutor>${xmlEscape(dataNascimento)}</suh:dtNascimentoPrincipalCondutor>` +
					`<suh:sexoPrincipalCondutor>${sexo}</suh:sexoPrincipalCondutor>` +
					`<suh:estadoCivilPrincipalCondutor>${estadoCivil}</suh:estadoCivilPrincipalCondutor>` +
					`<suh:pergunta1>${pergunta1}</suh:pergunta1>` +
					`<suh:pergunta2>${pergunta2}</suh:pergunta2>` +
					`<suh:pergunta3>${pergunta3}</suh:pergunta3>` +
					`<suh:pergunta4>${pergunta4}</suh:pergunta4>` +
					`<suh:vlr_desconto>${xmlEscape(credentials.vlrDesconto ?? '6')}</suh:vlr_desconto>` +
					`<suh:possuiOutroVeic>${xmlEscape(possuiOutroVeic || '1')}</suh:possuiOutroVeic>` +
					`<suh:cdCobertura>${xmlEscape(credentials.cdCobertura || '10091')}</suh:cdCobertura>` +
					`<suh:vlr_DanosMateriais>${xmlEscape(credentials.vlrDanosMateriais || '100000.00')}</suh:vlr_DanosMateriais>` +
					`<suh:vlr_DanosCorporais>${xmlEscape(credentials.vlrDanosCorporais || '100000.00')}</suh:vlr_DanosCorporais>` +
					`<suh:vlr_DanosMorais>${xmlEscape(credentials.vlrDanosMorais || '10000.00')}</suh:vlr_DanosMorais>` +
					`</suh:cotacao></suh:IncluirCotacaoSuhai></soapenv:Body></soapenv:Envelope>`;

				const cotacaoOptions: IHttpRequestOptions = {
					method: 'POST',
					url: cotacaoUrl,
					headers: {
						'Content-Type': 'text/xml; charset=utf-8',
						SOAPAction: '"suhaiseguradoracotacao.com.br:5155/MultiCalculos/IncluirCotacaoSuhai"',
					},
					body: cotacaoEnvelope,
					// Impede parse automático: retornamos o XML cru da cotação.
					json: false,
				};

				const cotacaoRaw = await this.helpers.httpRequest(cotacaoOptions);
				const cotacaoObj = parser.parse(typeof cotacaoRaw === 'string' ? cotacaoRaw : String(cotacaoRaw));

				const cotacaoBody = get(cotacaoObj, ['s:Envelope', 's:Body']) || get(cotacaoObj, ['soap:Envelope', 'soap:Body']) || get(cotacaoObj, ['Envelope', 'Body']);
				if (cotacaoBody && (cotacaoBody['s:Fault'] || cotacaoBody['soap:Fault'] || cotacaoBody.Fault)) {
					const fault = cotacaoBody['s:Fault'] || cotacaoBody['soap:Fault'] || cotacaoBody.Fault;
					throw new NodeOperationError(this.getNode(), `SOAP Fault na IncluirCotacaoSuhai: ${JSON.stringify(fault)}`, { itemIndex: i });
				}

				// Retorna o XML cru, 100% fiel ao que a Suhai devolveu nas duas chamadas.
				// Nenhum campo é descartado — o consumidor trata o XML como preferir.
				returnData.push({
					json: {
						consultaVeiculosXml: typeof consultaRaw === 'string' ? consultaRaw : String(consultaRaw),
						cotacaoXml: typeof cotacaoRaw === 'string' ? cotacaoRaw : String(cotacaoRaw),
					},
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
