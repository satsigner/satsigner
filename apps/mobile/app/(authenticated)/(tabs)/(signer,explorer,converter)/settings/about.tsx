import { useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { Linking, ScrollView, StyleSheet } from 'react-native'

import SSMarkdown from '@/components/SSMarkdown'
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
          <SSVStack gap="lg">
            <SSHStack justifyBetween>
              <SSText uppercase>{t('common.version')}</SSText>
              <SSText>{`${APP_VERSION} (${BUILD_NUMBER})`}</SSText>
            </SSHStack>
            <SSVStack gap="sm">
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

  // Matches the trailing "## Changelog" / "### Full Changelog" heading
  // GitHub appends to release descriptions, which only links to the commit
  // history rather than summarizing it.
  const CHANGELOG_SECTION_REGEX = /^#{1,6}\s*.*changelog.*$/im
  const EMOJI_REGEX =
    /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]+/gu

  function stripChangelogSection(description: string) {
    const match = description.match(CHANGELOG_SECTION_REGEX)
    if (!match || match.index === undefined) {
      return description.trim()
    }
    return description.slice(0, match.index).trim()
  }

  function removeEmojis(description: string) {
    return description.replace(EMOJI_REGEX, '').replace(/[ \t]+$/gm, '')
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
    if (!isSafeHttpUrl(url)) {
      return
    }
    try {
      await Linking.openURL(url)
    } catch {
      // Ignore invalid or unsupported links.
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
        const description = removeEmojis(
          stripChangelogSection(release.body ?? '')
        )
        const tarballUrl = release.tarball_url
        const apkAsset = release.assets.find((asset) =>
          asset.name.endsWith('.apk')
        )

        return (
          <SSVStack key={release.id} gap="xs">
            <SSText weight="bold">{`${version} (${date})`}</SSText>
            {!!description && <SSMarkdown content={description} />}
            <SSVStack gap="xs">
              {!!tarballUrl && (
                <SSText
                  size="xs"
                  style={styles.link}
                  onPress={() => openLink(tarballUrl)}
                >
                  {t('settings.about.changelog.sourcecode')}
                </SSText>
              )}
              {!!apkAsset && (
                <SSText
                  size="xs"
                  style={styles.link}
                  onPress={() => openLink(apkAsset.browser_download_url)}
                >
                  {t('settings.about.changelog.apk')}
                </SSText>
              )}
            </SSVStack>
          </SSVStack>
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
