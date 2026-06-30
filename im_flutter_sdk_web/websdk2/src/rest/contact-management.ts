import { isRecord } from '../cache/cache-utils';
import { parseAppKey } from '../upload/utils';
import { ERROR_CODES } from '../utils/error-codes';
import { ValidationError } from '../utils/errors';
import type { RestClient } from './client';
import type {
  AddContactParams,
  BlocklistAddResult,
  BlocklistMutationParams,
  Contact,
  ContactMutationTarget,
  SetContactRemarkParams,
} from '../types/contact';
import type { RestContext } from '../types/chat-client';
import type { UserInfo } from '../types/user-info';

interface StringArrayEnvelope {
  readonly data?: ReadonlyArray<unknown>;
}

interface ContactCursorEnvelope {
  readonly data?: {
    readonly cursor?: unknown;
    readonly contacts?: ReadonlyArray<unknown>;
    readonly entities?: ReadonlyArray<unknown>;
  };
  readonly cursor?: unknown;
  readonly contacts?: ReadonlyArray<unknown>;
  readonly entities?: ReadonlyArray<unknown>;
}

interface ServerPagedContact {
  readonly username?: unknown;
  readonly userId?: unknown;
  readonly name?: unknown;
  readonly remark?: unknown;
}

interface GetContactListParams {
  readonly pageSize?: number;
  readonly cursor?: string;
}

interface ContactListPage {
  readonly cursor: string;
  readonly contacts: ReadonlyArray<Contact>;
}

const buildContactEndpointContext = (context: RestContext): {
  readonly orgName: string;
  readonly appName: string;
  readonly encodedUserId: string;
  readonly encodedResource: string;
} => {
  const { orgName, appName } = parseAppKey(context.appKey);
  return {
    orgName,
    appName,
    encodedUserId: encodeURIComponent(context.userId),
    encodedResource: encodeURIComponent(context.clientResource),
  };
};

const readStringArray = (payload: unknown): ReadonlyArray<string> => {
  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
  if (Array.isArray(payload)) {
    return payload.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
  return [];
};

export const dedupeUserIds = (userIds: ReadonlyArray<string>): ReadonlyArray<string> => {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const userId of userIds) {
    if (!userId || seen.has(userId)) {
      continue;
    }
    seen.add(userId);
    result.push(userId);
  }
  return result;
};

export const normalizeBlocklistEntries = (payload: unknown): ReadonlyArray<UserInfo> => {
  return readStringArray(payload).map(userId => ({ userId }));
};

export const normalizeBlocklistAddResult = (payload: unknown): BlocklistAddResult => {
  const succeeded = readStringArray(payload).map(userId => ({ userId }));
  return {
    succeeded,
    failed: [],
  };
};

export const normalizeContactListPage = (
  payload: unknown,
  existingContacts: ReadonlyMap<string, Contact>
): ContactListPage => {
  const envelope = isRecord(payload) ? (payload as ContactCursorEnvelope) : undefined;
  const data = envelope && isRecord(envelope.data) ? envelope.data : undefined;
  const rawContacts =
    (Array.isArray(data?.contacts) ? data.contacts : undefined) ??
    (Array.isArray(data?.entities) ? data.entities : undefined) ??
    (Array.isArray(envelope?.contacts) ? envelope.contacts : undefined) ??
    (Array.isArray(envelope?.entities) ? envelope.entities : undefined) ??
    [];
  const contacts = rawContacts
    .filter((item): item is ServerPagedContact => isRecord(item))
    .map(item => {
      const userId =
        typeof item.username === 'string'
          ? item.username.trim()
          : typeof item.userId === 'string'
            ? item.userId.trim()
            : typeof item.name === 'string'
              ? item.name.trim()
              : '';
      if (!userId) {
        return null;
      }
      const remark = typeof item.remark === 'string' ? item.remark : '';
      const existing = existingContacts.get(userId);
      return {
        userId,
        userInfo: existing?.userInfo ?? {
          userId,
        },
        remark,
        addTs: existing?.addTs ?? 0,
      };
    })
    .filter(
      (item): item is ContactListPage['contacts'][number] =>
        item !== null
    );

  return {
    cursor:
      typeof data?.cursor === 'string'
        ? data.cursor
        : typeof envelope?.cursor === 'string'
          ? envelope.cursor
          : '',
    contacts,
  };
};

export const assertNormalizedUserIds = (
  params: BlocklistMutationParams,
  path: string
): ReadonlyArray<string> => {
  if (!Array.isArray(params.userIds) || params.userIds.length === 0) {
    throw new ValidationError(`${path} is required`, {
      code: ERROR_CODES.VALIDATION_REQUIRED,
      details: {
        fields: [
          {
            path,
            message: `${path} is required`,
            rule: 'required',
          },
        ],
      },
    });
  }

  const normalized = params.userIds.map((userId, index) => {
    if (typeof userId !== 'string') {
      throw new ValidationError(`${path}[${index}] must be a string`, {
        code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
        details: {
          fields: [
            {
              path: `${path}[${index}]`,
              message: 'userId must be a string',
              rule: 'invalid_format',
            },
          ],
        },
      });
    }
    return userId.trim();
  });

  const deduped = dedupeUserIds(normalized);
  if (deduped.length === 0) {
    throw new ValidationError(`${path} is required`, {
      code: ERROR_CODES.VALIDATION_REQUIRED,
      details: {
        fields: [
          {
            path,
            message: `${path} is required`,
            rule: 'required',
          },
        ],
      },
    });
  }

  if (deduped.length !== normalized.length && isRecord(params)) {
    void params;
  }

  return deduped;
};

