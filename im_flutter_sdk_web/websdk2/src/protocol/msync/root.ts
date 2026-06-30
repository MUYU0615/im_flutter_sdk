/**
 * MSync protobuf Root 单例
 */

import type { Root } from 'protobufjs/light';
import { getStaticProtoRoot } from '../../platform/proto/static-proto-adapter';

let cachedRoot: Root | null = null;

export function getMsyncRoot(): Root {
  if (!cachedRoot) {
    cachedRoot = getStaticProtoRoot();
  }
  return cachedRoot;
}
