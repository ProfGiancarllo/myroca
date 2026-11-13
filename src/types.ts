export type WaterPointType =
  | 'nascente'
  | 'acude'
  | 'poco'
  | 'rio'
  | 'sede'
  | 'curral'
  | 'silo'
  | 'estrada'
  | 'reserva'
  | 'pivo'
  | 'estacao_meteo';

export type FarmElementType = WaterPointType;

export type CropPhaseKey =
  | 'planejamento'
  | 'preparo'
  | 'plantio'
  | 'emergencia'
  | 'crescimento'
  | 'floracao'
  | 'enchimento'
  | 'colheita'
  | 'colhido'
  | 'pastagem';

export interface CropPhaseInfo {
  key: CropPhaseKey;
  label: string;
  icon: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
}

export interface HarvestHistoryItem {
  id: string;
  season: string; // Ex: 'Safra 2025/26'
  crop: string;   // Ex: 'Soja'
  harvestDate: string; // Ex: 'Fevereiro de 2026' ou 'Julho de 2026'
  yieldText?: string;  // Ex: '72 sc/ha'
  notes?: string;
}

export interface NextCropPlan {
  crop: string;          // Ex: 'Milho Safrinha'
  plannedPlanting: string; // Ex: 'Fevereiro de 2027' ou '2027-02-15'
  plannedHarvest?: string; // Ex: 'Junho de 2027'
  cycleDays?: number;
  notes?: string;
}

export interface RotationSlot {
  crop: string;   // soja | milho | sorgo | feijao | algodao | trigo | cana | pasto | cobertura | pousio
  cycle: number;  // dias
}
export interface RotationStrategyData {
  id: string;
  name: string;
  kind: 'current' | 'suggested' | 'custom';
  summer: RotationSlot;
  second: RotationSlot;
}
export interface RotationPlan {
  summerSow?: string; // YYYY-MM-DD
  strategies: RotationStrategyData[];
}

export type DiaryEntryType =
  | 'plantio'
  | 'adubacao'
  | 'aplicacao'
  | 'irrigacao'
  | 'chuva'
  | 'monitoramento'
  | 'colheita'
  | 'observacao'
  | 'preparo'
  | 'calagem'
  | 'foliar'
  | 'ocorrencia'
  | 'analise_solo';

/** Clima do dia do registro: informado pelo produtor ou preenchido por NASA POWER / Open-Meteo. */
export interface DiaryWeather {
  rain: number | null;   // mm no dia
  tmax: number | null;   // °C
  tmin: number | null;   // °C
  src: string;           // 'Produtor' | 'NASA POWER' | 'Open-Meteo'
}

/** Registro do diário de safra de um talhão. */
export interface DiaryEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  type: DiaryEntryType;
  amount?: number;       // kg/ha (adubação), L/ha (aplicação), mm (irrigação/chuva), sc/ha (colheita)
  note?: string;
  unit?: string;         // unidade da quantidade (kg/ha, L/ha, t/ha, mm, sc/ha...)
  product?: string;      // produto, cultivar ou implemento
  category?: string;     // combate: herbicida, fungicida, inseticida, dessecacao, outro
  target?: string;       // alvo do combate (praga, doença ou planta daninha) ou ocorrência
  depth?: number;        // profundidade de trabalho (cm) no preparo do solo
  groupId?: string;      // liga os registros feitos juntos em vários talhões
  weather?: DiaryWeather; // clima do dia (automático ou do produtor)
}

export interface Talhao {
  id: string;
  name: string;
  color: string;
  crop?: string;
  cultivar?: string;          // Cultivar da safra (ex: 'Brasmax Bônus', 'DM 54i52 RSF')
  plantingDate?: string;      // Data de plantio (formato YYYY-MM-DD, ex: '2026-10-10')
  cycleDays?: number;         // Ciclo em dias (ex: 115 dias)
  harvestDateExpected?: string; // Data prevista de colheita (calculada ou editada)
  isExample?: boolean;        // Rótulo de exemplo
  healthStatus?: 'verde' | 'amarelo' | 'vermelho'; // Estado da lavoura para a borda
  harvestHistory?: HarvestHistoryItem[]; // Histórico de safras anteriores
  diary?: DiaryEntry[];                 // Diário de safra (registros de campo)
  nextCropPlan?: NextCropPlan;          // Próxima safra planejada
  rotationPlan?: RotationPlan;          // Estratégias de rotação em comparação
  areaHectares: number;
  perimeterKm: number;
  coordinates: [number, number][]; // [latitude, longitude]
  createdAt: string;
  notes?: string;
}

