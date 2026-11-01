import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'

type SSDiagnosticsSectionProps = {
  children: React.ReactNode
  summary?: string
  title: string
}

function SSDiagnosticsSection({
  children,
  summary,
  title
}: SSDiagnosticsSectionProps) {
  return (
    <SSVStack gap="xs">
      <SSText uppercase>{title}</SSText>
      {summary ? (
        <SSText color="muted" size="xs">
          {summary}
        </SSText>
      ) : null}
      {children}
    </SSVStack>
  )
}

export default SSDiagnosticsSection
