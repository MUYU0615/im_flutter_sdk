export type MockScenarioId =
  | 'NORMAL_FLOW'
  | 'MOCK_PROVISION_REJECTED'
  | 'MOCK_TIMEOUT_DISCONNECT'
  | 'MOCK_OUTOFORDER_DUPLICATE'
  | 'MOCK_INVALID_PAYLOAD';

export interface MockScenarioDefinition {
  readonly id: MockScenarioId;
  readonly description: string;
  readonly responseType: 'normal' | 'timeout' | 'disconnect' | 'protobuf' | 'invalid_payload';
}

export const MOCK_SCENARIO_MAP: Readonly<Record<MockScenarioId, MockScenarioDefinition>> = {
  NORMAL_FLOW: {
    id: 'NORMAL_FLOW',
    description: '模拟正常 protobuf 收发链路',
    responseType: 'normal',
  },
  MOCK_PROVISION_REJECTED: {
    id: 'MOCK_PROVISION_REJECTED',
    description: '模拟 provision 鉴权失败',
    responseType: 'protobuf',
  },
  MOCK_TIMEOUT_DISCONNECT: {
    id: 'MOCK_TIMEOUT_DISCONNECT',
    description: '模拟超时与断连异常',
    responseType: 'timeout',
  },
  MOCK_OUTOFORDER_DUPLICATE: {
    id: 'MOCK_OUTOFORDER_DUPLICATE',
    description: '模拟 ACK 乱序与重复响应',
    responseType: 'protobuf',
  },
  MOCK_INVALID_PAYLOAD: {
    id: 'MOCK_INVALID_PAYLOAD',
    description: '模拟非法 protobuf 响应体',
    responseType: 'invalid_payload',
  },
};

export const getMockScenarioIds = (): ReadonlyArray<MockScenarioId> => {
  return Object.keys(MOCK_SCENARIO_MAP) as ReadonlyArray<MockScenarioId>;
};
