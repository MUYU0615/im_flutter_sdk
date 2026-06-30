export type LayerId = 'unit' | 'protocol_integration' | 'e2e_browser' | 'smoke_real_env';
export type ScenarioCategory = 'happy_path' | 'error_path' | 'recovery';
export type ScenarioRiskLevel = 'high' | 'medium' | 'low';

export interface ScenarioItem {
  readonly scenarioId: string;
  readonly layerId: LayerId;
  readonly category: ScenarioCategory;
  readonly riskLevel: ScenarioRiskLevel;
  readonly description: string;
}

export const SCENARIO_CATALOG: ReadonlyArray<ScenarioItem> = [
  {
    scenarioId: 'NORMAL_FLOW',
    layerId: 'protocol_integration',
    category: 'happy_path',
    riskLevel: 'high',
    description: 'mock WebSocket protobuf 正常收发链路',
  },
  {
    scenarioId: 'MOCK_PROVISION_REJECTED',
    layerId: 'protocol_integration',
    category: 'error_path',
    riskLevel: 'high',
    description: 'mock provision 鉴权失败场景',
  },
  {
    scenarioId: 'REAL_CONNECT_AUTH_SEND_RECEIVE_ACK',
    layerId: 'smoke_real_env',
    category: 'happy_path',
    riskLevel: 'high',
    description: '真实环境 smoke 主链路：连接、鉴权、发送、接收、回执',
  },
  {
    scenarioId: 'REAL_ENV_UNREACHABLE_RETRY_BLOCK',
    layerId: 'smoke_real_env',
    category: 'error_path',
    riskLevel: 'high',
    description: '真实环境 smoke 不可达时重试后失败',
  },
  {
    scenarioId: 'MOCK_TIMEOUT_DISCONNECT',
    layerId: 'protocol_integration',
    category: 'error_path',
    riskLevel: 'high',
    description: 'mock 超时与断连异常场景',
  },
  {
    scenarioId: 'MOCK_OUTOFORDER_DUPLICATE',
    layerId: 'protocol_integration',
    category: 'error_path',
    riskLevel: 'high',
    description: 'mock 乱序与重复响应场景',
  },
  {
    scenarioId: 'MOCK_INVALID_PAYLOAD',
    layerId: 'protocol_integration',
    category: 'error_path',
    riskLevel: 'high',
    description: 'mock 非法响应与协议异常场景',
  },
  {
    scenarioId: 'E2E_REAL_INIT_LOGIN_CONNECT',
    layerId: 'e2e_browser',
    category: 'happy_path',
    riskLevel: 'high',
    description: '真实 demo 页面初始化、登录与连接主链路',
  },
  {
    scenarioId: 'E2E_REAL_INVALID_APPKEY_FAIL',
    layerId: 'e2e_browser',
    category: 'error_path',
    riskLevel: 'medium',
    description: '真实 demo 页面使用无效 AppKey 登录失败',
  },
  {
    scenarioId: 'E2E_REAL_SEND_TEXT_SUCCESS',
    layerId: 'e2e_browser',
    category: 'happy_path',
    riskLevel: 'high',
    description: '真实 demo 页面发送文本消息成功',
  },
  {
    scenarioId: 'E2E_REAL_LOGOUT',
    layerId: 'e2e_browser',
    category: 'happy_path',
    riskLevel: 'medium',
    description: '真实 demo 页面登录后登出恢复未连接状态',
  },
];

export const getScenariosByLayer = (layerId: LayerId): ReadonlyArray<ScenarioItem> => {
  return SCENARIO_CATALOG.filter(scenario => scenario.layerId === layerId);
};
