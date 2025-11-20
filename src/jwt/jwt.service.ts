import { Injectable } from '@nestjs/common';
import { jwtVerify } from 'jose';

const getSecretKey = (): Uint8Array => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return new TextEncoder().encode(secret);
};

@Injectable()
export class JwtService {
  async verify(token: string): Promise<{ valid: boolean; payload?: any }> {
    try {
      const secret = getSecretKey();
      const { payload } = await jwtVerify(token, secret);
      return { valid: true, payload };
    } catch (err) {
      console.error('JWT verify failed', err);
      return { valid: false };
    }
  }
}
