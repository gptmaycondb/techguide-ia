const HP_FAMILIES = {
  10: 'Suprimentos', 11: 'Relogio', 13: 'Atolamento', 20: 'Memoria',
  21: 'Pagina', 30: 'Scanner', 31: 'Alimentador', 32: 'Backup/restauracao',
  33: 'Seguranca', 40: 'I/O', 41: 'Fusor/Scanner laser/Caminho do papel',
  42: 'Firmware', 44: 'Firmware', 46: 'Motor', 47: 'Firmware',
  48: 'Firmware', 49: 'Firmware', 50: 'Fusor', 51: 'Scanner laser',
  52: 'Scanner laser', 53: 'Bandeja', 54: 'Sensor', 55: 'DC controller',
  56: 'Manuseio de papel', 57: 'Ventoinha', 58: 'Sensor', 59: 'Motor',
  60: 'Motor de bandeja', 62: 'Sistema', 63: 'Motor', 64: 'Acessorio/Hardware',
  65: 'Conector', 66: 'Acessorio de saida', 67: 'Acessorio de entrada',
  70: 'DC controller', 80: 'Dispositivo gerenciado', 81: 'NFC',
  82: 'Memoria (HD/eMMC)', 90: 'Diagnostico interno', 98: 'Disco rigido',
  99: 'Instalador de firmware',
};

const RICOH_FAMILIES = {
  1: 'Scanner', 2: 'Escrita de imagem', 3: 'Carga/Revelacao',
  4: 'Ao redor do cilindro', 5: 'Transporte de papel/Fusao',
  6: 'Comunicacao', 7: 'Perifericos', 8: 'Controlador', 9: 'Diversos',
};

const SP3710_FAMILIES = {
  2: 'Optica laser', 4: 'Transferencia de imagem',
  5: 'Motor/Fusao', 6: 'Comunicacao',
};

export function getErrorFamily(code, modelId) {
  const value = String(code || '').trim().toUpperCase();
  if (value.startsWith('SC')) {
    const prefix = value.match(/^SC(\d)/)?.[1];
    if (!prefix) return null;
    return (modelId === 'ricoh_sp3710' ? SP3710_FAMILIES : RICOH_FAMILIES)[prefix] || null;
  }
  const prefix = value.match(/^(\d{2})\./)?.[1];
  return prefix === '39' ? null : HP_FAMILIES[prefix] || null;
}
