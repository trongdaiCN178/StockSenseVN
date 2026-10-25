const makeForecast = (label, probabilities, confidence = 'mid') => ({ label, probabilities, confidence });

const rows = [
  ['FPT', 'FPT Corporation', 'HOSE', 145200, 1.45, 'up', [0.62, 0.23, 0.15], 'hold', [0.31, 0.44, 0.25]],
  ['HPG', 'Hoa Phat Group', 'HOSE', 27450, 0.92, 'up', [0.57, 0.28, 0.15], 'up', [0.59, 0.25, 0.16]],
  ['VCB', 'Vietcombank', 'HOSE', 92800, -0.32, 'hold', [0.28, 0.48, 0.24], 'hold', [0.25, 0.51, 0.24]],
  ['VNM', 'Vinamilk', 'HOSE', 68100, 0.15, 'hold', [0.27, 0.49, 0.24], 'down', [0.24, 0.31, 0.45]],
  ['SSI', 'SSI Securities', 'HOSE', 35600, 2.01, 'up', [0.68, 0.20, 0.12], 'up', [0.61, 0.25, 0.14]],
  ['MWG', 'Mobile World Investment', 'HOSE', 73500, 0.68, 'up', [0.56, 0.29, 0.15], 'hold', [0.30, 0.45, 0.25]],
  ['MBB', 'Military Commercial Bank', 'HOSE', 25800, -0.19, 'hold', [0.29, 0.46, 0.25], 'up', [0.48, 0.34, 0.18]],
  ['VIC', 'Vingroup', 'HOSE', 102300, 1.08, 'up', [0.58, 0.27, 0.15], 'up', [0.63, 0.23, 0.14]],
  ['ACB', 'Asia Commercial Bank', 'HOSE', 25400, 0.39, 'hold', [0.31, 0.47, 0.22], 'hold', [0.29, 0.46, 0.25]],
  ['GAS', 'PetroVietnam Gas', 'HOSE', 72100, -0.55, 'down', [0.19, 0.29, 0.52], 'hold', [0.26, 0.48, 0.26]],
  ['HUT', 'Tasco Joint Stock Company', 'HNX', 26700, 0.71, 'up', [0.55, 0.30, 0.15], 'up', [0.60, 0.25, 0.15]],
  ['PVS', 'PetroVietnam Technical Services', 'HNX', 41200, 1.22, 'up', [0.64, 0.22, 0.14], 'hold', [0.32, 0.43, 0.25]],
  ['SHS', 'Saigon-Hanoi Securities', 'HNX', 18600, 0.00, 'hold', [0.25, 0.50, 0.25], 'down', [0.22, 0.34, 0.44]],
  ['IDC', 'Idico Corporation', 'HNX', 59200, -0.84, 'down', [0.18, 0.30, 0.52], 'down', [0.16, 0.28, 0.56]],
  ['BSR', 'Binh Son Refining and Petrochemical', 'UPCOM', 21800, 0.47, 'hold', [0.34, 0.42, 0.24], 'up', [0.52, 0.31, 0.17]],
  ['QNS', 'Quang Ngai Sugar', 'UPCOM', 49600, -0.22, 'hold', [0.29, 0.48, 0.23], 'hold', [0.30, 0.45, 0.25]],
  ['VGT', 'Vietnam National Textile and Garment', 'UPCOM', 14200, 1.08, 'up', [0.57, 0.28, 0.15], 'up', [0.61, 0.24, 0.15]],
];

const forecastFrom = (label, values) => {
  const [up, hold, down] = values;
  const confidence = Math.max(up, hold, down) >= 0.58 ? 'high' : Math.max(up, hold, down) < 0.45 ? 'low' : 'mid';
  return makeForecast(label, { up, hold, down }, confidence);
};

export const marketMock = {
  status: {
    dataDate: '2026-10-07',
    batchCompletedAt: '2026-10-07T19:42:00+07:00',
    modelVersion: 'demo-0.0.1',
    state: 'demo',
    sourceStatus: 'sample',
  },
  summary: {
    indices: [
      { code: 'VNINDEX', label: 'VN-Index', value: 1284.56, changePoints: 8.24, changePercent: 0.65 },
      { code: 'HNX', label: 'HNX-Index', value: 236.18, changePoints: -0.42, changePercent: -0.18 },
      { code: 'VN30', label: 'VN30', value: 1348.22, changePoints: 6.58, changePercent: 0.49 },
    ],
    breadth: { advances: 218, nochanges: 74, declines: 151 },
    labelDistribution: { up: 8, hold: 6, down: 3 },
  },
  symbols: {
    items: rows.map(([symbol, name, exchange, closePrice, changePercent, t2Label, t2Values, t5Label, t5Values]) => ({
      symbol,
      name,
      exchange,
      closePrice,
      changePercent,
      averageTurnover20d: 125000000000,
      dataStatus: 'complete',
      forecasts: {
        t2: forecastFrom(t2Label, t2Values),
        t5: forecastFrom(t5Label, t5Values),
      },
    })),
    total: rows.length,
  },
};
