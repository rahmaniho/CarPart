import type { DataSource } from 'typeorm';
import { normalizeFa, searchTokens } from '@carpart/contract';
import { PartBrand } from '../modules/catalog/entities/part-brand.entity';
import { PartCategory } from '../modules/catalog/entities/part-category.entity';
import { PartCompatibility } from '../modules/catalog/entities/part-compatibility.entity';
import { Part } from '../modules/catalog/entities/part.entity';
import { VehicleMake, VehicleModel, VehicleVariant } from '../modules/catalog/entities/vehicle-catalog.entity';

export interface CatalogRefs {
  categories: Record<string, PartCategory>;
  brands: Record<string, PartBrand>;
  makes: Record<string, VehicleMake>;
  models: Record<string, VehicleModel>;
  variants: Record<string, VehicleVariant>;
  parts: Record<string, Part>;
}

const CATEGORIES = [
  { key: 'brake', nameFa: 'ترمز', nameEn: 'Brakes', icon: 'brake-disc' },
  { key: 'filters', nameFa: 'فیلترها', nameEn: 'Filters', icon: 'filter' },
  { key: 'electrical', nameFa: 'برق و باتری', nameEn: 'Electrical', icon: 'battery' },
  { key: 'engine', nameFa: 'موتور و روان‌کاری', nameEn: 'Engine', icon: 'engine' },
  { key: 'suspension', nameFa: 'تعلیق و جلوبندی', nameEn: 'Suspension', icon: 'suspension' },
  { key: 'body', nameFa: 'بدنه و چراغ', nameEn: 'Body', icon: 'car-body' },
];

const BRANDS = [
  { key: 'isaco', nameFa: 'ایساکو', nameEn: 'Isaco', country: 'ایران', isOem: true },
  { key: 'saipayadak', nameFa: 'سایپا یدک', nameEn: 'Saipa Yadak', country: 'ایران', isOem: true },
  { key: 'crouse', nameFa: 'کروز', nameEn: 'Crouse', country: 'ایران', isOem: false },
  { key: 'bosch', nameFa: 'بوش', nameEn: 'Bosch', country: 'آلمان', isOem: false },
  { key: 'valeo', nameFa: 'والئو', nameEn: 'Valeo', country: 'فرانسه', isOem: false },
  { key: 'mann', nameFa: 'مان', nameEn: 'Mann Filter', country: 'آلمان', isOem: false },
];

