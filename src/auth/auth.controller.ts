import { Controller, Get, Query, BadRequestException, Post, Body, Req, HttpCode, Res, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '../jwt/jwt.service';
import axios from 'axios';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthResponseDto } from './dto/auth-response.dto';
import type { Request, Response } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private usersService: UsersService, private jwtService: JwtService) {}

  @ApiOperation({ summary: 'GitHub OAuth callback' })
  @ApiQuery({ name: 'code', required: true })
  @ApiResponse({ status: 200, description: 'Returns JWT and user', type: AuthResponseDto })
  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!code) throw new BadRequestException('Missing code');

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    if (!clientId || !clientSecret) throw new BadRequestException('GitHub OAuth not configured');

    // Exchange code for access token
    const tokenResp = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri },
      { headers: { Accept: 'application/json' } },
    );
    const accessToken = tokenResp.data?.access_token;
    if (!accessToken) throw new BadRequestException('Failed to obtain access token from GitHub');

    // Fetch profile
    const profileResp = await axios.get('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}` } });
    const profile = profileResp.data;

    // Try to get primary email if not present
    let email: string | undefined = profile.email;
    let emailVerified = false;
    if (!email) {
      try {
        const emails = await axios.get('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}` } });
        const primary = emails.data.find((e: any) => e.primary) || emails.data[0];
        if (primary) {
          email = primary.email;
          emailVerified = primary.verified || false;
        }
      } catch (e) {
        // ignore
      }
    } else {
      emailVerified = true;
    }

    const user = await this.usersService.upsert({
      provider: 'github',
      providerAccountId: String(profile.id),
      login: profile.login,
      email,
      avatar_url: profile.avatar_url,
      profile,
      email_verified: emailVerified,
    });

    const { refreshToken, expiresAt } = await this.usersService.createSession(user.id, undefined, req.ip, req.headers['user-agent'] as string | undefined);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', expires: expiresAt });
    const token = await this.jwtService.sign({ sub: user.id, email: user.email });
    return { token, user };
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiQuery({ name: 'code', required: true })
  @ApiResponse({ status: 200, description: 'Returns JWT and user', type: AuthResponseDto })
  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!code) throw new BadRequestException('Missing code');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret) throw new BadRequestException('Google OAuth not configured');

    // Exchange code for tokens
    const tokenResp = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri || '',
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const accessToken = tokenResp.data?.access_token;
    if (!accessToken) throw new BadRequestException('Failed to obtain access token from Google');

    const profileResp = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    const profile = profileResp.data;

    const user = await this.usersService.upsert({
      provider: 'google',
      providerAccountId: String(profile.id),
      login: profile.name || profile.email,
      email: profile.email,
      avatar_url: profile.picture,
      profile,
      email_verified: profile.verified_email || true,
    });

    const { refreshToken, expiresAt } = await this.usersService.createSession(user.id, undefined, req.ip, req.headers['user-agent'] as string | undefined);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', expires: expiresAt });
    const token = await this.jwtService.sign({ sub: user.id, email: user.email });
    return { token, user };
  }

  @ApiOperation({ summary: 'Generic OAuth callback (POST) for frontends' })
  @ApiBody({ schema: { type: 'object', properties: { provider: { type: 'string' }, code: { type: 'string' } }, required: ['provider', 'code'] } })
  @ApiResponse({ status: 200, description: 'Returns JWT, refresh token and user', type: AuthResponseDto })
  @Post('oauth/callback')
  async oauthCallback(@Body() body: any, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { provider, code } = body || {};
    this.logger.log(`[OAUTH_CALLBACK] Received callback: provider=${provider}, code=${code ? 'present' : 'missing'}`);
    if (!provider || !code) {
      this.logger.error(`[OAUTH_CALLBACK] Missing provider or code`);
      throw new BadRequestException('Missing provider or code');
    }

    let user: any = null;
    try {
      if (provider === 'github') {
        this.logger.log(`[OAUTH_CALLBACK] Processing GitHub OAuth exchange`);
        user = await this.handleGithubExchange(code);
      } else if (provider === 'google') {
        this.logger.log(`[OAUTH_CALLBACK] Processing Google OAuth exchange`);
        user = await this.handleGoogleExchange(code);
      } else {
        this.logger.error(`[OAUTH_CALLBACK] Unsupported provider: ${provider}`);
        throw new BadRequestException('Unsupported provider');
      }

      this.logger.log(`[OAUTH_CALLBACK] OAuth exchange successful, user ID: ${user.id}`);

      // create refresh session and set HttpOnly cookie
      this.logger.log(`[OAUTH_CALLBACK] Creating session and tokens for user ${user.id}`);
      const { refreshToken, expiresAt } = await this.usersService.createSession(user.id, undefined, req.ip, req.headers['user-agent'] as string | undefined);
      res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', expires: expiresAt });
      const token = await this.jwtService.sign({ sub: user.id, email: user.email });

      this.logger.log(`[OAUTH_CALLBACK] Successfully completed OAuth flow for user ${user.id}`);
      return { token, user };
    } catch (err: any) {
      this.logger.error(`[OAUTH_CALLBACK] Error in OAuth callback: ${err?.message}`, err?.stack);
      throw err;
    }
  }

  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ schema: { type: 'object', properties: { refreshToken: { type: 'string' } }, required: ['refreshToken'] } })
  @ApiResponse({ status: 200, description: 'Returns new JWT and refresh token' })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body('refreshToken') refreshTokenBody: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieToken = (req as any)?.cookies?.refreshToken;
    const refreshToken = refreshTokenBody || cookieToken;
    if (!refreshToken) throw new BadRequestException('Missing refreshToken');
    const { user, refreshToken: newRefreshToken, expiresAt } = await this.usersService.refreshAccessToken(refreshToken);
    // set rotated refresh token as cookie
    res.cookie('refreshToken', newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', expires: expiresAt });
    const token = await this.jwtService.sign({ sub: user.id, email: user.email });
    return { token, user };
  }

  @ApiOperation({ summary: 'Logout (invalidate refresh token)' })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieToken = (req as any)?.cookies?.refreshToken;

    // Invalidate refresh token if present
    if (cookieToken) {
      try {
        // Invalidate by deleting from database (if you have a method for it)
        // For now, we just clear the cookie
        console.log('[Auth] Logout: Refresh token invalidation in progress');
      } catch (e) {
        console.error('[Auth] Error invalidating refresh token:', e);
      }
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });

    return { success: true, message: 'Logged out successfully' };
  }

  private async handleGithubExchange(code: string) {
    this.logger.log('[GITHUB] Starting GitHub OAuth token exchange');
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    if (!clientId || !clientSecret) {
      this.logger.error('[GITHUB] GitHub OAuth not configured');
      throw new BadRequestException('GitHub OAuth not configured');
    }

    // Exchange code for access token
    this.logger.debug(`[GITHUB] Exchanging code for access token`);
    const tokenResp = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri },
      { headers: { Accept: 'application/json' } },
    );
    const accessToken = tokenResp.data?.access_token;
    if (!accessToken) {
      this.logger.error('[GITHUB] Failed to obtain access token');
      throw new BadRequestException('Failed to obtain access token from GitHub');
    }
    this.logger.debug('[GITHUB] Successfully obtained access token');

    // Fetch profile
    this.logger.debug('[GITHUB] Fetching user profile');
    const profileResp = await axios.get('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}` } });
    const profile = profileResp.data;
    this.logger.log(`[GITHUB] Fetched profile for GitHub user: ${profile.login} (id: ${profile.id})`);

    // Try to get primary email if not present
    let email: string | undefined = profile.email;
    let emailVerified = false;
    if (!email) {
      this.logger.debug('[GITHUB] No email in profile, fetching from emails endpoint');
      try {
        const emails = await axios.get('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}` } });
        const primary = emails.data.find((e: any) => e.primary) || emails.data[0];
        if (primary) {
          email = primary.email;
          emailVerified = primary.verified || false;
          this.logger.log(`[GITHUB] Retrieved email from GitHub: ${email}`);
        }
      } catch (e) {
        this.logger.warn('[GITHUB] Failed to fetch emails from GitHub');
      }
    } else {
      emailVerified = true;
      this.logger.debug(`[GITHUB] Using email from profile: ${email}`);
    }

    this.logger.log(`[GITHUB] Calling upsert with: email=${email}, login=${profile.login}`);
    const user = await this.usersService.upsert({
      provider: 'github',
      providerAccountId: String(profile.id),
      login: profile.login,
      email,
      avatar_url: profile.avatar_url,
      profile,
      email_verified: emailVerified,
    });

    this.logger.log(`[GITHUB] GitHub OAuth exchange completed successfully for user: ${user.id}`);
    return user;
  }

  private async handleGoogleExchange(code: string) {
    this.logger.log('[GOOGLE] Starting Google OAuth token exchange');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret) {
      this.logger.error('[GOOGLE] Google OAuth not configured');
      throw new BadRequestException('Google OAuth not configured');
    }

    // Exchange code for tokens
    this.logger.debug('[GOOGLE] Exchanging code for access token');
    const tokenResp = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri || '',
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const accessToken = tokenResp.data?.access_token;
    if (!accessToken) {
      this.logger.error('[GOOGLE] Failed to obtain access token');
      throw new BadRequestException('Failed to obtain access token from Google');
    }
    this.logger.debug('[GOOGLE] Successfully obtained access token');

    this.logger.debug('[GOOGLE] Fetching user profile');
    const profileResp = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    const profile = profileResp.data;
    this.logger.log(`[GOOGLE] Fetched profile for Google user: ${profile.email} (id: ${profile.id})`);

    this.logger.log(`[GOOGLE] Calling upsert with: email=${profile.email}, name=${profile.name}`);
    const user = await this.usersService.upsert({
      provider: 'google',
      providerAccountId: String(profile.id),
      login: profile.name || profile.email,
      email: profile.email,
      avatar_url: profile.picture,
      profile,
      email_verified: profile.verified_email || true,
    });

    this.logger.log(`[GOOGLE] Google OAuth exchange completed successfully for user: ${user.id}`);
    return user;
  }
}
