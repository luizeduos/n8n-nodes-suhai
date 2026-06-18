import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SuhaiApi implements ICredentialType {
	name = 'suhaiApi';

	displayName = 'Suhai API';

	documentationUrl = 'https://www.suhaiseguradora.com';

	properties: INodeProperties[] = [
		{
			displayName: 'Login',
			name: 'login',
			type: 'string',
			default: '',
			description: 'Login do corretor na Suhai (ex.: 15246638839)',
		},
		{
			displayName: 'Senha',
			name: 'senha',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
		{
			displayName: 'URL ConsultaVeiculos (FIPE)',
			name: 'consultaUrl',
			type: 'string',
			default: 'https://suhaiseguradoracotacao.com.br:5156/veiculosfipe.svc?wsdl',
		},
		{
			displayName: 'URL IncluirCotacaoSuhai',
			name: 'cotacaoUrl',
			type: 'string',
			default: 'https://suhaiseguradoracotacao.com.br:5156/MultiCalculos.svc',
		},
		{
			displayName: 'Tabela De Comissão',
			name: 'tabelaComissao',
			type: 'string',
			default: 'tab 36',
		},
		{
			displayName: 'Código De Cobertura (cdCobertura)',
			name: 'cdCobertura',
			type: 'string',
			default: '10091',
		},
		{
			displayName: 'Valor De Desconto (%)',
			name: 'vlrDesconto',
			type: 'string',
			default: '6',
		},
		{
			displayName: 'Valor Danos Materiais',
			name: 'vlrDanosMateriais',
			type: 'string',
			default: '100000.00',
		},
		{
			displayName: 'Valor Danos Corporais',
			name: 'vlrDanosCorporais',
			type: 'string',
			default: '100000.00',
		},
		{
			displayName: 'Valor Danos Morais',
			name: 'vlrDanosMorais',
			type: 'string',
			default: '10000.00',
		},
		{
			displayName: 'Classe De Bônus',
			name: 'classeBonus',
			type: 'string',
			default: '0',
		},
	];
}
