import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Validator } from '@/validators/validator';
import { ValidationError } from '@/utils/errors';
import { ERROR_CODES } from '@/utils/error-codes';

describe('Validator', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });

  describe('validate', () => {
    it('校验成功时返回 success 和 data', () => {
      const result = Validator.validate(schema, { name: 'Alice', age: 30 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Alice', age: 30 });
      expect(result.error).toBeUndefined();
    });

    it('缺少必填字段时返回 VALIDATION_REQUIRED 错误', () => {
      const result = Validator.validate(schema, { name: 'Alice' });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error!.code).toBe(ERROR_CODES.VALIDATION_REQUIRED);
      expect(result.error!.message).toContain('Validation failed');
    });

    it('字段格式错误时返回 VALIDATION_INVALID_FORMAT 错误', () => {
      const result = Validator.validate(schema, { name: 123, age: 30 });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error!.code).toBe(ERROR_CODES.VALIDATION_INVALID_FORMAT);
    });

    it('非 ZodError 异常时返回 VALIDATION_UNKNOWN 错误', () => {
      const throwingSchema = z.string().transform(() => {
        throw new TypeError('non-zod error');
      });
      const result = Validator.validate(throwingSchema, 'hello');
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error!.code).toBe(ERROR_CODES.VALIDATION_UNKNOWN);
      expect(result.error!.message).toBe('Unknown validation error');
    });
  });

  describe('validateOrThrow', () => {
    it('校验成功时返回数据', () => {
      const data = Validator.validateOrThrow(schema, { name: 'Bob', age: 25 });
      expect(data).toEqual({ name: 'Bob', age: 25 });
    });

    it('校验失败时抛出 ValidationError', () => {
      expect(() => Validator.validateOrThrow(schema, {})).toThrow(ValidationError);
    });
  });

  describe('safeParse', () => {
    it('成功时返回 success: true', () => {
      const result = Validator.safeParse(schema, { name: 'C', age: 1 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'C', age: 1 });
    });

    it('失败时返回 success: false', () => {
      const result = Validator.safeParse(schema, { name: 'C' });
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
    });
  });
});
