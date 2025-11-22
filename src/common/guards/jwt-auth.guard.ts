import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../../jwt/jwt.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.replace(/^Bearer /, '');
    const { valid, payload } = await this.jwtService.verify(token);

    if (!valid || !payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = payload;
    return true;
  }
}
