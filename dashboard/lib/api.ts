const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return `http://${hostname}:5000`;
  }
  return 'http://127.0.0.1:5000';
};
const API_BASE_URL = getApiBaseUrl();

export interface Session {
  start: number;
  end: number | null;
  type: 'green' | 'red';
}

export interface Employee {
  id: string;
  name: string;
  status: string;
  current_status: string;
  since: string;
  location: string;
  has_wfh: boolean;
  phone?: string;
  telegram_id?: string | number;
}

export interface SessionsMap {
  [empId: string]: Session[];
}

export async function fetchEmployees(): Promise<Employee[]> {
  const response = await fetch(`${API_BASE_URL}/employees`);
  if (!response.ok) {
    throw new Error('Failed to fetch employees');
  }
  const data = await response.json();
  return data.employees;
}

export async function fetchSessions(date: string): Promise<SessionsMap> {
  const response = await fetch(`${API_BASE_URL}/sessions?date=${date}`);
  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }
  return await response.json();
}

export async function fetchRangeStats(start: string, end: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/range-stats?start=${start}&end=${end}`);
  if (!response.ok) {
    throw new Error('Failed to fetch range stats');
  }
  return await response.json();
}

export async function fetchDailyMinutes(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/daily-minutes`);
  if (!response.ok) {
    throw new Error('Failed to fetch daily minutes');
  }
  return await response.json();
}

export async function postAttendance(employeeId: string, employeeName: string, action: 'in' | 'out'): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/attendance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      employee_id: employeeId,
      employee_name: employeeName,
      action: action,
      location: 'Office' // Default for now
    }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to post attendance');
  }
  return await response.json();
}

export function subscribeToUpdates(onUpdate: () => void) {
  const eventSource = new EventSource(`${API_BASE_URL}/stream`);
  
  eventSource.onmessage = (event) => {
    console.log('SSE update received:', event.data);
    onUpdate();
  };

  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}

export async function checkUserRole(identifier: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/auth/check-role?identifier=${encodeURIComponent(identifier)}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to check role');
  }
  return await response.json();
}

export async function loginUser(identifier: string, password: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Login failed');
  }
  return await response.json();
}

export async function requestOtp(identifier: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to request OTP');
  }
  return await response.json();
}

export async function resetPassword(userId: string, otp: string, newPassword: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, otp, new_password: newPassword }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to reset password');
  }
  return await response.json();
}

export async function verifyOtp(userId: string, otp: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, otp }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Invalid OTP');
  }
  return await response.json();
}

export async function fetchRequests(status: string = 'pending'): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/api/requests?status=${status}`);
  if (!response.ok) {
    throw new Error('Failed to fetch requests');
  }
  const data = await response.json();
  return data.requests || [];
}

export async function updateRequestStatus(action: string, requestData?: any): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/requests/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, request: requestData }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update request');
  }
  return await response.json();
}
