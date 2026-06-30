#!/usr/bin/env node

// @ts-check
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import protobuf from 'protobufjs';
import { WebSocketServer } from 'ws';

/**
 * @typedef {import('node:http').IncomingMessage} IncomingMessage
 * @typedef {import('node:http').ServerResponse<IncomingMessage>} ServerResponse
 * @typedef {import('node:net').Socket} NetSocket
 * @typedef {Uint8Array | ArrayBuffer | Uint8Array[] | string} RawData
 * @typedef {{ readyState: number; send: (data: Uint8Array) => void; close: (code?: number, reason?: string) => void; on: (event: 'message', handler: (raw: RawData) => void) => void }} WsSocket
 * @typedef {{ on: (event: 'connection', handler: (socket: WsSocket) => void) => void; handleUpgrade: (request: IncomingMessage, socket: NetSocket, head: Buffer, callback: (socket: WsSocket) => void) => void; emit: (event: 'connection', socket: WsSocket, request: IncomingMessage) => void; close: (callback: () => void) => void; clients: Set<WsSocket> }} WsServerLike
 * @typedef {{ id?: string }} ScenarioRequestBody
 * @typedef {{ command?: number; payload?: Uint8Array }} MsyncEnvelope
 * @typedef {{ meta?: { id?: string | number | bigint | { toString: () => string }; from?: { name?: string } } }} CommSyncUlEnvelope
 * @typedef {{ toUserId: string; fromUserId: string; text: string }} DownlinkMessageInput
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const port = Number(process.env.MOCK_SERVER_PORT ?? 19360);
const wsPath = process.env.MOCK_SERVER_WS_PATH ?? '/websocket';

const SCENARIO = {
  NORMAL_FLOW: 'NORMAL_FLOW',
  MOCK_PROVISION_REJECTED: 'MOCK_PROVISION_REJECTED',
  MOCK_TIMEOUT_DISCONNECT: 'MOCK_TIMEOUT_DISCONNECT',
  MOCK_OUTOFORDER_DUPLICATE: 'MOCK_OUTOFORDER_DUPLICATE',
  MOCK_INVALID_PAYLOAD: 'MOCK_INVALID_PAYLOAD',
};

let currentScenario = process.env.MOCK_SCENARIO ?? SCENARIO.NORMAL_FLOW;

const protoJsonPath = resolve(__dirname, '../../src/protocol/msync/proto-source.json');
const protoJsonUnknown = /** @type {unknown} */ (JSON.parse(readFileSync(protoJsonPath, 'utf8')));
const protoJson = /** @type {import('protobufjs').INamespace} */ (protoJsonUnknown);
const root = protobuf.Root.fromJSON(protoJson);
const msyncType = root.lookupType('easemob.pb.MSync');
const provisionType = root.lookupType('easemob.pb.Provision');
const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
const messageBodyType = root.lookupType('easemob.pb.MessageBody');

const WS_OPEN = 1;

/**
 * @param {string} message
 * @returns {void}
 */
function writeStdout(message) {
  process.stdout.write(`${message}\n`);
}

/**
 * @returns {string}
 */
function nowId() {
  return String(Date.now());
}

/**
 * @param {string | number | bigint | { toString: () => string } | null | undefined} value
 * @returns {string}
 */
function toNumericString(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : '0';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value && typeof value === 'object') {
    if (typeof value.toString === 'function') {
      return value.toString();
    }
  }
  return '0';
}

/**
 * @param {number} command
 * @param {Uint8Array} payload
 * @returns {Uint8Array}
 */
function encodeMsyncEnvelope(command, payload) {
  const message = msyncType.create({
    version: 0,
    command,
    encryptType: [0],
    payload,
    traceId: nowId(),
  });
  return msyncType.encode(message).finish();
}

/** @returns {Uint8Array} */
function encodeProvisionSuccess() {
  const provision = provisionType.create({
    status: {
      errorCode: 0,
      reason: '',
    },
    resource: 'mock-resource',
    authToken: '{"token":"mock-token"}',
    protocolCompressType: [0],
    protocolCompressDirection: 2,
  });
  return provisionType.encode(provision).finish();
}

