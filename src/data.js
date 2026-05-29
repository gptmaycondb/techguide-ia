export const API_URL = 'https://manuais-hp.onrender.com/chat';

export const USER_MODES = {
  user: {
    id: 'user',
    label: 'Usuario',
    icon: '👤',
    color: '#00d4aa',
    description: 'Respostas simples e diretas',
    promptSuffix: 'Responda de forma simples e clara para um usuario leigo.',
  },
  tech: {
    id: 'tech',
    label: 'Tecnico',
    icon: '🔧',
    color: '#0096ff',
    description: 'Informacoes tecnicas completas',
    promptSuffix: 'Responda com detalhes tecnicos, codigos e procedimentos completos.',
  },
};

// ─── HP ───────────────────────────────────────────────────────────────────────
export const MANUALS = [
  {
    id: 'mfpe52645',
    brand: 'hp',
    label: 'MFP E52645',
    subtitle: 'HP LaserJet Managed',
    color: '#0096ff',
    indexKey: 'e52645_guia',
    tags: ['E52645', 'MFP', 'Gerenciado'],
    topics: {
      user: {
        'Uso Diario': [
          'Como colocar papel na impressora?',
          'Como imprimir dos dois lados?',
          'Como digitalizar um documento?',
          'O papel atolou, o que faco?',
          'A impressora nao liga',
          'Impressao saindo borrada ou clara',
        ],
        'Suprimentos': [
          'Como trocar o cartucho de toner?',
          'A impressora diz que o toner esta baixo',
          'Como repor grampos?',
          'Qual cartucho usar nesta impressora?',
        ],
        'Conexao': [
          'Como conectar a impressora ao Wi-Fi?',
          'Nao consigo imprimir do celular',
          'Como configurar impressao por e-mail?',
          'Como acessar as configuracoes da impressora?',
        ],
        'Erros': [
          'O que significa esse erro na tela?',
          'Mensagem de cartucho incorreto',
          'Impressora mostra Checking engine',
          'Fax nao funciona',
        ],
      },
      tech: {
        'Operacao': [
          'Configurar bandejas de papel',
          'Impressao frente e verso duplex',
          'Digitalizar para pasta de rede SMB',
          'Configurar Quick Sets',
        ],
        'Suprimentos': [
          'Substituir cartucho de toner',
          'Numero de peca do cartucho E52645',
          'Substituir kit de manutencao',
          'Cartucho de grampos part number',
        ],
        'Rede': [
          'Configurar endereco IP estatico',
          'Acessar EWS Servidor Web Incorporado',
          'Configurar LDAP autenticacao',
          'Protocolo IPSec certificados',
        ],
        'Service': [
          'Codigos de erro painel de controle',
          'Procedimento de calibracao do scanner',
          'Substituir fusor E52645',
          'Diagnostico motor principal',
        ],
      },
    },
    prompts: {
      user: 'Voce e um assistente de suporte para usuarios da HP LaserJet Managed MFP E52645. Use os TRECHOS DO MANUAL para responder de forma simples e clara. Se nao encontrar no manual, ajude com conhecimento geral. Portugues Brasileiro.',
      tech: 'Voce e um tecnico especialista na HP LaserJet Managed MFP E52645. Use os TRECHOS DO MANUAL com detalhes tecnicos completos incluindo codigos, part numbers e procedimentos. Se nao encontrar, informe e complemente. Portugues Brasileiro.',
    },
  },
];

// ─── RICOH ────────────────────────────────────────────────────────────────────
export const MANUALS_RICOH = [
  {
    id: 'ricoh_imc3000',
    brand: 'ricoh',
    label: 'IM C3000/3500',
    subtitle: 'Ricoh IM C Series',
    color: '#e63946',
    indexKey: 'ricoh_imc3000_guia',
    tags: ['IM C3000', 'IM C3500', 'Color MFP'],
    topics: {
      user: {
        'Uso Diario': [
          'Como colocar papel na impressora Ricoh?',
          'Como imprimir dos dois lados?',
          'Como digitalizar um documento?',
          'O papel atolou, o que faco?',
          'A impressora nao liga',
          'Impressao saindo com qualidade ruim',
        ],
        'Suprimentos': [
          'Como trocar o toner da Ricoh?',
          'Qual toner usar na IM C3000?',
          'Como trocar o kit de manutencao?',
          'Unidade de transferencia esta no fim',
        ],
        'Conexao': [
          'Como conectar ao Wi-Fi?',
          'Nao consigo imprimir da rede',
          'Como configurar digitalizar para email?',
          'Como acessar as configuracoes web?',
        ],
        'Erros': [
          'O que significa o codigo de erro?',
          'Mensagem de toner incorreto',
          'Erro de temperatura no fusor',
          'Scanner nao funciona',
        ],
      },
      tech: {
        'Operacao': [
          'Configurar bandejas de papel',
          'Impressao frente e verso duplex',
          'Digitalizar para pasta SMB',
          'Configurar perfis de digitalizacao',
        ],
        'Suprimentos': [
          'Substituir cartucho de toner CMYK',
          'Part number toner IM C3000/3500',
          'Substituir unidade de tambor',
          'Kit de manutencao intervalo',
        ],
        'Rede': [
          'Configurar IP estatico',
          'Acessar Web Image Monitor',
          'Configurar autenticacao LDAP',
          'Protocolo SSL/TLS certificados',
        ],
        'Service': [
          'Codigos SC (Service Call)',
          'Calibracao de cores',
          'Substituir fusor IM C3000',
          'Diagnostico do motor',
        ],
      },
    },
    prompts: {
      user: 'Voce e um assistente de suporte para usuarios da Ricoh IM C3000/3500. Use os TRECHOS DO MANUAL para responder de forma simples e clara. Se nao encontrar no manual, ajude com conhecimento geral. Portugues Brasileiro.',
      tech: 'Voce e um tecnico especialista na Ricoh IM C3000/3500. Use os TRECHOS DO MANUAL com detalhes tecnicos completos incluindo codigos SC, part numbers e procedimentos. Se nao encontrar, informe e complemente. Portugues Brasileiro.',
    },
  },
];

