import { Shovel, Sprout } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import {
  SERVICE_CATEGORY_ID,
  TITLE_MAX,
  availabilitySelectOptions,
  cityOptions,
  growingFormOptions,
  plantTypeOptions,
  priceUnitOptions,
  productCategoryOptions,
  sellerKindOptions,
  serviceCategoryOptions,
  servicePriceTypeOptions,
  serviceTypeOptions,
  subcategoryOptions,
  withPlaceholder,
  type PostAdDraft,
} from '@/data/postAd'
import { CheckboxField, InfoNotice, KindCard, SafeImage } from './components'
import { contactLine, isPlant, isService, previewAttributes, previewImage, previewLocation, priceLabel } from './draft'
import { PhotoUploader } from './PhotoUploader'
import type { FieldKey } from './validation'

export interface StepProps {
  draft: PostAdDraft
  update: (patch: Partial<PostAdDraft>) => void
  /** Visible validation message for a field (respects touched / submit-attempt state). */
  error: (field: FieldKey) => string | undefined
  /** Marks a field as touched (on blur) so its error becomes visible. */
  touch: (field: FieldKey) => void
  /** Phone number verified on the signed-in account, if any. */
  verifiedPhone?: string
}

/** Common props for a text/select bound to a draft field. */
function bind<K extends FieldKey>({ draft, update, error, touch }: StepProps, key: K) {
  return {
    name: key,
    value: String(draft[key] ?? ''),
    error: error(key),
    onBlur: () => touch(key),
    onChange: (e: { target: { value: string } }) => update({ [key]: e.target.value } as Partial<PostAdDraft>),
  }
}

/* ------------------------------------------------------------------ */
/* 1 · Məhsul və ya xidmət seçimi                                      */
/* ------------------------------------------------------------------ */

