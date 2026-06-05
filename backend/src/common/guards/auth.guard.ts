import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Client } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

interface GuardRequest {
  headers: { authorization?: string }
  client: Client
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardRequest>()
    const authorization = request.headers['authorization']

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido.')
    }

    const token = authorization.slice(7)

    let payload: { sub: string }
    try {
      payload = this.jwtService.verify(token)
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.')
    }

    const client = await this.prisma.client.findUnique({
      where: { id: payload.sub },
    })
    if (!client || !client.active) {
      throw new UnauthorizedException('Cliente não encontrado ou inativo.')
    }

    request.client = client
    return true
  }
}
