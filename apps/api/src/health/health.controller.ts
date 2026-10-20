import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';
import { MapService } from '../modules/maps/map.service';
import { PaymentsService } from '../modules/payments/payments.service';

interface ComponentHealth {
  status: 'ok' | 'degraded' | 'down';
  detail?: string;
}

@ApiTags('سلامت سرویس')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly maps: MapService,
    private readonly payments: PaymentsService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'بررسی زنده بودن سرویس' })
  live() {
    return {
      status: 'ok',
      service: 'carpart-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'آمادگی سرویس و وضعیت اجزای وابسته' })
  async ready() {
    const components: Record<string, ComponentHealth> = {};

    try {
      await this.dataSource.query('SELECT 1');
      components.database = { status: 'ok', detail: this.dataSource.options.type };
    } catch (error) {
      components.database = { status: 'down', detail: (error as Error).message };
    }

    try {
      const mapHealth = this.maps.health();
      components.map = {
        status: mapHealth.live ? 'ok' : 'degraded',
        detail: `${mapHealth.active}${mapHealth.live ? '' : ' — مسیرها با تخمین داخلی محاسبه می‌شوند (سرویس نقشه در دسترس نیست)'}`,
      };
    } catch (error) {
      components.map = { status: 'down', detail: (error as Error).message };
    }

    try {
      const readiness = await this.payments.readiness();
      const active = readiness.find((item) => item.active);
      components.payment = {
        status: active?.configured ? 'ok' : 'degraded',
        detail: active ? `${active.name} (${active.mode})${active.reason ? ` — ${active.reason}` : ''}` : 'فراهم‌کننده‌ای فعال نیست',
      };
    } catch (error) {
      components.payment = { status: 'down', detail: (error as Error).message };
    }

    const healthy = components.database?.status === 'ok';
    return {
      status: healthy ? 'ok' : 'down',
      timestamp: new Date().toISOString(),
      components,
      notice: 'وضعیت «degraded» یعنی سرویس کار می‌کند اما با تخمین داخلی یا پیکربندی آزمایشی.',
    };
  }
}
