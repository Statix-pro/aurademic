import { Configuration } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID;

if (!clientId) {
  console.warn('VITE_MICROSOFT_CLIENT_ID is not set');
}
if (!tenantId) {
  console.warn('VITE_MICROSOFT_TENANT_ID is not set');
}

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId || '00000000-0000-0000-0000-000000000000', // Placeholder to prevent empty string crash
    authority: `https://login.microsoftonline.com/${tenantId || 'common'}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['User.Read'],
};

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
};
