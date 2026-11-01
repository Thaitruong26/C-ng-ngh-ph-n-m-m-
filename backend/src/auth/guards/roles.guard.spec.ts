import { describe, expect, it } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { Role } from '../../generated/prisma/client.js';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function createMockContext(user: any): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('cho phép truy cập nếu route không yêu cầu role', () => {
    const ctx = createMockContext({ role: Role.CUSTOMER });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ném 403 nếu user không có role BARISTA được yêu cầu', () => {
    reflector.getAllAndOverride = () => [Role.BARISTA];
    const ctx = createMockContext({ role: Role.CUSTOMER });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('cho phép truy cập nếu user có đúng role BARISTA', () => {
    reflector.getAllAndOverride = () => [Role.BARISTA];
    const ctx = createMockContext({ role: Role.BARISTA });

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
