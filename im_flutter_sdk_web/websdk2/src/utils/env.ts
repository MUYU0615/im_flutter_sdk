/**
 * 运行时环境判断
 */

export const isUniAppRuntime = (): boolean => {
  const globalValue = globalThis as typeof globalThis & {
    uni?: unknown;
    __uniConfig?: unknown;
  };
  return typeof globalValue.__uniConfig !== 'undefined'
    || typeof globalValue.uni !== 'undefined';
};
