// Нагрузочный тест SafeGram API (k6).
// Запуск: k6 run scripts/load-test-k6.js
// Переменные: BASE_URL (default http://localhost:8082), VUS (virtual users), DURATION (e.g. 30s).

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8082';
const VUS = __ENV.VUS || 5;
const DURATION = __ENV.DURATION || '30s';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // Health
  let res = http.get(`${BASE}/health`);
  check(res, { 'health ok': (r) => r.status === 200 });

  // API без авторизации — ожидаем 401/404 для защищённых эндпоинтов
  res = http.get(`${BASE}/api/chats`, { headers: { Accept: 'application/json' } });
  check(res, (r) => r.status === 200 || r.status === 401);

  sleep(0.5 + Math.random());
}
