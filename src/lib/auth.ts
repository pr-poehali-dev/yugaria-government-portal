export interface User {
  id: number;
  phone: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  inn?: string;
  created_at?: string;
}

export function saveSession(token: string, user: User) {
  localStorage.setItem('yugaru_token', token);
  localStorage.setItem('yugaru_user', JSON.stringify(user));
}

export function getSession(): { token: string; user: User } | null {
  const token = localStorage.getItem('yugaru_token');
  const userStr = localStorage.getItem('yugaru_user');
  if (!token || !userStr) return null;
  try {
    return { token, user: JSON.parse(userStr) };
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('yugaru_token');
  localStorage.removeItem('yugaru_user');
}

export function updateStoredUser(user: User) {
  localStorage.setItem('yugaru_user', JSON.stringify(user));
}