export interface WaterPoint {
  id: string;
  name: string;
  type: FarmElementType;
  coordinates: [number, number]; // [latitude, longitude]
  createdAt: string;
  notes?: string;
  isExample?: boolean;
}

export interface FarmData {
  farmName: string;
  referenceDate?: string; // Data de referência 'Hoje', default '2026-11-09'
  simulateTime?: boolean; // true = produtor avançou o calendário (simulação); false/ausente = segue o relógio real
  activeViewMode?: 'mapa' | 'fazenda'; // Modo atual: 'mapa' ou 'fazenda'
  talhoes: Talhao[];
  waterPoints: WaterPoint[];
  demoVersion?: number; // versão da fazenda de exemplo (para trocar exemplos antigos)
}

export interface ElementMeta {
  label: string;
  icon: string;
  color: string;
  badgeBg: string;
  category: 'agua' | 'estrutura';
  description: string;
}

export const FARM_ELEMENT_META: Record<FarmElementType, ElementMeta> = {
  // Recursos Hídricos
  nascente: {
    label: 'Nascente',
    icon: '💧',
    color: '#0284c7',
    badgeBg: 'rgba(2, 132, 199, 0.15)',
    category: 'agua',
    description: 'Olho d\'água, vertente ou mina protegida',
  },
  acude: {
    label: 'Açude / Represa',
    icon: '🌊',
    color: '#0d9488',
    badgeBg: 'rgba(13, 148, 136, 0.15)',
    category: 'agua',
    description: 'Reservatório hídrico, açude ou tanque',
  },
  poco: {
    label: 'Poço Artesiano',
    icon: '🚰',
    color: '#2563eb',
    badgeBg: 'rgba(37, 99, 235, 0.15)',
    category: 'agua',
    description: 'Poço tubular com bomba para abastecimento',
  },
  rio: {
    label: 'Rio / Córrego',
    icon: '🏞️',
    color: '#059669',
    badgeBg: 'rgba(5, 150, 105, 0.15)',
    category: 'agua',
    description: 'Curso d\'água natural ou ribeirão da fazenda',
  },

  // Estruturas e Infraestrutura da Fazenda
  sede: {
    label: 'Sede (Casa)',
    icon: '🏠',
    color: '#ea580c', // Laranja quente
    badgeBg: 'rgba(234, 88, 12, 0.15)',
    category: 'estrutura',
    description: 'Casa principal, moradia ou escritório central',
  },
  curral: {
    label: 'Curral',
    icon: '🐂',
    color: '#92400e', // Castanho terra
    badgeBg: 'rgba(146, 64, 14, 0.15)',
    category: 'estrutura',
    description: 'Instalação de manejo, brete e embarcadouro',
  },
  silo: {
    label: 'Silo ou Armazém',
    icon: '🏭',
    color: '#6366f1', // Índigo industrial
    badgeBg: 'rgba(99, 102, 241, 0.15)',
    category: 'estrutura',
    description: 'Bateria de silos, tulha ou armazém de grãos',
  },
  estrada: {
    label: 'Estrada Interna',
    icon: '🛣️',
    color: '#64748b', // Ardósia
    badgeBg: 'rgba(100, 116, 139, 0.15)',
    category: 'estrutura',
    description: 'Via de escoamento de safra e tráfego de máquinas',
  },
  reserva: {
    label: 'Reserva ou Mata',
    icon: '🌳',
    color: '#15803d', // Verde mata densa
    badgeBg: 'rgba(21, 128, 61, 0.15)',
    category: 'estrutura',
    description: 'Reserva Legal, APP ou capão de mata nativa',
  },
  pivo: {
    label: 'Pivô de Irrigação',
    icon: '🔄',
    color: '#0891b2', // Ciano
    badgeBg: 'rgba(8, 145, 178, 0.15)',
    category: 'estrutura',
    description: 'Pivô central de irrigação para safra irrigada',
  },
  estacao_meteo: {
    label: 'Estação Meteorológica',
    icon: '📡',
    color: '#8b5cf6', // Roxo tecnologia
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    category: 'estrutura',
    description: 'Sensor de pluviometria, vento, umidade e temperatura',
  },
};

