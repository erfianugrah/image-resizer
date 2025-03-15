import { vi, beforeEach } from 'vitest';

// Mock caches API (global in Cloudflare Workers)
const mockCaches = {
  default: {
    match: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
};

vi.stubGlobal('caches', mockCaches);

// Mock fetch API with a mock function
const mockFetch = vi
  .fn()
  .mockImplementation(() => Promise.resolve(new Response('Test response', { status: 200 })));
vi.stubGlobal('fetch', mockFetch);

// Mock performance API
vi.stubGlobal('performance', {
  now: () => 1000,
});

// Create ExecutionContext mock that can be used in tests
export class MockExecutionContext {
  waitUntil = vi.fn();
  passThroughOnException = vi.fn();
}

// Reset all mocks before each test
beforeEach(() => {
  vi.resetAllMocks();

  // Reset mockFetch implementation
  mockFetch.mockImplementation(() =>
    Promise.resolve(new Response('Test response', { status: 200 }))
  );
});
