import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider as MSALProvider } from '@azure/msal-react';
import React, { ReactNode } from 'react';

import { msalConfig } from '../../config/authConfig';

const msalInstance = new PublicClientApplication(msalConfig);

interface MsalProviderProps {
  children: ReactNode;
}

export const MsalProvider: React.FC<MsalProviderProps> = ({ children }) => {
  return <MSALProvider instance={msalInstance}>{children}</MSALProvider>;
};
