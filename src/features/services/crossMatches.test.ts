import { emptySearchState } from '@/features/search/searchUrl'
import { getServiceMatches } from '@/features/search/serviceMatches'
import { getProductMatches } from './productMatches'

describe('the other catalogue for a search word', () => {
  it('finds services for a word the products lack («qazon»), with the city when there is one', async () => {
    expect(await getServiceMatches({ ...emptySearchState, q: 'qazon' })).toEqual({ q: 'qazon', total: 2, href: '/xidmetler?q=qazon' })
    expect(await getServiceMatches({ ...emptySearchState, q: 'qazon', cityIds: ['quba'] })).toBeUndefined()
    expect((await getServiceMatches({ ...emptySearchState, q: 'qazon', cityIds: ['baki'] }))?.href).toBe('/xidmetler?q=qazon&erazi=baki')
    expect(await getServiceMatches(emptySearchState)).toBeUndefined()
  })

  it('finds products for a word the services lack («zeytun»)', async () => {
    const zeytun = await getProductMatches('zeytun')
    expect(zeytun).toMatchObject({ q: 'zeytun', href: '/elanlar?q=zeytun' })
    expect(zeytun!.total).toBeGreaterThan(0)
    expect(await getProductMatches('qazon')).toBeUndefined()
    expect(await getProductMatches('')).toBeUndefined()
  })
})
