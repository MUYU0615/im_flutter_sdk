import { describe, it, expect } from 'vitest';
import {
  buildUserInfoFromSummary,
  projectUserInfoToSummary,
  UserInfoRuntimeStore,
} from '@/managers/user-info/user-info-runtime-store';
import type { UserInfoSummary } from '@/cache/cache-types';
import type { UserInfoNotifyPatch } from '@/types/user-info';

describe('UserInfoRuntimeStore', () => {
  describe('buildUserInfoFromSummary', () => {
    it('从 summary 构建 UserInfo', () => {
      const summary: UserInfoSummary = {
        userId: 'u1',
        nickname: 'Nick',
        avatarUrl: 'https://avatar',
        sign: 'hi',
        ext: '{"k":"v"}',
        lastAccess: 100,
        lastUpdate: 200,
      };
      const info = buildUserInfoFromSummary(summary);
      expect(info).toEqual({
        userId: 'u1',
        nickname: 'Nick',
        avatarUrl: 'https://avatar',
        sign: 'hi',
        ext: '{"k":"v"}',
      });
    });
  });

  describe('projectUserInfoToSummary', () => {
    it('从 RuntimeRecord 投影为 UserInfoSummary', () => {
      const summary = projectUserInfoToSummary({
        profile: { userId: 'u2', nickname: 'A', avatarUrl: 'url', sign: 's', ext: 'e' },
        lastModified: 300,
        lastAccess: 400,
        source: 'fetch',
      });
      expect(summary).toEqual({
        userId: 'u2',
        nickname: 'A',
        avatarUrl: 'url',
        sign: 's',
        ext: 'e',
        lastAccess: 400,
        lastUpdate: 300,
      });
    });
  });

  describe('get', () => {
    it('不存在的 userId 返回 null', () => {
      const store = new UserInfoRuntimeStore();
      expect(store.get('nonexist')).toBeNull();
    });

    it('updateAccess=false 时不更新 lastAccess', () => {
      const store = new UserInfoRuntimeStore();
      store.setAll([{ profile: { userId: 'u1' }, source: 'fetch' }], 1000);
      const record = store.get('u1', false, 9999);
      expect(record!.lastAccess).toBe(1000);
    });

    it('updateAccess=true 时更新 lastAccess', () => {
      const store = new UserInfoRuntimeStore();
      store.setAll([{ profile: { userId: 'u1' }, source: 'fetch' }], 1000);
      const record = store.get('u1', true, 5000);
      expect(record!.lastAccess).toBe(5000);
    });
  });

  describe('applyPatch', () => {
    it('patch.lastModified 小于已有记录时返回 stale', () => {
      const store = new UserInfoRuntimeStore();
      store.setAll([{ profile: { userId: 'u1', nickname: 'Old' }, lastModified: 200, source: 'fetch' }], 100);
      const patch: UserInfoNotifyPatch = {
        userId: 'u1',
        attributes: { nickname: 'New' },
        lastModified: 100,
        source: 'subscription',
      };
      const result = store.applyPatch(patch);
      expect(result.applied).toBe(false);
      expect(result.reason).toBe('stale');
    });

    it('patch.lastModified 相同且内容相同时返回 duplicate', () => {
      const store = new UserInfoRuntimeStore();
      store.setAll([{ profile: { userId: 'u1', nickname: 'Same' }, lastModified: 200, source: 'fetch' }], 100);
      const patch: UserInfoNotifyPatch = {
        userId: 'u1',
        attributes: { nickname: 'Same' },
        lastModified: 200,
        source: 'subscription',
      };
      const result = store.applyPatch(patch);
      expect(result.applied).toBe(false);
      expect(result.reason).toBe('duplicate');
    });

    it('正常 patch 应用成功', () => {
      const store = new UserInfoRuntimeStore();
      store.setAll([{ profile: { userId: 'u1', nickname: 'Old' }, lastModified: 100, source: 'fetch' }], 50);
      const patch: UserInfoNotifyPatch = {
        userId: 'u1',
        attributes: { nickname: 'New' },
        lastModified: 200,
        source: 'contact',
      };
      const result = store.applyPatch(patch);
      expect(result.applied).toBe(true);
      expect(result.reason).toBe('applied');
      expect(result.record.profile.nickname).toBe('New');
      expect(result.record.source).toBe('contact_notify');
    });
  });
});
