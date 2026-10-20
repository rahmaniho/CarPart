import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { haversineKm, normalizeFa, type Role } from '@carpart/contract';
import { hashPassword } from '../common/utils/crypto';
import { shortCode } from '../common/utils/id';
import type { AppConfig } from '../config/configuration';
import { Commission } from '../modules/finance/entities/commission.entity';
import { Coupon } from '../modules/coupons/entities/coupon.entity';
import { CourierProfile } from '../modules/couriers/entities/courier-profile.entity';
import { DeliveryEvent } from '../modules/delivery/entities/delivery-event.entity';
import { Delivery } from '../modules/delivery/entities/delivery.entity';
import { InventoryMovement } from '../modules/sellers/entities/inventory-movement.entity';
import { OrderEvent } from '../modules/orders/entities/order-event.entity';
import { OrderItem } from '../modules/orders/entities/order-item.entity';
import { Order } from '../modules/orders/entities/order.entity';
import { PaymentEvent } from '../modules/payments/entities/payment-event.entity';
import { Payment } from '../modules/payments/entities/payment.entity';
import { PartRequest } from '../modules/requests/entities/part-request.entity';
import { QuoteItem } from '../modules/requests/entities/quote-item.entity';
import { Quote } from '../modules/requests/entities/quote.entity';
import { Review } from '../modules/reviews/entities/review.entity';
import { SellerBranch } from '../modules/sellers/entities/seller-branch.entity';
import { SellerProduct } from '../modules/sellers/entities/seller-product.entity';
import { Seller } from '../modules/sellers/entities/seller.entity';
import { Announcement } from '../modules/settings/entities/announcement.entity';
import { SystemSetting } from '../modules/settings/entities/system-setting.entity';
import { DEFAULT_SETTINGS } from '../modules/settings/default-settings';
import { User } from '../modules/users/entities/user.entity';
import { Vehicle } from '../modules/workshops/entities/vehicle.entity';
import { WorkshopAddress } from '../modules/workshops/entities/workshop-address.entity';
import { Workshop } from '../modules/workshops/entities/workshop.entity';
import { CatalogRefs, seedCatalog } from './seed-catalog';

const logger = new Logger('Seed');

/** رمز عبور حساب‌های نمونه (غیر از مدیر) — فقط برای محیط توسعه. */
const DEMO_PASSWORD = 'CarPart!12345';

/* تعرفه‌های نمونه باید با تنظیمات پیش‌فرض سامانه یکسان باشند (تنظیمات منبع حقیقت است). */
const DELIVERY_BASE_FEE = 25_000;
const DELIVERY_PER_KM = 6_000;
const COURIER_SHARE_PERCENT = 85;
const COMMISSION_PERCENT = 7;

export interface SeedReport {
  skipped: boolean;
  users: number;
  sellers: number;
  branches: number;
  products: number;
  parts: number;
  requests: number;
  quotes: number;
  orders: number;
  deliveries: number;
  coupons: number;
  message: string;
}

interface SeededAccounts {
  admin: User;
  operator: User;
  mechanics: Array<{ user: User; workshop: Workshop; address: WorkshopAddress; vehicles: Vehicle[] }>;
  sellers: Array<{ user: User; seller: Seller; branches: SellerBranch[] }>;
  couriers: Array<{ user: User; courier: CourierProfile }>;
}

/**
 * داده نمونه واقعی (نه ساختگی در زمان اجرا).
 *
 * این تابع فقط در محیط توسعه/تست اجرا می‌شود و رکوردهای کامل و سازگار می‌سازد:
 * کاتالوگ، حساب‌های تأییدشده، موجودی، درخواست‌ها، پیشنهادها، سفارش‌ها با پرداخت و کارمزد،
 * مأموریت‌های ارسال و بازخوردها. همه مبالغ عدد صحیح تومان است.
 */
export async function seedDatabase(dataSource: DataSource, config: AppConfig, options: { force?: boolean } = {}): Promise<SeedReport> {
  const userRepo = dataSource.getRepository(User);
  const existing = await userRepo.count();
  if (existing > 0 && !options.force) {
    return emptyReport(`پایگاه‌داده پیش‌تر ${existing} کاربر دارد؛ داده نمونه اضافه نشد.`);
  }

  const settingsCount = await seedSettings(dataSource);
  const catalog = await seedCatalog(dataSource, (await ensureAdmin(dataSource, config)).id);
  const accounts = await seedAccounts(dataSource, config);
  const products = await seedOffers(dataSource, accounts, catalog);
  const coupons = await seedCoupons(dataSource, accounts.admin.id);
  await seedAnnouncement(dataSource, accounts.admin.id);
  const history = await seedHistory(dataSource, accounts, products, catalog);

  const message = `داده نمونه ساخته شد: ${history.orders} سفارش، ${history.requests} درخواست، ${history.quotes} پیشنهاد، ${products.length} پیشنهاد فروش، ${settingsCount} تنظیم.`;
  logger.log(message);
  logger.log(`ورود مدیر: ${config.seed.adminMobile} / رمز از متغیر محیطی SEED_ADMIN_PASSWORD`);
  logger.log(`سایر حساب‌های نمونه با رمز ${DEMO_PASSWORD} (مکانیک ۰۹۱۲۱۱۱۰۰۰۱، فروشنده ۰۹۱۲۲۲۲۰۰۰۱، پیک ۰۹۱۲۳۳۳۰۰۰۱، اپراتور ۰۹۱۲۰۰۰۰۰۰۱)`);

  return {
    skipped: false,
    users: await userRepo.count(),
    sellers: accounts.sellers.length,
    branches: accounts.sellers.reduce((acc, seller) => acc + seller.branches.length, 0),
    products: products.length,
    parts: Object.keys(catalog.parts).length,
    requests: history.requests,
    quotes: history.quotes,
    orders: history.orders,
    deliveries: history.deliveries,
    coupons,
    message,
  };
}

function emptyReport(message: string): SeedReport {
  return { skipped: true, users: 0, sellers: 0, branches: 0, products: 0, parts: 0, requests: 0, quotes: 0, orders: 0, deliveries: 0, coupons: 0, message };
}

async function seedSettings(dataSource: DataSource): Promise<number> {
  const repo = dataSource.getRepository(SystemSetting);
  let created = 0;
  for (const item of DEFAULT_SETTINGS) {
    const exists = await repo.findOne({ where: { key: item.key } });
    if (exists) continue;
    await repo.save(
      repo.create({
        key: item.key,
        group: item.group,
        valueType: item.valueType,
        value: item.value,
        defaultValue: item.value,
        faLabel: item.faLabel,
        description: item.description ?? null,
        unit: item.unit ?? null,
        constraints: item.constraints ?? null,
        isPublic: item.isPublic ?? false,
        updatedBy: null,
      }),
    );
    created += 1;
  }
  return created;
}

async function ensureAdmin(dataSource: DataSource, config: AppConfig): Promise<User> {
  const repo = dataSource.getRepository(User);
  const existing = await repo.findOne({ where: { mobile: config.seed.adminMobile } });
  if (existing) return existing;
  return repo.save(
    repo.create({
      mobile: config.seed.adminMobile,
      fullName: 'مدیر سامانه',
      email: null,
      passwordHash: await hashPassword(config.seed.adminPassword),
      roles: ['admin'] as Role[],
      isActive: true,
      isMobileVerified: true,
      city: 'تهران',
      avatarUrl: null,
    }),
  );
}

