import { Global, Module } from '@nestjs/common';
import { LiveGateway } from './live.gateway';

@Global()
@Module({
  providers: [LiveGateway],
  exports: [LiveGateway],
})
export class LiveModule {}
