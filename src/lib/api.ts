const AUTH_URL = 'https://functions.poehali.dev/33418e4c-9e61-4c24-b7cb-fa0af5c48333';
const NEWS_URL = 'https://functions.poehali.dev/163f2c51-4238-431d-a500-14b086540bba';
const SERVICES_URL = 'https://functions.poehali.dev/2c6cf86e-4472-4d3f-8b01-88b5a3b42c08';

function getToken() {
  return localStorage.getItem('yugaru_token') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Auth-Token': getToken(),
  };
}

export const api = {
  // Auth
  register: (phone: string, first_name: string, last_name: string) =>
    fetch(`${AUTH_URL}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, first_name, last_name }) }).then(r => r.json()),

  login: (phone: string, first_name: string, last_name: string) =>
    fetch(`${AUTH_URL}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, first_name, last_name }) }).then(r => r.json()),

  getMe: () =>
    fetch(`${AUTH_URL}/me`, { headers: authHeaders() }).then(r => r.json()),

  updateMe: (data: Record<string, string>) =>
    fetch(`${AUTH_URL}/me`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }).then(r => r.json()),

  uploadAvatar: (image: string, content_type: string) =>
    fetch(`${AUTH_URL}/avatar`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ image, content_type }) }).then(r => r.json()),

  deleteMe: () =>
    fetch(`${AUTH_URL}/me`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),

  // News
  getNews: () =>
    fetch(`${NEWS_URL}/news`, { headers: authHeaders() }).then(r => r.json()),

  createNews: (title: string, content: string) =>
    fetch(`${NEWS_URL}/news`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ title, content }) }).then(r => r.json()),

  likeNews: (id: number) =>
    fetch(`${NEWS_URL}/news/${id}/like`, { method: 'POST', headers: authHeaders() }).then(r => r.json()),

  getComments: (id: number) =>
    fetch(`${NEWS_URL}/news/${id}/comments`, { headers: authHeaders() }).then(r => r.json()),

  addComment: (id: number, content: string) =>
    fetch(`${NEWS_URL}/news/${id}/comments`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ content }) }).then(r => r.json()),

  // Services
  getFines: (inn?: string, car_number?: string) => {
    const params = new URLSearchParams();
    if (inn) params.set('inn', inn);
    if (car_number) params.set('car_number', car_number);
    return fetch(`${SERVICES_URL}/fines?${params}`, { headers: authHeaders() }).then(r => r.json());
  },

  getTaxes: (inn?: string) => {
    const params = new URLSearchParams();
    if (inn) params.set('inn', inn);
    return fetch(`${SERVICES_URL}/taxes?${params}`, { headers: authHeaders() }).then(r => r.json());
  },

  pay: (payment_type: string, reference_id: number, amount: number) =>
    fetch(`${SERVICES_URL}/pay`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ payment_type, reference_id, amount }) }).then(r => r.json()),

  getAppointments: () =>
    fetch(`${SERVICES_URL}/appointments`, { headers: authHeaders() }).then(r => r.json()),

  createAppointment: (data: Record<string, string>) =>
    fetch(`${SERVICES_URL}/appointments`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }).then(r => r.json()),

  getDocuments: () =>
    fetch(`${SERVICES_URL}/documents`, { headers: authHeaders() }).then(r => r.json()),

  addDocument: (data: Record<string, unknown>) =>
    fetch(`${SERVICES_URL}/documents`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }).then(r => r.json()),
};
