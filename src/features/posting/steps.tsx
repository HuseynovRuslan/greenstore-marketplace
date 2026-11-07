'use client'

import { Shovel, Sprout } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { CharCount, TextAreaField, TextField } from '@/components/ui/Field'
import { ChoiceCard, FieldGroup, PhoneField, Switch } from '@/components/ui/FormControls'
import { Listbox } from '@/components/ui/Listbox'
import { cities } from '@/data/cities'
import { productCategories } from '@/data/categories'
import { subcategoriesByCategory } from '@/features/search/taxonomy'
import { monthName, cn } from '@/lib/format'
import { isCompletePhone } from '@/lib/phone'
import type { UserProfile } from '@/types'
import { PLANT_CATEGORIES, SERVICE_CATEGORY, unitOptions, visibleAttributes, type AttrDef } from './attributes'
import { DESCRIPTION_MAX, TITLE_MAX, serviceTypes, withCategory, type PostingDraft } from './draft'
import { RadioPills, TogglePills, UnitInput } from './ui'
import { fieldDomId } from './validation'

export interface StepProps {
  draft: PostingDraft
  update: (patch: Partial<PostingDraft> | ((d: PostingDraft) => PostingDraft)) => void
  /** The error to show for a field (after «Davam et», or once the field was left) */
  error: (key: string) => string | undefined
  /** Marks a field as visited (its error may show from now on) */
  touch: (key: string) => void
  user: UserProfile | null
}

const id = fieldDomId

/* ---------- 1 · Kateqoriya ---------- */

