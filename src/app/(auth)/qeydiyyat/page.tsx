import { privateMetadata } from '@/seo/metadata'
import RegisterPage from '@/views/RegisterPage'

export const metadata = privateMetadata('Qeydiyyat')

type Props = { searchParams: Promise<{ next?: string | string[] }> }

export default async function Page({ searchParams }: Props) {
  const { next } = await searchParams
  return <RegisterPage next={Array.isArray(next) ? next[0] : next} />
}