async function createUser(
  dataSource: DataSource,
  input: { mobile: string; fullName: string; roles: Role[]; city: string; password?: string },
): Promise<User> {
  const repo = dataSource.getRepository(User);
  const existing = await repo.findOne({ where: { mobile: input.mobile } });
  if (existing) return existing;
  return repo.save(
    repo.create({
      mobile: input.mobile,
      fullName: input.fullName,
      email: null,
      passwordHash: await hashPassword(input.password ?? DEMO_PASSWORD),
      roles: input.roles,
      isActive: true,
      isMobileVerified: true,
      city: input.city,
      avatarUrl: null,
    }),
  );
}

async function seedAccounts(dataSource: DataSource, config: AppConfig): Promise<SeededAccounts> {
  const admin = await ensureAdmin(dataSource, config);
  const operator = await createUser(dataSource, { mobile: '09120000001', fullName: 'سارا احمدی (پشتیبانی)', roles: ['operator'], city: 'تهران' });

  /* ------------------------------ مکانیک‌ها ------------------------------ */
  const workshopRepo = dataSource.getRepository(Workshop);
  const addressRepo = dataSource.getRepository(WorkshopAddress);
  const vehicleRepo = dataSource.getRepository(Vehicle);
  const mechanics: SeededAccounts['mechanics'] = [];

  const mechanicSeeds = [
    {
      mobile: '09121110001',
      fullName: 'رضا محمدی',
      workshop: 'تعمیرگاه تکنیک خودرو',
      city: 'تهران',
      lat: 35.735,
      lng: 51.41,
      address: 'تهران، یوسف‌آباد، خیابان مستوفی، پلاک ۴۲',
      vehicles: [
        { nickname: 'پراید سفید', modelKey: 'pride', variantKey: 'pride-131', year: 1395, plate: '۱۲ج۳۴۵-۶۷', engine: '۱.۳ لیتری' },
        { nickname: 'پژو ۲۰۶ نقره‌ای', modelKey: 'peugeot206', variantKey: 'p206-type5', year: 1398, plate: '۳۳د۵۶۷-۷۷', engine: '۱.۶ لیتری TU5' },
      ],
    },
    {
      mobile: '09121110002',
      fullName: 'علی کریمی',
      workshop: 'تعمیرگاه شهاب خودرو',
      city: 'تهران',
      lat: 35.702,
      lng: 51.435,
      address: 'تهران، میدان آزادی، خیابان حبیب‌الله، پلاک ۸',
      vehicles: [{ nickname: 'تیبا مشکی', modelKey: 'tiba', variantKey: 'tiba-sedan', year: 1399, plate: '۵۵ب۱۲۳-۴۴', engine: '۱.۵ لیتری M15' }],
    },
  ];

  for (const seed of mechanicSeeds) {
    const user = await createUser(dataSource, { mobile: seed.mobile, fullName: seed.fullName, roles: ['mechanic'], city: seed.city });
    const workshop = await workshopRepo.save(
      workshopRepo.create({
        userId: user.id,
        name: seed.workshop,
        ownerName: seed.fullName,
        phone: seed.mobile,
        nationalId: null,
        taxCode: null,
        city: seed.city,
        addressText: seed.address,
        lat: seed.lat,
        lng: seed.lng,
        logoUrl: null,
        description: 'تعمیرگاه تخصصی خودروهای داخلی',
        specialties: ['موتور', 'جلوبندی', 'برق خودرو'],
        verificationStatus: 'APPROVED',
        verificationNote: 'تأییدشده در داده نمونه',
        isActive: true,
      }),
    );
    const address = await addressRepo.save(
      addressRepo.create({
        workshopId: workshop.id,
        title: 'تعمیرگاه',
        receiverName: seed.fullName,
        phone: seed.mobile,
        city: seed.city,
        addressText: seed.address,
        postalCode: null,
        lat: seed.lat,
        lng: seed.lng,
        isDefault: true,
        isActive: true,
      }),
    );
    const vehicles: Vehicle[] = [];
    for (const vehicleSeed of seed.vehicles) {
      vehicles.push(
        await vehicleRepo.save(
          vehicleRepo.create({
            workshopId: workshop.id,
            nickname: vehicleSeed.nickname,
            modelId: null,
            variantId: null,
            vehicleType: 'car',
            yearFrom: vehicleSeed.year,
            yearTo: vehicleSeed.year,
            engine: vehicleSeed.engine,
            gearbox: 'دنده‌ای',
            plate: vehicleSeed.plate,
            vin: null,
            freeMakeName: null,
            freeModelName: vehicleSeed.nickname,
            isPrimary: vehicles.length === 0,
            isActive: true,
          }),
        ),
      );
    }
    mechanics.push({ user, workshop, address, vehicles });
  }

  /* ------------------------------ فروشندگان ------------------------------ */
  const sellerRepo = dataSource.getRepository(Seller);
  const branchRepo = dataSource.getRepository(SellerBranch);
  const sellers: SeededAccounts['sellers'] = [];

  const sellerSeeds = [
    {
      mobile: '09122220001',
      fullName: 'حسین رحیمی',
      storeName: 'یدک مرکزی پایتخت',
      city: 'تهران',
      rating: 4.6,
      branches: [
        { name: 'شعبه شهرک غرب', lat: 35.7448, lng: 51.3753, address: 'تهران، شهرک غرب، بلوار دادمان، پلاک ۱۲', radius: 20, prep: 45, primary: true },
        { name: 'شعبه میدان آزادی', lat: 35.699, lng: 51.423, address: 'تهران، میدان آزادی، بازارچه قطعات، غرفه ۷', radius: 15, prep: 60, primary: false },
      ],
    },
    {
      mobile: '09122220002',
      fullName: 'مریم نوری',
      storeName: 'قطعات یدکی پارس',
      city: 'تهران',
      rating: 4.2,
      branches: [{ name: 'شعبه ستارخان', lat: 35.722, lng: 51.452, address: 'تهران، ستارخان، خیابان گلستان، پلاک ۳', radius: 12, prep: 30, primary: true }],
    },
    {
      mobile: '09122220003',
      fullName: 'امیر صادقی',
      storeName: 'لوازم یدکی البرز',
      city: 'کرج',
      rating: 3.9,
      branches: [{ name: 'شعبه مهرشهر', lat: 35.8327, lng: 50.9915, address: 'کرج، مهرشهر، بلوار ارم، پلاک ۲۱', radius: 25, prep: 90, primary: true }],
    },
  ];

  for (const seed of sellerSeeds) {
    const user = await createUser(dataSource, { mobile: seed.mobile, fullName: seed.fullName, roles: ['seller'], city: seed.city });
    const seller = await sellerRepo.save(
      sellerRepo.create({
        userId: user.id,
        storeName: seed.storeName,
        legalName: seed.storeName,
        nationalId: '1234567890',
        taxCode: null,
        phone: seed.mobile,
        email: null,
        city: seed.city,
        logoUrl: null,
        description: `فروش تخصصی قطعات یدکی در ${seed.city} با ضمانت اصالت`,
        documents: [{ kind: 'national_card', fileUrl: '/api/v1/files/demo/national-card.jpg', uploadedAt: new Date().toISOString(), status: 'verified' }],
        payoutInfoEncrypted: null,
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
        verifiedBy: admin.id,
        rejectionReason: null,
        commissionPercent: null,
        ratingAvg: seed.rating,
        ratingCount: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        avgResponseMinutes: 18,
        isActive: true,
      }),
    );
    const branches: SellerBranch[] = [];
    for (const branchSeed of seed.branches) {
      branches.push(
        await branchRepo.save(
          branchRepo.create({
            sellerId: seller.id,
            name: branchSeed.name,
            city: seed.city,
            addressText: branchSeed.address,
            phone: seed.mobile,
            lat: branchSeed.lat,
            lng: branchSeed.lng,
            serviceRadiusKm: branchSeed.radius,
            businessHours: [
              { day: 0, open: '08:00', close: '20:00', closed: false },
              { day: 1, open: '08:00', close: '20:00', closed: false },
              { day: 2, open: '08:00', close: '20:00', closed: false },
              { day: 3, open: '08:00', close: '20:00', closed: false },
              { day: 4, open: '08:00', close: '20:00', closed: false },
              { day: 5, open: '08:00', close: '14:00', closed: false },
              { day: 6, open: null, close: null, closed: true },
            ],
            prepTimeMinutes: branchSeed.prep,
            isPrimary: branchSeed.primary,
            isActive: true,
          }),
        ),
      );
    }
    sellers.push({ user, seller, branches });
  }

  /* -------------------------------- پیک‌ها -------------------------------- */
  const courierRepo = dataSource.getRepository(CourierProfile);
  const couriers: SeededAccounts['couriers'] = [];
  const courierSeeds = [
    { mobile: '09123330001', fullName: 'مهدی قاسمی', vehicleType: 'motorcycle' as const, lat: 35.74, lng: 51.38, city: 'تهران', rating: 4.8 },
    { mobile: '09123330002', fullName: 'یوسف عباسی', vehicleType: 'car' as const, lat: 35.72, lng: 51.45, city: 'تهران', rating: 4.4 },
  ];
  for (const seed of courierSeeds) {
    const user = await createUser(dataSource, { mobile: seed.mobile, fullName: seed.fullName, roles: ['courier'], city: seed.city });
    const courier = await courierRepo.save(
      courierRepo.create({
        userId: user.id,
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
        verifiedBy: admin.id,
        rejectionReason: null,
        nationalId: '0987654321',
        vehicleType: seed.vehicleType,
        vehicleModel: seed.vehicleType === 'motorcycle' ? 'هوندا ۱۲۵' : 'پراید وانت',
        vehiclePlate: seed.vehicleType === 'motorcycle' ? '۱۲۳-۴۵۶۷۸' : '۱۲ج۳۴۵-۶۷',
        capacityKg: seed.vehicleType === 'motorcycle' ? 25 : 300,
        capacityLiters: seed.vehicleType === 'motorcycle' ? 40 : 800,
        serviceCity: seed.city,
        serviceRadiusKm: 20,
        documents: [{ kind: 'license', fileUrl: '/api/v1/files/demo/license.jpg', uploadedAt: new Date().toISOString(), status: 'verified' }],
        payoutInfoEncrypted: null,
        availability: 'online',
        currentLat: seed.lat,
        currentLng: seed.lng,
        locationUpdatedAt: new Date(),
        ratingAvg: seed.rating,
        ratingCount: 0,
        completedDeliveries: 0,
        isActive: true,
      }),
    );
    couriers.push({ user, courier });
  }

  return { admin, operator, mechanics, sellers, couriers };
}

