import { FarmData } from '../types';
import { getRioVerdeDemoFarm, localizeExampleNames } from './geo';
import { scopedKey } from '../auth/auth';

const BASE_KEY = 'myroca_farm_data_rio_verde_rural_v3';

export function loadFarmData(): FarmData {
  try {
    const raw = localStorage.getItem(scopedKey(BASE_KEY));
    if (raw) {
      const parsed = JSON.parse(raw) as FarmData;
      if (parsed && Array.isArray(parsed.talhoes)) {
        // troca a fazenda de exemplo antiga pela nova (só se TODOS os talhões forem de exemplo)
        if (parsed.talhoes.length > 0 && parsed.talhoes.every((x) => x.isExample) && parsed.demoVersion !== 2) {
          const fresh = getRioVerdeDemoFarm(); fresh.simulateTime = parsed.simulateTime; if (parsed.referenceDate) fresh.referenceDate = parsed.referenceDate;
          saveFarmData(fresh);
          return fresh;
        }
        localizeExampleNames(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Falha ao carregar dados locais:', err);
  }

  // Se for a primeira vez, inicializa com dados reais de exemplo em Rio Verde, Goiás
  const demo = getRioVerdeDemoFarm();
  saveFarmData(demo);
  return demo;
}

export function saveFarmData(data: FarmData): void {
  try {
    localStorage.setItem(scopedKey(BASE_KEY), JSON.stringify(data));
  } catch (err) {
    console.error('Falha ao salvar dados no localStorage:', err);
  }
}

export function resetToDemoFarm(): FarmData {
  const demo = getRioVerdeDemoFarm();
  saveFarmData(demo);
  return demo;
}

export function clearAllFarmData(): FarmData {
  const empty: FarmData = {
    farmName: 'Minha Fazenda - Rio Verde (GO)',
    talhoes: [],
    waterPoints: [],
  };
  saveFarmData(empty);
  return empty;
}
