/**
 * Roster protobuf Root 单例
 */

import Long from 'long';
import { Root, configure, util, type INamespace } from 'protobufjs/light';

import protoJson from './proto';

let longConfigured = false;
let cachedRoot: Root | null = null;

const ensureLongConfigured = (): void => {
  if (longConfigured) {
    return;
  }
  util.Long = Long;
  configure();
  longConfigured = true;
};

export const getRosterRoot = (): Root => {
  if (cachedRoot) {
    return cachedRoot;
  }
  ensureLongConfigured();
  cachedRoot = Root.fromJSON(protoJson as INamespace);
  return cachedRoot;
};
