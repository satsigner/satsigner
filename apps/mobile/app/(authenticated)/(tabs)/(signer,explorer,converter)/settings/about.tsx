import { useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { Linking, ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSMarkdown from '@/components/SSMarkdown'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import { APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { isSafeHttpUrl } from '@/utils/markdown'

export default function About() {
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.about.title')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <SSVStack gap="md">
            <SSHStack justifyBetween>
              <SSText uppercase>{t('common.version')}</SSText>
              <SSText>{`${APP_VERSION} (${BUILD_NUMBER})`}</SSText>
            </SSHStack>
            <SSVStack gap="lg">
              <SSText uppercase weight="bold">
                {t('settings.about.changelog.title')}
              </SSText>
              <Changelog />
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}

function Changelog() {
  // This component fetches release data directly instead of relying on the
  // bundled CHANGELOG.md, so it always reflects what's on GitHub.
  type GithubReleaseAsset = {
    browser_download_url: string
    name: string
  }

  type GithubRelease = {
    assets: GithubReleaseAsset[]
    body: string | null
    draft: boolean
    id: number
    name: string | null
    published_at: string | null
    tag_name: string
    tarball_url: string | null
  }

  function parseDescription(rawDescription: string) {
    let description = rawDescription

    // strip changelog heading section. which only links to the commit history rather than summarizing it.
    const CHANGELOG_SECTION_REGEX = /^#{1,6}\s*.*changelog.*$/im
    const match = description.match(CHANGELOG_SECTION_REGEX)
    if (match !== null && match.index !== undefined) {
      description = description.slice(0, match.index)
    }

    // remove emojis & whitespaces
    const EMOJI_REGEX =
      /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]+/gu
    description = description.replace(EMOJI_REGEX, '').replace(/[ \t]+$/gm, '')

    // downgrade markdown headers
    description = description.replace(/^#+/gm, '####')

    // delete line break
    description = description.replace(/\n\n+/gm, '\n')

    return description
  }

  async function fetchGithubReleases(): Promise<GithubRelease[]> {
    const response = await fetch(
      'https://api.github.com/repos/satsigner/satsigner/releases?per_page=100',
      { headers: { Accept: 'application/vnd.github+json' } }
    )
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }
    const releases: GithubRelease[] = await response.json()
    return releases.filter((release) => !release.draft)
  }

  async function openLink(url: string) {
    try {
      await Linking.openURL(url)
    } catch {
      toast.error('Failed to open URL')
    }
  }

  const {
    data: releases,
    isLoading,
    isError
  } = useQuery({
    queryFn: fetchGithubReleases,
    queryKey: ['githubReleases'],
    staleTime: 1000 * 60 * 60
  })

  if (isLoading) {
    return <SSText color="muted">{t('common.loading')}</SSText>
  }

  if (isError || !releases) {
    return <SSText color="muted">{t('settings.about.changelog.error')}</SSText>
  }

  return (
    <SSVStack gap="lg">
      {releases.map((release) => {
        const version = release.tag_name || release.name || ''
        const date = release.published_at?.slice(0, 10) ?? ''
        const description = parseDescription(release.body || '')
        const tarballUrl = release.tarball_url
        const apkAsset = release.assets.find((asset) =>
          asset.name.endsWith('.apk')
        )

        return (
          <>
            <SSSeparator />
            <SSVStack key={release.id} gap="md">
              <SSText weight="bold">{`${version} (${date})`}</SSText>
              {description && <SSMarkdown content={description} />}
              <SSHStack gap="sm">
                {tarballUrl && (
                  <SSText
                    size="xs"
                    style={styles.link}
                    onPress={() => openLink(tarballUrl)}
                  >
                    {t('settings.about.changelog.sourcecode')}
                  </SSText>
                )}
                {apkAsset && (
                  <SSText
                    size="xs"
                    style={styles.link}
                    onPress={() => openLink(apkAsset.browser_download_url)}
                  >
                    {t('settings.about.changelog.apk')}
                  </SSText>
                )}
              </SSHStack>
            </SSVStack>
          </>
        )
      })}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  link: {
    color: Colors.gray[75],
    textDecorationLine: 'underline'
  },
  scroll: {
    paddingBottom: 64
  }
})