interface OfferSeed {
  partKey: string;
  sellerIndex: number;
  branchIndex?: number;
  price: number;
  listPrice?: number;
  stock: number;
  quality?: SellerProduct['quality'];
  prep?: number;
  sku?: string;
}

const OFFERS: OfferSeed[] = [
  { partKey: 'pride-front-brake-pad', sellerIndex: 0, price: 685_000, listPrice: 780_000, stock: 24, quality: 'aftermarket_high', prep: 40, sku: 'BP-131-CR' },
  { partKey: 'pride-front-brake-pad', sellerIndex: 1, price: 720_000, stock: 8, quality: 'aftermarket_high', prep: 30, sku: 'BP-131-PARS' },
  { partKey: 'pride-front-brake-pad', sellerIndex: 2, price: 640_000, stock: 0, quality: 'aftermarket_economy', prep: 90 },
  { partKey: 'p206-front-brake-pad', sellerIndex: 0, price: 1_480_000, stock: 12, quality: 'oem', prep: 45 },
  { partKey: 'p206-front-brake-pad', sellerIndex: 1, price: 1_560_000, stock: 3, quality: 'oem', prep: 35 },
  { partKey: 'pride-front-brake-disc', sellerIndex: 0, branchIndex: 1, price: 1_120_000, stock: 6, quality: 'genuine', prep: 60 },
  { partKey: 'pride-oil-filter', sellerIndex: 0, price: 145_000, stock: 120, quality: 'aftermarket_high', prep: 20 },
  { partKey: 'pride-oil-filter', sellerIndex: 1, price: 138_000, stock: 45, quality: 'aftermarket_high', prep: 25 },
  { partKey: 'p405-air-filter', sellerIndex: 1, price: 210_000, stock: 30, quality: 'aftermarket_high', prep: 30 },
  { partKey: 'p206-cabin-filter', sellerIndex: 0, price: 165_000, stock: 2, quality: 'aftermarket_economy', prep: 40 },
  { partKey: 'battery-60ah', sellerIndex: 2, price: 3_850_000, stock: 9, quality: 'genuine', prep: 90 },
  { partKey: 'spark-plug-ngk', sellerIndex: 1, price: 235_000, stock: 60, quality: 'oem', prep: 25 },
  { partKey: 'pride-ignition-wire', sellerIndex: 0, price: 480_000, stock: 15, quality: 'aftermarket_high', prep: 45 },
  { partKey: 'engine-oil-10w40', sellerIndex: 2, price: 980_000, stock: 40, quality: 'genuine', prep: 60 },
  { partKey: 'tiba-fuel-filter', sellerIndex: 1, price: 120_000, stock: 55, quality: 'oem', prep: 25 },
  { partKey: 'p206-front-shock', sellerIndex: 0, price: 2_150_000, stock: 4, quality: 'genuine', prep: 50 },
  { partKey: 'pride-steering-ball-joint', sellerIndex: 0, branchIndex: 1, price: 340_000, stock: 18, quality: 'aftermarket_high', prep: 55 },
  { partKey: 'p405-headlight-left', sellerIndex: 2, price: 2_680_000, stock: 3, quality: 'oem', prep: 120 },
  { partKey: 'p206-side-mirror-right', sellerIndex: 1, price: 890_000, stock: 7, quality: 'aftermarket_economy', prep: 40 },
  { partKey: 'peugeot-timing-belt', sellerIndex: 0, price: 640_000, stock: 22, quality: 'oem', prep: 45 },
  { partKey: 'pride-water-pump', sellerIndex: 1, price: 720_000, stock: 11, quality: 'oem', prep: 35 },
  { partKey: 'dena-radiator', sellerIndex: 2, price: 3_450_000, stock: 2, quality: 'genuine', prep: 150 },
];

