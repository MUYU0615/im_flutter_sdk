#!/usr/bin/env node
// @ts-check

/**
 * Bulk create demo users and add them as contacts of `user1` (or a configured owner).
 *
 * Secrets must be provided through environment variables instead of being committed:
 * - EASEMOB_BULK_TOKEN: required bearer token
 * - EASEMOB_BULK_COOKIE: optional cookie header copied from the console
 * - EASEMOB_BULK_BASE_URL: optional API base url
 * - EASEMOB_BULK_ORIGIN: optional Origin header
 * - EASEMOB_BULK_REFERER: optional Referer header
 */

const DEFAULTS = {
  start: 4,
  end: 3000,
  concurrency: 5,
  timeoutMs: 15000,
  delayMs: 0,
  stopAfterConsecutive429: 0,
  userPrefix: 'user',
  friendOwner: 'user1',
  password: '1',
  nickname: 'easemob@easemob.com',
  source: 'NORMAL',
  baseUrl: 'https://im-console-hsb.easemob.com/easemob-demo/chatdemoui11',
  origin: 'https://console4-hsb.easemob.com',
  referer: 'https://console4-hsb.easemob.com/',
};

/**
 * @typedef {Object} CliOptions
 * @property {number} start
 * @property {number} end
 * @property {number} concurrency
 * @property {number} timeoutMs
 * @property {number} delayMs
 * @property {number} stopAfterConsecutive429
 * @property {string} userPrefix
 * @property {string} friendOwner
 * @property {string} password
 * @property {string} nickname
 * @property {string} source
 * @property {string} baseUrl
 * @property {string} origin
 * @property {string} referer
 * @property {boolean} dryRun
 * @property {boolean} continueOnError
 * @property {boolean} help
 * @property {string} token
 * @property {string} cookie
 */

/**
 * @typedef {Object} RequestResult
 * @property {boolean} ok
 * @property {number} status
 * @property {string} text
 * @property {unknown} data
 */

/**
 * @typedef {Object} Summary
 * @property {number} created
 * @property {number} createSkipped
 * @property {number} friended
 * @property {number} friendSkipped
 * @property {number} failed
 */

const BOOLEAN_FLAGS = new Set(['--dry-run', '--continue-on-error', '--help']);

/**
 * @typedef {Error & { status?: number, isLimitError?: boolean }} SeedError
 */

/**
 * @param {string} message
 * @returns {void}
 */
const writeStdout = message => {
  process.stdout.write(`${message}\n`);
};

/**
 * @param {string} message
 * @returns {void}
 */
const writeStderr = message => {
  process.stderr.write(`${message}\n`);
};

/** @returns {string} */
const usage = () => `Usage:
  EASEMOB_BULK_TOKEN=... node scripts/seed-demo-users.mjs [options]

Options:
  --start <number>             Start index, default: ${DEFAULTS.start}
  --end <number>               End index, default: ${DEFAULTS.end}
  --concurrency <number>       Parallel workers, default: ${DEFAULTS.concurrency}
  --timeout-ms <number>        Per-request timeout, default: ${DEFAULTS.timeoutMs}
  --delay-ms <number>          Delay after each user, default: ${DEFAULTS.delayMs}
  --stop-after-429 <number>    Stop after N consecutive 429 errors, default: ${DEFAULTS.stopAfterConsecutive429}
  --user-prefix <string>       Username prefix, default: ${DEFAULTS.userPrefix}
  --friend-owner <string>      Contact owner, default: ${DEFAULTS.friendOwner}
  --password <string>          Password for new users, default: ${DEFAULTS.password}
  --nickname <string>          Nickname for new users, default: ${DEFAULTS.nickname}
  --base-url <url>             API base url, default: ${DEFAULTS.baseUrl}
  --origin <url>               Origin header, default: ${DEFAULTS.origin}
  --referer <url>              Referer header, default: ${DEFAULTS.referer}
  --source <string>            source header, default: ${DEFAULTS.source}
  --dry-run                    Print planned work without calling the API
  --continue-on-error          Keep processing after per-user failures
  --help                       Show this message

Environment variables:
  EASEMOB_BULK_TOKEN           Required bearer token
  EASEMOB_BULK_COOKIE          Optional Cookie header value
  EASEMOB_BULK_BASE_URL        Optional default for --base-url
  EASEMOB_BULK_ORIGIN          Optional default for --origin
  EASEMOB_BULK_REFERER         Optional default for --referer

Examples:
  EASEMOB_BULK_TOKEN=... node scripts/seed-demo-users.mjs
  EASEMOB_BULK_TOKEN=... node scripts/seed-demo-users.mjs --start 4 --end 100 --concurrency 10
  EASEMOB_BULK_TOKEN=... EASEMOB_BULK_COOKIE='...' node scripts/seed-demo-users.mjs --continue-on-error`;

/**
 * @param {string | undefined} value
 * @param {string} flagName
 * @returns {number}
 */