const VEHICLES = [
  {
    key: 'saipa',
    nameFa: 'سایپا',
    nameEn: 'Saipa',
    models: [
      {
        key: 'pride',
        nameFa: 'پراید',
        yearFrom: 1372,
        yearTo: 1400,
        variants: [
          { key: 'pride-131', nameFa: 'پراید ۱۳۱', engine: '۱.۳ لیتری', yearFrom: 1390, yearTo: 1400 },
          { key: 'pride-132', nameFa: 'پراید ۱۳۲', engine: '۱.۳ لیتری', yearFrom: 1388, yearTo: 1399 },
          { key: 'pride-141', nameFa: 'پراید ۱۴۱', engine: '۱.۳ لیتری', yearFrom: 1385, yearTo: 1395 },
        ],
      },
      {
        key: 'tiba',
        nameFa: 'تیبا',
        yearFrom: 1390,
        yearTo: 1402,
        variants: [
          { key: 'tiba-sedan', nameFa: 'تیبا صندوق‌دار', engine: '۱.۵ لیتری M15', yearFrom: 1390, yearTo: 1402 },
          { key: 'tiba-hatch', nameFa: 'تیبا هاچ‌بک', engine: '۱.۵ لیتری M15', yearFrom: 1393, yearTo: 1402 },
        ],
      },
      { key: 'shahin', nameFa: 'شاهین', yearFrom: 1400, yearTo: 1404, variants: [{ key: 'shahin-mt', nameFa: 'شاهین دنده‌ای', engine: '۱.۵ لیتری توربو', yearFrom: 1400, yearTo: 1404 }] },
    ],
  },
  {
    key: 'ikco',
    nameFa: 'ایران خودرو',
    nameEn: 'IKCO',
    models: [
      {
        key: 'peugeot206',
        nameFa: 'پژو ۲۰۶',
        yearFrom: 1381,
        yearTo: 1402,
        variants: [
          { key: 'p206-type2', nameFa: 'پژو ۲۰۶ تیپ ۲', engine: '۱.۴ لیتری TU3', yearFrom: 1381, yearTo: 1402 },
          { key: 'p206-type5', nameFa: 'پژو ۲۰۶ تیپ ۵', engine: '۱.۶ لیتری TU5', yearFrom: 1383, yearTo: 1402 },
        ],
      },
      {
        key: 'peugeot405',
        nameFa: 'پژو ۴۰۵',
        yearFrom: 1372,
        yearTo: 1400,
        variants: [
          { key: 'p405-glx', nameFa: 'پژو ۴۰۵ GLX', engine: '۱.۸ لیتری XU7', yearFrom: 1372, yearTo: 1400 },
          { key: 'p405-slx', nameFa: 'پژو ۴۰۵ SLX', engine: '۱.۷ لیتری CVVT', yearFrom: 1388, yearTo: 1400 },
        ],
      },
      { key: 'samand', nameFa: 'سمند LX', yearFrom: 1382, yearTo: 1402, variants: [{ key: 'samand-lx', nameFa: 'سمند LX', engine: '۱.۸ لیتری XU7', yearFrom: 1382, yearTo: 1402 }] },
      { key: 'dena', nameFa: 'دنا', yearFrom: 1393, yearTo: 1404, variants: [{ key: 'dena-plus', nameFa: 'دنا پلاس', engine: '۱.۷ لیتری EF7 توربو', yearFrom: 1396, yearTo: 1404 }] },
    ],
  },
];

interface PartSeed {
  key: string;
  nameFa: string;
  category: string;
  brand?: string;
  technicalCode?: string;
  oemCode?: string;
  unit?: string;
  defaultQuality?: Part['defaultQuality'];
  isCompatibilityCritical?: boolean;
  referencePrice?: number;
  description?: string;
  /** سازگاری‌ها: کلید مدل یا واریانت + بازه سال + سطح */
  fits: Array<{ model?: string; variant?: string; yearFrom?: number; yearTo?: number; level?: 'exact' | 'likely'; note?: string }>;
}

