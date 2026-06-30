/**
 * 统一事件系统 EventHub
 */

import { logger } from '../../utils/logger';
import type { EventHandlerId, EventHandlerMap, EventName, EventPayloadMap } from '../../types/event-system';

export class EventHub {
  private handlers: Map<EventHandlerId, EventHandlerMap> = new Map();

  addEventHandler(id: EventHandlerId, handlers: EventHandlerMap): void {
    this.handlers.set(id, handlers);
  }

  removeEventHandler(id: EventHandlerId): void {
    this.handlers.delete(id);
  }

  dispatch<K extends EventName>(event: K, payload: EventPayloadMap[K]): void {
    const internalHandlers: Array<[EventHandlerId, EventHandlerMap]> = [];
    const externalHandlers: Array<[EventHandlerId, EventHandlerMap]> = [];

    for (const entry of this.handlers.entries()) {
      const [id] = entry;
      if (id.startsWith('__internal')) {
        internalHandlers.push(entry);
      } else {
        externalHandlers.push(entry);
      }
    }

    const internalPending = this.dispatchToHandlers(event, payload, internalHandlers);
    if (internalPending) {
      void internalPending.then(() => {
        const externalPending = this.dispatchToHandlers(event, payload, externalHandlers);
        if (externalPending) {
          void externalPending;
        }
      });
      return;
    }

    const externalPending = this.dispatchToHandlers(event, payload, externalHandlers);
    if (externalPending) {
      void externalPending;
    }
  }

  private dispatchToHandlers<K extends EventName>(
    event: K,
    payload: EventPayloadMap[K],
    entries: Array<[EventHandlerId, EventHandlerMap]>
  ): Promise<void> | null {
    let pending: Promise<void> | null = null;

    for (const [, handlers] of entries) {
      const handler = handlers[event];
      if (!handler) {
        continue;
      }

      if (pending) {
        pending = pending.then(async () => {
          await this.invokeHandler(event, payload, handler);
        });
        continue;
      }

      pending = this.invokeHandler(event, payload, handler);
    }

    return pending;
  }

  private invokeHandler<K extends EventName>(
    event: K,
    payload: EventPayloadMap[K],
    handler: EventHandlerMap[K]
  ): Promise<void> | null {
    try {
      const result = (handler as (input: EventPayloadMap[K]) => unknown)(payload);
      if (this.isPromiseLike(result)) {
        return Promise.resolve(result)
          .then(() => undefined)
          .catch(error => {
          logger.error(`Event handler error for ${event}`, error);
          });
      }
      return null;
    } catch (error) {
      logger.error(`Event handler error for ${event}`, error);
      return null;
    }
  }

  private isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'then' in value &&
      typeof value.then === 'function'
    );
  }
}
