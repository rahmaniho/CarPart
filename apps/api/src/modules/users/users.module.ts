import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpCode } from './entities/otp-code.entity';
import { UserSession } from './entities/user-session.entity';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, UserSession, OtpCode])],
  providers: [UsersRepository, UsersService],
  controllers: [UsersController],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
