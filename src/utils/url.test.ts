import { it, expect, describe, afterEach, beforeEach } from 'vitest';

import { getProxiedServiceUrl, QuranFoundationService } from './url';

describe('getProxiedServiceUrl', () => {
  const originalWindow = global.window;

  afterEach(() => {
    // Restore window
    if (originalWindow !== undefined) {
      global.window = originalWindow;
    }
  });

  describe('when running server-side (typeof window === "undefined")', () => {
    beforeEach(() => {
      // @ts-ignore - simulate server-side environment
      delete global.window;
    });

    it('should call the staging API directly when not in production', () => {
      const url = getProxiedServiceUrl(
        QuranFoundationService.CONTENT,
        '/api/qdc/verses/by_chapter/1',
      );
      expect(url).toBe('https://staging.quran.com/api/qdc/verses/by_chapter/1');
    });

    it('should not route through the proxy', () => {
      const url = getProxiedServiceUrl(
        QuranFoundationService.CONTENT,
        '/api/qdc/verses/by_chapter/1',
      );
      expect(url).not.toContain('/api/proxy/');
    });
  });

  describe('when running client-side (typeof window !== "undefined")', () => {
    it('should route through the proxy', () => {
      // window is defined in jsdom test environment
      const url = getProxiedServiceUrl(
        QuranFoundationService.CONTENT,
        '/api/qdc/verses/by_chapter/1',
      );
      expect(url).toContain('/api/proxy/content/api/qdc/verses/by_chapter/1');
    });
  });
});
