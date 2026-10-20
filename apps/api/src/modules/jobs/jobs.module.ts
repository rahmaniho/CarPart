import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Job } from './entities/job.entity';
import { JobQueueService } from './job-queue.service';
import { JobRegistry } from './job-registry';
import { JobRunnerService } from './job-runner.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Job]), ScheduleModule.forRoot()],
  providers: [JobQueueService, JobRegistry, JobRunnerService],
  exports: [JobQueueService, JobRegistry, JobRunnerService],
})
export class JobsModule {}
