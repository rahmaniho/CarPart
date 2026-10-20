import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';
import { CONFIG_TOKEN, type AppConfig } from '../config/configuration';
import { buildDataSourceOptions } from './data-source';

/**
 * ماژول پایگاه‌داده سراسری.
 * نوع پایگاه‌داده از تنظیمات خوانده می‌شود: sqljs برای توسعه/تست و postgres برای عملیات.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [CONFIG_TOKEN],
      useFactory: (config: AppConfig): DataSourceOptions => buildDataSourceOptions(config),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

