import axios from 'axios';
// import { useAuth } from '../context/AuthContext';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api'; // Define baseURL separately

const authenticityUtility = axios.create({
  baseURL: baseURL, // Use baseURL here
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Add request interceptor to include Authorization token
authenticityUtility.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // Get token from local storage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`; // Set Authorization header
    } else {
      console.warn('No token found in localStorage');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Modify the response interceptor to handle token expiration
authenticityUtility.interceptors.response.use(
  (response) => {
    return response.data; // Return just the data
  },
  (error) => {
    // Check if error is due to authentication issues (any 401 with shouldLogout)
    if (
      error.response?.status === 401 &&
      error.response?.data?.shouldLogout
    ) {
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Redirect to login page
      window.location.replace('/login');
      return Promise.reject({
        ...error,
        message: 'Your session has expired. Please login again.',
      });
    }
    return Promise.reject(error);
  }
);

// Adding the `postFile` function inside `authenticityUtility`
// authenticityUtility.postFile = async (endpoint, formData) => {
//   try {
//       const response = await fetch(`${authenticityUtility.baseURL}${endpoint}`, {
//           method: 'POST',
//           headers: {
//               // Don't set Content-Type header - let browser set it with boundary
//               'Authorization': `Bearer ${authenticityUtility.getToken()}`
//           },
//           body: formData
//       });

//       if (!response.ok) {
//           const errorData = await response.json();
//           throw new Error(errorData.message || 'Upload failed');
//       }

//       return await response.json();
//   } catch (error) {
//       console.error('File upload error:', error);
//       throw error;
//   }
// };

authenticityUtility.postFile = async (endpoint, formData) => {
  try {
    const response = await authenticityUtility.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data', // Ensure multipart/form-data for file uploads
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      'Error in postFile request:',
      error.response?.data || error.message
    );
    throw error;
  }
};

authenticityUtility.patch = async (endpoint, data) => {
  try {
    // Use the configured instance instead of axios directly
    const response = await authenticityUtility({
      method: 'PATCH',
      url: endpoint,
      data: data,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    return response;
  } catch (error) {
    console.error('Error in patch request:', error);
    // Return the error response from the server if available
    if (error.response && error.response.data) {
      return error.response.data;
    }
    // Otherwise return a generic error
    return {
      success: false,
      message: error.message || 'Failed to process request',
    };
  }
};

authenticityUtility.getBaseURL = () => {
  // return baseURL;
  // // Directly return the backend URL for development.
  // // For production, you should use environment variables to configure this.
  return 'http://localhost:5000';
};

// authenticityUtility.getBaseURL = () => {
//     // Ensure baseURL does not end with '/api'
//         const cleanBaseURL = baseURL.endsWith('/api') ? baseURL.slice(0, -4) : baseURL;
//         return cleanBaseURL;
//     };

export default authenticityUtility;
