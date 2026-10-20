import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { buildConfig, CONFIG_TOKEN, type AppConfig } from './configuration';
import { validateEnv } from './env.schema';

function loadConfig(): AppConfig {
  return buildConfig(validateEnv(process.env as unknown as Record<string, unknown>));
}

/** ماژول پیکربندی سراسری — همه مقادیر از محیط خوانده و اعتبارسنجی می‌شوند. */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => validateEnv(raw as Record<string, unknown>),
      load: [() => ({ app: loadConfig() })],
    }),
  ],
  providers: [{ provide: CONFIG_TOKEN, useFactory: loadConfig }],
  exports: [CONFIG_TOKEN, NestConfigModule],
})
export class AppConfigModule {}
