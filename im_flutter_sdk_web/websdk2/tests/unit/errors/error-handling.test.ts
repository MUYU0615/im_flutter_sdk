/**
 * 错误处理单元测试
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventHub } from '@/core/events/event-hub';
import { MessageSender } from '@/core/message/message-sender';
import { RestClient } from '@/rest/client';
import {
  CHAT_REST_ERROR_MAP,
  CHATROOM_REST_ERROR_MAP,
  CONTACT_REST_ERROR_MAP,
  GROUP_REST_ERROR_MAP,
} from '@/rest/error-maps';
import { MsyncCodec } from '@/protocol/msync/codec';
import { initConfigSchema } from '@/validators/chat-client';
import { Validator } from '@/validators/validator';
import { ERROR_CODES } from '@/utils/error-codes';
import {
  AuthenticationError,
  MessageSendError,
  RestBusinessError,
  RestTransportError,
  StorageError,
  ValidationError,
} from '@/utils/errors';
import type { Message } from '@/types';

describe('错误处理', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('参数缺失返回校验错误码与字段详情', () => {
    let error: unknown;
    try {
      Validator.validateOrThrow(initConfigSchema, {});
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ValidationError);
    const validationError = error as ValidationError;
    expect(validationError.code).toBe(ERROR_CODES.VALIDATION_REQUIRED);
    const fields = (validationError.details?.fields ?? []) as ReadonlyArray<{ path?: string }>;
    expect(fields).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'appKey' })]));
  });

  it('消息发送未连接返回消息错误码与 msgLocalId', async () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'user-1',
      token: 'token',
    });
    const sender = new MessageSender(codec, null, new EventHub());
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'local-1',
      from: '',
      to: '',
      sender: { userId: 'user-1' },
      conversationId: 'peer-1',
      conversationType: 'singleChat',
      type: 'text',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: { content: 'hi' },
    };

    let error: unknown;
    try {
      await sender.sendMessage(message);
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(MessageSendError);
    const sendError = error as MessageSendError;
    expect(sendError.code).toBe(ERROR_CODES.MESSAGE_NOT_CONNECTED);
    expect(sendError.details).toEqual(
      expect.objectContaining({
        msgLocalId: 'local-1',
        retryable: true,
      })
    );
  });

  it('REST 传输错误映射为网络错误码', async () => {
    const client = new RestClient('https://api.example.com');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));

    let error: unknown;
    try {
      await client.get('/users');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestTransportError);
    const transportError = error as RestTransportError;
    expect(transportError.code).toBe(ERROR_CODES.REST_NETWORK_ERROR);
    expect(transportError.details).toEqual(
      expect.objectContaining({
        url: 'https://api.example.com/users',
        method: 'GET',
      })
    );
  });

  it('存储错误默认映射为本地存储操作失败错误码', () => {
    const storageError = new StorageError('localStorage setItem failed');

    expect(storageError.code).toBe(ERROR_CODES.STORAGE_OPERATION_FAILED);
    expect(storageError.code).toBe(3);
    expect('STORAGE_DATABASE_ERROR' in ERROR_CODES).toBe(false);
  });

  it('REST 业务错误映射为 API 错误码', async () => {
    const client = new RestClient('https://api.example.com', {
      errorMap: CONTACT_REST_ERROR_MAP,
    });
    const payload = { error: 'USER_NOT_FOUND', code: 204, message: '用户不存在' };
    const response = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.get('/contacts', { operation: 'addContact' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(204);
    expect(businessError.message).toBe('REST business error: addContact failed');
    expect(businessError.message).not.toMatch(/[\u4e00-\u9fff]/);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'addContact',
        serverCode: 204,
        serverMessage: payload.message,
      })
    );
  });

  it('REST 业务错误应兼容 error_description 并透出 error 作为 serverCode', async () => {
    const client = new RestClient('https://api.example.com', {
      errorMap: CONTACT_REST_ERROR_MAP,
    });
    const payload = {
      error: 'illegal_argument',
      exception: 'InvalidParameterException',
      timestamp: 1774350803336,
      duration: 0,
      error_description: 'updateRemark | they are not friends, please add as a friend first.',
    };
    const response = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.put('/contacts/users/bob', { remark: 'x' }, { operation: 'setContactRemark' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.CONTACT_SET_REMARK_NOT_FRIEND);
    expect(businessError.message).toBe('REST business error: setContactRemark failed');
    expect(businessError.message).not.toMatch(/[\u4e00-\u9fff]/);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'setContactRemark',
        serverCode: 'illegal_argument',
        serverMessage: payload.error_description,
      })
    );
  });

  it('REST 未映射 400 错误应兜底为 ValidationError(110)', async () => {
    const client = new RestClient('https://api.example.com');
    const payload = {
      error: 'bad_request',
      error_description: 'unexpected bad request',
    };
    const response = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.post('/unknown', {}, { operation: 'unknownOperation' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ValidationError);
    const validationError = error as ValidationError;
    expect(validationError.code).toBe(ERROR_CODES.VALIDATION_UNKNOWN);
    expect(validationError.details).toEqual(
      expect.objectContaining({
        api: 'unknownOperation',
        serverCode: 'bad_request',
        serverMessage: payload.error_description,
        httpStatus: 400,
        canonicalCode: ERROR_CODES.VALIDATION_UNKNOWN,
      })
    );
  });

  it('REST 未映射 401 错误应兜底为 AuthenticationError(token expired)', async () => {
    const client = new RestClient('https://api.example.com');
    const payload = {
      error: 'unauthorized',
      error_description: 'token expired',
    };
    const response = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.get('/unknown');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(AuthenticationError);
    const authError = error as AuthenticationError;
    expect(authError.code).toBe(ERROR_CODES.AUTH_TOKEN_EXPIRED);
    expect(authError.details).toEqual(
      expect.objectContaining({
        serverCode: 'unauthorized',
        serverMessage: payload.error_description,
        httpStatus: 401,
        canonicalCode: ERROR_CODES.AUTH_TOKEN_EXPIRED,
      })
    );
  });

  it('REST 未映射 403 错误应兜底为 AuthenticationError(forbidden)', async () => {
    const client = new RestClient('https://api.example.com');
    const payload = {
      error: 'operation forbidden',
      error_description: 'service not enabled',
    };
    const response = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.get('/unknown');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(AuthenticationError);
    const authError = error as AuthenticationError;
    expect(authError.code).toBe(ERROR_CODES.AUTH_FORBIDDEN);
    expect(authError.details).toEqual(
      expect.objectContaining({
        serverCode: 'operation forbidden',
        serverMessage: payload.error_description,
        httpStatus: 403,
        canonicalCode: ERROR_CODES.AUTH_FORBIDDEN,
      })
    );
  });

  it('REST 未映射 429 错误应兜底为 SERVICE_LIMIT_EXCEEDED', async () => {
    const client = new RestClient('https://api.example.com');
    const payload = {
      error: 'too_many_requests',
      error_description: 'request rate limit exceeded',
    };
    const response = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.post('/unknown', {}, { operation: 'unknownOperation' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.SERVICE_LIMIT_EXCEEDED);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'unknownOperation',
        serverCode: 'too_many_requests',
        serverMessage: payload.error_description,
        httpStatus: 429,
        retryable: true,
        canonicalCode: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
      })
    );
  });

  it('REST 未映射 500 错误应兜底为 REST_BUSINESS_UNKNOWN', async () => {
    const client = new RestClient('https://api.example.com');
    const payload = {
      error: 'service_exception',
      error_description: 'internal server error',
    };
    const response = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.post('/unknown', {}, { operation: 'unknownOperation' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.REST_BUSINESS_UNKNOWN);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'unknownOperation',
        serverCode: 'service_exception',
        serverMessage: payload.error_description,
        httpStatus: 500,
        retryable: true,
        canonicalCode: ERROR_CODES.REST_BUSINESS_UNKNOWN,
      })
    );
  });

  it('REST 业务错误应支持 error_code 映射置顶类服务端错误码', async () => {
    const client = new RestClient('https://api.example.com', { errorMap: CHAT_REST_ERROR_MAP });
    const payload = {
      error: 'service_exception',
      error_code: 91101,
      error_description: 'pin message limit reached',
    };
    const response = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.post('/pin', {}, { operation: 'pinMessage' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.SERVICE_LIMIT_EXCEEDED);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'pinMessage',
        mapped: true,
        serverCode: 91101,
        serverMessage: payload.error_description,
        httpStatus: 403,
        canonicalCode: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
      })
    );
  });

  it('REST 业务错误应将服务端置顶不存在错误码收敛为参数错误码', async () => {
    const client = new RestClient('https://api.example.com', { errorMap: CHAT_REST_ERROR_MAP });
    const payload = {
      error: 'service_exception',
      error_code: 91102,
      error_description: 'pin message not found',
    };
    const response = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.delete('/pin', { operation: 'unpinMessage' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.VALIDATION_UNKNOWN);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'unpinMessage',
        mapped: true,
        serverCode: 91102,
        serverMessage: payload.error_description,
        httpStatus: 403,
        canonicalCode: ERROR_CODES.VALIDATION_UNKNOWN,
      })
    );
  });

  it('REST 业务错误应将服务端置顶不支持错误码收敛为公开错误码', async () => {
    const client = new RestClient('https://api.example.com', { errorMap: CHAT_REST_ERROR_MAP });
    const payload = {
      error: 'service_exception',
      error_code: 15002,
      error_description: 'not support pinned messages',
    };
    const response = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.get('/pin', { operation: 'getPinnedMessageList' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.OPERATION_UNSUPPORTED);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'getPinnedMessageList',
        mapped: true,
        serverCode: 15002,
        serverMessage: payload.error_description,
        httpStatus: 403,
        canonicalCode: ERROR_CODES.OPERATION_UNSUPPORTED,
      })
    );
  });

  it('group createGroup 已映射业务错误应返回群组名称错误码与处理信息', async () => {
    const client = new RestClient('https://api.example.com', { errorMap: GROUP_REST_ERROR_MAP });
    const payload = {
      error: 'group_name_violation',
      error_description: 'XX is violation, please change it.',
    };
    const response = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.post('/chatgroups', {}, { operation: 'createGroup' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.GROUP_NAME_VIOLATION);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'createGroup',
        mapped: true,
        reasonKey: 'group_name_violation',
        serverCode: 'group_name_violation',
        serverMessage: payload.error_description,
        httpStatus: 403,
        canonicalCode: ERROR_CODES.GROUP_NAME_VIOLATION,
      })
    );
  });

  it('group getGroupInfo 已映射业务错误应返回群组不存在错误码', async () => {
    const client = new RestClient('https://api.example.com', { errorMap: GROUP_REST_ERROR_MAP });
    const payload = {
      error: 'resource_not_found',
      error_description: 'group does not exist',
    };
    const response = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.get('/chatgroups/g1', { operation: 'getGroupInfo' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.GROUP_NOT_EXIST);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'getGroupInfo',
        mapped: true,
        reasonKey: 'resource_not_found',
        serverCode: 'resource_not_found',
        serverMessage: payload.error_description,
        httpStatus: 404,
        canonicalCode: ERROR_CODES.GROUP_NOT_EXIST,
      })
    );
  });

  it('group inviteUsersToGroup 已映射业务错误应返回群权限错误码', async () => {
    const client = new RestClient('https://api.example.com', { errorMap: GROUP_REST_ERROR_MAP });
    const payload = {
      error: 'group_authorization',
      error_description: 'not allowed to invite users',
    };
    const response = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.post('/chatgroups/g1/invite', {}, { operation: 'inviteUsersToGroup' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.GROUP_PERMISSION_DENIED);
    expect(businessError.message).toBe('REST business error: inviteUsersToGroup failed');
    expect(businessError.message).not.toMatch(/[\u4e00-\u9fff]/);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'inviteUsersToGroup',
        mapped: true,
        reasonKey: 'group_authorization',
        serverCode: 'group_authorization',
        serverMessage: payload.error_description,
        httpStatus: 400,
        canonicalCode: ERROR_CODES.GROUP_PERMISSION_DENIED,
      })
    );
  });

  it('group updateGroupInfo 已映射权限错误应返回英文运行时 message 并保留中文处理信息', async () => {
    const client = new RestClient('https://api.example.com', { errorMap: GROUP_REST_ERROR_MAP });
    const payload = {
      error: 'group_authorization',
      error_description:
        'you have no permission to do this,group fields require group admin privileges to be modified',
    };
    const response = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.put('/chatgroups/g1', { groupname: 'new name' }, { operation: 'updateGroupInfo' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.GROUP_PERMISSION_DENIED);
    expect(businessError.message).toBe('REST business error: updateGroupInfo failed');
    expect(businessError.message).not.toMatch(/[\u4e00-\u9fff]/);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'updateGroupInfo',
        mapped: true,
        reasonKey: 'group_authorization',
        serverCode: 'group_authorization',
        serverMessage: payload.error_description,
        httpStatus: 401,
        canonicalCode: ERROR_CODES.GROUP_PERMISSION_DENIED,
      })
    );
  });

  it('group updateGroupInfo 字段超限的 403 响应应映射为参数错误', async () => {
    const client = new RestClient('https://api.example.com', { errorMap: GROUP_REST_ERROR_MAP });
    const payload = {
      error: 'exceed_limit',
      timestamp: 1780655277647,
      duration: 1,
      properties: {},
      exception: 'com.easemob.group.exception.ExceedLimitException',
      error_description: 'title cannot exceed to 1024',
    };
    const response = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.put(
        '/chatgroups/g1',
        { description: 'x'.repeat(1025) },
        { operation: 'updateGroupInfo' }
      );
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.VALIDATION_UNKNOWN);
    expect(businessError.message).toBe('REST business error: updateGroupInfo failed');
    expect(businessError.message).not.toBe('Access forbidden');
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'updateGroupInfo',
        mapped: true,
        reasonKey: 'exceed_limit',
        serverCode: 'exceed_limit',
        serverMessage: payload.error_description,
        httpStatus: 403,
        canonicalCode: ERROR_CODES.VALIDATION_UNKNOWN,
      })
    );
  });

  it('默认 RestClient 不应携带 API 专属错误映射', async () => {
    const client = new RestClient('https://api.example.com');
    const payload = {
      error: 'exceed_limit',
      error_description: 'title cannot exceed to 1024',
    };
    const response = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.put('/chatgroups/g1', {}, { operation: 'updateGroupInfo' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(AuthenticationError);
    const authError = error as AuthenticationError;
    expect(authError.code).toBe(ERROR_CODES.AUTH_FORBIDDEN);
    expect(authError.details).toEqual(
      expect.objectContaining({
        api: 'updateGroupInfo',
        mapped: false,
        serverCode: 'exceed_limit',
        serverMessage: payload.error_description,
        httpStatus: 403,
        canonicalCode: ERROR_CODES.AUTH_FORBIDDEN,
      })
    );
  });

  it.each([
    {
      reasonKey: 'attributes_reach_limit',
      code: ERROR_CODES.GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT,
    },
    {
      reasonKey: 'attributes_update_failed',
      code: ERROR_CODES.GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED,
    },
    {
      reasonKey: 'attributes_key_reach_limit',
      code: ERROR_CODES.GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT,
    },
    {
      reasonKey: 'attributes_value_reach_limit',
      code: ERROR_CODES.GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT,
    },
  ])(
    'group setGroupMemberAttributes 应映射 $reasonKey 到稳定业务错误码',
    async ({ reasonKey, code }) => {
      const client = new RestClient('https://api.example.com', { errorMap: GROUP_REST_ERROR_MAP });
      const payload = {
        error: reasonKey,
        error_description: `${reasonKey} happened`,
      };
      const response = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: vi.fn().mockResolvedValue(payload),
        text: vi.fn().mockResolvedValue(''),
        headers: new Headers({ 'content-type': 'application/json' }),
      } as unknown as Response;

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

      let error: unknown;
      try {
        await client.post(
          '/sdk/metadata/chatgroup/g1/user/bob',
          {},
          {
            operation: 'setGroupMemberAttributes',
          }
        );
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(RestBusinessError);
      const businessError = error as RestBusinessError;
      expect(businessError.code).toBe(code);
      expect(businessError.details).toEqual(
        expect.objectContaining({
          api: 'setGroupMemberAttributes',
          mapped: true,
          reasonKey,
          serverCode: reasonKey,
          serverMessage: payload.error_description,
          httpStatus: 400,
          canonicalCode: code,
        })
      );
    }
  );

  it('chatroom 已映射业务错误应返回稳定 SDKError，并保留结构化映射信息', async () => {
    const client = new RestClient('https://api.example.com', { errorMap: CHATROOM_REST_ERROR_MAP });
    const payload = {
      error: 'resource_not_found',
      error_description: 'grpID r1 does not exist!',
    };
    const response = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.get('/chatrooms/r1', { operation: 'getChatRoomInfo' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(606);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'getChatRoomInfo',
        mapped: true,
        reasonKey: 'resource_not_found',
        serverCode: 'resource_not_found',
        serverMessage: 'grpID r1 does not exist!',
        httpStatus: 404,
        canonicalCode: 606,
      })
    );
  });

  it('未映射 chatroom 业务错误应保持 RestBusinessError，并以 303 兼容返回', async () => {
    const client = new RestClient('https://api.example.com', { errorMap: CHATROOM_REST_ERROR_MAP });
    const payload = {
      error: 'chatroom_new_error',
      error_description: 'new upstream error',
    };
    const response = {
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: vi.fn().mockResolvedValue(payload),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as unknown as Response;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    let error: unknown;
    try {
      await client.post(
        '/chatrooms/r1/announcement',
        {},
        { operation: 'updateChatRoomAnnouncement' }
      );
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(RestBusinessError);
    const businessError = error as RestBusinessError;
    expect(businessError.code).toBe(ERROR_CODES.REST_BUSINESS_UNKNOWN);
    expect(businessError.details).toEqual(
      expect.objectContaining({
        api: 'updateChatRoomAnnouncement',
        mapped: false,
        reasonKey: 'chatroom_new_error',
        serverCode: 'chatroom_new_error',
        serverMessage: 'new upstream error',
        httpStatus: 409,
      })
    );
  });
});
