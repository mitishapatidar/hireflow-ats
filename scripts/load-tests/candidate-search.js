import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 }, // Ramp up to 20 users
    { duration: '30s', target: 50 }, // Sustained 50 concurrent recruiters searching
    { duration: '10s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<250'], // 95% of searches must complete in < 250ms
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';

export default function () {
  const queries = ['Senior', 'Engineer', 'Developer', 'React', 'Architect', 'Python'];
  const query = queries[Math.floor(Math.random() * queries.length)];

  const res = http.get(`${BASE_URL}/search?q=${query}&limit=10`, {
    headers: {
      'Content-Type': 'application/json',
      'x-dev-role': 'RECRUITER',
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has search results': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data.candidates);
      } catch (e) {
        return false;
      }
    },
  });

  sleep(0.5);
}