async function seedOffers(dataSource: DataSource, accounts: SeededAccounts, catalog: CatalogRefs): Promise<SellerProduct[]> {
  const productRepo = dataSource.getRepository(SellerProduct);
  const movementRepo = dataSource.getRepository(InventoryMovement);
  const products: SellerProduct[] = [];

  for (const offer of OFFERS) {
    const part = catalog.parts[offer.partKey];
    const sellerEntry = accounts.sellers[offer.sellerIndex];
    if (!part || !sellerEntry) continue;
    const branch = sellerEntry.branches[offer.branchIndex ?? 0];
    if (!branch) continue;

    const existing = await productRepo.findOne({ where: { sellerId: sellerEntry.seller.id, partId: part.id, branchId: branch.id } });
    if (existing) {
      products.push(existing);
      continue;
    }
    const product = await productRepo.save(
      productRepo.create({
        sellerId: sellerEntry.seller.id,
        branchId: branch.id,
        partId: part.id,
        sku: offer.sku ?? `${part.technicalCode ?? 'SKU'}-${offer.sellerIndex}`,
        price: offer.price,
        listPrice: offer.listPrice ?? null,
        stock: offer.stock,
        reservedStock: 0,
        priceUpdatedAt: new Date(),
        stockUpdatedAt: new Date(),
        quality: offer.quality ?? part.defaultQuality,
        isGenuineClaimed: offer.quality === 'genuine',
        preparationMinutes: offer.prep ?? branch.prepTimeMinutes,
        warrantyNote: offer.quality === 'genuine' ? '۶ ماه ضمانت اصالت کالا' : 'ضمانت بازگشت در صورت مغایرت',
        returnPolicy: 'بازگشت تا ۷ روز در صورت عدم نصب',
        returnWindowDays: 7,
        images: part.images,
        conditionNote: null,
        isActive: true,
        searchKey: normalizeFa(`${part.searchKey ?? part.nameFa} ${sellerEntry.seller.storeName}`),
      }),
    );
    await movementRepo.save(
      movementRepo.create({
        sellerProductId: product.id,
        branchId: branch.id,
        delta: offer.stock,
        stockAfter: offer.stock,
        reason: 'initial',
        note: 'موجودی اولیه داده نمونه',
        actorId: accounts.admin.id,
        actorType: 'user',
      }),
    );
    products.push(product);
  }
  return products;
}

async function seedCoupons(dataSource: DataSource, actorId: string): Promise<number> {
  const repo = dataSource.getRepository(Coupon);
  const seeds = [
    { code: 'WELCOME10', type: 'percent' as const, value: 10, maxDiscount: 200_000, minOrderAmount: 300_000, usageLimit: 500, perUserLimit: 1, description: 'تخفیف خوش‌آمدگویی ۱۰٪' },
    { code: 'TEHRAN50', type: 'fixed' as const, value: 50_000, maxDiscount: null, minOrderAmount: 200_000, usageLimit: 200, perUserLimit: 2, description: '۵۰ هزار تومان تخفیف سفارش‌های تهران' },
  ];
  let created = 0;
  for (const seed of seeds) {
    const exists = await repo.findOne({ where: { code: seed.code } });
    if (exists) continue;
    await repo.save(
      repo.create({
        code: seed.code,
        type: seed.type,
        value: seed.value,
        maxDiscount: seed.maxDiscount,
        minOrderAmount: seed.minOrderAmount,
        usageLimit: seed.usageLimit,
        usedCount: 0,
        perUserLimit: seed.perUserLimit,
        startsAt: new Date(Date.now() - 86_400_000),
        endsAt: new Date(Date.now() + 30 * 86_400_000),
        isActive: true,
        audienceRoles: null,
        city: null,
        description: seed.description,
        createdBy: actorId,
      }),
    );
    created += 1;
  }
  return created;
}

async function seedAnnouncement(dataSource: DataSource, actorId: string): Promise<void> {
  const repo = dataSource.getRepository(Announcement);
  if ((await repo.count()) > 0) return;
  await repo.save(
    repo.create({
      title: 'سامانه در حالت آزمایشی است',
      body: 'درگاه پرداخت و سرویس نقشه در حالت آزمایشی/تخمینی هستند؛ مبالغ و زمان‌های اعلام‌شده واقعی نیستند.',
      audienceRoles: null,
      tone: 'warning',
      isActive: true,
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
      createdBy: actorId,
    }),
  );
}

interface HistoryCounts {
  requests: number;
  quotes: number;
  orders: number;
  deliveries: number;
}

function deliveryFeeFor(distanceKm: number, urgency: 'normal' | 'urgent' | 'critical' = 'normal'): number {
  const multiplier = urgency === 'critical' ? 1.5 : urgency === 'urgent' ? 1.25 : 1;
  return Math.round((DELIVERY_BASE_FEE + Math.round(distanceKm * DELIVERY_PER_KM)) * multiplier);
}

