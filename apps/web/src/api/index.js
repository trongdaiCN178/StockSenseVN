import { mockApi } from './mockApi.js';
import { realApi } from './realApi.js';

const useMock = import.meta.env.VITE_API_MODE !== 'real';

export const api = useMock ? mockApi : realApi;

if (import.meta.env.DEV && useMock) {
  console.info('[StockSense] Mock API mode is active. Demo login is not real authentication.');
}
