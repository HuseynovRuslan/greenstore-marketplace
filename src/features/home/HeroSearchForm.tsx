'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { productCategories } from '@/data/categories'
import { cities } from '@/data/cities'
import { serviceCategories } from '@/data/services'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { cn } from '@/lib/format'

type Mode = 'products' | 'services'

/** Interactive part of the hero search band: "Məhsullar / Xidmətlər" tabs and the search form. */
export function HeroSearchForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('products')
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [category, setCategory] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [error, setError] = useState<string>()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const minN = min === '' ? undefined : Number(min)
    const maxN = max === '' ? undefined : Number(max)
    if ((minN != null && minN < 0) || (maxN != null && maxN < 0)) return setError('Qiymət sıfırdan az ola bilməz.')
    if (minN != null && maxN != null && minN > maxN) return setError('Minimum qiymət maksimumdan böyük ola bilməz.')
    setError(undefined)
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (city) params.set('seher', city)
    if (category) params.set('kateqoriya', category)
    if (minN != null) params.set('min', String(minN))
    if (maxN != null) params.set('max', String(maxN))
    const base = mode === 'products' ? '/elanlar' : '/xidmetler'
    router.push(params.size ? `${base}?${params}` : base)
  }

  const categoryOptions =
    mode === 'products'
      ? productCategories.map((c) => ({ value: c.id, label: c.name }))
      : serviceCategories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <>
      <div role="tablist" aria-label="Axtarış növü" className="flex flex-wrap items-start gap-2">
        {(
          [
            ['products', 'Məhsullar'],
            ['services', 'Xidmətlər'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value)
              setCategory('')
            }}
            className={cn(
              'min-h-11 rounded-lg p-3 text-[13px] leading-[normal] whitespace-nowrap text-forest transition-colors',
              mode === value ? 'bg-forest font-semibold text-white' : 'bg-mint hover:bg-[#dfe8de]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="flex w-full flex-col gap-3.5">
        <div className="flex w-full flex-col gap-3 md:flex-row">
          <TextField
            containerClassName="md:flex-1"
            label="Nə axtarırsınız?"
            placeholder={mode === 'products' ? 'Məsələn, zeytun ağacı' : 'Məsələn, landşaft dizaynı'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <SelectField
            containerClassName="md:flex-1"
            label="Şəhər seçin"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            options={[{ value: '', label: 'Bütün Azərbaycan' }, ...cities.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
        <div className="flex w-full flex-col gap-3 md:flex-row">
          <SelectField
            containerClassName="md:flex-1"
            label="Kateqoriya seçin"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[{ value: '', label: 'Bütün kateqoriyalar' }, ...categoryOptions]}
          />
          <div className="flex w-full gap-2.5 md:flex-1">
            <TextField
              containerClassName="flex-1"
              label="Min. qiymət, ₼"
              inputMode="numeric"
              type="number"
              min={0}
              placeholder="0"
              value={min}
              aria-invalid={error ? true : undefined}
              onChange={(e) => setMin(e.target.value)}
            />
            <TextField
              containerClassName="flex-1"
              label="Maks. qiymət, ₼"
              inputMode="numeric"
              type="number"
              min={0}
              placeholder="İstənilən"
              value={max}
              aria-invalid={error ? true : undefined}
              onChange={(e) => setMax(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="-mt-1 text-xs leading-[1.5] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth icon={<Search aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
          {mode === 'products' ? 'Elanları tap' : 'Xidmətləri tap'}
        </Button>
      </form>
    </>
  )
}
