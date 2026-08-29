import { describe, expect, it } from 'vitest';

import { safeStoredWebsite, toStoredWebsite } from '../modules/shared/webUrl.js';

describe('toStoredWebsite', () => {
  it('accepts http and https addresses', () => {
    expect(toStoredWebsite('https://serb.gov.in/power')).toBe('https://serb.gov.in/power');
    expect(toStoredWebsite(' http://dst.gov.in ')).toBe('http://dst.gov.in/');
  });

  it('treats an empty value as "no website"', () => {
    expect(toStoredWebsite('')).toBeNull();
    expect(toStoredWebsite(null)).toBeNull();
    expect(toStoredWebsite(undefined)).toBeNull();
  });

  it('rejects a script-bearing scheme', () => {
    expect(() => toStoredWebsite('javascript:alert(document.cookie)')).toThrowError(
      /http:\/\/ or https:\/\//,
    );
    expect(() => toStoredWebsite('data:text/html,<script>alert(1)</script>')).toThrowError(
      /http:\/\/ or https:\/\//,
    );
  });

  it('rejects a bare domain, which the browser would not treat as a URL', () => {
    expect(() => toStoredWebsite('dst.gov.in')).toThrowError(/valid website/);
  });

  it('answers 400 rather than a server fault', () => {
    expect.assertions(1);
    try {
      toStoredWebsite('javascript:void(0)');
    } catch (error) {
      expect(error.statusCode).toBe(400);
    }
  });

  it('drops a stored value that cannot be linked instead of throwing', () => {
    expect(safeStoredWebsite('javascript:alert(1)')).toBeNull();
    expect(safeStoredWebsite('https://ugc.gov.in')).toBe('https://ugc.gov.in/');
  });
});
