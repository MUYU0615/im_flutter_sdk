import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export interface MockRestRequest {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly headers: IncomingMessage['headers'];
  readonly rawBody: string;
  readonly jsonBody: unknown;
}

export interface MockRestResponse {
  readonly status?: number;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
}

type MockRestHandler = (request: MockRestRequest) => MockRestResponse | Promise<MockRestResponse>;

export interface MockRestServerController {
  readonly baseUrl: string;
  readonly requests: MockRestRequest[];
  on(method: string, path: string, handler: MockRestHandler): void;
  stop(): Promise<void>;
}

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  return await new Promise<string>((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += String(chunk);
    });
    request.on('end', () => {
      resolve(body);
    });
    request.on('error', reject);
  });
};

const parseJsonBody = (rawBody: string): unknown => {
  if (!rawBody) {
    return undefined;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return undefined;
  }
};

const sendResponse = (response: ServerResponse, payload: MockRestResponse): void => {
  const status = payload.status ?? 200;
  const headers = payload.headers ?? {};
  const body = payload.body;

  response.statusCode = status;
  for (const [key, value] of Object.entries(headers)) {
    response.setHeader(key, value);
  }

  if (body === undefined) {
    response.end();
    return;
  }

  if (typeof body === 'string') {
    if (!response.hasHeader('content-type')) {
      response.setHeader('content-type', 'text/plain; charset=utf-8');
    }
    response.end(body);
    return;
  }

  if (!response.hasHeader('content-type')) {
    response.setHeader('content-type', 'application/json; charset=utf-8');
  }
  response.end(JSON.stringify(body));
};

export const startMockRestServer = async (): Promise<MockRestServerController> => {
  const routes = new Map<string, MockRestHandler>();
  const requests: MockRestRequest[] = [];

  const handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const method = request.method ?? 'GET';
    const path = url.pathname;
    const routeKey = `${method.toUpperCase()} ${path}`;
    const handler = routes.get(routeKey);

    const rawBody = await readRequestBody(request);
    const mockRequest: MockRestRequest = {
      method,
      path,
      query: url.searchParams,
      headers: request.headers,
      rawBody,
      jsonBody: parseJsonBody(rawBody),
    };
    requests.push(mockRequest);

    if (!handler) {
      sendResponse(response, {
        status: 404,
        body: {
          error: `No mock route for ${routeKey}`,
        },
      });
      return;
    }

    try {
      const result = await handler(mockRequest);
      sendResponse(response, result);
    } catch (error) {
      sendResponse(response, {
        status: 500,
        body: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1');
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('mock rest server address unavailable');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    on(method: string, path: string, handler: MockRestHandler): void {
      routes.set(`${method.toUpperCase()} ${path}`, handler);
    },
    async stop(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
};
