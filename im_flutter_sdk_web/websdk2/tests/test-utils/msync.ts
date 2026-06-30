import { getMsyncRoot } from '@/protocol/msync/root';
import { MsyncCommand, ProvisionErrorCode } from '@/protocol/msync/types';

export const buildProvisionResponse = (ok: boolean = true): Uint8Array => {
  const root = getMsyncRoot();
  const provisionType = root.lookupType('easemob.pb.Provision');
  const msyncType = root.lookupType('easemob.pb.MSync');
  const provisionPayload = provisionType.create({
    status: {
      errorCode: ok ? ProvisionErrorCode.OK : ProvisionErrorCode.FAIL,
      reason: ok ? '' : 'provision failed',
    },
    resource: ok ? 'mock-resource' : '',
  });
  const payload = provisionType.encode(provisionPayload).finish();
  const msyncMessage = msyncType.create({
    command: MsyncCommand.PROVISION,
    payload,
  });
  return msyncType.encode(msyncMessage).finish();
};