const PARTS: PartSeed[] = [
  {
    key: 'pride-front-brake-pad',
    nameFa: 'لنت ترمز جلو پراید',
    category: 'brake',
    brand: 'crouse',
    technicalCode: 'CR-BP-1310',
    oemCode: 'M3302010',
    defaultQuality: 'aftermarket_high',
    referencePrice: 685_000,
    description: 'لنت ترمز جلو با آلیاژ کم‌فلز، مناسب رانندگی شهری.',
    fits: [
      { variant: 'pride-131', yearFrom: 1390, yearTo: 1400 },
      { variant: 'pride-132', yearFrom: 1388, yearTo: 1399 },
      { variant: 'pride-141', yearFrom: 1385, yearTo: 1395 },
    ],
  },
  {
    key: 'p206-front-brake-pad',
    nameFa: 'لنت ترمز جلو پژو ۲۰۶ تیپ ۵',
    category: 'brake',
    brand: 'valeo',
    technicalCode: 'VL-578320',
    oemCode: '4252-48',
    defaultQuality: 'oem',
    referencePrice: 1_480_000,
    fits: [
      { variant: 'p206-type5', yearFrom: 1383, yearTo: 1402 },
      { variant: 'p206-type2', yearFrom: 1381, yearTo: 1402, level: 'likely', note: 'برای تیپ ۲ نیاز به تطبیق سیلندر چرخ دارد' },
    ],
  },
  {
    key: 'pride-front-brake-disc',
    nameFa: 'دیسک چرخ جلو پراید',
    category: 'brake',
    brand: 'isaco',
    technicalCode: 'IS-3311220',
    oemCode: 'M3301011',
    defaultQuality: 'genuine',
    referencePrice: 1_120_000,
    unit: 'جفت',
    fits: [{ model: 'pride', yearFrom: 1372, yearTo: 1400 }],
  },
  {
    key: 'pride-oil-filter',
    nameFa: 'فیلتر روغن پراید و تیبا',
    category: 'filters',
    brand: 'mann',
    technicalCode: 'MN-W542',
    defaultQuality: 'aftermarket_high',
    referencePrice: 145_000,
    fits: [{ model: 'pride' }, { model: 'tiba' }],
  },
  {
    key: 'p405-air-filter',
    nameFa: 'فیلتر هوای پژو ۴۰۵',
    category: 'filters',
    brand: 'bosch',
    technicalCode: 'BS-S9240',
    defaultQuality: 'aftermarket_high',
    referencePrice: 210_000,
    fits: [{ model: 'peugeot405' }, { model: 'samand' }],
  },
  {
    key: 'p206-cabin-filter',
    nameFa: 'فیلتر کابین پژو ۲۰۶',
    category: 'filters',
    brand: 'crouse',
    technicalCode: 'CR-CF-2061',
    defaultQuality: 'aftermarket_economy',
    referencePrice: 165_000,
    fits: [{ model: 'peugeot206' }],
  },
  {
    key: 'battery-60ah',
    nameFa: 'باتری ۶۰ آمپر اتمی',
    category: 'electrical',
    defaultQuality: 'genuine',
    referencePrice: 3_850_000,
    isCompatibilityCritical: false,
    description: 'قطعه عمومی؛ برای خودروهای سواری داخلی قابل استفاده است.',
    fits: [{ model: 'pride', level: 'likely' }],
  },
  {
    key: 'spark-plug-ngk',
    nameFa: 'شمع موتور NGK',
    category: 'electrical',
    technicalCode: 'NGK-BKR6E',
    defaultQuality: 'oem',
    referencePrice: 235_000,
    unit: 'عدد',
    isCompatibilityCritical: false,
    fits: [],
  },
  {
    key: 'pride-ignition-wire',
    nameFa: 'وایر شمع پراید',
    category: 'electrical',
    brand: 'crouse',
    technicalCode: 'CR-IW-131',
    defaultQuality: 'aftermarket_high',
    referencePrice: 480_000,
    unit: 'دست',
    fits: [{ model: 'pride' }],
  },
  {
    key: 'engine-oil-10w40',
    nameFa: 'روغن موتور ۱۰W۴۰ نیمه‌سنتتیک',
    category: 'engine',
    defaultQuality: 'genuine',
    referencePrice: 980_000,
    unit: 'لیتر',
    isCompatibilityCritical: false,
    fits: [],
  },
  {
    key: 'tiba-fuel-filter',
    nameFa: 'فیلتر بنزین تیبا',
    category: 'engine',
    brand: 'saipayadak',
    technicalCode: 'SY-FB-1500',
    defaultQuality: 'oem',
    referencePrice: 120_000,
    fits: [{ model: 'tiba' }],
  },
  {
    key: 'p206-front-shock',
    nameFa: 'کمک فنر جلو پژو ۲۰۶',
    category: 'suspension',
    brand: 'isaco',
    technicalCode: 'IS-SA-2061',
    oemCode: '5202-EP',
    defaultQuality: 'genuine',
    referencePrice: 2_150_000,
    fits: [{ model: 'peugeot206' }],
  },
  {
    key: 'pride-steering-ball-joint',
    nameFa: 'سیبک فرمان پراید',
    category: 'suspension',
    brand: 'crouse',
    technicalCode: 'CR-SBJ-131',
    defaultQuality: 'aftermarket_high',
    referencePrice: 340_000,
    fits: [{ model: 'pride' }, { model: 'tiba' }],
  },
  {
    key: 'p405-headlight-left',
    nameFa: 'چراغ جلو چپ پژو ۴۰۵',
    category: 'body',
    brand: 'isaco',
    oemCode: '6205-E9',
    defaultQuality: 'oem',
    referencePrice: 2_680_000,
    fits: [{ variant: 'p405-glx' }, { variant: 'p405-slx' }],
  },
  {
    key: 'p206-side-mirror-right',
    nameFa: 'آینه بغل راست پژو ۲۰۶',
    category: 'body',
    defaultQuality: 'aftermarket_economy',
    referencePrice: 890_000,
    fits: [{ model: 'peugeot206' }],
  },
  {
    key: 'peugeot-timing-belt',
    nameFa: 'تسمه تایم پژو XU7',
    category: 'engine',
    brand: 'bosch',
    technicalCode: 'BS-TB-1446',
    defaultQuality: 'oem',
    referencePrice: 640_000,
    fits: [{ model: 'peugeot405' }, { model: 'samand' }],
  },
  {
    key: 'pride-water-pump',
    nameFa: 'واتر پمپ پراید',
    category: 'engine',
    brand: 'saipayadak',
    technicalCode: 'SY-WP-131',
    defaultQuality: 'oem',
    referencePrice: 720_000,
    fits: [{ model: 'pride' }],
  },
  {
    key: 'dena-radiator',
    nameFa: 'رادیاتور آب دنا پلاس',
    category: 'engine',
    brand: 'isaco',
    technicalCode: 'IS-RD-DP',
    defaultQuality: 'genuine',
    referencePrice: 3_450_000,
    fits: [{ variant: 'dena-plus' }],
  },
];