export const requestAddContact = async (
  client: RestClient,
  context: RestContext,
  params: AddContactParams
): Promise<void> => {
  const endpointContext = buildContactEndpointContext(context);
  const endpoint = `/${endpointContext.orgName}/${endpointContext.appName}/users/${endpointContext.encodedUserId}/contacts/apply?resource=${endpointContext.encodedResource}`;
  await client.post<unknown>(
    endpoint,
    {
      usernames: [params.userId],
      reason: params.message ?? '',
    },
    {
      operation: 'addContact',
    }
  );
};

export const requestDeleteContact = async (
  client: RestClient,
  context: RestContext,
  params: ContactMutationTarget
): Promise<void> => {
  const endpointContext = buildContactEndpointContext(context);
  const endpoint = `/${endpointContext.orgName}/${endpointContext.appName}/users/${endpointContext.encodedUserId}/contacts/users/${encodeURIComponent(params.userId)}?resource=${endpointContext.encodedResource}`;
  await client.delete<unknown>(endpoint, {
    operation: 'deleteContact',
  });
};

export const requestAcceptContactInvite = async (
  client: RestClient,
  context: RestContext,
  params: ContactMutationTarget
): Promise<void> => {
  const endpointContext = buildContactEndpointContext(context);
  const endpoint = `/${endpointContext.orgName}/${endpointContext.appName}/users/${endpointContext.encodedUserId}/contacts/accept/users/${encodeURIComponent(params.userId)}?resource=${endpointContext.encodedResource}`;
  await client.post<unknown>(endpoint, undefined, {
    operation: 'acceptContactInvite',
  });
};

export const requestDeclineContactInvite = async (
  client: RestClient,
  context: RestContext,
  params: ContactMutationTarget
): Promise<void> => {
  const endpointContext = buildContactEndpointContext(context);
  const endpoint = `/${endpointContext.orgName}/${endpointContext.appName}/users/${endpointContext.encodedUserId}/contacts/decline/users/${encodeURIComponent(params.userId)}?resource=${endpointContext.encodedResource}`;
  await client.post<unknown>(endpoint, undefined, {
    operation: 'declineContactInvite',
  });
};

export const requestSetContactRemark = async (
  client: RestClient,
  context: RestContext,
  params: SetContactRemarkParams
): Promise<void> => {
  const endpointContext = buildContactEndpointContext(context);
  const endpoint = `/${endpointContext.orgName}/${endpointContext.appName}/users/${endpointContext.encodedUserId}/contacts/users/${encodeURIComponent(params.userId)}?resource=${endpointContext.encodedResource}`;
  await client.put<unknown>(
    endpoint,
    {
      remark: params.remark,
    },
    {
      operation: 'setContactRemark',
    }
  );
};

export const requestGetBlocklist = async (
  client: RestClient,
  context: RestContext
): Promise<ReadonlyArray<UserInfo>> => {
  const endpointContext = buildContactEndpointContext(context);
  const endpoint = `/${endpointContext.orgName}/${endpointContext.appName}/users/${endpointContext.encodedUserId}/blocks/users`;
  const response = await client.get<StringArrayEnvelope>(endpoint, {
    operation: 'getBlocklist',
  });
  return normalizeBlocklistEntries(response);
};

export const requestGetContactList = async (
  client: RestClient,
  context: RestContext,
  params: GetContactListParams,
  existingContacts: ReadonlyMap<string, Contact>
): Promise<ContactListPage> => {
  const endpointContext = buildContactEndpointContext(context);
  const pageSize = params.pageSize ?? 20;
  const cursor = params.cursor ?? '';
  const endpoint =
    `/${endpointContext.orgName}/${endpointContext.appName}/users/${endpointContext.encodedUserId}` +
    `/contacts?needReturnRemark=true&limit=${pageSize}&cursor=${encodeURIComponent(cursor)}`;
  const response = await client.get<unknown>(endpoint, {
    operation: 'getContactList',
  });
  return normalizeContactListPage(response, existingContacts);
};

export const requestAddUsersToBlocklist = async (
  client: RestClient,
  context: RestContext,
  userIds: ReadonlyArray<string>
): Promise<BlocklistAddResult> => {
  const endpointContext = buildContactEndpointContext(context);
  const endpoint = `/${endpointContext.orgName}/${endpointContext.appName}/sdk/user/${endpointContext.encodedUserId}/blocks?resource=${endpointContext.encodedResource}`;
  const response = await client.post<unknown>(
    endpoint,
    {
      usernames: userIds,
    },
    {
      operation: 'addUsersToBlocklist',
    }
  );
  return normalizeBlocklistAddResult(response);
};

export const requestRemoveUsersFromBlocklist = async (
  client: RestClient,
  context: RestContext,
  userIds: ReadonlyArray<string>
): Promise<void> => {
  const endpointContext = buildContactEndpointContext(context);
  const endpoint = `/${endpointContext.orgName}/${endpointContext.appName}/sdk/user/${endpointContext.encodedUserId}/blocks?resource=${endpointContext.encodedResource}`;
  await client.request<unknown>(endpoint, {
    method: 'DELETE',
    body: {
      usernames: userIds,
    },
    operation: 'removeUserFromBlocklist',
  });
};
