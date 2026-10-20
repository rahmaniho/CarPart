import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUDIT_WRITER } from '../../common/interceptors/audit-writer.token';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService, { provide: AUDIT_WRITER, useExisting: AuditService }],
  exports: [AuditService, AUDIT_WRITER],
})
export class AuditModule {}
