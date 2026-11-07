import { privateMetadata } from '@/seo/metadata'
import LoginPage from '@/views/LoginPage'

export const metadata = privateMetadata('Daxil ol')

type Props = { searchParams: Promise<{ next?: string | string[] }> }

export default async function Page({ searchParams }: Props) {
  const { next } = await searchParams
  return <LoginPage next={Array.isArray(next) ? next[0] : next} />
}
