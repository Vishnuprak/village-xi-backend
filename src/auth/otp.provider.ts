import { Injectable, Logger } from '@nestjs/common';

export interface OtpProvider {
  sendOtp(phone: string, otp: string): Promise<boolean>;
}

@Injectable()
export class MockOtpProvider implements OtpProvider {
  private readonly logger = new Logger(MockOtpProvider.name);

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    this.logger.log(`[MOCK OTP SERVICE] Sent OTP ${otp} to phone number ${phone}`);
    return true;
  }
}