async function seedHistory(
  dataSource: DataSource,
  accounts: SeededAccounts,
  products: SellerProduct[],
  catalog: CatalogRefs,
): Promise<HistoryCounts> {
  const orderRepo = dataSource.getRepository(Order);
  const orderItemRepo = dataSource.getRepository(OrderItem);
  const orderEventRepo = dataSource.getRepository(OrderEvent);
  const paymentRepo = dataSource.getRepository(Payment);
  const paymentEventRepo = dataSource.getRepository(PaymentEvent);
  const commissionRepo = dataSource.getRepository(Commission);
  const deliveryRepo = dataSource.getRepository(Delivery);
  const deliveryEventRepo = dataSource.getRepository(DeliveryEvent);
  const reviewRepo = dataSource.getRepository(Review);
  const requestRepo = dataSource.getRepository(PartRequest);
  const quoteRepo = dataSource.getRepository(Quote);
  const quoteItemRepo = dataSource.getRepository(QuoteItem);

  const findProduct = (sellerIndex: number, partKey: string): SellerProduct | undefined =>
    products.find((product) => product.partId === catalog.parts[partKey]?.id && product.sellerId === accounts.sellers[sellerIndex].seller.id);

  let ordersCreated = 0;
  let deliveriesCreated = 0;

  /* ------------------------ سفارش‌های تکمیل‌شده ------------------------ */
  const completedSeeds = [
    { mechanicIndex: 0, sellerIndex: 0, lines: [{ partKey: 'pride-front-brake-pad', quantity: 1 }, { partKey: 'pride-oil-filter', quantity: 2 }], daysAgo: 6, courierIndex: 0, rating: 5, courierRating: 5 },
    { mechanicIndex: 1, sellerIndex: 1, lines: [{ partKey: 'tiba-fuel-filter', quantity: 3 }], daysAgo: 4, courierIndex: 1, rating: 4, courierRating: 4 },
  ];

  for (const seed of completedSeeds) {
    const mechanic = accounts.mechanics[seed.mechanicIndex];
    const sellerEntry = accounts.sellers[seed.sellerIndex];
    const lines = seed.lines
      .map((line) => {
        const product = findProduct(seed.sellerIndex, line.partKey);
        if (!product) return null;
        return { product, quantity: line.quantity, unitPrice: product.price, lineTotal: product.price * line.quantity };
      })
      .filter((line): line is { product: SellerProduct; quantity: number; unitPrice: number; lineTotal: number } => Boolean(line));
    if (!lines.length) continue;

    const branch = sellerEntry.branches[0];
    const itemsSubtotal = lines.reduce((acc, line) => acc + line.lineTotal, 0);
    const distanceKm = haversineKm({ lat: branch.lat ?? 0, lng: branch.lng ?? 0 }, { lat: mechanic.workshop.lat ?? 0, lng: mechanic.workshop.lng ?? 0 }) ?? 8;
    const deliveryFee = deliveryFeeFor(distanceKm);
    const payableTotal = itemsSubtotal + deliveryFee;
    const platformFee = Math.round((itemsSubtotal * COMMISSION_PERCENT) / 100);
    const courierShare = Math.round((deliveryFee * COURIER_SHARE_PERCENT) / 100);
    const createdAt = new Date(Date.now() - seed.daysAgo * 86_400_000);
    const deliveredAt = new Date(createdAt.getTime() + 3 * 3_600_000);

    const order = await orderRepo.save(
      orderRepo.create({
        code: shortCode(8, 'ORD'),
        userId: mechanic.user.id,
        workshopId: mechanic.workshop.id,
        sellerId: sellerEntry.seller.id,
        branchId: branch.id,
        status: 'COMPLETED',
        requestId: null,
        quoteId: null,
        parentOrderId: null,
        source: 'direct',
        city: mechanic.workshop.city,
        itemsSubtotal,
        deliveryFee,
        discountTotal: 0,
        platformFee,
        payableTotal,
        currency: 'IRT',
        couponCode: null,
        couponId: null,
        paymentStatus: 'SUCCESS',
        paymentId: null,
        paidAt: new Date(createdAt.getTime() + 6 * 60_000),
        deliveryAddressId: mechanic.address.id,
        addressSnapshot: {
          receiverName: mechanic.address.receiverName,
          phone: mechanic.address.phone,
          city: mechanic.address.city,
          addressText: mechanic.address.addressText,
          lat: mechanic.address.lat,
          lng: mechanic.address.lng,
        },
        vehicleSnapshot: null,
        urgency: 'normal',
        notes: null,
        expectedReadyAt: new Date(createdAt.getTime() + 45 * 60_000),
        expectedDeliveryAt: deliveredAt,
        deliveredAt,
        completedAt: new Date(deliveredAt.getTime() + 3_600_000),
        cancelledAt: null,
        cancelReason: null,
        cancelActor: null,
        idempotencyKey: `seed-completed-${seed.mechanicIndex}-${seed.sellerIndex}`,
        createdBy: mechanic.user.id,
        createdAt,
      }),
    );
    ordersCreated += 1;

    for (const line of lines) {
      await orderItemRepo.save(
        orderItemRepo.create({
          orderId: order.id,
          sellerProductId: line.product.id,
          partId: line.product.partId,
          nameFa: catalog.parts[Object.keys(catalog.parts).find((key) => catalog.parts[key].id === line.product.partId) ?? '']?.nameFa ?? 'قطعه',
          sku: line.product.sku,
          technicalCode: null,
          brandName: null,
          quality: line.product.quality,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          imageUrl: null,
          returnedQuantity: 0,
          snapshot: { seeded: true },
        }),
      );
    }

    await recordOrderTrail(orderEventRepo, order.id, mechanic.user.id, [
      { from: null, to: 'WAITING_FOR_PAYMENT', fa: 'ثبت سفارش', at: createdAt },
      { from: 'WAITING_FOR_PAYMENT', to: 'PAID', fa: 'ثبت پرداخت موفق', at: new Date(createdAt.getTime() + 6 * 60_000) },
      { from: 'PAID', to: 'SELLER_CONFIRMED', fa: 'تأیید سفارش توسط فروشنده', at: new Date(createdAt.getTime() + 15 * 60_000) },
      { from: 'SELLER_CONFIRMED', to: 'PREPARING', fa: 'شروع آماده‌سازی', at: new Date(createdAt.getTime() + 20 * 60_000) },
      { from: 'PREPARING', to: 'READY_FOR_PICKUP', fa: 'اعلام آمادگی تحویل به پیک', at: new Date(createdAt.getTime() + 60 * 60_000) },
      { from: 'READY_FOR_PICKUP', to: 'WAITING_FOR_COURIER', fa: 'ثبت درخواست پیک', at: new Date(createdAt.getTime() + 61 * 60_000) },
      { from: 'WAITING_FOR_COURIER', to: 'COURIER_ASSIGNED', fa: 'تخصیص پیک', at: new Date(createdAt.getTime() + 70 * 60_000) },
      { from: 'COURIER_ASSIGNED', to: 'PICKED_UP', fa: 'دریافت مرسوله از فروشگاه', at: new Date(createdAt.getTime() + 100 * 60_000) },
      { from: 'PICKED_UP', to: 'IN_TRANSIT', fa: 'شروع ارسال', at: new Date(createdAt.getTime() + 105 * 60_000) },
      { from: 'IN_TRANSIT', to: 'DELIVERED', fa: 'تحویل با کد تأیید', at: deliveredAt },
      { from: 'DELIVERED', to: 'COMPLETED', fa: 'تأیید نهایی دریافت', at: new Date(deliveredAt.getTime() + 3_600_000) },
    ]);

    const payment = await paymentRepo.save(
      paymentRepo.create({
        orderId: order.id,
        userId: mechanic.user.id,
        provider: 'sandbox',
        mode: 'sandbox',
        amount: payableTotal,
        status: 'SUCCESS',
        referenceId: `seed-ref-${order.code}`,
        gatewayAuthority: `sbx-seed-${order.code}`,
        gatewayTrackingNumber: String(Date.now()),
        idempotencyKey: `seed-payment-${order.id}`,
        requestPayload: null,
        verifyPayload: { seeded: true },
        expiresAt: new Date(createdAt.getTime() + 15 * 60_000),
        paidAt: new Date(createdAt.getTime() + 6 * 60_000),
        failureCode: null,
        failureReason: null,
        refundedAmount: 0,
        cardPanMasked: '****-****-****-1234',
        createdAt,
      }),
    );
    order.paymentId = payment.id;
    await orderRepo.save(order);
    await paymentEventRepo.save(paymentEventRepo.create({ paymentId: payment.id, event: 'verify_success', source: 'gateway', payload: { seeded: true }, note: null }));

    await commissionRepo.save(
      commissionRepo.create({
        orderId: order.id,
        sellerId: sellerEntry.seller.id,
        branchId: branch.id,
        itemsTotal: itemsSubtotal,
        discountTotal: 0,
        deliveryFee,
        commissionBase: itemsSubtotal,
        ratePercent: COMMISSION_PERCENT,
        platformAmount: platformFee,
        sellerNetAmount: itemsSubtotal - platformFee,
        courierAmount: courierShare,
        deliveryPlatformAmount: deliveryFee - courierShare,
        status: 'recorded',
        payoutId: null,
        reversedAt: null,
        reversalReason: null,
        calculation: { seeded: true, formula: 'commissionBase * ratePercent / 100' },
        createdAt,
      }),
    );

    const delivery = await deliveryRepo.save(
      deliveryRepo.create({
        code: shortCode(6, 'DLV'),
        orderId: order.id,
        sellerBranchId: branch.id,
        sellerId: sellerEntry.seller.id,
        courierId: accounts.couriers[seed.courierIndex].courier.id,
        status: 'DELIVERED',
        pickupPoint: { title: sellerEntry.seller.storeName, city: branch.city ?? undefined, addressText: branch.addressText ?? '', lat: branch.lat, lng: branch.lng },
        dropoffPoint: { title: 'تعمیرگاه', receiverName: mechanic.address.receiverName, phone: mechanic.address.phone, city: mechanic.address.city ?? undefined, addressText: mechanic.address.addressText, lat: mechanic.address.lat, lng: mechanic.address.lng },
        city: mechanic.workshop.city,
        distanceKm: Math.round(distanceKm * 100) / 100,
        estimatedMinutes: Math.round(distanceKm * 1.35 * (60 / 24)),
        deliveryFee,
        courierShare,
        platformShare: deliveryFee - courierShare,
        offerCount: 1,
        offeredAt: createdAt,
        offerExpiresAt: new Date(createdAt.getTime() + 4 * 60_000),
        acceptedAt: new Date(createdAt.getTime() + 70 * 60_000),
        arrivedAtSellerAt: new Date(createdAt.getTime() + 95 * 60_000),
        pickedUpAt: new Date(createdAt.getTime() + 100 * 60_000),
        deliveredAt,
        cancelledAt: null,
        pickupCodeEncrypted: null,
        deliveryOtpEncrypted: null,
        attempts: 0,
        lastFailureReason: null,
        proofImageUrl: null,
        proofNote: 'تحویل در محل تعمیرگاه',
        estimatedWeightKg: 2,
        isUrgent: false,
        notes: null,
        excludedCourierIds: null,
        createdAt,
      }),
    );
    deliveriesCreated += 1;
    await deliveryEventRepo.save([
      deliveryEventRepo.create({ deliveryId: delivery.id, type: 'created', status: 'PENDING_ASSIGNMENT', faDescription: 'ایجاد مأموریت ارسال', actorId: null, actorType: 'system', lat: null, lng: null, metadata: { routeSource: 'estimation' } }),
      deliveryEventRepo.create({ deliveryId: delivery.id, type: 'accepted', status: 'ACCEPTED', faDescription: 'پیک مأموریت را پذیرفت', actorId: accounts.couriers[seed.courierIndex].user.id, actorType: 'courier', lat: null, lng: null, metadata: null }),
      deliveryEventRepo.create({ deliveryId: delivery.id, type: 'delivered', status: 'DELIVERED', faDescription: 'تحویل مرسوله با کد تأیید', actorId: accounts.couriers[seed.courierIndex].user.id, actorType: 'courier', lat: null, lng: null, metadata: null }),
    ]);

    await reviewRepo.save(
      reviewRepo.create({
        orderId: order.id,
        authorId: mechanic.user.id,
        targetType: 'seller',
        targetId: sellerEntry.seller.id,
        rating: seed.rating,
        comment: seed.rating >= 5 ? 'قطعه اصل بود و سریع رسید.' : 'کیفیت قابل قبول بود، کمی دیرتر از زمان تخمینی رسید.',
        hadIssue: seed.rating <= 2,
        isPublished: true,
        moderationNote: null,
        createdAt: deliveredAt,
      }),
    );
    await reviewRepo.save(
      reviewRepo.create({
        orderId: order.id,
        authorId: mechanic.user.id,
        targetType: 'courier',
        targetId: accounts.couriers[seed.courierIndex].courier.id,
        rating: seed.courierRating,
        comment: 'تحویل در محل و با هماهنگی انجام شد.',
        hadIssue: false,
        isPublished: true,
        moderationNote: null,
        createdAt: deliveredAt,
      }),
    );
  }

  /* ------------------- سفارش لغوشده با درخواست بازپرداخت ------------------- */
  const cancelMechanic = accounts.mechanics[0];
  const cancelSeller = accounts.sellers[2];
  const cancelProduct = findProduct(2, 'p405-headlight-left');
  if (cancelProduct) {
    const createdAt = new Date(Date.now() - 2 * 86_400_000);
    const lineTotal = cancelProduct.price;
    const distanceKm = haversineKm({ lat: cancelSeller.branches[0].lat ?? 0, lng: cancelSeller.branches[0].lng ?? 0 }, { lat: cancelMechanic.workshop.lat ?? 0, lng: cancelMechanic.workshop.lng ?? 0 }) ?? 30;
    const deliveryFee = deliveryFeeFor(distanceKm);
    const order = await orderRepo.save(
      orderRepo.create({
        code: shortCode(8, 'ORD'),
        userId: cancelMechanic.user.id,
        workshopId: cancelMechanic.workshop.id,
        sellerId: cancelSeller.seller.id,
        branchId: cancelSeller.branches[0].id,
        status: 'REFUND_REQUESTED',
        source: 'direct',
        city: cancelMechanic.workshop.city,
        itemsSubtotal: lineTotal,
        deliveryFee,
        discountTotal: 0,
        platformFee: Math.round((lineTotal * COMMISSION_PERCENT) / 100),
        payableTotal: lineTotal + deliveryFee,
        currency: 'IRT',
        paymentStatus: 'SUCCESS',
        paidAt: new Date(createdAt.getTime() + 5 * 60_000),
        deliveryAddressId: cancelMechanic.address.id,
        addressSnapshot: {
          receiverName: cancelMechanic.address.receiverName,
          phone: cancelMechanic.address.phone,
          city: cancelMechanic.address.city,
          addressText: cancelMechanic.address.addressText,
          lat: cancelMechanic.address.lat,
          lng: cancelMechanic.address.lng,
        },
        urgency: 'normal',
        deliveredAt: new Date(createdAt.getTime() + 5 * 3_600_000),
        idempotencyKey: 'seed-refund-order',
        createdBy: cancelMechanic.user.id,
        createdAt,
      }),
    );
    ordersCreated += 1;
    await orderItemRepo.save(
      orderItemRepo.create({
        orderId: order.id,
        sellerProductId: cancelProduct.id,
        partId: cancelProduct.partId,
        nameFa: 'چراغ جلو چپ پژو ۴۰۵',
        sku: cancelProduct.sku,
        technicalCode: null,
        brandName: null,
        quality: cancelProduct.quality,
        quantity: 1,
        unitPrice: cancelProduct.price,
        lineTotal,
        imageUrl: null,
        returnedQuantity: 0,
        snapshot: { seeded: true },
      }),
    );
    await recordOrderTrail(orderEventRepo, order.id, cancelMechanic.user.id, [
      { from: null, to: 'WAITING_FOR_PAYMENT', fa: 'ثبت سفارش', at: createdAt },
      { from: 'WAITING_FOR_PAYMENT', to: 'PAID', fa: 'ثبت پرداخت موفق', at: new Date(createdAt.getTime() + 5 * 60_000) },
      { from: 'DELIVERED', to: 'REFUND_REQUESTED', fa: 'درخواست بازپرداخت به‌دلیل مغایرت قطعه', at: new Date(createdAt.getTime() + 20 * 3_600_000) },
    ]);
    await paymentRepo.save(
      paymentRepo.create({
        orderId: order.id,
        userId: cancelMechanic.user.id,
        provider: 'sandbox',
        mode: 'sandbox',
        amount: lineTotal + deliveryFee,
        status: 'SUCCESS',
        referenceId: `seed-ref-${order.code}`,
        gatewayAuthority: `sbx-seed-${order.code}`,
        idempotencyKey: `seed-payment-${order.id}`,
        paidAt: new Date(createdAt.getTime() + 5 * 60_000),
        refundedAmount: 0,
        cardPanMasked: '****-****-****-1234',
        createdAt,
      }),
    );
    await commissionRepo.save(
      commissionRepo.create({
        orderId: order.id,
        sellerId: cancelSeller.seller.id,
        branchId: cancelSeller.branches[0].id,
        itemsTotal: lineTotal,
        discountTotal: 0,
        deliveryFee,
        commissionBase: lineTotal,
        ratePercent: COMMISSION_PERCENT,
        platformAmount: Math.round((lineTotal * COMMISSION_PERCENT) / 100),
        sellerNetAmount: lineTotal - Math.round((lineTotal * COMMISSION_PERCENT) / 100),
        courierAmount: Math.round((deliveryFee * COURIER_SHARE_PERCENT) / 100),
        deliveryPlatformAmount: deliveryFee - Math.round((deliveryFee * COURIER_SHARE_PERCENT) / 100),
        status: 'recorded',
        payoutId: null,
        calculation: { seeded: true },
        createdAt,
      }),
    );
  }

  /* ------------------- سفارش در حال آماده‌سازی (پرداخت‌شده) ------------------- */
  const prepMechanic = accounts.mechanics[1];
  const prepSeller = accounts.sellers[0];
  const prepProduct = findProduct(0, 'p206-front-shock');
  if (prepProduct) {
    const createdAt = new Date(Date.now() - 3 * 3_600_000);
    const lineTotal = prepProduct.price * 2;
    const distanceKm = haversineKm({ lat: prepSeller.branches[0].lat ?? 0, lng: prepSeller.branches[0].lng ?? 0 }, { lat: prepMechanic.workshop.lat ?? 0, lng: prepMechanic.workshop.lng ?? 0 }) ?? 10;
    const deliveryFee = deliveryFeeFor(distanceKm);
    const order = await orderRepo.save(
      orderRepo.create({
        code: shortCode(8, 'ORD'),
        userId: prepMechanic.user.id,
        workshopId: prepMechanic.workshop.id,
        sellerId: prepSeller.seller.id,
        branchId: prepSeller.branches[0].id,
        status: 'PREPARING',
        source: 'direct',
        city: prepMechanic.workshop.city,
        itemsSubtotal: lineTotal,
        deliveryFee,
        discountTotal: 0,
        platformFee: Math.round((lineTotal * COMMISSION_PERCENT) / 100),
        payableTotal: lineTotal + deliveryFee,
        currency: 'IRT',
        paymentStatus: 'SUCCESS',
        paidAt: new Date(createdAt.getTime() + 4 * 60_000),
        deliveryAddressId: prepMechanic.address.id,
        addressSnapshot: {
          receiverName: prepMechanic.address.receiverName,
          phone: prepMechanic.address.phone,
          city: prepMechanic.address.city,
          addressText: prepMechanic.address.addressText,
          lat: prepMechanic.address.lat,
          lng: prepMechanic.address.lng,
        },
        urgency: 'urgent',
        expectedReadyAt: new Date(createdAt.getTime() + 45 * 60_000),
        idempotencyKey: 'seed-preparing-order',
        createdBy: prepMechanic.user.id,
        createdAt,
      }),
    );
    ordersCreated += 1;
    await orderItemRepo.save(
      orderItemRepo.create({
        orderId: order.id,
        sellerProductId: prepProduct.id,
        partId: prepProduct.partId,
        nameFa: 'کمک فنر جلو پژو ۲۰۶',
        sku: prepProduct.sku,
        technicalCode: null,
        brandName: null,
        quality: prepProduct.quality,
        quantity: 2,
        unitPrice: prepProduct.price,
        lineTotal,
        imageUrl: null,
        returnedQuantity: 0,
        snapshot: { seeded: true },
      }),
    );
    prepProduct.reservedStock = 0;
    prepProduct.stock = Math.max(0, prepProduct.stock - 2);
    await dataSource.getRepository(SellerProduct).save(prepProduct);

    await recordOrderTrail(orderEventRepo, order.id, prepMechanic.user.id, [
      { from: null, to: 'WAITING_FOR_PAYMENT', fa: 'ثبت سفارش', at: createdAt },
      { from: 'WAITING_FOR_PAYMENT', to: 'PAID', fa: 'ثبت پرداخت موفق', at: new Date(createdAt.getTime() + 4 * 60_000) },
      { from: 'PAID', to: 'SELLER_CONFIRMED', fa: 'تأیید سفارش توسط فروشنده', at: new Date(createdAt.getTime() + 12 * 60_000) },
      { from: 'SELLER_CONFIRMED', to: 'PREPARING', fa: 'شروع آماده‌سازی', at: new Date(createdAt.getTime() + 18 * 60_000) },
    ]);
    const payment = await paymentRepo.save(
      paymentRepo.create({
        orderId: order.id,
        userId: prepMechanic.user.id,
        provider: 'sandbox',
        mode: 'sandbox',
        amount: lineTotal + deliveryFee,
        status: 'SUCCESS',
        referenceId: `seed-ref-${order.code}`,
        gatewayAuthority: `sbx-seed-${order.code}`,
        idempotencyKey: `seed-payment-${order.id}`,
        paidAt: new Date(createdAt.getTime() + 4 * 60_000),
        refundedAmount: 0,
        cardPanMasked: '****-****-****-1234',
        createdAt,
      }),
    );
    order.paymentId = payment.id;
    await orderRepo.save(order);
    await commissionRepo.save(
      commissionRepo.create({
        orderId: order.id,
        sellerId: prepSeller.seller.id,
        branchId: prepSeller.branches[0].id,
        itemsTotal: lineTotal,
        discountTotal: 0,
        deliveryFee,
        commissionBase: lineTotal,
        ratePercent: COMMISSION_PERCENT,
        platformAmount: Math.round((lineTotal * COMMISSION_PERCENT) / 100),
        sellerNetAmount: lineTotal - Math.round((lineTotal * COMMISSION_PERCENT) / 100),
        courierAmount: Math.round((deliveryFee * COURIER_SHARE_PERCENT) / 100),
        deliveryPlatformAmount: deliveryFee - Math.round((deliveryFee * COURIER_SHARE_PERCENT) / 100),
        status: 'recorded',
        payoutId: null,
        calculation: { seeded: true },
        createdAt,
      }),
    );
  }

  /* --------------------- درخواست تأمین باز با دو پیشنهاد --------------------- */
  const openRequestMechanic = accounts.mechanics[0];
  const requestPart = catalog.parts['pride-water-pump'];
  let requestsCreated = 0;
  let quotesCreated = 0;

  if (requestPart) {
    const createdAt = new Date(Date.now() - 10 * 60_000);
    const request = await requestRepo.save(
      requestRepo.create({
        code: shortCode(6, 'REQ'),
        userId: openRequestMechanic.user.id,
        workshopId: openRequestMechanic.workshop.id,
        status: 'QUOTED',
        titleFa: 'واتر پمپ پراید ۱۳۱',
        partNameFa: requestPart.nameFa,
        technicalCode: requestPart.technicalCode,
        oemCode: null,
        categoryId: requestPart.categoryId,
        quantity: 1,
        qualityPreference: 'oem',
        onlyGenuine: false,
        urgency: 'urgent',
        description: 'واتر پمپ با نشتی، نیاز به نمونه اصلی یا درجه یک دارم.',
        images: null,
        vehicleId: openRequestMechanic.vehicles[0]?.id ?? null,
        vehicleSnapshot: { makeName: 'سایپا', modelName: 'پراید', variantName: 'پراید ۱۳۱', year: 1395, engine: '۱.۳ لیتری', plate: '۱۲ج۳۴۵-۶۷', vin: null },
        city: openRequestMechanic.workshop.city,
        deliveryAddressId: openRequestMechanic.address.id,
        deliverySnapshot: {
          receiverName: openRequestMechanic.address.receiverName,
          phone: openRequestMechanic.address.phone,
          city: openRequestMechanic.address.city,
          addressText: openRequestMechanic.address.addressText,
          lat: openRequestMechanic.address.lat,
          lng: openRequestMechanic.address.lng,
        },
        neededBy: new Date(Date.now() + 6 * 3_600_000),
        deadlineAt: new Date(Date.now() + 35 * 60_000),
        quoteCount: 0,
        convertedOrderId: null,
        closedAt: null,
        closeReason: null,
        targetedSellerIds: accounts.sellers.map((entry) => entry.seller.id),
        searchKey: normalizeFa(requestPart.nameFa),
        createdAt,
      }),
    );
    requestsCreated += 1;

    for (const [index, sellerEntry] of accounts.sellers.entries()) {
      if (index > 1) continue;
      const product = findProduct(index, 'pride-water-pump');
      const branch = sellerEntry.branches[0];
      const unitPrice = product ? product.price + index * 25_000 : 780_000;
      const distanceKm = haversineKm({ lat: branch.lat ?? 0, lng: branch.lng ?? 0 }, { lat: request.deliverySnapshot?.lat ?? 0, lng: request.deliverySnapshot?.lng ?? 0 }) ?? 12;
      const deliveryFee = deliveryFeeFor(distanceKm, 'urgent');
      const quote = await quoteRepo.save(
        quoteRepo.create({
          requestId: request.id,
          sellerId: sellerEntry.seller.id,
          branchId: branch.id,
          status: 'SUBMITTED',
          itemsTotal: unitPrice,
          deliveryFee,
          total: unitPrice + deliveryFee,
          preparationMinutes: branch.prepTimeMinutes,
          estimatedDeliveryMinutes: Math.round(distanceKm * 1.35 * (60 / 24)) + branch.prepTimeMinutes,
          distanceKm: Math.round(distanceKm * 100) / 100,
          validUntil: new Date(Date.now() + 60 * 60_000),
          note: index === 0 ? 'نمونه اصلی سایپا یدک موجود است و امروز ارسال می‌شود.' : 'نمونه درجه یک با ضمانت بازگشت.',
          supportsPlatformDelivery: true,
          rankSnapshot: { seeded: true },
          submittedAt: new Date(createdAt.getTime() + (index + 1) * 6 * 60_000),
          decidedAt: null,
          decisionNote: null,
          convertedOrderId: null,
        }),
      );
      quotesCreated += 1;
      await quoteItemRepo.save(
        quoteItemRepo.create({
          quoteId: quote.id,
          sellerProductId: product?.id ?? null,
          partId: requestPart.id,
          nameFa: requestPart.nameFa,
          sku: product?.sku ?? null,
          quality: 'oem',
          quantity: 1,
          unitPrice,
          lineTotal: unitPrice,
          stockAtQuote: product?.availableStock ?? null,
          isSubstitute: false,
          note: null,
        }),
      );
    }
    request.quoteCount = quotesCreated;
    await requestRepo.save(request);
  }

  await refreshSellerStats(dataSource, accounts);
  return { requests: requestsCreated, quotes: quotesCreated, orders: ordersCreated, deliveries: deliveriesCreated };
}

