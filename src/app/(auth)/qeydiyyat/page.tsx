import { accountTypeFromParam } from '@/features/auth/validation'
import { privateMetadata } from '@/seo/metadata'
import RegisterPage from '@/views/RegisterPage'

export const metadata = privateMetadata('Qeydiyyat')

type Props = { searchParams: Promise<{ next?: string | string[]; hesab?: string | string[] }> }

const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value)

/** ?hesab=biznes opens the form with «Biznes» chosen (footer «Biznes hesabları»); the visitor can still switch. */
export default async function Page({ searchParams }: Props) {
  const { next, hesab } = await searchParams
  return <RegisterPage next={first(next)} accountType={accountTypeFromParam(first(hesab))} />
}
