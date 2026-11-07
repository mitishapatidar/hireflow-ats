import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '20s', target: 25 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'], // 95% of requests under 400ms
    http_req_failed: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001/api';

export default function () {
  const payload = JSON.stringify({
    name: `Load Candidate ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    email: `loadtest-${Date.now()}-${Math.floor(Math.random() * 1000)}@hireflow.test`,
    currentTitle: 'Fullstack Engineer',
    currentCompany: 'Test Corp',
    location: 'Bangalore, India',
    skills: ['TypeScript', 'Next.js', 'PostgreSQL'],
  });

  const res = http.post(`${BASE_URL}/candidates`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'x-dev-role': 'RECRUITER',
    },
  });

  check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  sleep(1);
}
