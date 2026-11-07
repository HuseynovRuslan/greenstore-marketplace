import { categoryById } from '@/data/categories'
import { cities } from '@/data/cities'
import { availabilityOptions, rootOptions } from '@/features/home/heroSearch'
import { filterTitles, type FilterOption } from '@/features/search/filterDefs'
import { foliageLabels, priceUnitLabels, rootSystemLabels, sunLabels, waterLabels } from '@/features/listing/facts'
import { lowerAz } from '@/lib/format'
import type { PlantFacts, PriceUnit, RootSystem } from '@/types'

/*
 * Category attributes of «Elan yerləşdir» (step 2). One definition list per kind of category, built on the
 * catalogue's filter vocabulary (filterDefs titles, the pending «Kök sistemi» / «Mövcudluq» options of the hero
 * search) so a value a seller picks here is the value a buyer filters by. Values are kept as strings in the draft;
 * `plantFacts` turns them into the contract's PlantFacts.
 */

export type AttrKind = 'choice' | 'number' | 'range' | 'text' | 'months' | 'cities'

export interface AttrDef {
  id: string
  label: string
  kind: AttrKind
  required?: boolean
  options?: FilterOption[]
  /** Shown after a number ("sm", "yaş", "litr", "°C", "il") */
  unit?: string
  hint?: string
  placeholder?: string
  min?: number
  max?: number
  /** Number fields that accept below zero (frost hardiness) */
  negative?: boolean
  maxLength?: number
  /** Only asked when another attribute has this value */
  when?: { id: string; value: string }
  /** Plants: the form shows the plant itself and its care as two groups (all care fields are optional). */
  group?: 'plant' | 'care'
}

/** Living-plant categories: the plant facts, care and availability apply. */
export const PLANT_CATEGORIES = ['agaclar', 'kollar', 'guller', 'otaq-bitkileri', 'tingler-fidanlar']
export const SERVICE_CATEGORY = 'landsaft-xidmetleri'

const options = <K extends string>(labels: Record<K, string>): FilterOption[] => Object.entries(labels).map(([value, label]) => ({ value, label: label as string }))

/** Root system, worded like the hero search's pending «Kök sistemi» filter (its `kok` values map to the contract). */
const rootParam: Record<string, RootSystem> = { dibcek: 'container', 'torpaq-kuresi': 'rootball', 'aciq-kok': 'bare-root' }
export const rootSystemOptions: FilterOption[] = rootOptions.map((o) => ({ value: rootParam[o.value], label: o.label }))

const availability: AttrDef = { id: 'availability', label: 'Mövcudluq', kind: 'choice', required: true, options: availabilityOptions }

const plantAttrs = (opts: { foliage: boolean }): AttrDef[] => [
  {
    id: 'species',
    label: 'Növün adı',
    kind: 'text',
    placeholder: 'Məsələn: Thuja occidentalis',
    hint: 'Latınca adı bilirsinizsə yazın: alıcılar dəqiq növü axtarır.',
    maxLength: 60,
    group: 'plant',
  },
  { id: 'height', label: filterTitles.height, kind: 'range', unit: 'sm', required: true, min: 1, max: 3000, hint: 'Dibçəklə birlikdə. Tinglər müxtəlif boydadırsa, ən hündürünü yanındakı xanaya yazın.', group: 'plant' },
  { id: 'age', label: filterTitles.age, kind: 'number', unit: 'yaş', min: 0, max: 200, group: 'plant' },
  { id: 'rootSystem', label: 'Kök sistemi', kind: 'choice', required: true, options: rootSystemOptions, group: 'plant' },
  { id: 'potLitres', label: 'Dibçəyin həcmi', kind: 'number', unit: 'litr', min: 0.5, max: 2000, when: { id: 'rootSystem', value: 'container' }, group: 'plant' },
  { ...availability, group: 'plant' },
  ...(opts.foliage ? [{ id: 'foliage', label: 'Yarpaq', kind: 'choice' as const, options: options(foliageLabels), group: 'care' as const }] : []),
  { id: 'sun', label: 'İşıq', kind: 'choice', options: options(sunLabels), group: 'care' },
  { id: 'water', label: 'Suvarma', kind: 'choice', options: options(waterLabels), group: 'care' },
  {
    id: 'frost',
    label: 'Şaxtaya davamlılıq',
    kind: 'number',
    unit: '°C',
    negative: true,
    min: -60,
    max: 30,
    hint: 'Bitkinin dözdüyü ən aşağı temperatur. Məsələn: −15.',
    group: 'care',
  },
  { id: 'plantingMonths', label: 'Əkin vaxtı', kind: 'months', hint: 'Əkmək üçün ən yaxşı aylar.', group: 'care' },
]

const packAttrs: AttrDef[] = [
  { id: 'pack', label: 'Qablaşdırma', kind: 'text', required: true, placeholder: 'Məsələn: 20 litrlik kisə', maxLength: 40 },
  { id: 'composition', label: 'Tərkibi', kind: 'text', placeholder: 'Məsələn: torf, perlit, kompost', maxLength: 80 },
  availability,
]

const conditionOptions: FilterOption[] = [
  { value: 'new', label: 'Yeni' },
  { value: 'used', label: 'İşlənmiş' },
]

const goodsAttrs: AttrDef[] = [
  { id: 'condition', label: 'Vəziyyəti', kind: 'choice', required: true, options: conditionOptions },
  { id: 'brand', label: 'Marka', kind: 'text', placeholder: 'Məsələn: Gardena', maxLength: 40 },
  availability,
]