async function recordOrderTrail(
  repo: import('typeorm').Repository<OrderEvent>,
  orderId: string,
  actorId: string,
  trail: Array<{ from: Order['status'] | null; to: Order['status']; fa: string; at: Date }>,
): Promise<void> {
  for (const step of trail) {
    await repo.save(
      repo.create({
        orderId,
        fromStatus: step.from,
        toStatus: step.to,
        action: `status:${step.to}`,
        faDescription: step.fa,
        actorId: step.to === 'PAID' ? null : actorId,
        actorRole: step.to === 'PAID' ? 'system' : 'mechanic',
        actorType: step.to === 'PAID' ? 'system' : 'user',
        reason: null,
        metadata: { seeded: true },
        createdAt: step.at,
      }),
    );
  }
}

/** هم‌ترازسازی آمار فروشگاه‌ها و پیک‌ها با داده واقعی ثبت‌شده. */
async function refreshSellerStats(dataSource: DataSource, accounts: SeededAccounts): Promise<void> {
  const reviewRepo = dataSource.getRepository(Review);
  const orderRepo = dataSource.getRepository(Order);
  const sellerRepo = dataSource.getRepository(Seller);
  const courierRepo = dataSource.getRepository(CourierProfile);
  const deliveryRepo = dataSource.getRepository(Delivery);

  for (const entry of accounts.sellers) {
    const reviews = await reviewRepo.find({ where: { targetType: 'seller', targetId: entry.seller.id, isPublished: true } });
    const completed = await orderRepo.count({ where: { sellerId: entry.seller.id, status: 'COMPLETED' } });
    entry.seller.ratingCount = reviews.length;
    entry.seller.ratingAvg = reviews.length
      ? Math.round((reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length) * 100) / 100
      : entry.seller.ratingAvg;
    entry.seller.ratingCount = Math.max(reviews.length, entry.seller.ratingCount);
    entry.seller.completedOrders = completed;
    await sellerRepo.save(entry.seller);
  }

  for (const entry of accounts.couriers) {
    const reviews = await reviewRepo.find({ where: { targetType: 'courier', targetId: entry.courier.id, isPublished: true } });
    const delivered = await deliveryRepo.count({ where: { courierId: entry.courier.id, status: 'DELIVERED' } });
    entry.courier.ratingAvg = reviews.length ? Math.round((reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length) * 100) / 100 : entry.courier.ratingAvg;
    entry.courier.ratingCount = Math.max(reviews.length, entry.courier.ratingCount);
    entry.courier.completedDeliveries = delivered;
    await courierRepo.save(entry.courier);
  }
}
