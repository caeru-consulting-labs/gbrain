import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth';
import { BrainsController } from './brains/brains.controller';
@Module({ imports: [AuthModule.forRoot({ auth })], controllers: [BrainsController] })
export class AppModule {}