const grassAttrs: AttrDef[] = [{ id: 'pack', label: 'Qablaşdırma və ya sahə', kind: 'text', placeholder: 'Məsələn: 1 kq, 0,8 m² rulon', maxLength: 40 }, availability]

const serviceAttrs: AttrDef[] = [
  {
    id: 'areas',
    label: 'Xidmət göstərdiyiniz ərazilər',
    kind: 'cities',
    required: true,
    options: cities.map((c) => ({ value: c.id, label: c.name })),
  },
  { id: 'experience', label: 'Təcrübə', kind: 'number', unit: 'il', min: 0, max: 80 },
  { id: 'warranty', label: 'Zəmanət', kind: 'text', placeholder: 'Məsələn: əkilən bitkilərə 1 il', maxLength: 60 },
]

/** Attributes asked for a category (and the service category). */
export function attributesFor(categoryId: string): AttrDef[] {
  if (categoryId === SERVICE_CATEGORY) return serviceAttrs
  if (PLANT_CATEGORIES.includes(categoryId)) return plantAttrs({ foliage: categoryId !== 'otaq-bitkileri' && categoryId !== 'guller' })
  if (categoryId === 'torpaq-gubreler') return packAttrs
  if (categoryId === 'cim-toxumlar') return grassAttrs
  if (categoryId === 'bag-avadanliqlari' || categoryId === 'suvarma-sistemleri') return goodsAttrs
  return [availability]
}

/** Attributes in play right now (a conditional one only while its condition holds). */
export function visibleAttributes(categoryId: string, values: Record<string, string>): AttrDef[] {
  return attributesFor(categoryId).filter((a) => !a.when || values[a.when.id] === a.when.value)
}

/** Price units a category offers, the first being the default. */
export function unitsFor(categoryId: string): PriceUnit[] {
  if (categoryId === SERVICE_CATEGORY) return ['job', 'sqm', 'hour', 'piece']
  if (PLANT_CATEGORIES.includes(categoryId)) return ['piece', 'set']
  if (categoryId === 'cim-toxumlar') return ['sqm', 'kg', 'bag']
  if (categoryId === 'torpaq-gubreler') return ['bag', 'kg', 'litre']
  return ['piece', 'set', 'metre']
}

export const unitOptions = (categoryId: string): FilterOption[] => unitsFor(categoryId).map((u) => ({ value: u, label: priceUnitLabels[u] }))

/* ---------- Values → contract and card line ---------- */

/** "−15" / "-15" / "15" → number; '' or junk → undefined */
export function parseNumberValue(value: string | undefined): number | undefined {
  if (!value) return undefined
  const v = value.trim().replace(/\s/g, '').replace(',', '.').replace('−', '-')
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : undefined
}

const listOf = (value: string | undefined) => (value ? value.split(',').filter(Boolean) : [])

/** PlantFacts from the draft's attribute values (undefined for non-plant categories). */
export function plantFacts(categoryId: string, values: Record<string, string>): PlantFacts | undefined {
  if (!PLANT_CATEGORIES.includes(categoryId)) return undefined
  const num = (id: string) => parseNumberValue(values[id])
  const heightMin = num('heightMin')
  const heightMax = num('heightMax')
  const facts: PlantFacts = {
    species: values.species?.trim() || undefined,
    heightCm: heightMin != null ? { min: heightMin, ...(heightMax != null && heightMax !== heightMin ? { max: heightMax } : {}) } : undefined,
    ageYears: num('age'),
    rootSystem: (values.rootSystem as RootSystem) || undefined,
    potLitres: values.rootSystem === 'container' ? num('potLitres') : undefined,
    sun: (values.sun as PlantFacts['sun']) || undefined,
    water: (values.water as PlantFacts['water']) || undefined,
    frostHardinessC: num('frost'),
    foliage: (values.foliage as PlantFacts['foliage']) || undefined,
    plantingMonths: listOf(values.plantingMonths).map(Number).filter((m) => m >= 1 && m <= 12),
  }
  if (!facts.plantingMonths?.length) delete facts.plantingMonths
  return Object.fromEntries(Object.entries(facts).filter(([, v]) => v !== undefined)) as PlantFacts
}

/** The card's grey line: «140 sm · 3 yaş · dibçəkdə», «20 litrlik kisə», «Yeni · Gardena», service areas. */
export function attributeLine(categoryId: string, values: Record<string, string>): string[] {
  const plant = plantFacts(categoryId, values)
  if (plant) {
    return [
      plant.heightCm ? (plant.heightCm.max ? `${plant.heightCm.min}–${plant.heightCm.max} sm` : `${plant.heightCm.min} sm`) : '',
      plant.ageYears != null ? `${plant.ageYears} yaş` : '',
      plant.rootSystem ? lowerAz(rootSystemLabels[plant.rootSystem]) : '',
    ].filter(Boolean)
  }
  if (categoryId === SERVICE_CATEGORY) return listOf(values.areas).map((id) => cities.find((c) => c.id === id)?.name ?? id)
  const condition = conditionOptions.find((o) => o.value === values.condition)?.label
  return [values.pack?.trim(), condition, values.brand?.trim()].filter((v): v is string => Boolean(v))
}

/** «Ağaclar» — the category name for summaries. */
export const categoryLabel = (categoryId: string) => categoryById(categoryId)?.name ?? ''