/** ساخت کاتالوگ پایه (دسته‌ها، برندها، خودروها، قطعات و سازگاری‌ها). */
export async function seedCatalog(dataSource: DataSource, actorId: string): Promise<CatalogRefs> {
  const categories = new Map<string, PartCategory>();
  const categoryRepo = dataSource.getRepository(PartCategory);
  for (const [index, item] of CATEGORIES.entries()) {
    const existing = await categoryRepo.findOne({ where: { slug: `cat-${item.key}` } });
    if (existing) {
      categories.set(item.key, existing);
      continue;
    }
    categories.set(
      item.key,
      await categoryRepo.save(
        categoryRepo.create({
          nameFa: item.nameFa,
          nameEn: item.nameEn,
          slug: `cat-${item.key}`,
          parentId: null,
          icon: item.icon,
          sortOrder: index + 1,
          searchKey: normalizeFa(`${item.nameFa} ${item.nameEn}`),
          description: null,
          isActive: true,
        }),
      ),
    );
  }

  const brands = new Map<string, PartBrand>();
  const brandRepo = dataSource.getRepository(PartBrand);
  for (const [index, item] of BRANDS.entries()) {
    const existing = await brandRepo.findOne({ where: { slug: `brand-${item.key}` } });
    if (existing) {
      brands.set(item.key, existing);
      continue;
    }
    brands.set(
      item.key,
      await brandRepo.save(
        brandRepo.create({
          nameFa: item.nameFa,
          nameEn: item.nameEn,
          slug: `brand-${item.key}`,
          country: item.country,
          isOem: item.isOem,
          logoUrl: null,
          searchKey: normalizeFa(`${item.nameFa} ${item.nameEn}`),
          sortOrder: index + 1,
          isActive: true,
        }),
      ),
    );
  }

  const makes = new Map<string, VehicleMake>();
  const models = new Map<string, VehicleModel>();
  const variants = new Map<string, VehicleVariant>();
  const makeRepo = dataSource.getRepository(VehicleMake);
  const modelRepo = dataSource.getRepository(VehicleModel);
  const variantRepo = dataSource.getRepository(VehicleVariant);

  for (const [index, make] of VEHICLES.entries()) {
    const existingMake = await makeRepo.findOne({ where: { slug: `make-${make.key}` } });
    const savedMake =
      existingMake ??
      (await makeRepo.save(
        makeRepo.create({
          nameFa: make.nameFa,
          nameEn: make.nameEn ?? null,
          slug: `make-${make.key}`,
          country: 'ایران',
          searchKey: normalizeFa(make.nameFa),
          sortOrder: index + 1,
          isActive: true,
        }),
      ));
    makes.set(make.key, savedMake);

    for (const model of make.models) {
      const existingModel = await modelRepo.findOne({ where: { slug: `model-${model.key}` } });
      const savedModel =
        existingModel ??
        (await modelRepo.save(
          modelRepo.create({
            makeId: savedMake.id,
            nameFa: model.nameFa,
            nameEn: null,
            slug: `model-${model.key}`,
            bodyType: 'sedan',
            yearFrom: model.yearFrom,
            yearTo: model.yearTo,
            searchKey: normalizeFa(`${make.nameFa} ${model.nameFa}`),
            isActive: true,
          }),
        ));
      models.set(model.key, savedModel);

      for (const variant of model.variants) {
        const existingVariant = await variantRepo.findOne({ where: { modelId: savedModel.id, nameFa: variant.nameFa } });
        const savedVariant =
          existingVariant ??
          (await variantRepo.save(
            variantRepo.create({
              modelId: savedModel.id,
              nameFa: variant.nameFa,
              engine: variant.engine,
              gearbox: 'دنده‌ای',
              yearFrom: variant.yearFrom,
              yearTo: variant.yearTo,
              searchKey: normalizeFa(variant.nameFa),
              isActive: true,
            }),
          ));
        variants.set(variant.key, savedVariant);
      }
    }
  }

  const parts = new Map<string, Part>();
  const partRepo = dataSource.getRepository(Part);
  const compatRepo = dataSource.getRepository(PartCompatibility);
  const modelById = new Map([...models.values()].map((model) => [model.id, model]));

  for (const seed of PARTS) {
    const existing = await partRepo.findOne({ where: { technicalCode: seed.technicalCode ?? `seed-${seed.key}` } });
    const nameFa = normalizeFa(seed.nameFa);
    const part =
      existing ??
      (await partRepo.save(
        partRepo.create({
          nameFa,
          nameEn: null,
          categoryId: categories.get(seed.category)?.id ?? '',
          brandId: seed.brand ? (brands.get(seed.brand)?.id ?? null) : null,
          technicalCode: seed.technicalCode ?? `seed-${seed.key}`,
          oemCode: seed.oemCode ?? null,
          description: seed.description ?? null,
          specs: null,
          images: null,
          defaultQuality: seed.defaultQuality ?? 'unknown',
          unit: seed.unit ?? 'عدد',
          minOrderQty: 1,
          isCompatibilityCritical: seed.isCompatibilityCritical ?? true,
          searchKey: normalizeFa(`${seed.nameFa} ${seed.technicalCode ?? ''} ${seed.oemCode ?? ''} ${brands.get(seed.brand ?? '')?.nameFa ?? ''}`),
          searchTokens: searchTokens(`${seed.nameFa} ${seed.technicalCode ?? ''}`),
          referencePrice: seed.referencePrice ?? null,
          isActive: true,
          createdBy: actorId,
        }),
      ));
    parts.set(seed.key, part);

    const compatCount = await compatRepo.count({ where: { partId: part.id } });
    if (compatCount === 0) {
      for (const fit of seed.fits) {
        const model = fit.model ? models.get(fit.model) : undefined;
        const variant = fit.variant ? variants.get(fit.variant) : undefined;
        const resolvedModel = variant ? modelById.get(variant.modelId) : model;
        await compatRepo.save(
          compatRepo.create({
            partId: part.id,
            makeId: resolvedModel?.makeId ?? null,
            modelId: resolvedModel?.id ?? null,
            variantId: variant?.id ?? null,
            yearFrom: fit.yearFrom ?? variant?.yearFrom ?? model?.yearFrom ?? null,
            yearTo: fit.yearTo ?? variant?.yearTo ?? model?.yearTo ?? null,
            engine: variant?.engine ?? null,
            level: fit.level ?? 'exact',
            note: fit.note ?? null,
            source: 'admin',
            isActive: true,
          }),
        );
      }
    }
  }

  return {
    categories: Object.fromEntries(categories),
    brands: Object.fromEntries(brands),
    makes: Object.fromEntries(makes),
    models: Object.fromEntries(models),
    variants: Object.fromEntries(variants),
    parts: Object.fromEntries(parts),
  };
}
