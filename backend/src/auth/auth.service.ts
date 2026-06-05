import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { AuthRequestDto } from './dto/auth-request.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: AuthRequestDto) {
    const client = await this.prisma.client.findFirst({
      where: { documentId: dto.documentId, documentType: dto.documentType },
    })

    if (!client || !client.active) {
      throw new UnauthorizedException(
        'Credenciais inválidas ou cliente inativo.',
      )
    }

    const token = this.jwtService.sign({ sub: client.id })

    return {
      token,
      client: {
        id: client.id,
        name: client.name,
        documentId: client.documentId,
        documentType: client.documentType,
        planType: client.planType,
        active: client.active,
        balance:
          client.planType === 'prepaid' ? Number(client.balance) : undefined,
        limit:
          client.planType === 'postpaid'
            ? Number(client.monthlyLimit)
            : undefined,
      },
    }
  }
}
