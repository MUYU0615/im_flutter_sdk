/**
 * 统一参数校验器
 * 
 * 基于 zod schema，统一参数校验和错误处理
 */

import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';
import { ERROR_CODES } from '../utils/error-codes';

/**
 * 参数校验结果
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: ValidationError;
}

/**
 * 统一参数校验器
 */
export class Validator {
  /**
   * 校验参数
   * 
   * @param schema Zod schema
   * @param data 要校验的数据
   * @returns 校验结果
   */
  static validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
    try {
      const validatedData = schema.parse(data);
      return {
        success: true,
        data: validatedData,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        // 格式化 Zod 错误信息
        const fields = error.errors.map((err) => {
          const path = err.path.length > 0 ? err.path.join('.') : 'root';
          return {
            path,
            message: err.message,
            rule: err.code,
          };
        });

        const errorMessages = fields.map((field) => `${field.path}: ${field.message}`);
        const message = `Validation failed: ${errorMessages.join('; ')}`;
        const hasMissing = error.errors.some(
          (err) => err.code === 'invalid_type' && err.received === 'undefined'
        );
        const code = hasMissing ? ERROR_CODES.VALIDATION_REQUIRED : ERROR_CODES.VALIDATION_INVALID_FORMAT;
        return {
          success: false,
          error: new ValidationError(message, {
            code,
            details: {
              fields,
            },
          }),
        };
      }

      // 未知错误
      return {
        success: false,
        error: new ValidationError('Unknown validation error', {
          code: ERROR_CODES.VALIDATION_UNKNOWN,
          details: {
            fields: [],
          },
        }),
      };
    }
  }

  /**
   * 校验参数（抛出异常版本）
   * 
   * @param schema Zod schema
   * @param data 要校验的数据
   * @returns 校验后的数据
   * @throws ValidationError 如果校验失败
   */
  static validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
    const result = this.validate(schema, data);
    if (result.success && result.data !== undefined) {
      return result.data;
    }
    if (result.error) {
      throw result.error;
    }
    throw new ValidationError('Unknown validation error', {
      code: ERROR_CODES.VALIDATION_UNKNOWN,
      details: {
        fields: [],
      },
    });
  }

  /**
   * 安全解析（不抛出异常）
   * 
   * @param schema Zod schema
   * @param data 要校验的数据
   * @returns 校验结果，包含 success 标志
   */
  static safeParse<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
    return this.validate(schema, data);
  }
}

/**
 * 导出常用的 Zod schema 辅助函数
 */
export { z };