export const CROP_PHASE_META: Record<CropPhaseKey, CropPhaseInfo> = {
  planejamento: {
    key: 'planejamento',
    label: 'Planejamento / Pousio',
    icon: '',
    badgeColor: '#94a3b8',
    badgeBg: 'rgba(148, 163, 184, 0.18)',
    description: 'Área em descanso ou planejamento de semeadura',
  },
  preparo: {
    key: 'preparo',
    label: 'Preparo do Solo',
    icon: '',
    badgeColor: '#d97706',
    badgeBg: 'rgba(217, 119, 6, 0.18)',
    description: 'Dessecação, calagem e preparo de sulcos/plantio direto',
  },
  plantio: {
    key: 'plantio',
    label: 'Plantio / Semeadura',
    icon: '',
    badgeColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.18)',
    description: 'Semeadora em campo e deposição das sementes',
  },
  emergencia: {
    key: 'emergencia',
    label: 'Emergência (VE - V1)',
    icon: '',
    badgeColor: '#22c55e',
    badgeBg: 'rgba(34, 197, 94, 0.18)',
    description: 'Plântulas rompendo o solo com estande homogêneo',
  },
  crescimento: {
    key: 'crescimento',
    label: 'Crescimento Vegetativo',
    icon: '',
    badgeColor: '#16a34a',
    badgeBg: 'rgba(22, 163, 74, 0.22)',
    description: 'Desenvolvimento das folhas, nós e fechamento de entrelinhas',
  },
  floracao: {
    key: 'floracao',
    label: 'Floração (R1 - R2)',
    icon: '',
    badgeColor: '#ec4899',
    badgeBg: 'rgba(236, 72, 153, 0.22)',
    description: 'Abertura das flores e definição do potencial de vagens/grãos',
  },
  enchimento: {
    key: 'enchimento',
    label: 'Enchimento de Grãos (R3 - R6)',
    icon: '',
    badgeColor: '#eab308',
    badgeBg: 'rgba(234, 179, 8, 0.22)',
    description: 'Acúmulo de matéria seca e granação das vagens/espigas',
  },
  colheita: {
    key: 'colheita',
    label: 'Maturação e Colheita',
    icon: '',
    badgeColor: '#f97316',
    badgeBg: 'rgba(249, 115, 22, 0.22)',
    description: 'Ponto de maturidade ideal e colhedoras operando',
  },
  colhido: {
    key: 'colhido',
    label: 'Safra Colhida',
    icon: '',
    badgeColor: '#64748b',
    badgeBg: 'rgba(100, 116, 139, 0.18)',
    description: 'Área colhida aguardando próxima safra ou dessecação',
  },
  pastagem: {
    key: 'pastagem',
    label: 'Pastagem Perene',
    icon: '',
    badgeColor: '#059669',
    badgeBg: 'rgba(5, 150, 105, 0.2)',
    description: 'Pastagem contínua para pastejo rotacionado de gado',
  },
};

// Aliased for backwards compatibility
export const WATER_POINT_META = FARM_ELEMENT_META;

export const TALHAO_COLORS = [
  { name: 'Verde Soja', hex: '#16a34a' },
  { name: 'Amarelo Milho', hex: '#eab308' },
  { name: 'Laranja Terracota', hex: '#ea580c' },
  { name: 'Azul Celeste', hex: '#0284c7' },
  { name: 'Roxo Lavanda', hex: '#9333ea' },
  { name: 'Rosa Florada', hex: '#db2777' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Âmbar Dourado', hex: '#d97706' },
  { name: 'Vinho Tinto', hex: '#9f1239' },
  { name: 'Azul Marinho', hex: '#1d4ed8' },
  { name: 'Ciano Lagoa', hex: '#0891b2' },
  { name: 'Verde Oliva', hex: '#65a30d' },
];