const parseInteger = (value, flagName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid value for ${flagName}: ${value ?? ''}`);
  }
  return parsed;
};

/**
 * @param {string | undefined} value
 * @param {string} flagName
 * @returns {number}
 */
const parseNonNegativeInteger = (value, flagName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid value for ${flagName}: ${value ?? ''}`);
  }
  return parsed;
};

/**
 * @param {number} delayMs
 * @returns {Promise<void>}
 */
const sleep = async delayMs =>
  new Promise(resolve => {
    setTimeout(resolve, delayMs);
  });

/**
 * @param {ReadonlyArray<string>} argv
 * @returns {CliOptions}
 */
const parseArgs = argv => {
  /** @type {Record<string, string | boolean>} */
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (BOOLEAN_FLAGS.has(arg)) {
      parsed[arg] = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    parsed[arg] = nextValue;
    index += 1;
  }

  const options = {
    start: parseInteger(String(parsed['--start'] ?? DEFAULTS.start), '--start'),
    end: parseInteger(String(parsed['--end'] ?? DEFAULTS.end), '--end'),
    concurrency: parseInteger(
      String(parsed['--concurrency'] ?? DEFAULTS.concurrency),
      '--concurrency'
    ),
    timeoutMs: parseInteger(
      String(parsed['--timeout-ms'] ?? DEFAULTS.timeoutMs),
      '--timeout-ms'
    ),
    delayMs: parseNonNegativeInteger(
      String(parsed['--delay-ms'] ?? DEFAULTS.delayMs),
      '--delay-ms'
    ),
    stopAfterConsecutive429: parseNonNegativeInteger(
      String(parsed['--stop-after-429'] ?? DEFAULTS.stopAfterConsecutive429),
      '--stop-after-429'
    ),
    userPrefix: String(parsed['--user-prefix'] ?? DEFAULTS.userPrefix),
    friendOwner: String(parsed['--friend-owner'] ?? DEFAULTS.friendOwner),
    password: String(parsed['--password'] ?? DEFAULTS.password),
    nickname: String(parsed['--nickname'] ?? DEFAULTS.nickname),
    source: String(parsed['--source'] ?? DEFAULTS.source),
    baseUrl: String(
      parsed['--base-url'] ?? process.env.EASEMOB_BULK_BASE_URL ?? DEFAULTS.baseUrl
    ).replace(/\/+$/, ''),
    origin: String(parsed['--origin'] ?? process.env.EASEMOB_BULK_ORIGIN ?? DEFAULTS.origin),
    referer: String(
      parsed['--referer'] ?? process.env.EASEMOB_BULK_REFERER ?? DEFAULTS.referer
    ),
    dryRun: Boolean(parsed['--dry-run']),
    continueOnError: Boolean(parsed['--continue-on-error']),
    help: Boolean(parsed['--help']),
    token: (process.env.EASEMOB_BULK_TOKEN ?? '').trim(),
    cookie: (process.env.EASEMOB_BULK_COOKIE ?? '').trim(),
  };

  if (options.end < options.start) {
    throw new Error(`--end must be greater than or equal to --start`);
  }

  return options;
};

/**
 * @param {CliOptions} options
 * @returns {HeadersInit}
 */
