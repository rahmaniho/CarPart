import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { AppException, ErrorCodes, NotFoundException } from '../../common/errors/app-error';
import { CONFIG_TOKEN, type AppConfig } from '../../config/configuration';
import { decryptSecret, encryptSecret } from '../../common/utils/crypto';
import { Seller } from './entities/seller.entity';
import { SellerBranch, type BusinessHour } from './entities/seller-branch.entity';
import { SellerProduct } from './entities/seller-product.entity';
import { UpsertBranchDto, UpsertSellerDto } from './dto/seller.dto';
import { Order } from '../orders/entities/order.entity';
import { Quote } from '../requests/entities/quote.entity';
import { Commission } from '../finance/entities/commission.entity';

export interface SellerDashboard {
  seller: { id: string; storeName: string; verificationStatus: string; ratingAvg: number; ratingCount: number };
  products: { total: number; active: number; outOfStock: number; lowStock: number; stalePrice: number };
  branches: { total: number; openNow: number };
  quotes: { openRequests: number; submitted: number; accepted: number };
  orders: { waitingConfirmation: number; preparing: number; readyForPickup: number; completedToday: number; total: number };
  finance: { netRevenueTotal: number; platformCommissionTotal: number; pendingPayout: number };
}

@Injectable()
export class SellersService {
  constructor(
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    @InjectRepository(SellerBranch) private readonly branches: Repository<SellerBranch>,
    @InjectRepository(SellerProduct) private readonly products: Repository<SellerProduct>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Quote) private readonly quotes: Repository<Quote>,
    @InjectRepository(Commission) private readonly commissions: Repository<Commission>,
    @Inject(CONFIG_TOKEN) private readonly config: AppConfig,
  ) {}

  async findByUserId(userId: string): Promise<Seller | null> {
    return this.sellers.findOne({ where: { userId } });
  }

  async requireSeller(userId: string): Promise<Seller> {
    const seller = await this.findByUserId(userId);
    if (!seller) {
      throw new AppException('پروفایل فروشگاهی شما کامل نیست. ابتدا اطلاعات فروشگاه را ثبت کنید.', ErrorCodes.PROFILE_INCOMPLETE, {
        statusCode: 409,
      });
    }
    return seller;
  }

  /** فروشنده تأییدشده برای عملیات تجاری (ثبت پیشنهاد، دریافت سفارش). */
  async requireVerifiedSeller(userId: string): Promise<Seller> {
    const seller = await this.requireSeller(userId);
    if (seller.verificationStatus !== 'APPROVED') {
      throw new AppException(
        'حساب فروشگاه شما هنوز تأیید نشده است. اطلاعات و مدارک را تکمیل و برای بررسی ارسال کنید.',
        ErrorCodes.ACCOUNT_NOT_VERIFIED,
        { statusCode: 403 },
      );
    }
    if (!seller.isActive) {
      throw new AppException('حساب فروشگاه غیرفعال است.', ErrorCodes.ACCOUNT_SUSPENDED, { statusCode: 403 });
    }
    return seller;
  }

  async getOrCreate(userId: string): Promise<Seller> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;
    return this.sellers.save(this.sellers.create({ userId, storeName: 'فروشگاه من', verificationStatus: 'DRAFT', isActive: true }));
  }

  async upsert(userId: string, dto: UpsertSellerDto): Promise<Seller> {
    const seller = await this.getOrCreate(userId);
    const before = { nationalId: seller.nationalId, city: seller.city, storeName: seller.storeName };
    Object.assign(seller, {
      storeName: dto.storeName,
      legalName: dto.legalName ?? seller.legalName,
      nationalId: dto.nationalId ?? seller.nationalId,
      taxCode: dto.taxCode ?? seller.taxCode,
      phone: dto.phone ?? seller.phone,
      email: dto.email ?? seller.email,
      city: dto.city ?? seller.city,
      description: dto.description ?? seller.description,
    });
    if (dto.documents) {
      seller.documents = dto.documents.map((doc) => ({
        kind: doc.kind,
        fileUrl: doc.fileUrl,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded',
      }));
    }
    if (dto.payoutInfo) {
      // اطلاعات حساب بانکی رمزنگاری‌شده نگهداری می‌شود و هرگز به‌صورت خام در پاسخ‌ها برنمی‌گردد.
      seller.payoutInfoEncrypted = encryptSecret(JSON.stringify(dto.payoutInfo), this.config.auth.encryptionKey);
    }
    if (seller.verificationStatus === 'APPROVED' && (before.nationalId !== seller.nationalId || before.storeName !== seller.storeName)) {
      seller.verificationStatus = 'PENDING_REVIEW';
    }
    return this.sellers.save(seller);
  }

  /** نمایش امن اطلاعات تسویه (بدون افشای کامل شماره حساب). */
  payoutInfo(seller: Seller): Record<string, string> | null {
    if (!seller.payoutInfoEncrypted) return null;
    try {
      const raw = JSON.parse(decryptSecret(seller.payoutInfoEncrypted, this.config.auth.encryptionKey)) as Record<string, string>;
      return {
        bankName: raw.bankName ?? '',
        ownerName: raw.ownerName ?? '',
        accountNumber: raw.accountNumber ? `****${raw.accountNumber.slice(-4)}` : '',
        iban: raw.iban ? `IR****${raw.iban.slice(-4)}` : '',
      };
    } catch {
      return null;
    }
  }

  async submitForReview(userId: string): Promise<Seller> {
    const seller = await this.requireSeller(userId);
    const branchCount = await this.branches.count({ where: { sellerId: seller.id, isActive: true } });
    if (!seller.storeName || !seller.nationalId || !seller.city) {
      throw new AppException('نام فروشگاه، شناسه ملی و شهر الزامی است.', ErrorCodes.PROFILE_INCOMPLETE, { statusCode: 409 });
    }
    if (branchCount === 0) {
      throw new AppException('حداقل یک شعبه با آدرس و موقعیت روی نقشه ثبت کنید.', ErrorCodes.PROFILE_INCOMPLETE, { statusCode: 409 });
    }
    seller.verificationStatus = 'PENDING_REVIEW';
    return this.sellers.save(seller);
  }

  /* ------------------------------- شعبه‌ها ------------------------------- */

  async listBranches(sellerId: string, includeInactive = false): Promise<SellerBranch[]> {
    return this.branches.find({
      where: includeInactive ? { sellerId } : { sellerId, isActive: true },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async createBranch(sellerId: string, dto: UpsertBranchDto): Promise<SellerBranch> {
    const count = await this.branches.count({ where: { sellerId } });
    const entity = this.branches.create({
      sellerId,
      name: dto.name,
      city: dto.city ?? null,
      addressText: dto.addressText ?? null,
      phone: dto.phone ?? null,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      serviceRadiusKm: dto.serviceRadiusKm ?? 25,
      prepTimeMinutes: dto.prepTimeMinutes ?? 30,
      businessHours: (dto.businessHours as BusinessHour[]) ?? null,
      isPrimary: dto.isPrimary ?? count === 0,
      isActive: true,
    });
    const saved = await this.branches.save(entity);
    if (saved.isPrimary) await this.branches.update({ sellerId, id: Not(saved.id) }, { isPrimary: false });
    return saved;
  }

  async updateBranch(sellerId: string, branchId: string, dto: Partial<UpsertBranchDto> & { isActive?: boolean }): Promise<SellerBranch> {
    const branch = await this.branches.findOne({ where: { id: branchId, sellerId } });
    if (!branch) throw new NotFoundException('شعبه');
    Object.assign(branch, dto);
    if (dto.businessHours) branch.businessHours = dto.businessHours as BusinessHour[];
    const saved = await this.branches.save(branch);
    if (saved.isPrimary) await this.branches.update({ sellerId, id: Not(saved.id) }, { isPrimary: false });
    return saved;
  }

  async requireBranch(sellerId: string, branchId?: string | null): Promise<SellerBranch> {
    if (branchId) {
      const branch = await this.branches.findOne({ where: { id: branchId, sellerId, isActive: true } });
      if (!branch) throw new NotFoundException('شعبه');
      return branch;
    }
    const branch = await this.branches.findOne({ where: { sellerId, isActive: true, isPrimary: true } });
    if (!branch) {
      throw new AppException('ابتدا یک شعبه با موقعیت روی نقشه ثبت کنید.', ErrorCodes.PROFILE_INCOMPLETE, { statusCode: 409 });
    }
    return branch;
  }

  /** آیا شعبه هم‌اکنون (به وقت تهران) باز است؟ */
  isOpenNow(branch: SellerBranch, now = new Date()): boolean {
    const hours = branch.businessHours;
    if (!hours?.length) return true;
    const tehranMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 210) % 1440; // UTC+3:30
    const weekday = new Date(now.getTime() + 210 * 60_000).getUTCDay(); // 0=یکشنبه
    // نگاشت به تقویم هفته ایرانی: شنبه=0
    const persianDay = (weekday + 1) % 7;
    const today = hours.find((h) => h.day === persianDay);
    if (!today || today.closed || !today.open || !today.close) return false;
    const [openH, openM] = today.open.split(':').map(Number);
    const [closeH, closeM] = today.close.split(':').map(Number);
    const openMinutes = openH * 60 + (openM ?? 0);
    const closeMinutes = closeH * 60 + (closeM ?? 0);
    return tehranMinutes >= openMinutes && tehranMinutes <= closeMinutes;
  }

  /* ------------------------------ داشبورد ------------------------------ */

  async dashboard(userId: string): Promise<SellerDashboard> {
    const seller = await this.requireSeller(userId);
    const branches = await this.listBranches(seller.id);
    const products = await this.products.find({ where: { sellerId: seller.id }, select: { id: true, isActive: true, stock: true, reservedStock: true, priceUpdatedAt: true } });
    const staleCutoff = new Date(Date.now() - 7 * 86_400_000);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const ordersByStatus = await this.orders
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(1)', 'count')
      .where('o.sellerId = :sellerId', { sellerId: seller.id })
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string }>();
    const orderCounts = Object.fromEntries(ordersByStatus.map((row) => [row.status, Number(row.count)]));

    const completedToday = await this.orders.count({
      where: { sellerId: seller.id, status: 'COMPLETED', updatedAt: MoreThanOrEqual(startOfDay) },
    });

    const quoteRows = await this.quotes
      .createQueryBuilder('q')
      .select('q.status', 'status')
      .addSelect('COUNT(1)', 'count')
      .where('q.sellerId = :sellerId', { sellerId: seller.id })
      .groupBy('q.status')
      .getRawMany<{ status: string; count: string }>();
    const quoteCounts = Object.fromEntries(quoteRows.map((row) => [row.status, Number(row.count)]));

    const financeRows = await this.commissions
      .createQueryBuilder('c')
      .select('SUM(c.sellerNetAmount)', 'net')
      .addSelect('SUM(c.platformAmount)', 'commission')
      .where('c.sellerId = :sellerId', { sellerId: seller.id })
      .andWhere('c.status = :status', { status: 'recorded' })
      .getRawOne<{ net: string | null; commission: string | null }>();

    return {
      seller: {
        id: seller.id,
        storeName: seller.storeName,
        verificationStatus: seller.verificationStatus,
        ratingAvg: seller.ratingAvg,
        ratingCount: seller.ratingCount,
      },
      products: {
        total: products.length,
        active: products.filter((p) => p.isActive).length,
        outOfStock: products.filter((p) => p.isActive && p.stock - p.reservedStock <= 0).length,
        lowStock: products.filter((p) => p.isActive && p.stock - p.reservedStock > 0 && p.stock - p.reservedStock <= 3).length,
        stalePrice: products.filter((p) => p.isActive && (!p.priceUpdatedAt || p.priceUpdatedAt < staleCutoff)).length,
      },
      branches: { total: branches.length, openNow: branches.filter((b) => this.isOpenNow(b)).length },
      quotes: {
        openRequests: 0, // در RequestsService محاسبه می‌شود (درخواست‌های باز در محدوده فروشنده)
        submitted: quoteCounts.SUBMITTED ?? 0,
        accepted: (quoteCounts.ACCEPTED ?? 0) + (quoteCounts.CONVERTED ?? 0),
      },
      orders: {
        waitingConfirmation: orderCounts.PAID ?? 0,
        preparing: (orderCounts.SELLER_CONFIRMED ?? 0) + (orderCounts.PREPARING ?? 0),
        readyForPickup: orderCounts.READY_FOR_PICKUP ?? 0,
        completedToday,
        total: Object.values(orderCounts).reduce((acc, value) => acc + value, 0),
      },
      finance: {
        netRevenueTotal: Number(financeRows?.net ?? 0),
        platformCommissionTotal: Number(financeRows?.commission ?? 0),
        pendingPayout: 0,
      },
    };
  }

  /** فروشنده بر اساس شناسه (برای بخش‌های دیگر). */
  async findById(id: string): Promise<Seller | null> {
    return this.sellers.findOne({ where: { id } });
  }

  async findBranchById(branchId: string): Promise<SellerBranch | null> {
    return this.branches.findOne({ where: { id: branchId } });
  }

  async orderStatsForPeriod(sellerId: string, from: Date, to: Date) {
    return this.orders.count({ where: { sellerId, createdAt: Between(from, to) } });
  }
}
