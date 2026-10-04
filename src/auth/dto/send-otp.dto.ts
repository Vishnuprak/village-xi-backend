import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: '+919999999999', description: 'Mobile phone number with country code' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Phone number must be valid format with country code' })
  phone: string;
}
