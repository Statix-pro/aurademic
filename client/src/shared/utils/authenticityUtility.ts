import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface AuthenticityUtility extends AxiosInstance {
  postFile: (endpoint: string, formData: FormData) => Promise<unknown>;
  getBaseURL: () => string;
}

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
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('No token found in localStorage');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

authenticityUtility.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error) => {
    if (
      error.response?.status === 401 &&
      error.response?.data?.shouldLogout
    ) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.replace('/login');
      return Promise.reject({
        ...error,
        message: 'Your session has expired. Please login again.',
      });
    }
    return Promise.reject(error);
  }
);

authenticityUtility.postFile = async (endpoint: string, formData: FormData): Promise<unknown> => {
  try {
    const response = await authenticityUtility.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return (response as unknown as AxiosResponse).data;
  } catch (error: unknown) {
    const axiosError = error as { response?: { data?: unknown }; message?: string };
    console.error(
      'Error in postFile request:',
      axiosError.response?.data || axiosError.message
    );
    throw error;
  }
};

authenticityUtility.getBaseURL = (): string => {
  return baseURL.replace(/\/api\/?$/, '');
};

export default authenticityUtility;
