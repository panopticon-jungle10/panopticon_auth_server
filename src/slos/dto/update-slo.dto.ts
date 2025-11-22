import { PartialType } from '@nestjs/swagger';
import { CreateSloDto } from './create-slo.dto';

export class UpdateSloDto extends PartialType(CreateSloDto) {}