/** @returns {Uint8Array} */
function encodeProvisionRejected() {
  const provision = provisionType.create({
    status: {
      errorCode: 2,
      reason: 'mock unauthorized',
    },
    resource: '',
    authToken: '',
    protocolCompressType: [0],
    protocolCompressDirection: 2,
  });
  return provisionType.encode(provision).finish();
}

/**
 * @param {string} protocolId
 * @returns {Uint8Array}
 */
function encodeAckPayload(protocolId) {
  const ack = commSyncDlType.create({
    status: {
      errorCode: 0,
      reason: '',
    },
    metaId: protocolId,
    serverId: `9${protocolId}`,
    isLast: true,
  });
  return commSyncDlType.encode(ack).finish();
}

/**
 * @param {DownlinkMessageInput} input
 * @returns {Uint8Array}
 */
function encodeChatDownlinkPayload({ toUserId, fromUserId, text }) {
  const body = messageBodyType.create({
    type: 1,
    from: { name: fromUserId },
    to: { name: toUserId },
    contents: [
      {
        type: 0,
        text,
      },
    ],
    ext: [],
  });
  const bodyBytes = messageBodyType.encode(body).finish();

  const payload = commSyncDlType.create({
    status: {
      errorCode: 0,
      reason: '',
    },
    metas: [
      {
        id: nowId(),
        from: { name: fromUserId },
        to: { name: toUserId },
        timestamp: nowId(),
        ns: 1,
        payload: bodyBytes,
      },
    ],
    isLast: true,
  });

  return commSyncDlType.encode(payload).finish();
}

/**
 * @param {IncomingMessage} req
 * @returns {Promise<ScenarioRequestBody>}
 */
function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    req.on(
      'data',
      /** @param {Buffer | string} chunk */ chunk => {
        body += chunk.toString();
      }
    );
    req.on('end', () => {
      try {
        const parsedBody = body ? /** @type {unknown} */ (JSON.parse(body)) : {};
        resolveBody(
          parsedBody && typeof parsedBody === 'object'
            ? /** @type {ScenarioRequestBody} */ (parsedBody)
            : {}
        );
      } catch (error) {
        rejectBody(error);
      }
    });
    req.on('error', rejectBody);
  });
}

/**
 * @param {ServerResponse} res
 * @param {number} statusCode
 * @param {unknown} payload
 * @returns {void}
 */
function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

/**
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @returns {Promise<void>}
 */
async function handleHttpRequest(req, res) {
  const method = req.method ?? 'GET';
  const pathName = new URL(req.url ?? '/', `http://127.0.0.1:${port}`).pathname;

  if (method === 'GET' && pathName === '/health') {
    sendJson(res, 200, {
      ok: true,
      scenario: currentScenario,
      ws: {
        path: wsPath,
      },
    });
    return;
  }

  if (method === 'GET' && pathName === '/scenario') {
    sendJson(res, 200, { scenario: currentScenario });
    return;
  }

  if (method === 'POST' && pathName === '/scenario') {
    try {
      const body = await readJsonBody(req);
      if (typeof body.id !== 'string' || body.id.length === 0) {
        sendJson(res, 400, { error: 'invalid scenario id' });
        return;
      }
      currentScenario = body.id;
      sendJson(res, 200, { ok: true, scenario: currentScenario });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}

const httpServer = createServer((req, res) => {
  void handleHttpRequest(req, res);
});

// `ws` 在 `.mjs` 下的构造器类型信息不完整，这里收敛为本脚本实际使用的最小接口。
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const wsServer = /** @type {WsServerLike} */ (new WebSocketServer({ noServer: true }));

/**
 * @param {WsSocket} socket
 * @param {Uint8Array} data
 * @returns {void}
 */
function sendBinary(socket, data) {
  if (socket.readyState === WS_OPEN) {
    socket.send(data);
  }
}

/**
 * @param {RawData} raw
 * @returns {Uint8Array}
 */
function toUint8Array(raw) {
  if (raw instanceof Uint8Array) {
    return raw;
  }
  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw);
  }
  if (Array.isArray(raw)) {
    return new Uint8Array(Buffer.concat(raw));
  }
  if (typeof raw === 'string') {
    return new TextEncoder().encode(raw);
  }
  return new Uint8Array();
}

