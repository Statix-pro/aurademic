import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import authenticityUtility from '../shared/utils/authenticityUtility';

/* ============================================================
   Tenant Context
   ============================================================
   Fetches branding metadata from the backend on app initialization
   and applies dynamic CSS custom properties (colors, etc.) so the
   entire UI adapts to the current tenant's branding.

   Usage:
     const { tenantInfo } = useTenant();
     console.log(tenantInfo.collegeName); // "K.S. Rangasamy College of Technology"
   ============================================================ */

export interface TenantInfo {
  collegeId: string;
  collegeName: string;
  shortName: string;
  logoUrl: string;
  primaryColor: string;
  primaryHover: string;
  secondaryColor: string;
  tagline: string;
  portalMode: 'admin' | 'student';
  host: string;
}

interface TenantContextType {
  tenantInfo: TenantInfo | null;
  loading: boolean;
  isStudentPortal: boolean;
}

const defaultContext: TenantContextType = {
  tenantInfo: null,
  loading: true,
  isStudentPortal: false,
};

const TenantContext = createContext<TenantContextType>(defaultContext);

interface TenantProviderProps {
  children: ReactNode;
}

/**
 * Default branding applied when the metadata endpoint is unreachable
 * (e.g., backend is down during local frontend-only development).
 */
const FALLBACK_BRANDING: TenantInfo = {
  collegeId: 'default',
  collegeName: 'Research Portal',
  shortName: 'Portal',
  logoUrl: '/logos/default-logo.png',
  primaryColor: '#0069ab',
  primaryHover: '#005492',
  secondaryColor: '#5d6b8a',
  tagline: 'Academic Research Management',
  portalMode: 'admin',
  host: window.location.hostname,
};

/**
 * Applies tenant branding colors to CSS custom properties on :root.
 * This dynamically overrides the values in variables.css so the
 * entire UI reflects the tenant's brand without any code changes.
 */
function applyBrandingToCSS(branding: TenantInfo) {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', branding.primaryColor);
  root.style.setProperty('--primary-hover', branding.primaryHover);
  root.style.setProperty('--secondary-color', branding.secondaryColor);
  root.style.setProperty('--border-focus', branding.primaryColor);

  // Update the page title
  document.title = `${branding.shortName} - Research Portal`;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchTenantMetadata = async () => {
      try {
        const data = await authenticityUtility.get('/tenant/metadata');
        if (!cancelled) {
          const info = data as unknown as TenantInfo;
          setTenantInfo(info);
          applyBrandingToCSS(info);
        }
      } catch (error) {
        console.warn('[TenantContext] Failed to fetch tenant metadata, using fallback:', error);
        if (!cancelled) {
          setTenantInfo(FALLBACK_BRANDING);
          applyBrandingToCSS(FALLBACK_BRANDING);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchTenantMetadata();

    return () => {
      cancelled = true;
    };
  }, []);

  const isStudentPortal = tenantInfo?.portalMode === 'student';

  return (
    <TenantContext.Provider value={{ tenantInfo, loading, isStudentPortal }}>
      {children}
    </TenantContext.Provider>
  );
};

/**
 * Hook to access the current tenant's branding and configuration.
 *
 * @example
 * const { tenantInfo, isStudentPortal } = useTenant();
 * if (isStudentPortal) { ... }
 */
export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

export default TenantContext;