export function CategoryStep({ draft, update, error }: StepProps) {
  const subs = draft.kind === 'service' ? serviceTypes : (subcategoriesByCategory[draft.categoryId] ?? [])
  if (draft.editing) {
    // Editing a published listing: the category can't change (a different plant is a new listing).
    const name = productCategories.find((c) => c.id === draft.categoryId)?.name ?? 'Bağ xidmətləri'
    return (
      <div className="flex flex-col gap-5">
        <p className="text-[15px] leading-[1.5] text-ink">
          Kateqoriya: <span className="font-semibold">{[name, draft.subcategory].filter(Boolean).join(' / ')}</span>
        </p>
        <p className="rounded-xl bg-mint p-4 text-sm leading-[1.5] text-ink">
          Dərc olunmuş elanın kateqoriyasını dəyişmək olmur. Başqa bitki satırsınızsa, yeni elan yerləşdirin.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-7">
      <FieldGroup legend="Elanın növü" error={error('kind')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceCard
            id={id('kind')}
            name="kind"
            value="product"
            checked={draft.kind === 'product'}
            onChange={() => update((d) => (d.kind === 'product' ? d : { ...d, kind: 'product', categoryId: '', subcategory: '', attrs: {} }))}
            icon={<Sprout size={22} strokeWidth={1.8} />}
            title="Məhsul satıram"
            description="Ağac, fidan, gül, otaq bitkisi, toxum, gübrə, alət"
          />
          <ChoiceCard
            name="kind"
            value="service"
            checked={draft.kind === 'service'}
            onChange={() => update((d) => withCategory(d, 'service', SERVICE_CATEGORY))}
            icon={<Shovel size={22} strokeWidth={1.8} />}
            title="Xidmət göstərirəm"
            description="Landşaft dizaynı, əkin, çim, suvarma, bağ baxımı"
          />
        </div>
      </FieldGroup>

      {draft.kind === 'product' && (
        <FieldGroup legend="Kateqoriya" error={error('categoryId')}>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {productCategories.map((c, i) => {
              const on = draft.categoryId === c.id
              return (
                <label
                  key={c.id}
                  className={cn(
                    'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm leading-[1.3] font-medium text-ink transition-[border-color,background-color,scale] duration-(--dur-fast) ease-out active:scale-[0.98] motion-reduce:active:scale-100',
                    'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-olive',
                    on ? 'border-forest bg-mint shadow-[inset_0_0_0_1px_var(--color-forest)]' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <input
                    id={i === 0 ? id('categoryId') : undefined}
                    type="radio"
                    name="category"
                    value={c.id}
                    checked={on}
                    onChange={() => update((d) => withCategory(d, 'product', c.id))}
                    className="sr-only"
                  />
                  <CategoryIcon name={c.icon} size={22} />
                  {c.name}
                </label>
              )
            })}
          </div>
        </FieldGroup>
      )}

      {draft.kind && subs.length > 0 && (draft.kind === 'service' || draft.categoryId) && (
        <FieldGroup legend={draft.kind === 'service' ? 'Xidmətin növü' : 'Alt kateqoriya'} error={error('subcategory')}>
          <RadioPills
            name="subcategory"
            firstId={id('subcategory')}
            options={subs.map((s) => ({ value: s, label: s }))}
            value={draft.subcategory}
            onChange={(v) => update({ subcategory: v })}
            invalid={Boolean(error('subcategory'))}
          />
        </FieldGroup>
      )}
    </div>
  )
}

/* ---------- 2 · Məlumat ---------- */

const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))

function AttributeField({ a, draft, update, error, touch }: StepProps & { a: AttrDef }) {
  const value = draft.attrs[a.id] ?? ''
  const set = (key: string, v: string) => update((d) => ({ ...d, attrs: { ...d.attrs, [key]: v } }))
  const key = `attr.${a.id}`
  switch (a.kind) {
    case 'choice':
      return (
        <FieldGroup legend={a.label} optional={!a.required} hint={a.hint} error={error(key)} className="md:col-span-2">
          <RadioPills name={a.id} firstId={id(key)} options={a.options ?? []} value={value} onChange={(v) => set(a.id, v)} clearable={!a.required} invalid={Boolean(error(key))} />
        </FieldGroup>
      )
    case 'months':
    case 'cities': {
      const options = a.kind === 'months' ? monthOptions : (a.options ?? [])
      return (
        <FieldGroup legend={a.label} optional={!a.required} hint={a.hint} error={error(key)} className="md:col-span-2">
          <TogglePills
            firstId={id(key)}
            options={options}
            values={value ? value.split(',') : []}
            onChange={(vs) => set(a.id, options.filter((o) => vs.includes(o.value)).map((o) => o.value).join(','))}
          />
        </FieldGroup>
      )
    }
    case 'range':
      return (
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <UnitInput
            id={id(`${key}Min`)}
            label={a.label}
            unit={a.unit}
            hint={a.hint}
            error={error(`${key}Min`)}
            value={draft.attrs[`${a.id}Min`] ?? ''}
            onValueChange={(v) => set(`${a.id}Min`, v)}
            onBlur={() => touch(`${key}Min`)}
            containerClassName="col-span-2 sm:col-span-1"
          />
          <UnitInput
            id={id(`${key}Max`)}
            label={<>Ən hündürü</>}
            optional
            unit={a.unit}
            error={error(`${key}Max`)}
            value={draft.attrs[`${a.id}Max`] ?? ''}
            onValueChange={(v) => set(`${a.id}Max`, v)}
            onBlur={() => touch(`${key}Max`)}
            containerClassName="col-span-2 sm:col-span-1"
          />
        </div>
      )
    case 'number':
      return (
        <UnitInput
          id={id(key)}
          label={a.label}
          optional={!a.required}
          unit={a.unit}
          hint={a.hint}
          negative={a.negative}
          error={error(key)}
          value={value}
          onValueChange={(v) => set(a.id, v)}
          onBlur={() => touch(key)}
        />
      )
    default:
      return (
        <TextField
          id={id(key)}
          label={a.label}
          optional={!a.required}
          hint={a.hint}
          placeholder={a.placeholder}
          maxLength={a.maxLength}
          error={error(key)}
          value={value}
          onChange={(e) => set(a.id, e.target.value)}
          onBlur={() => touch(key)}
        />
      )
  }
}

export function DetailsStep(props: StepProps) {
  const { draft, update, error, touch } = props
  const attrs = visibleAttributes(draft.categoryId, draft.attrs)
  const plant = PLANT_CATEGORIES.includes(draft.categoryId)
  return (
    <div className="flex flex-col gap-7">
      <TextField
        id={id('title')}
        label="Başlıq"
        placeholder={plant ? 'Məsələn: Tuya Smaragd — 140 sm, dibçəkdə' : draft.kind === 'service' ? 'Məsələn: Həyətə çim salınması' : 'Məsələn: Universal torpaq qarışığı, 20 litr'}
        hint={plant ? 'Növü və ölçünü yazın: alıcılar belə axtarır.' : 'Nə olduğunu qısa və dəqiq yazın.'}
        maxLength={TITLE_MAX + 20}
        autoComplete="off"
        error={error('title')}
        value={draft.title}
        aside={<CharCount value={draft.title} max={TITLE_MAX} />}
        onChange={(e) => update({ title: e.target.value })}
        onBlur={() => touch('title')}
      />

      {attrs.length > 0 && (
        <fieldset className="flex flex-col gap-5">
          <legend className="mb-4 text-[15px] leading-[1.35] font-semibold text-forest">{plant ? 'Bitkinin xüsusiyyətləri' : 'Xüsusiyyətlər'}</legend>
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
            {attrs.map((a) => (
              <AttributeField key={a.id} a={a} {...props} />
            ))}
          </div>
        </fieldset>
      )}

      <TextAreaField
        id={id('description')}
        label="Təsvir"
        rows={7}
        placeholder={
          plant
            ? 'Bitkinin vəziyyəti, harada yetişdirildiyi, kök sistemi, qulluq məsləhəti, çatdırılma şərtləri…'
            : 'Vəziyyəti, ölçüsü, nə daxildir, necə təhvil verirsiniz…'
        }
        hint="Telefon nömrəsini burada yazmayın — onu «Əlaqə» addımında göstərəcəyik."
        error={error('description')}
        value={draft.description}
        aside={<CharCount value={draft.description} max={DESCRIPTION_MAX} />}
        onChange={(e) => update({ description: e.target.value })}
        onBlur={() => touch('description')}
      />
    </div>
  )
}

/* ---------- 4 · Qiymət və ünvan ---------- */

const priceTypes = [
  { value: 'fixed', title: 'Sabit qiymət', description: 'Yazdığınız qiymətə satırsınız' },
  { value: 'negotiable', title: 'Razılaşmaq olar', description: 'Qiymət var, endirim mümkündür' },
  { value: 'agreement', title: 'Razılaşma ilə', description: 'Qiyməti alıcı ilə danışacaqsınız' },
] as const

export function PriceStep({ draft, update, error, touch }: StepProps) {
  const priced = draft.priceType !== 'agreement'
  const units = unitOptions(draft.categoryId)
  const unitLabel = units.find((u) => u.value === draft.priceUnit)?.label ?? 'ədəd'
  const service = draft.kind === 'service'
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="qiymet-basliq" className="flex flex-col gap-5">
        <h2 id="qiymet-basliq" className="text-[15px] leading-[1.35] font-semibold text-forest">
          Qiymət
        </h2>
        <FieldGroup legend="Qiymət necədir?">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {priceTypes.map((p) => (
              <ChoiceCard
                key={p.value}
                name="priceType"
                value={p.value}
                checked={draft.priceType === p.value}
                onChange={() => update({ priceType: p.value })}
                title={p.title}
                description={p.description}
                className="p-3.5"
              />
            ))}
          </div>
        </FieldGroup>

        {priced && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UnitInput
                id={id('price')}
                label={service ? 'Başlanğıc qiymət' : 'Qiymət'}
                unit="₼"
                error={error('price')}
                value={draft.price}
                onValueChange={(v) => update({ price: v })}
                onBlur={() => touch('price')}
              />
              <FieldGroup legend="Vahid" error={error('priceUnit')}>
                <RadioPills name="priceUnit" firstId={id('priceUnit')} options={units.map((u) => ({ value: u.value, label: `1 ${u.label}` }))} value={draft.priceUnit} onChange={(v) => update({ priceUnit: v as PostingDraft['priceUnit'] })} />
              </FieldGroup>
            </div>

            {!service && (
              <div className="flex flex-col gap-4 rounded-xl bg-cream p-4">
                <Switch
                  checked={draft.wholesale}
                  onCheckedChange={(on) => update({ wholesale: on })}
                  label="Topdan da satıram"
                  description="Tingçiliklər, bağ şirkətləri və çox alan alıcılar üçün aşağı qiymət."
                />
                {draft.wholesale && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <UnitInput
                      id={id('wholesalePrice')}
                      label="Topdan qiymət"
                      unit={`₼ / ${unitLabel}`}
                      error={error('wholesalePrice')}
                      value={draft.wholesalePrice}
                      onValueChange={(v) => update({ wholesalePrice: v })}
                      onBlur={() => touch('wholesalePrice')}
                    />
                    <UnitInput
                      id={id('wholesaleMin')}
                      label="Ən az sifariş"
                      unit={unitLabel}
                      hint="Topdan qiymət bu miqdardan başlayır."
                      error={error('wholesaleMin')}
                      value={draft.wholesaleMin}
                      onValueChange={(v) => update({ wholesaleMin: v.replace(/[.,]/g, '') })}
                      onBlur={() => touch('wholesaleMin')}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!service && (
          <UnitInput
            id={id('quantity')}
            label="Stokda neçə var"
            optional
            unit={unitLabel}
            hint="Alıcı böyük sifarişdən əvvəl bilsin."
            error={error('quantity')}
            value={draft.quantity}
            onValueChange={(v) => update({ quantity: v.replace(/[.,]/g, '') })}
            onBlur={() => touch('quantity')}
            containerClassName="sm:max-w-[calc(50%-8px)]"
          />
        )}
      </section>

      <section aria-labelledby="unvan-basliq" className="flex flex-col gap-5">
        <h2 id="unvan-basliq" className="text-[15px] leading-[1.35] font-semibold text-forest">
          {service ? 'Haradasınız' : 'Ünvan'}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-[7px]">
            <p aria-hidden className="text-[13px] leading-[normal] font-semibold text-ink">
              Şəhər və ya rayon
            </p>
            <div className={cn('h-12 rounded-lg border bg-surface focus-within:border-olive', error('cityId') ? 'border-danger' : 'border-line')}>
              <Listbox
                id={id('cityId')}
                invalid={Boolean(error('cityId'))}
                describedBy={error('cityId') ? `${id('cityId')}-error` : undefined}
                label="Şəhər və ya rayon"
                className="h-full"
                value={draft.cityId}
                onChange={(v) => update({ cityId: v })}
                options={[{ value: '', label: 'Seçin' }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
                triggerClassName="h-full px-[13px] text-sm font-normal pointer-coarse:text-base"
              />
            </div>
            {error('cityId') && (
              <p id={`${id('cityId')}-error`} className="text-xs leading-[1.5] text-danger">
                {error('cityId')}
              </p>
            )}
          </div>
          <TextField
            id={id('area')}
            label="Ərazi"
            optional
            placeholder="Məsələn: Məhəmmədi qəsəbəsi"
            hint="Kənd, qəsəbə və ya rayon. Dəqiq ünvanı yazmayın."
            autoComplete="address-level3"
            maxLength={90}
            error={error('area')}
            value={draft.area}
            onChange={(e) => update({ area: e.target.value })}
            onBlur={() => touch('area')}
          />
        </div>

        {!service && (
          <div className="flex flex-col gap-3 rounded-xl bg-cream p-4">
            <Switch checked={draft.delivery} onCheckedChange={(on) => update({ delivery: on })} label="Çatdırılma edirəm" description="Alıcılar çatdırılma ilə axtarışda sizi tapacaq." />
            {draft.delivery && (
              <TextField
                id={id('deliveryAreas')}
                label="Hara çatdırırsınız"
                placeholder="Məsələn: Bakı və Abşeron"
                error={error('deliveryAreas')}
                value={draft.deliveryAreas}
                maxLength={80}
                onChange={(e) => update({ deliveryAreas: e.target.value })}
                onBlur={() => touch('deliveryAreas')}
              />
            )}
            {PLANT_CATEGORIES.includes(draft.categoryId) && (
              <Switch checked={draft.planting} onCheckedChange={(on) => update({ planting: on })} label="Yerində əkə bilirəm" description="Elanda «Əkin xidməti» kimi göstəriləcək." />
            )}
          </div>
        )}
      </section>
    </div>
  )
}

/* ---------- 5 · Əlaqə ---------- */

export function ContactStep({ draft, update, error, touch, user }: StepProps) {
  const verified = Boolean(user?.phone) && isCompletePhone(draft.phone) && user!.phone.replace(/\D/g, '') === draft.phone.replace(/\D/g, '')
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id={id('contactName')}
          label="Adınız"
          autoComplete="name"
          placeholder="Məsələn: Elvin"
          error={error('contactName')}
          value={draft.contactName}
          maxLength={60}
          onChange={(e) => update({ contactName: e.target.value })}
          onBlur={() => touch('contactName')}
        />
        <PhoneField
          id={id('phone')}
          hint={verified ? '✓ Bu nömrə hesabınızda təsdiqlənib.' : 'Başqa nömrə yazsanız, göndərməzdən əvvəl SMS ilə təsdiqləyəcəyik.'}
          error={error('phone')}
          value={draft.phone}
          onValueChange={(v) => update({ phone: v })}
          onBlur={() => touch('phone')}
        />
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-cream p-4">
        <Switch
          id={id('whatsapp')}
          checked={draft.whatsapp}
          onCheckedChange={(on) => update({ whatsapp: on })}
          label="WhatsApp-a yazmaq olar"
          description="Elanda «WhatsApp-a yaz» düyməsi olacaq. Alıcıların çoxu əvvəl yazır."
        />
        {error('whatsapp') && (
          <p className="text-xs leading-[1.5] text-danger">
            {error('whatsapp')}
          </p>
        )}
        <Switch
          checked={draft.hidePhone}
          onCheckedChange={(on) => update((d) => ({ ...d, hidePhone: on, whatsapp: on ? true : d.whatsapp }))}
          label="Zəng qəbul etmirəm"
          description="Nömrə elanda göstərilməyəcək; alıcılar yalnız WhatsApp-da yazacaq."
        />
      </div>
    </div>
  )
}
