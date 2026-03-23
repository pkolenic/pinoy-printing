import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import { AppError } from "../utils/errors";
import { logger } from '../utils/logging';
import {
  getIndex,
  getFavicon,
  getWellKnownNotFound
} from './static';


// 1. Mock internal dependencies
vi.mock('fs');
vi.mock('../constants/paths.js', () => ({ PUBLIC_DIR: '/public' }));
vi.mock('../utils/logging/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Site Controller', () => {
  let mockReq: any;
  let mockRes: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      path: '/favicon.ico',
      tenantConfig: { backend: { static: { favIcon: null } } }
    };

    // 2. Enhance mockRes to act like a Writable stream for .pipe()
    mockRes = {
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      sendFile: vi.fn(),
      setHeader: vi.fn(),
      on: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      emit: vi.fn().mockReturnThis(),
      write: vi.fn().mockReturnValue(true),
    };

    next = vi.fn();
    global.fetch = vi.fn();
  });

  describe('getIndex', () => {
    it('should send the index.html file', async () => {
      await getIndex(mockReq, mockRes, next);
      expect(mockRes.sendFile).toHaveBeenCalledWith(expect.stringContaining('index.html'));
    });
  });

  describe('getFavicon', () => {
    it('should successfully pipe remote stream if fetch is ok', async () => {
      const mockStream = new ReadableStream();
      mockReq.tenantConfig.backend.static.favIcon = 'https://cdn.com';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        body: mockStream
      });

      await getFavicon(mockReq, mockRes, next);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      // No logger.error should have been called
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should fallback to image/x-icon if remote fetch has no content-type header', async () => {
      const mockStream = new ReadableStream();
      mockReq.tenantConfig.backend.static.favIcon = 'https://cdn.com';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        // Provide headers WITHOUT a content-type
        headers: new Headers({}),
        body: mockStream
      });

      await getFavicon(mockReq, mockRes, next);

      // This forces the ?? 'image/x-icon' branch
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/x-icon');
      expect(mockRes.on).toHaveBeenCalled(); // verified it proceeded to pipe
    });

    it('should use site directory if apple-touch-icon-precomposed.png is missing', async () => {
      mockReq.path = '/apple-touch-icon-precomposed.png';
      // Mock fs.existsSync to return false for the first check
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await getFavicon(mockReq, mockRes, next);

      expect(mockRes.sendFile).toHaveBeenCalledWith(
        expect.stringContaining('site/apple-touch-icon.png'),
        expect.any(Function)
      );
    });

    it('should successfully send local favicon and not call next', async () => {
      mockReq.path = '/favicon.ico';

      await getFavicon(mockReq, mockRes, next);

      // Extract the callback
      const sendFileArgs = vi.mocked(mockRes.sendFile).mock.calls[0];
      const callback = sendFileArgs[1] as Function;

      // Execute callback WITHOUT an error (success case)
      callback();

      // Verify next was never called, covering the "else" branch
      expect(next).not.toHaveBeenCalled();
    });

    it('should log error and fallback if remote fetch returns !ok', async () => {
      mockReq.tenantConfig.backend.static.favIcon = 'https://cdn.com';
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404
      });

      await getFavicon(mockReq, mockRes, next);

      expect(mockRes.sendFile).toHaveBeenCalled();
    });

    it('should log an error using the custom logger when fetch fails', async () => {
      const error = new Error('Network failure');
      const badUrl = 'https://broken.link';
      mockReq.tenantConfig.backend.static.favIcon = badUrl;
      (global.fetch as any).mockRejectedValue(error);

      await getFavicon(mockReq, mockRes, next);

      // Verify logger was used instead of console.error
      expect(logger.error).toHaveBeenCalledWith({
        message: expect.stringContaining(`Remote icon fetch failed: ${badUrl}`),
        args: [error],
      });

      // Ensure it still attempted the local fallback
      expect(mockRes.sendFile).toHaveBeenCalled();
    });

    it('should call next with AppError if res.sendFile fails', async () => {
      await getFavicon(mockReq, mockRes, next);

      // Extract the anonymous callback passed to sendFile
      const sendFileArgs = vi.mocked(mockRes.sendFile).mock.calls[0];
      const callback = sendFileArgs[1] as Function;

      // Manually trigger the error branch
      const error = new Error('File read error');
      callback(error);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Resource not found',
        statusCode: StatusCodes.NOT_FOUND
      }));
    });
  });

  describe('getWellKnownNotFound', () => {
    it('should return a silent 404', async () => {
      await getWellKnownNotFound(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
    });
  });
});
