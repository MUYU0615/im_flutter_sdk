export interface TestDataScope {
  readonly scopeId: string;
  readonly accountAlias: string;
  readonly conversationPrefix: string;
  readonly cleanupPolicy: 'after_each' | 'after_suite';
  readonly parallelSlot: number;
}

export const buildScopeId = (name: string, parallelSlot: number): string => {
  return `${name}-${parallelSlot}`;
};

export const createTestDataScope = (
  name: string,
  parallelSlot: number,
  cleanupPolicy: TestDataScope['cleanupPolicy']
): TestDataScope => {
  const scopeId = buildScopeId(name, parallelSlot);
  return {
    scopeId,
    accountAlias: `acct-${scopeId}`,
    conversationPrefix: `case-${scopeId}`,
    cleanupPolicy,
    parallelSlot,
  };
};

export const buildScopedMessage = (scope: TestDataScope, message: string): string => {
  return `[${scope.conversationPrefix}] ${message}`;
};
