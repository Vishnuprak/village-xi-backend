import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: '+919999999999' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;
}
