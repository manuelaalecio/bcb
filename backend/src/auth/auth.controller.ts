import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { AuthRequestDto } from './dto/auth-request.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @ApiOperation({
    summary: 'Login via CPF ou CNPJ',
    description: 'Autentica o cliente e retorna um JWT.',
  })
  @ApiResponse({
    status: 201,
    description: 'Autenticado com sucesso. Retorna token e dados do cliente.',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas ou cliente inativo.',
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  login(@Body() dto: AuthRequestDto) {
    return this.authService.login(dto)
  }
}
