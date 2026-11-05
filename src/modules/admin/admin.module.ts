import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';

@Module({
  exports: [AdminService],
  providers: [AdminService],
})
export class AdminModule {}