wsServer.on(
  'connection',
  /** @param {WsSocket} socket */ socket => {
    /** @type {{ bufferedProtocolIds: string[]; provisioned: boolean }} */
    const sessionState = {
      bufferedProtocolIds: [],
      provisioned: false,
    };

    socket.on(
      'message',
      /** @param {RawData} raw */ raw => {
        const data = toUint8Array(raw);

        if (currentScenario === SCENARIO.MOCK_INVALID_PAYLOAD) {
          sendBinary(socket, Buffer.from('@@INVALID_PROTO@@'));
          return;
        }

        /** @type {MsyncEnvelope} */
        let decoded;
        try {
          decoded = /** @type {MsyncEnvelope} */ (msyncType.decode(data));
        } catch {
          return;
        }

        const command = Number(decoded.command ?? -1);
        const payload = decoded.payload instanceof Uint8Array ? decoded.payload : new Uint8Array();

        if (command === 3) {
          const provisionPayload =
            currentScenario === SCENARIO.MOCK_PROVISION_REJECTED
              ? encodeProvisionRejected()
              : encodeProvisionSuccess();
          const provisionEnvelope = encodeMsyncEnvelope(3, provisionPayload);
          sessionState.provisioned = currentScenario !== SCENARIO.MOCK_PROVISION_REJECTED;
          sendBinary(socket, provisionEnvelope);
          return;
        }

        if (command !== 0 || !sessionState.provisioned) {
          return;
        }

        /** @type {CommSyncUlEnvelope} */
        let commSyncUl;
        try {
          commSyncUl = /** @type {CommSyncUlEnvelope} */ (commSyncUlType.decode(payload));
        } catch {
          return;
        }

        const protocolId = toNumericString(commSyncUl.meta?.id ?? '0');
        const clientUserId =
          typeof commSyncUl.meta?.from?.name === 'string'
            ? commSyncUl.meta.from.name
            : 'mock-client';

        if (!protocolId || protocolId === '0') {
          return;
        }

        if (currentScenario === SCENARIO.MOCK_TIMEOUT_DISCONNECT) {
          setTimeout(() => {
            if (socket.readyState === WS_OPEN) {
              socket.close(4002, 'sync_timeout_disconnect');
            }
          }, 2200);
          return;
        }

        if (currentScenario === SCENARIO.MOCK_OUTOFORDER_DUPLICATE) {
          sessionState.bufferedProtocolIds.push(protocolId);
          if (sessionState.bufferedProtocolIds.length >= 2) {
            const first = sessionState.bufferedProtocolIds[0];
            const second = sessionState.bufferedProtocolIds[1];

            const secondAck = encodeMsyncEnvelope(0, encodeAckPayload(second));
            const firstAck = encodeMsyncEnvelope(0, encodeAckPayload(first));

            sendBinary(socket, secondAck);
            setTimeout(() => {
              sendBinary(socket, firstAck);
            }, 25);
            setTimeout(() => {
              sendBinary(socket, secondAck);
            }, 50);

            sessionState.bufferedProtocolIds = [];
          }
          return;
        }

        const ackEnvelope = encodeMsyncEnvelope(0, encodeAckPayload(protocolId));
        sendBinary(socket, ackEnvelope);

        const chatPayload = encodeChatDownlinkPayload({
          toUserId: clientUserId,
          fromUserId: 'mock-peer',
          text: 'mock push message',
        });
        const chatEnvelope = encodeMsyncEnvelope(0, chatPayload);
        sendBinary(socket, chatEnvelope);
      }
    );
  }
);

httpServer.on('upgrade', (request, socket, head) => {
  const pathName = new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname;
  if (pathName !== wsPath) {
    socket.destroy();
    return;
  }
  wsServer.handleUpgrade(request, /** @type {NetSocket} */ (socket), head, wsSocket => {
    wsServer.emit('connection', wsSocket, request);
  });
});

httpServer.listen(port, '127.0.0.1', () => {
  writeStdout(`[mock-server] listening on http://127.0.0.1:${port}, ws path=${wsPath}`);
});

/** @returns {void} */
function shutdown() {
  wsServer.clients.forEach(client => {
    if (client.readyState === WS_OPEN) {
      client.close(1001, 'server_shutdown');
    }
  });
  wsServer.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
