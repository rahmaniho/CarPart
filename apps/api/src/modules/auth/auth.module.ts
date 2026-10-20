import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierProfile } from '../couriers/entities/courier-profile.entity';
import { OtpCode } from '../users/entities/otp-code.entity';
import { Seller } from '../sellers/entities/seller.entity';
import { Workshop } from '../workshops/entities/workshop.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workshop, Seller, CourierProfile, OtpCode]),
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.register({}),
  ],
  providers: [AuthService, TokenService, OtpService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
