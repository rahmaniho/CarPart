import {
  COMPATIBILITY_META,
  QUALITY_GRADES,
  QUALITY_META,
  formatJalali,
  formatToman,
  toPersianDigits,
  type Page,
  type QualityGrade,
} from '@carpart/contract';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Clock,
  FilePlus2,
  Filter,
  Heart,
  Layers,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Store,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { OfferCard } from '../components/catalog/OfferCard';
import { EmptyState, ErrorAlert, LoadingState, StatusBadge, StatusFromMap } from '../components/ui/Primitives';
import { api } from '../lib/api-client';
import type {
  BrandDto,
  CategoryNode,
  OfferSearchItem,
  PartDetailResponse,
  SavedVehicleDto,
  VehicleMakeDto,
  VehicleModelDto,
  VehicleVariantDto,
} from '../lib/types';
import { useAuthStore } from '../store/auth-store';
import { useToastStore } from '../store/toast-store';

/* =============================== صفحه اصلی =============================== */
export function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const [variantId, setVariantId] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => api.get<CategoryNode[]>('catalog/categories'),
  });

  const makesQuery = useQuery({
    queryKey: ['catalog-makes'],
    queryFn: () => api.get<VehicleMakeDto[]>('catalog/vehicle-makes'),
  });

  const modelsQuery = useQuery({
    queryKey: ['catalog-models', makeId],
    queryFn: () => api.get<VehicleModelDto[]>('catalog/vehicle-models', { makeId }),
    enabled: Boolean(makeId),
  });

  const variantsQuery = useQuery({
    queryKey: ['catalog-variants', modelId],
    queryFn: () => api.get<VehicleVariantDto[]>('catalog/vehicle-variants', { modelId }),
    enabled: Boolean(modelId),
  });

  const featuredOffersQuery = useQuery({
    queryKey: ['home-featured-offers'],
    queryFn: () =>
      api.get<Page<OfferSearchItem>>('catalog/search', {
        inStockOnly: 'true',
        sort: 'rank',
        pageSize: 6,
      }),
  });

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (makeId) params.set('makeId', makeId);
    if (modelId) params.set('modelId', modelId);
    if (variantId) params.set('variantId', variantId);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="space-y-8">
      {/* بخش جست‌وجوی اصلی و انتخاب خودرو */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="max-w-3xl space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            تطبیق فنی با خودرو • قیمت‌گذاری سمت سرور • تحویل با کد OTP
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl leading-snug">
            تأمین سریع و شفاف قطعات یدکی برای تعمیرگاه‌ها و ناوگان شهری
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            نام قطعه، کد فنی یا کد OEM را جست‌وجو کنید؛ سازگاری با خودرو، زمان آماده‌سازی و جزئیات امتیاز هر فروشنده پیش از
            پرداخت شفاف است.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mt-6 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute right-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جست‌وجوی قطعه (مثلاً: لنت ترمز پراید، فیلتر روغن، کمک فنر ۲۰۶، BP-131...)"
                className="cp-input pr-10 py-2.5"
              />
            </div>
            <button type="submit" className="cp-btn-primary px-6 py-2.5">
              جست‌وجو و مقایسه پیشنهادها
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
            <select
              value={makeId}
              onChange={(e) => {
                setMakeId(e.target.value);
                setModelId('');
                setVariantId('');
              }}
              aria-label="سازنده خودرو"
              className="cp-input text-xs"
            >
              <option value="">همه سازندگان خودرو (اختیاری)</option>
              {makesQuery.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nameFa}
                </option>
              ))}
            </select>

            <select
              value={modelId}
              disabled={!makeId}
              onChange={(e) => {
                setModelId(e.target.value);
                setVariantId('');
              }}
              aria-label="مدل خودرو"
              className="cp-input text-xs"
            >
              <option value="">همه مدل‌ها</option>
              {modelsQuery.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nameFa}
                </option>
              ))}
            </select>

            <select
              value={variantId}
              disabled={!modelId}
              onChange={(e) => setVariantId(e.target.value)}
              aria-label="تیپ خودرو"
              className="cp-input text-xs"
            >
              <option value="">همه تیپ‌ها</option>
              {variantsQuery.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nameFa} {v.engine ? `(${v.engine})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
            <span>جست‌وجوهای پرتکرار:</span>
            {['لنت ترمز', 'فیلتر روغن', 'واتر پمپ', 'کمک فنر', 'شمع موتور', 'تسمه تایم'].map((term) => (
              <Link
                key={term}
                to={`/search?q=${encodeURIComponent(term)}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              >
                {term}
              </Link>
            ))}
          </div>
        </form>
      </section>

      {/* دو مسیر سفارش در قطعه‌رسان */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="cp-card p-5 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              مسیر اول: خرید مستقیم از کاتالوگ
            </span>
            <h2 className="text-base font-extrabold text-slate-900">موجودی زنده، رزرو اتمیک و ارسال فوری</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              پیشنهادهای چند فروشنده را بر اساس سازگاری، قیمت کل، فاصله و اعتبار مقایسه کنید و مستقیم سفارش دهید.
            </p>
            <div className="pt-2">
              <Link to="/search" className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
                مشاهده پیشنهادهای آماده ارسال
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <div className="cp-card p-5 flex items-start justify-between gap-4 border-amber-200 bg-amber-50/30">
          <div className="space-y-1.5">
            <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
              مسیر دوم: استعلام قیمت رقابتی (RFQ)
            </span>
            <h2 className="text-base font-extrabold text-slate-900">قطعه کمیاب است یا کد فنی دقیق ندارید؟</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              مشخصات خودرو و قطعه موردنیاز را ثبت کنید تا فروشندگان تأییدشده نزدیک به شما، پیشنهاد قیمت و زمان تحویل بدهند.
            </p>
            <div className="pt-2">
              <Link
                to="/mechanic/requests/new"
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:underline"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                ثبت درخواست تأمین قطعه
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* دسته‌بندی‌های کاتالوگ */}
      {categoriesQuery.data && categoriesQuery.data.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <Layers className="h-5 w-5 text-brand-700" />
              دسته‌بندی‌های تخصصی قطعات
            </h2>
            <Link to="/search" className="text-xs font-bold text-brand-700 hover:underline">
              همه پیشنهادها
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categoriesQuery.data.map((cat) => (
              <Link
                key={cat.id}
                to={`/search?categoryId=${cat.id}`}
                className="cp-card p-3.5 text-center transition hover:border-brand-400 hover:bg-brand-50/30"
              >
                <p className="text-xs font-bold text-slate-900">{cat.nameFa}</p>
                {cat.children && cat.children.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {toPersianDigits(cat.children.length)} زیردسته
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* پیشنهادهای برتر لحظه‌ای */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">پیشنهادهای آماده تأمین (رتبه‌بندی شفاف سرور)</h2>
            <p className="text-xs text-slate-500">
              با کلیک روی «رتبه شفاف» در هر کارت، ریز امتیاز سازگاری، قیمت، فاصله و اعتبار فروشنده را ببینید.
            </p>
          </div>
          <Link to="/search" className="cp-btn-secondary text-xs">
            فیلتر پیشرفته
          </Link>
        </div>

        {featuredOffersQuery.isLoading ? (
          <LoadingState />
        ) : featuredOffersQuery.error ? (
          <ErrorAlert error={featuredOffersQuery.error} onRetry={() => featuredOffersQuery.refetch()} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featuredOffersQuery.data?.items.map((offer) => (
              <OfferCard key={offer.sellerProductId} offer={offer} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================ صفحه جست‌وجوی پیشرفته ============================ */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isMechanic = Boolean(user?.roles.includes('mechanic'));

  const q = searchParams.get('q') ?? '';
  const categoryId = searchParams.get('categoryId') ?? '';
  const brandId = searchParams.get('brandId') ?? '';
  const vehicleId = searchParams.get('vehicleId') ?? '';
  const quality = searchParams.get('quality') ?? '';
  const inStockOnly = searchParams.get('inStockOnly') ?? '';
  const sort = searchParams.get('sort') ?? 'rank';
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const [draftQ, setDraftQ] = useState(q);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  };

  const categoriesQuery = useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => api.get<CategoryNode[]>('catalog/categories'),
  });

  const brandsQuery = useQuery({
    queryKey: ['catalog-brands'],
    queryFn: () => api.get<BrandDto[]>('catalog/brands'),
  });

  const myVehiclesQuery = useQuery({
    queryKey: ['mechanic-vehicles'],
    queryFn: () => api.get<SavedVehicleDto[]>('workshops/me/vehicles'),
    enabled: isMechanic,
  });

  const searchQuery = useQuery({
    queryKey: ['catalog-search', q, categoryId, brandId, vehicleId, quality, inStockOnly, sort, page],
    queryFn: () =>
      api.get<Page<OfferSearchItem>>('catalog/search', {
        q: q || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        vehicleId: vehicleId || undefined,
        makeId: searchParams.get('makeId') || undefined,
        modelId: searchParams.get('modelId') || undefined,
        variantId: searchParams.get('variantId') || undefined,
        quality: quality || undefined,
        inStockOnly: inStockOnly || undefined,
        sort,
        page,
        pageSize: 12,
      }),
  });

  const flatCategories: CategoryNode[] = [];
  for (const cat of categoriesQuery.data ?? []) {
    flatCategories.push(cat);
    for (const child of cat.children ?? []) flatCategories.push(child);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* ستون فیلترها */}
      <aside className="lg:col-span-3 space-y-4">
        <div className="cp-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
              <Filter className="h-4 w-4 text-brand-700" />
              فیلترهای تخصصی قطعه
            </h2>
            {(q || categoryId || brandId || vehicleId || quality || inStockOnly) && (
              <button
                type="button"
                onClick={() => {
                  setDraftQ('');
                  setSearchParams(new URLSearchParams());
                }}
                className="text-[11px] font-semibold text-rose-600 hover:underline"
              >
                پاک‌سازی همه
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateParam('q', draftQ.trim());
            }}
            className="space-y-2"
          >
            <label className="cp-label">عبارت جست‌وجو یا کد فنی</label>
            <div className="flex gap-1.5">
              <input
                type="search"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="مثلاً: لنت ترمز یا BP-131"
                className="cp-input text-xs"
              />
              <button type="submit" className="cp-btn-primary px-3 py-2 text-xs">
                اعمال
              </button>
            </div>
          </form>

          {isMechanic && myVehiclesQuery.data && myVehiclesQuery.data.length > 0 && (
            <div>
              <label className="cp-label flex items-center gap-1">
                <Car className="h-3.5 w-3.5 text-brand-600" />
                بررسی سازگاری با خودرو تعمیرگاه
              </label>
              <select
                value={vehicleId}
                onChange={(e) => updateParam('vehicleId', e.target.value)}
                className="cp-input text-xs"
              >
                <option value="">بدون انتخاب خودرو ذخیره‌شده</option>
                {myVehiclesQuery.data.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nickname || v.freeModelName} {v.plate ? `(${v.plate})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="cp-label">دسته‌بندی قطعه</label>
            <select
              value={categoryId}
              onChange={(e) => updateParam('categoryId', e.target.value)}
              className="cp-input text-xs"
            >
              <option value="">همه دسته‌ها</option>
              {flatCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? `— ${c.nameFa}` : c.nameFa}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cp-label">برند سازنده قطعه</label>
            <select value={brandId} onChange={(e) => updateParam('brandId', e.target.value)} className="cp-input text-xs">
              <option value="">همه برندها</option>
              {brandsQuery.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameFa} {b.isOem ? '(OEM)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="cp-label">درجه کیفی قطعه</label>
            <select value={quality} onChange={(e) => updateParam('quality', e.target.value)} className="cp-input text-xs">
              <option value="">همه سطوح کیفی</option>
              {QUALITY_GRADES.map((g: QualityGrade) => (
                <option key={g} value={g}>
                  {QUALITY_META[g].fa}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={inStockOnly === 'true'}
              onChange={(e) => updateParam('inStockOnly', e.target.checked ? 'true' : '')}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            فقط پیشنهادهای دارای موجودی آماده
          </label>
        </div>
      </aside>

      {/* نتایج جست‌وجو */}
      <div className="lg:col-span-9 space-y-4">
        <div className="cp-card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="text-xs text-slate-600">
            نتیجه جست‌وجو:{' '}
            <strong className="font-extrabold text-slate-900">
              {toPersianDigits(searchQuery.data?.meta.total ?? 0)}
            </strong>{' '}
            پیشنهاد فروش فعال
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">مرتب‌سازی:</span>
            <select
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
              aria-label="مرتب‌سازی نتایج"
              className="cp-input py-1.5 text-xs w-auto"
            >
              <option value="rank">بهترین رتبه ترکیبی (پیشنهادی)</option>
              <option value="price_asc">ارزان‌ترین قیمت</option>
              <option value="price_desc">گران‌ترین قیمت</option>
              <option value="distance">نزدیک‌ترین فروشگاه</option>
              <option value="rating">بالاترین امتیاز فروشنده</option>
              <option value="newest">جدیدترین به‌روزرسانی</option>
            </select>
          </div>
        </div>

        {searchQuery.isLoading ? (
          <LoadingState />
        ) : searchQuery.error ? (
          <ErrorAlert error={searchQuery.error} onRetry={() => searchQuery.refetch()} />
        ) : !searchQuery.data?.items.length ? (
          <EmptyState
            title="پیشنهادی با این فیلترها در کاتالوگ فوری یافت نشد"
            description="می‌توانید همین قطعه را به‌صورت «درخواست تأمین» ثبت کنید تا فروشندگان مرتبط موجودی انبار خود را پیشنهاد دهند."
            action={
              <Link
                to={`/mechanic/requests/new${q ? `?part=${encodeURIComponent(q)}` : ''}`}
                className="cp-btn-accent"
              >
                <FilePlus2 className="h-4 w-4" />
                ثبت درخواست تأمین برای «{q || 'قطعه موردنظر'}»
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {searchQuery.data.items.map((offer) => (
                <OfferCard key={offer.sellerProductId} offer={offer} />
              ))}
            </div>

            {searchQuery.data.meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  type="button"
                  disabled={!searchQuery.data.meta.hasPrevious}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('page', String(page - 1));
                    setSearchParams(next);
                  }}
                  className="cp-btn-secondary text-xs"
                >
                  صفحه قبل
                </button>
                <span className="text-xs font-semibold text-slate-600 px-3">
                  صفحه {toPersianDigits(page)} از {toPersianDigits(searchQuery.data.meta.totalPages)}
                </span>
                <button
                  type="button"
                  disabled={!searchQuery.data.meta.hasNext}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('page', String(page + 1));
                    setSearchParams(next);
                  }}
                  className="cp-btn-secondary text-xs"
                >
                  صفحه بعد
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ============================ جزئیات قطعه کاتالوگ ============================ */
export function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);

  const detailQuery = useQuery({
    queryKey: ['part-detail', id],
    queryFn: () => api.get<PartDetailResponse>(`catalog/parts/${id}`),
    enabled: Boolean(id),
  });

  const handleFavorite = async () => {
    if (!id) return;
    try {
      await api.post('workshops/me/favorites', {
        kind: 'part',
        refId: id,
        label: detailQuery.data?.part.nameFa,
      });
      pushToast({ tone: 'success', title: 'قطعه به فهرست علاقه‌مندی‌های تعمیرگاه افزوده شد' });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'امکان افزودن به علاقه‌مندی‌ها نبود',
        detail: err instanceof Error ? err.message : undefined,
      });
    }
  };

  if (detailQuery.isLoading) return <LoadingState />;
  if (detailQuery.error || !detailQuery.data) {
    return <ErrorAlert error={detailQuery.error} onRetry={() => detailQuery.refetch()} />;
  }

  const { part, offers, compatibilities, related } = detailQuery.data;

  return (
    <div className="space-y-6">
      <div className="cp-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {part.category && <StatusBadge tone="info" label={part.category.nameFa} size="xs" />}
              <StatusFromMap value={part.defaultQuality} map={QUALITY_META} size="xs" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">{part.nameFa}</h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              {part.brand && <span>سازنده قطعه: {part.brand.nameFa}</span>}
              {part.technicalCode && (
                <span>
                  کد فنی: <strong className="font-mono text-slate-800 ltr-num">{part.technicalCode}</strong>
                </span>
              )}
              {part.oemCode && (
                <span>
                  شماره OEM: <strong className="font-mono text-slate-800 ltr-num">{part.oemCode}</strong>
                </span>
              )}
              {part.referencePrice !== null && <span>قیمت مرجع کاتالوگ: {formatToman(part.referencePrice)}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user?.roles.includes('mechanic') && (
              <button type="button" onClick={handleFavorite} className="cp-btn-secondary text-xs">
                <Heart className="h-4 w-4 text-rose-500" />
                افزودن به علاقه‌مندی‌ها
              </button>
            )}
            <Link
              to={`/mechanic/requests/new?part=${encodeURIComponent(part.nameFa)}`}
              className="cp-btn-accent text-xs"
            >
              استعلام قیمت از فروشندگان
            </Link>
          </div>
        </div>

        {part.description && <p className="text-sm text-slate-600 leading-relaxed">{part.description}</p>}

        {compatibilities.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <h2 className="text-xs font-bold text-slate-800 mb-2">رکوردهای سازگاری ثبت‌شده در کاتالوگ:</h2>
            <div className="flex flex-wrap gap-2">
              {compatibilities.map((comp) => (
                <div
                  key={comp.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                >
                  <StatusFromMap value={comp.level} map={COMPATIBILITY_META} size="xs" />
                  {comp.engine && <span>موتور {comp.engine}</span>}
                  {comp.yearFrom && (
                    <span>
                      سال {toPersianDigits(comp.yearFrom)}
                      {comp.yearTo && comp.yearTo !== comp.yearFrom ? ` تا ${toPersianDigits(comp.yearTo)}` : ''}
                    </span>
                  )}
                  {comp.note && <span className="text-slate-500">({comp.note})</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* پیشنهادهای فروشندگان برای این قطعه */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-slate-900">
          پیشنهاد فروشندگان برای این قطعه ({toPersianDigits(offers.length)} پیشنهاد)
        </h2>
        {offers.length === 0 ? (
          <EmptyState
            title="در حال حاضر هیچ فروشنده‌ای موجودی فعال برای این قطعه ثبت نکرده است"
            description="با ثبت درخواست تأمین قطعه، این نیاز مستقیماً به فروشندگان مرتبط ارسال می‌شود."
            action={
              <Link to={`/mechanic/requests/new?part=${encodeURIComponent(part.nameFa)}`} className="cp-btn-accent">
                ثبت درخواست تأمین قطعه
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <OfferCard key={offer.sellerProductId} offer={offer} />
            ))}
          </div>
        )}
      </section>

      {related.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-slate-800">قطعات هم‌گروه در این دسته:</h3>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.id}
                to={`/parts/${r.id}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700"
              >
                {r.nameFa}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================ پروفایل عمومی فروشگاه ============================ */
interface PublicSellerDto {
  id: string;
  storeName: string;
  city: string | null;
  description: string | null;
  ratingAvg: number;
  ratingCount: number;
  completedOrders: number;
  avgResponseMinutes: number | null;
  branches: Array<{
    id: string;
    name: string;
    city: string | null;
    prepTimeMinutes: number;
    serviceRadiusKm: number;
    isOpenNow: boolean;
  }>;
}

interface PublicReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  hadIssue: boolean;
  createdAt: string;
}

export function PublicSellerPage() {
  const { id } = useParams<{ id: string }>();

  const sellerQuery = useQuery({
    queryKey: ['public-seller', id],
    queryFn: () => api.get<PublicSellerDto>(`public/sellers/${id}`),
    enabled: Boolean(id),
  });

  const reviewsQuery = useQuery({
    queryKey: ['public-seller-reviews', id],
    queryFn: () => api.get<Page<PublicReviewItem>>('public/reviews', { targetType: 'seller', targetId: id }),
    enabled: Boolean(id),
  });

  if (sellerQuery.isLoading) return <LoadingState />;
  if (sellerQuery.error || !sellerQuery.data) {
    return <ErrorAlert error={sellerQuery.error} onRetry={() => sellerQuery.refetch()} />;
  }

  const seller = sellerQuery.data;

  return (
    <div className="space-y-6">
      <div className="cp-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              فروشگاه احرازهویت‌شده در قطعه‌رسان
            </div>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
              <Store className="h-6 w-6 text-brand-700" />
              {seller.storeName}
            </h1>
            {seller.description && <p className="text-sm text-slate-600">{seller.description}</p>}
          </div>

          <div className="flex flex-wrap gap-3 text-center">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <span className="flex items-center justify-center gap-1 text-base font-extrabold text-amber-700">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                {toPersianDigits(seller.ratingAvg.toFixed(1))}
              </span>
              <span className="text-[11px] text-slate-500">{toPersianDigits(seller.ratingCount)} دیدگاه</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <span className="block text-base font-extrabold text-slate-900">
                {toPersianDigits(seller.completedOrders)}
              </span>
              <span className="text-[11px] text-slate-500">سفارش تکمیل‌شده</span>
            </div>
            {seller.avgResponseMinutes !== null && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <span className="block text-base font-extrabold text-brand-700">
                  {toPersianDigits(seller.avgResponseMinutes)} دقیقه
                </span>
                <span className="text-[11px] text-slate-500">میانگین پاسخ استعلام</span>
              </div>
            )}
          </div>
        </div>

        {/* شعبه‌ها */}
        <div className="border-t border-slate-100 pt-4">
          <h2 className="text-sm font-bold text-slate-900 mb-3">شعبه‌های فعال و محدوده پوشش</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {seller.branches.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-200 p-3.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{b.name}</span>
                  <StatusBadge
                    tone={b.isOpenNow ? 'success' : 'neutral'}
                    label={b.isOpenNow ? 'هم‌اکنون باز است' : 'خارج از ساعت کاری'}
                    size="xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-slate-500">
                  {b.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {b.city} (شعاع {toPersianDigits(b.serviceRadiusKm)} کیلومتر)
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    آماده‌سازی پایه: {toPersianDigits(b.prepTimeMinutes)} دقیقه
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* دیدگاه‌های ثبت‌شده خریداران واقعی */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-slate-900">بازخورد تعمیرگاه‌ها از خریدهای تحویل‌شده</h2>
        {!reviewsQuery.data?.items.length ? (
          <EmptyState title="هنوز دیدگاه منتشرشده‌ای برای این فروشگاه ثبت نشده است" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {reviewsQuery.data.items.map((rev) => (
              <div key={rev.id} className="cp-card p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-700">امتیاز: {toPersianDigits(rev.rating)} از ۵</span>
                  <span className="text-slate-400">{formatJalali(rev.createdAt)}</span>
                </div>
                {rev.comment && <p className="text-slate-700 leading-relaxed">{rev.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
