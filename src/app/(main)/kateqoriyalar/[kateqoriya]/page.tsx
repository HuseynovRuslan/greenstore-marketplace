import { CategoryRoute, categoryMetadata, type CategoryRouteProps } from '../category'

export const generateMetadata = (props: CategoryRouteProps) => categoryMetadata(props)

export default function Page(props: CategoryRouteProps) {
  return <CategoryRoute {...props} />
}
