'use client'

import { useEffect, useState } from 'react'
import { promotionPackages as demoPackages } from '@/data/promotions'
import { useDataSource } from '@/state/store'
import type { PromotionPackage } from '@/types'
import { loadPromotionPackages } from './actions'

/** How long the browser reuses the packages it read: a cabinet of many rows asks once. */
const REUSE_MS = 60_000

let loaded: { at: number; packages: Promise<PromotionPackage[]> } | undefined

function packagesOnSale(now: number): Promise<PromotionPackage[]> {
  if (!loaded || now - loaded.at > REUSE_MS) loaded = { at: now, packages: loadPromotionPackages().catch(() => []) }
  return loaded.packages
}

/** Tests: the next screen reads the packages again. */
export function forgetPromotionPackages(): void {
  loaded = undefined
}

/**
 * The promotion packages a screen in the browser may offer («Elan yerləşdir»'s «Reklam» step, the cabinet's «Ödə və
 * işə sal», «Göndərildi»). DATA_SOURCE=mock: the demo's own (src/data/promotions.ts), at once. DATA_SOURCE=api: the
 * API's (`GET /promotion-packages`), `undefined` while they load, `[]` when nothing can be bought now (no payment
 * provider yet): the screen then offers no paid choice.
 */
export function usePromotionPackages(): PromotionPackage[] | undefined {
  const api = useDataSource() === 'api'
  const [fromApi, setFromApi] = useState<PromotionPackage[]>()
  useEffect(() => {
    if (!api) return
    let current = true
    void packagesOnSale(Date.now()).then((packages) => {
      if (current) setFromApi(packages)
    })
    return () => {
      current = false
    }
  }, [api])
  return api ? fromApi : demoPackages
}
