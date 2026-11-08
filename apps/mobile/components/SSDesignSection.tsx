import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'

type SSDesignSectionProps = {
  title: string
  children: React.ReactNode
}

function SSDesignSection({ title, children }: SSDesignSectionProps) {
  return (
    <SSVStack gap="sm">
      <SSText size="xs" color="muted" uppercase weight="medium">
        {title}
      </SSText>
      {children}
    </SSVStack>
  )
}

export default SSDesignSection