// Todos os manuais juntos (para busca geral)
export const ALL_MANUALS = [...MANUALS, ...MANUALS_RICOH];

// ─── MODEL_GROUPS (tela de Manuais) ───────────────────────────────────────────

export const BRAND_GROUPS = [
  {
    id: 'hp',
    label: 'HP',
    subtitle: 'HP LaserJet Managed',
    color: '#0096ff',
    icon: '🔵',
    models: [
      {
        id: 'mfpe52645_group',
        label: 'MFP E52645',
        subtitle: 'HP LaserJet Managed MFP E52645',
        color: '#0096ff',
        icon: '🖨️',
        manuals: [
          {
            id: 'guia',
            title: 'Guia do Usuario',
            subtitle: 'Manual de operacao PT-BR',
            desc: 'Operacao, configuracao e solucao de problemas',
            color: '#00d4aa',
            icon: '📗',
            tags: ['E52645', 'PT-BR', '6.5 MB'],
            url: 'https://drive.google.com/uc?export=download&id=1IwaqI0k8IycRTge9jy_1FX02JjjVbuuf&confirm=t',
            localName: 'tg_guia_e52645.pdf',
            size: '6.5 MB',
          },
          {
            id: 'cpmd',
            title: 'Codigos de Erro (CPMD)',
            subtitle: 'Control Panel Message Document 2023',
            desc: 'Codigos de erro e procedimentos de solucao',
            color: '#a855f7',
            icon: '⚠️',
            tags: ['CPMD', '2023', '6.0 MB'],
            url: 'https://drive.google.com/uc?export=download&id=1AmQ0fExFjUBhVcK6yrEAjKNQJrYtRZLH&confirm=t',
            localName: 'tg_cpmd_2023.pdf',
            size: '6.0 MB',
          },
          {
            id: 'service',
            title: 'Service Parts Catalog',
            subtitle: 'Catalogo de Pecas 2025',
            desc: 'Pecas, troubleshooting e procedimentos de reparo',
            color: '#0096ff',
            icon: '🔧',
            tags: ['Service', '2025', '90 MB'],
            url: 'https://drive.google.com/uc?export=download&id=1ApI5qiLHTZaPKicn2SD5G6rqTrIFpPcQ&confirm=t',
            localName: 'tg_service_2025.pdf',
            size: '90 MB',
          },
        ],
      },
    ],
  },
  {
    id: 'ricoh',
    label: 'Ricoh',
    subtitle: 'Ricoh IM C Series',
    color: '#e63946',
    icon: '🔴',
    models: [
      {
        id: 'ricoh_imc3000_group',
        label: 'IM C3000 / C3500',
        subtitle: 'Ricoh IM C3000 / IM C3500',
        color: '#e63946',
        icon: '🖨️',
        manuals: [
          // ← Links serão preenchidos depois do upload no Drive
          {
            id: 'ricoh_guia',
            title: 'Guia do Usuario',
            subtitle: 'Manual de operacao IM C3000/3500',
            desc: 'Operacao, configuracao e solucao de problemas',
            color: '#e63946',
            icon: '📕',
            tags: ['IM C3000', 'IM C3500', '48 MB'],
            url: 'https://drive.google.com/uc?export=download&id=11O2zD-BCQq71GgJ85qtwLGV-39ryoBfk&confirm=t',
            localName: 'tg_ricoh_guia_imc3000.pdf',
            size: '48 MB',
          },
          {
            id: 'ricoh_service',
            title: 'Service Manual',
            subtitle: 'Manual de servico tecnico',
            desc: 'Procedimentos de reparo, ajustes e diagnostico',
            color: '#ff6b35',
            icon: '🔧',
            tags: ['Service', 'IM C3000', '84 MB'],
            url: 'https://drive.google.com/uc?export=download&id=1Lhct-qSmKYMV6wneIr6MW3bP8v5TMAwE&confirm=t',
            localName: 'tg_ricoh_service_imc3000.pdf',
            size: '84 MB',
          },
          {
            id: 'ricoh_parts',
            title: 'Parts Catalog',
            subtitle: 'Catalogo de Pecas',
            desc: 'Part numbers, pecas e diagramas de montagem',
            color: '#f59e0b',
            icon: '📋',
            tags: ['Parts', 'IM C3500', '0.9 MB'],
            url: 'https://drive.google.com/uc?export=download&id=128-etdw8eLoJkaV-dSzA8QHFibJ0zp1b&confirm=t',
            localName: 'tg_ricoh_parts_imc3000.pdf',
            size: '0.9 MB',
          },
        ],
      },
    ],
  },
];

// Mantido para compatibilidade com ManualsScreen antigo (não usado mais)
export const MODEL_GROUPS = BRAND_GROUPS.flatMap(b => b.models);