export function KindStep({ draft, update, error }: StepProps) {
  const kindError = error('kind')
  return (
    <>
      <p className="w-full text-[15px] leading-[1.5] text-muted">Satmaq istədiyiniz məhsulu və ya təqdim etdiyiniz xidməti seçin.</p>
      <div role="radiogroup" aria-label="Elan növü" className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        <KindCard
          name="kind"
          value="product"
          selected={draft.kind === 'product'}
          icon={Sprout}
          label="Məhsul"
          description="Bitkilər, ağaclar və bağ məhsulları"
          invalid={Boolean(kindError)}
          onSelect={() => update({ kind: 'product' })}
        />
        <KindCard
          name="kind"
          value="service"
          selected={draft.kind === 'service'}
          icon={Shovel}
          label="Xidmət"
          description="Landşaft, əkin, suvarma və bağ baxımı"
          invalid={Boolean(kindError)}
          onSelect={() => update({ kind: 'service' })}
        />
      </div>
      {kindError && (
        <p role="alert" className="-mt-2 w-full text-[12px] leading-[1.5] text-danger">
          {kindError}
        </p>
      )}
      {draft.kind === 'product' && (
        <InfoNotice title="Məhsul elanı seçilib">
          {draft.plantType && draft.plantType !== 'Digər' ? `${draft.plantType} fidanları` : 'Məhsulunuz'} üçün qiymət, ölçü və çatdırılma
          məlumatlarını növbəti addımlarda daxil edəcəksiniz. Xidmət elanında iş ərazisi və başlanğıc qiymət göstərilir.
        </InfoNotice>
      )}
      {draft.kind === 'service' && (
        <InfoNotice title="Xidmət elanı seçilib">
          İş növünü, xidmət ərazisini və başlanğıc qiyməti növbəti addımlarda daxil edəcəksiniz. Məhsul elanında qiymət, ölçü və çatdırılma
          məlumatları göstərilir.
        </InfoNotice>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 2 · Kateqoriya və xüsusiyyətlər                                     */
/* ------------------------------------------------------------------ */

const categoryNotice = (
  <InfoNotice title="Kateqoriyaya uyğun məlumatlar">
    Güllərdə rəng və çiçəkləmə dövrü, torpaqda həcm və tərkib, suvarmada sistem növü seçilir. Xidmətlərdə iş növü və xidmət ərazisi
    göstərilir.
  </InfoNotice>
)

export function DetailsStep(props: StepProps) {
  const { draft, update } = props
  if (isService(draft)) {
    return (
      <>
        <div className="grid w-full grid-cols-1 gap-[18px] md:grid-cols-2">
          <SelectField label="Kateqoriya seçin" value={SERVICE_CATEGORY_ID} options={serviceCategoryOptions} onChange={() => {}} />
          <SelectField
            label="İş növü seçin"
            {...bind(props, 'serviceType')}
            options={withPlaceholder(serviceTypeOptions, draft.serviceType)}
          />
          <TextField label="Xidmət ərazisi" autoComplete="off" {...bind(props, 'serviceArea')} />
          <SelectField label="Satıcı növü seçin" {...bind(props, 'sellerKind')} options={withPlaceholder(sellerKindOptions, draft.sellerKind)} />
        </div>
        {categoryNotice}
      </>
    )
  }

  const plant = isPlant(draft)
  const changeCategory = (categoryId: string) => {
    const subs = subcategoryOptions(categoryId).map((o) => o.value)
    const types = plantTypeOptions(categoryId).map((o) => o.value)
    update({
      categoryId,
      subcategory: subs.includes(draft.subcategory) ? draft.subcategory : '',
      plantType: types.includes(draft.plantType) ? draft.plantType : '',
    })
  }

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-[18px] md:grid-cols-2">
        <SelectField
          label="Kateqoriya seçin"
          {...bind(props, 'categoryId')}
          onChange={(e) => changeCategory(e.target.value)}
          options={withPlaceholder(productCategoryOptions, draft.categoryId)}
        />
        <SelectField
          label="Alt kateqoriya seçin"
          {...bind(props, 'subcategory')}
          disabled={!draft.categoryId}
          options={withPlaceholder(subcategoryOptions(draft.categoryId), draft.subcategory)}
        />
        {plant && (
          <>
            <SelectField
              label="Bitki növü seçin"
              {...bind(props, 'plantType')}
              options={withPlaceholder(plantTypeOptions(draft.categoryId), draft.plantType)}
            />
            <SelectField
              label="Yetişdirmə forması seçin"
              {...bind(props, 'growingForm')}
              options={withPlaceholder(growingFormOptions, draft.growingForm)}
            />
            <TextField label="Hündürlük, sm" inputMode="numeric" autoComplete="off" {...bind(props, 'height')} />
            <TextField label="Yaş, il" inputMode="numeric" autoComplete="off" {...bind(props, 'age')} />
          </>
        )}
        <SelectField
          label="Mövcudluq seçin"
          {...bind(props, 'availability')}
          options={withPlaceholder(availabilitySelectOptions, draft.availability)}
        />
        <SelectField label="Satıcı növü seçin" {...bind(props, 'sellerKind')} options={withPlaceholder(sellerKindOptions, draft.sellerKind)} />
      </div>
      {plant && (
        <TextField
          label="Hündürlük aralığı (istəyə bağlı)"
          autoComplete="off"
          containerClassName="w-full"
          {...bind(props, 'heightRange')}
        />
      )}
      {categoryNotice}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 3 · Şəkillər və təsvir                                              */
/* ------------------------------------------------------------------ */

export function MediaStep(props: StepProps) {
  const { draft, update, error } = props
  const service = isService(draft)
  const titleHint = service
    ? 'Xidmətin adını və əsas xüsusiyyətini yazın.'
    : isPlant(draft) || !draft.categoryId
      ? 'Bitkinin adını və əsas ölçüsünü yazın.'
      : 'Məhsulun adını və əsas ölçüsünü yazın.'
  return (
    <>
      <PhotoUploader draft={draft} update={update} error={error('photos')} />
      <TextField
        label="Elanın başlığı"
        autoComplete="off"
        maxLength={TITLE_MAX}
        containerClassName="w-full"
        hint={
          <span aria-live="polite">
            {draft.title.length}/{TITLE_MAX} simvol · {titleHint}
          </span>
        }
        {...bind(props, 'title')}
      />
      <TextAreaField
        label="Təsvir"
        rows={3}
        className="field-sizing-content"
        containerClassName="w-full"
        hint={
          service
            ? 'Xidmətin əhatəsini və iş qaydasını dürüst təsvir edin.'
            : 'Məhsulun vəziyyətini və qulluq xüsusiyyətlərini dürüst təsvir edin.'
        }
        {...bind(props, 'description')}
      />
      <InfoNotice title="Yaxşı foto daha çox maraq yaradır">
        Öz şəkillərinizi istifadə edin. Bitkini tam göstərən foto örtük üçün uyğundur. Şəkillərə telefon nömrəsi və ya başqa reklam əlavə
        etməyin.
      </InfoNotice>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 4 · Qiymət və yerləşmə                                              */
/* ------------------------------------------------------------------ */

export function PriceStep(props: StepProps) {
  const { draft, update } = props
  const service = isService(draft)
  const priceField = <TextField label="Qiymət, AZN (₼)" inputMode="decimal" autoComplete="off" {...bind(props, 'price')} />
  return (
    <>
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        {service ? (
          <>
            {draft.servicePriceType === 'from' && priceField}
            <SelectField
              label="Qiymət forması seçin"
              value={draft.servicePriceType}
              options={servicePriceTypeOptions}
              onChange={(e) => update({ servicePriceType: e.target.value as PostAdDraft['servicePriceType'] })}
            />
          </>
        ) : (
          <>
            {priceField}
            <SelectField label="Qiymət vahidi seçin" {...bind(props, 'priceUnit')} options={withPlaceholder(priceUnitOptions, draft.priceUnit)} />
          </>
        )}
      </div>
      {!service && (
        <CheckboxField checked={draft.negotiable} onChange={(negotiable) => update({ negotiable })}>
          Qiymətdə razılaşmaq olar
        </CheckboxField>
      )}
      <SelectField
        label="Şəhər / rayon seçin"
        containerClassName="w-full"
        {...bind(props, 'cityId')}
        options={withPlaceholder(cityOptions, draft.cityId)}
      />
      <TextField label="Qəsəbə / kənd" containerClassName="w-full" autoComplete="address-level3" {...bind(props, 'village')} />
      <TextField
        label="Ünvan (istəyə bağlı)"
        containerClassName="w-full"
        autoComplete="street-address"
        hint="Alıcılara yalnız qeyd etdiyiniz ümumi ünvan göstəriləcək."
        {...bind(props, 'address')}
      />
      {!service && (
        <>
          <CheckboxField checked={draft.delivery} onChange={(delivery) => update({ delivery })}>
            Çatdırılma mümkündür
          </CheckboxField>
          {draft.delivery && <TextField label="Çatdırılma əraziləri" containerClassName="w-full" autoComplete="off" {...bind(props, 'deliveryAreas')} />}
        </>
      )}
      <InfoNotice title="Çatdırılma şərtləri">
        Çatdırılma haqqı məsafədən asılıdır və alıcı ilə ayrıca razılaşdırılır. Xidmət elanlarında qiymət “başlayan” və ya “razılaşma yolu
        ilə” göstərilə bilər.
      </InfoNotice>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 5 · Əlaqə məlumatları                                               */
/* ------------------------------------------------------------------ */

const digits = (phone: string) => phone.replace(/\D/g, '')

export function ContactStep(props: StepProps) {
  const { draft, update, verifiedPhone } = props
  const verified = Boolean(verifiedPhone) && digits(draft.phone) === digits(verifiedPhone ?? '')
  return (
    <>
      <TextField label="Satıcının adı" containerClassName="w-full" autoComplete="organization" {...bind(props, 'sellerName')} />
      <TextField label="Əlaqələndirici şəxs" containerClassName="w-full" autoComplete="name" {...bind(props, 'contactPerson')} />
      <TextField
        label="Telefon nömrəsi"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        containerClassName="w-full"
        hint={verified ? 'Bu nömrə hesabınızda təsdiqlənib.' : undefined}
        {...bind(props, 'phone')}
      />
      {verified && <Badge tone="success">Telefon təsdiqlənib</Badge>}
      <CheckboxField checked={draft.whatsapp} onChange={(whatsapp) => update({ whatsapp })}>
        WhatsApp ilə əlaqəyə icazə verirəm
      </CheckboxField>
      <TextField label="Əlaqə saatları" containerClassName="w-full" autoComplete="off" {...bind(props, 'contactHours')} />
      <CheckboxField small checked={draft.showPhone} onChange={(showPhone) => update({ showPhone })}>
        Telefon nömrəmin alıcılara “Nömrəni göstər” düyməsi ilə təqdim edilməsinə razıyam.
      </CheckboxField>
      <InfoNotice title="Birbaşa əlaqə">
        Alıcılar sizinlə telefon və WhatsApp vasitəsilə əlaqə saxlayacaqlar. Ünvanı və görüş vaxtını söhbət zamanı dəqiqləşdirin.
      </InfoNotice>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 6 · Önizləmə və dərc — the listing as buyers will see it            */
/* ------------------------------------------------------------------ */

export function PreviewStep({ draft, update, error }: StepProps) {
  const title = draft.title.trim() || 'Yeni elan'
  const price = priceLabel(draft, '  ')
  const location = previewLocation(draft)
  const attributes = previewAttributes(draft)
  const contact = contactLine(draft)
  return (
    <>
      <Badge tone="warning">Önizləmə · hələ dərc edilməyib</Badge>
      <SafeImage src={previewImage(draft)} alt={title} className="h-[220px] w-full rounded-lg md:h-[380px]" />
      <h3 className="w-full text-[23px] leading-[1.35] font-normal break-words text-ink">{title}</h3>
      {price && <p className="text-[26px] leading-[1.5] font-semibold whitespace-pre-wrap text-ink md:text-[32px]">{price}</p>}
      {location && <p className="w-full text-sm leading-[1.5] text-muted">{location}</p>}
      {attributes && <p className="w-full text-sm leading-[1.5] text-ink">{attributes}</p>}
      {draft.description.trim() && (
        <p className="w-full text-sm leading-[1.5] break-words whitespace-pre-line text-ink">{draft.description.trim()}</p>
      )}
      {contact && <p className="w-full text-sm leading-[1.5] text-ink">{contact}</p>}
      <ButtonLink variant="secondary" to="/elan-yerlesdir/1">
        Məlumatları redaktə et
      </ButtonLink>
      <Notice tone="warning" title="Dərcdən əvvəl yoxlama">
        Elan moderasiya üçün göndəriləcək. Təsdiqləndikdən sonra axtarışda görünəcək. Yoxlama adətən 24 saat çəkir.
      </Notice>
      <CheckboxField small checked={draft.rulesAccepted} onChange={(rulesAccepted) => update({ rulesAccepted })} error={error('rulesAccepted')}>
        Elan qaydalarını qəbul edirəm və məlumatların düzgünlüyünü təsdiq edirəm.
      </CheckboxField>
    </>
  )
}
