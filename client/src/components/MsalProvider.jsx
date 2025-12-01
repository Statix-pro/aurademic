import { MsalProvider as MSALProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "../config/authConfig";

const msalInstance = new PublicClientApplication(msalConfig);

export const MsalProvider = ({ children }) => {
  return <MSALProvider instance={msalInstance}>{children}</MSALProvider>;
};
