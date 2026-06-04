import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AuthGuard } from '../common/guards/auth.guard'
import { ClientsService } from './clients.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateCreditDto } from './dto/update-credit.dto'

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar cliente', description: 'Cria um novo cliente (endpoint administrativo).' })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso.' })
  @ApiResponse({ status: 409, description: 'Já existe um cliente com este documento.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto)
  }

  @Patch(':id/credit')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Adicionar crédito ou limite',
    description: 'Para pré-pago: adiciona saldo. Para pós-pago: aumenta o limite mensal.',
  })
  @ApiResponse({ status: 200, description: 'Crédito atualizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token inválido ou não fornecido.' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado.' })
  addCredit(@Param('id') id: string, @Body() dto: UpdateCreditDto) {
    return this.clientsService.addCredit(id, dto)
  }
}
