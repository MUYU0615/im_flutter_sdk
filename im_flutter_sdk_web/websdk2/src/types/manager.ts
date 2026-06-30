/**
 * Manager 类型定义
 */

import type { EventHandlerId, EventHandlerMap, EventName, EventPayloadMap } from './event-system';

export type ManagerCapability =
  | 'rawNotify:group'
  | 'rawNotify:chatroom'
  | 'rawNotify:contact'
  | 'rawNotify:chatThread'
  | 'rawNotify:userInfo'
  | 'userInfo:read'
  | 'group:namecard';

export type RawNotifyEvent =
  | {
      readonly type: 'group';
      readonly payload: unknown;
    }
  | {
      readonly type: 'chatroom';
      readonly payload: unknown;
    }
  | {
      readonly type: 'contact';
      readonly payload: unknown;
    }
  | {
      readonly type: 'chatThread';
      readonly payload: unknown;
    }
  | {
      readonly type: 'userInfo';
      readonly payload: unknown;
    };

/**
 * Manager 事件上下文
 */
export interface ManagerEventContext<Handlers = EventHandlerMap> {
  addEventHandler(id: EventHandlerId, handlers: Handlers): void;
  removeEventHandler(id: EventHandlerId): void;
  dispatch?<TName extends EventName>(eventName: TName, payload: EventPayloadMap[TName]): void;
}

/**
 * 管理器基础接口
 */
export interface ManagerBase<Client> {
  readonly capabilities?: ReadonlyArray<ManagerCapability>;
  bind(client: Client, context?: ManagerEventContext): void;
  handleRawNotify?(event: RawNotifyEvent): void | Promise<void>;
}

/**
 * 管理器构造器接口
 */
export interface ManagerConstructor<Client, Manager extends ManagerBase<Client>, Key extends string> {
  new (): Manager;
  readonly key: Key;
}

/**
 * 管理器实例类型（运行时要求 constructor.key 存在）
 */
export type ManagerInstance<Client> = ManagerBase<Client> & {
  readonly constructor: {
    readonly key?: string;
    readonly name?: string;
  };
};

/**
 * 管理器实例 key 类型
 */
export type ManagerInstanceKey<Client, Manager extends ManagerInstance<Client>> =
  Manager['constructor'] extends { readonly key: infer Key }
    ? Key & string
    : string;

/**
 * 管理器注册类型（构造器或实例）
 */
export type ManagerRegistration<Client> =
  | ManagerConstructor<Client, ManagerBase<Client>, string>
  | ManagerInstance<Client>;

/**
 * 扩展单个管理器后的客户端类型
 */
export type WithManager<Client, Key extends string, Manager extends ManagerBase<Client>> = Client & {
  readonly [P in Key]: Manager;
};

/**
 * 扩展多个管理器后的客户端类型
 */
export type WithManagers<Client, Items extends ReadonlyArray<ManagerRegistration<Client>>> = Client & {
  readonly [Item in Items[number] as ManagerKeyOf<Client, Item>]: ManagerInstanceOf<Client, Item>;
};

type ManagerKeyOf<Client, Item extends ManagerRegistration<Client>> =
  Item extends ManagerConstructor<Client, ManagerBase<Client>, infer Key>
    ? Key
    : Item extends ManagerInstance<Client>
      ? ManagerInstanceKey<Client, Item>
      : never;

type ManagerInstanceOf<Client, Item extends ManagerRegistration<Client>> =
  Item extends ManagerConstructor<Client, infer Instance, string>
    ? Instance
    : Item extends ManagerInstance<Client>
      ? Item
      : never;
