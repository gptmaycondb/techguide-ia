export const API_URL = 'https://manuais-hp.onrender.com/chat';

export const USER_MODES = {
  user: {
    id: 'user',
    label: 'Usuario',
    icon: '👤',
    color: '#00d4aa',
    description: 'Respostas simples e diretas',
    promptSuffix: 'Responda de forma simples, clara e didatica, como se estivesse explicando para alguem que nao e tecnico. Evite jargoes tecnicos. Use passos numerados e linguagem do dia a dia.',
  },
  tech: {
    id: 'tech',
    label: 'Tecnico',
    icon: '🔧',
    color: '#0096ff',
    description: 'Informacoes tecnicas completas',
    promptSuffix: 'Responda com linguagem tecnica completa. Inclua codigos de erro, part numbers, procedimentos detalhados e referencias ao manual quando relevante.',
  },
};

export const MANUALS = [
  {
    id: 'e52645_guia',
    label: 'E52645',
    subtitle: 'Guia do Usuario',
    color: '#00d4aa',
    indexKey: 'e52645_guia',
    tags: ['E52645','MFP','Flow'],
    topics: {
      user: {
        'Uso Diario': [
          'Como colocar papel na impressora?',
          'Como imprimir dos dois lados?',
          'Como digitalizar um documento?',
          'O papel atolou, o que faco?',
        ],
        'Suprimentos': [
          'Como trocar o cartucho de toner?',
          'A impressora diz que o toner esta baixo',
          'Como repor grampos?',
        ],
        'Conexao': [
          'Como conectar a impressora ao Wi-Fi?',
          'Nao consigo imprimir do celular',
          'Como configurar impressao por e-mail?',
        ],
        'Problemas': [
          'A impressora nao liga',
          'Impressao saindo borrada ou clara',
          'Fax nao funciona',
        ],
      },
      tech: {
        'Operacao': ['Como carregar papel nas bandejas?','Impressao frente e verso','Digitalizar para e-mail','Grampeador'],
        'Suprimentos': ['Substituir cartucho de toner','Numero de peca do cartucho','Cartucho de grampos'],
        'Rede': ['Configurar endereco IP','Acessar EWS','Digitalizar para Pasta de Rede'],
        'Problemas': ['Resolver atolamentos','Qualidade de impressao','Fax','USB'],
      },
    },
    prompts: {
      user: 'Voce e um assistente de suporte para usuarios da impressora HP LaserJet MFP E52645. Use os TRECHOS DO MANUAL abaixo. Responda de forma simples, clara e amigavel para usuarios leigos. Se nao encontrar no manual, diga e ajude com conhecimento geral. Idioma: Portugues Brasileiro.',
      tech: 'Voce e um especialista tecnico na HP LaserJet Managed MFP E52645. Use os TRECHOS DO MANUAL abaixo. Responda com detalhes tecnicos completos. Se nao encontrar no manual, informe e complemente com conhecimento geral. Idioma: Portugues Brasileiro.',
    },
  },
  {
    id: 'm501_catalog',
    label: 'M501/506/507',
    subtitle: 'Service Parts',
    color: '#0096ff',
    indexKey: 'service',
    tags: ['M501','M506','M507'],
    topics: {
      user: {
        'Problemas Comuns': [
          'Papel atolando com frequencia',
          'Impressora fazendo barulho estranho',
          'Qualidade de impressao ruim',
        ],
        'Manutencao': [
          'Como limpar a impressora?',
          'Com que frequencia fazer manutencao?',
          'Pecas que desgastam mais',
        ],
      },
      tech: {
        'Pecas': ['Pecas disponiveis para o M501?','Numero de peca do fusor M506?','Componentes da bandeja'],
        'Service': ['Reparo do M507','Diagnostico de falhas','Teoria de operacao'],
        'Substituicao': ['Como trocar o fusor?','Rolo de transferencia','Placa formatadora'],
      },
    },
    prompts: {
      user: 'Voce e um assistente de suporte para usuarios da HP LaserJet M501/M506/M507. Use os TRECHOS DO MANUAL. Responda de forma simples para usuarios leigos. Se nao encontrar, ajude com conhecimento geral. Portugues Brasileiro.',
      tech: 'Voce e um tecnico especialista HP LaserJet M501/M506/M507. Use os TRECHOS DO MANUAL com detalhes tecnicos completos incluindo part numbers. Se nao encontrar, informe e complemente. Portugues Brasileiro.',
    },
  },
  {
    id: 'm527_catalog',
    label: 'M527/M528',
    subtitle: 'Service Parts',
    color: '#0096ff',
    indexKey: 'service',
    tags: ['M527','M528'],
    topics: {
      user: {
        'Problemas Comuns': [
          'Documento nao puxa no alimentador',
          'Scanner nao funciona',
          'Copia saindo torta',
        ],
        'Manutencao': [
          'Como limpar o vidro do scanner?',
          'Rolo do alimentador desgastado',
          'Manutencao preventiva',
        ],
      },
      tech: {
        'Pecas': ['Pecas do ADF M527','Componentes do scanner M528','Conjunto de digitalizacao'],
        'Service': ['Diagnostico do ADF','Calibracao do scanner','Vidro de digitalizacao'],
        'Substituicao': ['Separacao do ADF','Rolo de puxada','Placa de controle'],
      },
    },
    prompts: {
      user: 'Voce e um assistente de suporte para usuarios da HP LaserJet MFP M527/M528. Use os TRECHOS DO MANUAL. Responda de forma simples para leigos. Se nao encontrar, ajude com conhecimento geral. Portugues Brasileiro.',
      tech: 'Voce e um tecnico especialista HP LaserJet MFP M527/M528. Use os TRECHOS DO MANUAL com detalhes tecnicos. Se nao encontrar, informe e complemente. Portugues Brasileiro.',
    },
  },
  {
    id: 'e50045_catalog',
    label: 'E50045/145',
    subtitle: 'Service Parts',
    color: '#0096ff',
    indexKey: 'service',
    tags: ['E50045','E50145'],
    topics: {
      user: {
        'Problemas Comuns': [
          'Impressora com erro na tela',
          'Impressao muito lenta',
          'Papel atolando',
        ],
        'Manutencao': [
          'Como fazer manutencao basica?',
          'Pecas que precisam de troca periodica',
          'Limpeza da impressora',
        ],
      },
      tech: {
        'Pecas': ['Pecas do E50045','Part numbers E50145','Fusor gerenciado'],
        'Service': ['Diagnostico E50045','Motor laser','Problemas eletricos'],
        'Substituicao': ['Rolo de transferencia','Cartucho de imagem','Bandejas alta capacidade'],
      },
    },
    prompts: {
      user: 'Voce e um assistente de suporte para usuarios da HP LaserJet Managed E50045/E50145. Use os TRECHOS DO MANUAL. Responda de forma simples. Se nao encontrar, ajude com conhecimento geral. Portugues Brasileiro.',
      tech: 'Voce e um tecnico especialista HP LaserJet Managed E50045/E50145. Use os TRECHOS DO MANUAL com detalhes tecnicos. Se nao encontrar, informe e complemente. Portugues Brasileiro.',
    },
  },
  {
    id: 'e52545_catalog',
    label: 'E52545/645',
    subtitle: 'Service Parts',
    color: '#0096ff',
    indexKey: 'service',
    tags: ['E52545','E52645'],
    topics: {
      user: {
        'Problemas Comuns': [
          'Erro na tela da impressora',
          'Nao digitaliza',
          'Impressao com falhas',
        ],
        'Manutencao': [
          'Manutencao basica do MFP',
          'Como limpar o equipamento?',
          'Pecas de desgaste comum',
        ],
      },
      tech: {
        'Pecas': ['Pecas MFP E52645','Part numbers ADF E52545','Fusor MFP'],
        'Service': ['Diagnostico MFP E52645','Calibracao scanner','Reparo avancado'],
        'Substituicao': ['Conjunto ADF','Fusor alta capacidade','Placa de controle'],
      },
    },
    prompts: {
      user: 'Voce e um assistente de suporte para usuarios da HP LaserJet MFP E52545/E52645. Use os TRECHOS DO MANUAL. Responda de forma simples. Se nao encontrar, ajude com conhecimento geral. Portugues Brasileiro.',
      tech: 'Voce e um tecnico especialista HP LaserJet MFP E52545/E52645. Use os TRECHOS DO MANUAL com detalhes tecnicos. Se nao encontrar, informe e complemente. Portugues Brasileiro.',
    },
  },
  {
    id: 'cpmd',
    label: 'Codigos Erro',
    subtitle: 'CPMD 2023',
    color: '#a855f7',
    indexKey: 'cpmd',
    tags: ['Erros','CPMD'],
    topics: {
      user: {
        'Mensagens Comuns': [
          'O que significa esse erro na tela?',
          'Impressora mostra Checking engine',
          'Apareceu Output Bin Full',
          'Mensagem de cartucho incorreto',
        ],
        'Atolamentos': [
          'Codigo de atolamento de papel',
          'Papel preso no alimentador',
          'Atolamento no fusor',
        ],
      },
      tech: {
        'Suprimentos 10xx': ['Erro 10.xx.xx','Memoria do cartucho','Cartucho nao reconhecido'],
        'Atolamentos 13xx': ['Erro 13.xx.xx','Atolamento ADF','Atolamento fusor'],
        'Firmware 4xxx': ['Erro 49.xx.xx firmware','Erro 41.03 misprint','Erro 50.xx fusor'],
        'Painel': ['Checking engine','Output Bin Full','NON HP Supply'],
      },
    },
    prompts: {
      user: 'Voce e um assistente de suporte para usuarios HP LaserJet. Use os TRECHOS DO MANUAL CPMD. Explique os erros de forma simples e diga o que o usuario deve fazer. Se nao encontrar, ajude com conhecimento geral. Portugues Brasileiro.',
      tech: 'Voce e um especialista em codigos de erro HP LaserJet (CPMD 2023). Use os TRECHOS DO MANUAL. Informe componente afetado, descricao tecnica e passos de resolucao. Se nao encontrar, informe e complemente. Portugues Brasileiro.',
    },
  },
];
