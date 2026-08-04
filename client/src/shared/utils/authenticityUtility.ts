import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { jwtDecode, JwtPayload } from 'jwt-decode';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface AuthenticityUtility extends AxiosInstance {
  postFile: (endpoint: string, formData: FormData) => Promise<unknown>;
  putFile: (endpoint: string, formData: FormData) => Promise<unknown>;
  getBaseURL: () => string;
}

// Helper function to check if token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return true;
    }
    return false;
  } catch {
    return true; // If we can't decode, consider it expired
  }
};

// Helper function to perform logout
const performLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.replace('/login');
};

const authenticityUtility = axios.create({
  baseURL: baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
}) as AuthenticityUtility;

authenticityUtility.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Check if token is expired before making the request
      if (isTokenExpired(token)) {
        performLogout();
        return Promise.reject(new Error('Session expired. Please login again.'));
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

authenticityUtility.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error: AxiosError) => {
    // Handle 401 Unauthorized errors - session expired on server
    if (error.response?.status === 401) {
      performLogout();
      return Promise.reject({
        ...error,
        message: 'Your session has expired. Please login again.',
      });
    }

    // Handle network errors - check if it might be due to expired token
    if (!error.response && error.message === 'Network Error') {
      const token = localStorage.getItem('token');
      if (token && isTokenExpired(token)) {
        // Token is expired, perform logout
        performLogout();
        return Promise.reject({
          ...error,
          message: 'Your session has expired. Please login again.',
        });
      }
      // Actual network error - not related to auth
      return Promise.reject({
        ...error,
        message: 'Network error. Please check your connection.',
      });
    }

    return Promise.reject(error);
  },
);

authenticityUtility.postFile = async (endpoint: string, formData: FormData): Promise<unknown> => {
  try {
    const response = await authenticityUtility.post(endpoint, formData);
    return response;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: unknown }; message?: string };
    console.error('Error in postFile request:', axiosError.response?.data || axiosError.message);
    throw error;
  }
};

authenticityUtility.putFile = async (endpoint: string, formData: FormData): Promise<unknown> => {
  try {
    const response = await authenticityUtility.put(endpoint, formData);
    return response;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: unknown }; message?: string };
    console.error('Error in putFile request:', axiosError.response?.data || axiosError.message);
    throw error;
  }
};

authenticityUtility.getBaseURL = (): string => {
  return baseURL.replace(/\/api\/?$/, '');
};

export const isFallbackEligible = (error: any): boolean => {
  return !!(
    error &&
    typeof error === 'object' &&
    !error.response &&
    (error.request || error.isAxiosError === true || error.code === 'ERR_NETWORK')
  );
};

export default authenticityUtility;
