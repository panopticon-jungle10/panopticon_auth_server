import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Upsert user based on oauth provider data or email.
   * payload: { provider, providerAccountId, login, email, avatar_url, profile }
   */
  async upsert(payload: any) {
    this.logger.debug(`[UPSERT] Starting upsert with payload: ${JSON.stringify(payload)}`);
    const { provider, providerAccountId, github_id, google_id, login, email, avatar_url, profile } = payload;

    // Normalize providerAccountId for backward compatibility
    const accountId = providerAccountId || github_id || google_id;
    this.logger.debug(`[UPSERT] Normalized accountId: ${accountId}, provider: ${provider}, email: ${email}`);

    try {
      if (provider && accountId) {
        this.logger.debug(`[UPSERT] Looking for existing OAuthAccount with provider=${provider}, accountId=${accountId}`);
        // Try to find existing OAuthAccount
        const existing = await this.prisma.oAuthAccount.findUnique({
          where: { provider_providerAccountId: { provider, providerAccountId: accountId } },
          include: { user: true },
        });

        if (existing) {
          this.logger.log(`[UPSERT] Found existing OAuthAccount for user ${existing.userId}, updating...`);
          // update user info
          const updated = await this.prisma.user.update({
            where: { id: existing.userId },
            data: {
              email: email || existing.user.email,
              displayName: login || existing.user.displayName,
              avatarUrl: avatar_url || existing.user.avatarUrl,
              lastLoginAt: new Date(),
            },
          });
          this.logger.log(`[UPSERT] Successfully updated existing user: ${updated.id}`);

          // update oauth account profile if provided
          await this.prisma.oAuthAccount.update({
            where: { id: existing.id },
            data: { profileJson: profile || existing.profileJson, updatedAt: new Date() },
          });

          return updated;
        }

        this.logger.debug(`[UPSERT] No existing OAuthAccount found, attempting to find user by email: ${email}`);
        // No OAuthAccount found: try to find user by email
        let user = null;
        if (email) {
          user = await this.prisma.user.findUnique({ where: { email } });
          this.logger.debug(`[UPSERT] User lookup by email result: ${user ? user.id : 'NOT FOUND'}`);
        }

        if (!user) {
          this.logger.log(`[UPSERT] No user found, creating new user with email: ${email}`);
          // create user and oauth account
          const created = await this.prisma.user.create({
            data: {
              email: email || null,
              emailVerified: !!payload.email_verified,
              displayName: login || null,
              avatarUrl: avatar_url || null,
              lastLoginAt: new Date(),
              oauthAccounts: {
                create: {
                  provider,
                  providerAccountId: accountId,
                  providerType: 'oauth',
                  profileJson: profile || null,
                },
              },
            },
            include: { oauthAccounts: true },
          });
          this.logger.log(`[UPSERT] Successfully created new user: ${created.id} with OAuthAccount`);
          return created;
        }

        this.logger.log(`[UPSERT] Found existing user by email, attaching OAuth account (userId: ${user.id})`);
        // User exists by email -> attach oauth account
        await this.prisma.oAuthAccount.create({
          data: {
            provider,
            providerAccountId: accountId,
            providerType: 'oauth',
            profileJson: profile || null,
            user: { connect: { id: user.id } },
          },
        });
        this.logger.log(`[UPSERT] Successfully attached OAuth account`);

        // update user's last login and profile fields
        const updatedUser = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            displayName: login || user.displayName,
            avatarUrl: avatar_url || user.avatarUrl,
            lastLoginAt: new Date(),
          },
        });
        this.logger.log(`[UPSERT] Successfully updated user info`);

        return updatedUser;
      }

      // Fallback: upsert by email only
      if (email) {
        this.logger.debug(`[UPSERT] Fallback: upserting by email only: ${email}`);
        const upserted = await this.prisma.user.upsert({
          where: { email },
          update: { displayName: login || undefined, avatarUrl: avatar_url || undefined, lastLoginAt: new Date() },
          create: { email, displayName: login || null, avatarUrl: avatar_url || null, lastLoginAt: new Date() },
        });
        this.logger.log(`[UPSERT] Successfully upserted user by email: ${upserted.id}`);
        return upserted;
      }
    } catch (err: any) {
      this.logger.error(`[UPSERT] Error during upsert: ${err?.message}`, err?.stack);
      throw new InternalServerErrorException(err?.message || 'Database error while upserting user');
    }

    this.logger.error('[UPSERT] Insufficient identifiers provided');
    throw new BadRequestException('insufficient identifiers');
  }

  /**
   * Create a refresh session for a user and return the plaintext token and expiry.
   */
  async createSession(userId: string, expiresInSeconds = 60 * 60 * 24 * 30, ip?: string, userAgent?: string) {
    this.logger.log(`[SESSION] Creating session for user ${userId}`);
    const refreshToken = randomBytes(48).toString('hex');
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    await this.prisma.session.create({
      data: { userId, refreshTokenHash: hash, expiresAt, ip: ip || null, userAgent: userAgent || null },
    });
    this.logger.log(`[SESSION] Successfully created session for user ${userId}, expires at: ${expiresAt}`);
    return { refreshToken, expiresAt };
  }

  /**
   * Validate a refresh token, revoke the existing session and issue a new one.
   */
  async refreshAccessToken(refreshToken: string) {
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hash, revoked: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!session) {
      throw new BadRequestException('Invalid or expired refresh token');
    }

    // Revoke old session
    await this.prisma.session.update({ where: { id: session.id }, data: { revoked: true } });

    // Create new session
    const { refreshToken: newToken, expiresAt } = await this.createSession(session.userId);
    return { user: session.user, refreshToken: newToken, expiresAt };
  }

  async revokeSessionById(sessionId: string) {
    return this.prisma.session.update({ where: { id: sessionId }, data: { revoked: true } });
  }

  async getUserInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { oauthAccounts: true },
    });

    if (!user) {
      throw new BadRequestException(`User with ID "${userId}" not found`);
    }

    return user;
  }

  async updateUserInfo(userId: string, data: { displayName?: string; avatarUrl?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException(`User with ID "${userId}" not found`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: data.displayName || user.displayName,
        avatarUrl: data.avatarUrl || user.avatarUrl,
      },
    });
  }
}