const buildHeaders = options => {
  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${options.token}`,
    'Content-Type': 'application/json; charset=utf-8',
    Origin: options.origin,
    Referer: options.referer,
    source: options.source,
  };

  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  return headers;
};

/**
 * @param {CliOptions} options
 * @param {string} url
 * @param {RequestInit} init
 * @returns {Promise<RequestResult>}
 */
const request = async (options, url, init) => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  const text = await response.text();
  /** @type {unknown} */
  let data = null;
  if (text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    text,
    data,
  };
};

/**
 * @param {string} value
 * @returns {string}
 */
const normalizeErrorText = value => value.toLowerCase();

/**
 * @param {RequestResult} result
 * @returns {boolean}
 */
const isLimitResponse = result => {
  if (result.status !== 429) {
    return false;
  }

  const text = normalizeErrorText(result.text);
  return (
    text.includes('resource_limited') ||
    text.includes('reach_limit') ||
    text.includes('api limit') ||
    text.includes('community edition') ||
    text.includes('限流') ||
    text.includes('额度')
  );
};

/**
 * Heuristic idempotency handling because the console API error body may vary.
 *
 * @param {'create' | 'friend'} kind
 * @param {RequestResult} result
 * @returns {boolean}
 */
const isIgnorableConflict = (kind, result) => {
  if (result.status === 409) {
    return true;
  }

  const text = normalizeErrorText(result.text);
  const commonKeywords = [
    'already',
    'exist',
    'duplicate',
    'exists',
    'conflict',
    '\u5df2\u5b58\u5728',
    '\u91cd\u590d',
  ];
  const createKeywords = ['user already', 'username', 'duplicated', 'used'];
  const friendKeywords = ['contact', 'friend', '\u597d\u53cb', '\u8054\u7cfb\u4eba'];
  const keywords =
    kind === 'create'
      ? [...commonKeywords, ...createKeywords]
      : [...commonKeywords, ...friendKeywords];
  return keywords.some(keyword => text.includes(keyword));
};

/**
 * @param {CliOptions} options
 * @param {string} username
 * @returns {Promise<RequestResult>}
 */
const createUser = (options, username) =>
  request(options, `${options.baseUrl}/users`, {
    method: 'POST',
    headers: buildHeaders(options),
    body: JSON.stringify({
      username,
      password: options.password,
      nickname: options.nickname,
    }),
  });

/**
 * @param {CliOptions} options
 * @param {string} username
 * @returns {Promise<RequestResult>}
 */
const addFriend = (options, username) =>
  request(
    options,
    `${options.baseUrl}/users/${options.friendOwner}/contacts/users/${username}`,
    {
      method: 'POST',
      headers: buildHeaders(options),
    }
  );

/**
 * @param {string} username
 * @param {string} phase
 * @param {RequestResult} result
 * @returns {SeedError}
 */
const toRequestError = (username, phase, result) => {
  const error = /** @type {SeedError} */ (
    new Error(
      `${username} ${phase} failed with status ${result.status}: ${result.text || '<empty response>'}`
    )
  );
  error.status = result.status;
  error.isLimitError = isLimitResponse(result);
  return error;
};

/**
 * @param {number} index
 * @param {CliOptions} options
 * @param {Summary} summary
 * @returns {Promise<void>}
 */
const processSingleUser = async (index, options, summary) => {
  const username = `${options.userPrefix}${index}`;

  if (options.dryRun) {
    writeStdout(`[dry-run] would create ${username} and add it to ${options.friendOwner}`);
    summary.created += 1;
    summary.friended += 1;
    return;
  }

  const createResult = await createUser(options, username);
  let createState = 'created';
  if (createResult.ok) {
    summary.created += 1;
  } else if (isIgnorableConflict('create', createResult)) {
    createState = 'create-skipped(existing)';
    summary.createSkipped += 1;
  } else {
    summary.failed += 1;
    throw toRequestError(username, 'create', createResult);
  }

  const friendResult = await addFriend(options, username);
  let friendState = 'friend-added';
  if (friendResult.ok) {
    summary.friended += 1;
  } else if (isIgnorableConflict('friend', friendResult)) {
    friendState = 'friend-skipped(existing)';
    summary.friendSkipped += 1;
  } else {
    summary.failed += 1;
    throw toRequestError(username, 'add-friend', friendResult);
  }

  writeStdout(`[ok] ${username}: ${createState}, ${friendState}`);

  if (options.delayMs > 0) {
    await sleep(options.delayMs);
  }
};

/**
 * @param {CliOptions} options
 * @returns {Promise<Summary>}
 */
const runQueue = async options => {
  /** @type {Summary} */
  const summary = {
    created: 0,
    createSkipped: 0,
    friended: 0,
    friendSkipped: 0,
    failed: 0,
  };

  let cursor = options.start;
  let consecutive429 = 0;
  /** @type {SeedError | null} */
  let fatalError = null;

  const worker = async () => {
    while (true) {
      if (fatalError && !options.continueOnError) {
        return;
      }

      const current = cursor;
      cursor += 1;

      if (current > options.end) {
        return;
      }

      try {
        await processSingleUser(current, options, summary);
        consecutive429 = 0;
      } catch (error) {
        const normalized = /** @type {SeedError} */ (
          error instanceof Error ? error : new Error(String(error))
        );
        writeStderr(`[error] ${normalized.message}`);
        if (normalized.isLimitError) {
          consecutive429 += 1;
          if (
            options.stopAfterConsecutive429 > 0 &&
            consecutive429 >= options.stopAfterConsecutive429
          ) {
            fatalError = /** @type {SeedError} */ (
              new Error(
                `Hit ${consecutive429} consecutive 429 responses, stopping early to avoid useless retries.`
              )
            );
            return;
          }
        } else {
          consecutive429 = 0;
        }
        if (!options.continueOnError) {
          fatalError = normalized;
          return;
        }
      }
    }
  };

  const workerCount = Math.min(options.concurrency, options.end - options.start + 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (fatalError) {
    throw fatalError;
  }

  return summary;
};

/** @returns {Promise<void>} */
const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    writeStdout(usage());
    return;
  }

  if (!options.dryRun && !options.token) {
    throw new Error('Missing EASEMOB_BULK_TOKEN');
  }

  writeStdout(
    `Seeding ${options.userPrefix}${options.start}-${options.userPrefix}${options.end} -> ${options.friendOwner} (concurrency=${options.concurrency}, timeoutMs=${options.timeoutMs}, delayMs=${options.delayMs}, stopAfter429=${options.stopAfterConsecutive429}, dryRun=${options.dryRun ? 'true' : 'false'})`
  );

  const summary = await runQueue(options);
  writeStdout(
    `Summary: created=${summary.created}, createSkipped=${summary.createSkipped}, friended=${summary.friended}, friendSkipped=${summary.friendSkipped}, failed=${summary.failed}`
  );

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
};

main().catch(error => {
  writeStderr(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
