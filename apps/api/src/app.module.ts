import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Inject } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { CONFIG_TOKEN, type AppConfig } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { HealthModule } from './health/health.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { CouriersModule } from './modules/couriers/couriers.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { FilesModule } from './modules/files/files.module';
import { FinanceModule } from './modules/finance/finance.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MapsModule } from './modules/maps/maps.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { RequestsModule } from './modules/requests/requests.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SupportModule } from './modules/support/support.module';
import { UsersModule } from './modules/users/users.module';
import { WorkshopsModule } from './modules/workshops/workshops.module';

/**
 * ریشه برنامه.
 *
 * ترتیب گاردهای سراسری مهم است: ابتدا محدودسازی نرخ، سپس احراز هویت،
 * بعد نقش‌ها و در نهایت دسترسی‌های ریز. فیلتر خطا و رهگیرهای زمینه/ممیزی
 * به‌صورت سراسری ثبت می‌شوند تا هیچ کنترلری از آن‌ها جا نماند.
 */
@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [CONFIG_TOKEN],
      useFactory: (config: AppConfig) => ({
        // فقط در محیط تست (THROTTLE_DISABLED=true) محدودسازی نرخ کنار گذاشته می‌شود
        skipIf: () => config.throttle.disabled,
        throttlers: [
          {
            ttl: config.throttle.ttlSeconds * 1000,
            limit: config.throttle.limit,
          },
        ],
      }),
    }),
    // ماژول‌های زیرساختی سراسری
    AuditModule,
    SettingsModule,
    NotificationsModule,
    JobsModule,
    MapsModule,
    FinanceModule,
    IdempotencyModule,
    UsersModule,
    ProfilesModule,
    // ماژول‌های دامنه
    AuthModule,
    CatalogModule,
    WorkshopsModule,
    SellersModule,
    CouriersModule,
    RequestsModule,
    OrdersModule,
    PaymentsModule,
    DeliveryModule,
    ReviewsModule,
    SupportModule,
    CouponsModule,
    FilesModule,
    AdminModule,
    HealthModule,
    MaintenanceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {
  constructor(@Inject(CONFIG_TOKEN) private readonly config: AppConfig) {}

  /** برای استفاده در راه‌اندازی: اعلام وضعیت محیط (بدون افشای مقادیر حساس). */
  runtimeInfo(): Record<string, unknown> {
    return {
      env: this.config.app.env,
      db: this.config.db.type,
      synchronize: this.config.db.synchronize && !this.config.app.isProduction,
      paymentProvider: this.config.payment.provider,
      mapProvider: this.config.map.provider,
      seedDemoData: this.config.seed.demoData,
    };
  }
}
