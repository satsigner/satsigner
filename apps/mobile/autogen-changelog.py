#!/usr/bin/env python3
"""Generate CHANGELOG.md from the project's GitHub releases."""

import json
import os
import re
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CHANGELOG_PATH = os.path.join(SCRIPT_DIR, 'CHANGELOG.md')


def get_repository_url():
    project_root_path = os.path.realpath(f"{SCRIPT_DIR}/../..")
    package_json_path = os.path.join(project_root_path, 'package.json')
    with open(package_json_path, encoding='utf-8') as f:
        package_json = json.load(f)
    repository = package_json.get('repository').get('url')
    return url


def parse_owner_repo(repository_url):
    match = re.search(r'github\.com[:/]([^/]+)/([^/.]+)', repository_url)
    if not match:
        raise SystemExit(f'Unsupported repository url: {repository_url}')
    return match.group(1), match.group(2)


def fetch_releases(owner, repo):
    url = f'https://api.github.com/repos/{owner}/{repo}/releases?per_page=100'
    request = urllib.request.Request(
        url, headers={'Accept': 'application/vnd.github+json'}
    )
    token = os.environ.get('GITHUB_TOKEN')
    if token:
        request.add_header('Authorization', f'Bearer {token}')
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def strip_changelog_section(description):
    # Matches the trailing "## Changelog" / "### Full Changelog" section, which links to the commit history but is not part of changelog summary.
    CHANGELOG_SECTION_RE = re.compile(
        r'^#{1,6}\s*.*changelog.*$', re.IGNORECASE | re.MULTILINE
    )
    match = CHANGELOG_SECTION_RE.search(description)
    if match:
        description = description[: match.start()]
    return description.strip()


def remove_emojis(description):
    EMOJI_RE = re.compile(
        '['
        '\U0001f1e6-\U0001f1ff'
        '\U0001f300-\U0001faff'
        '\U00002600-\U000027bf'
        '\U00002b00-\U00002bff'
        '\U0000fe0f'
        '\U0000200d'
        ']+',
        flags=re.UNICODE
    )
    description = EMOJI_RE.sub('', description)
    description = re.sub(r'[ \t]+$', '', description, flags=re.MULTILINE)
    return description


def parse_release_description(plain_description):
    description = strip_changelog_section(plain_description)
    description = remove_emojis(description)
    return description


def main():
    owner, repo = parse_owner_repo(get_repository_url())
    releases = [r for r in fetch_releases(owner, repo) if not r.get('draft')]

    entries = []
    for release in releases:
        version = release.get('tag_name') or release.get('name')
        date = (release.get('published_at') or '')[:10]
        description = parse_release_description(release.get('body') or '')
        entries.append(f'## {version} ({date})\n\n{description}')

    f = open(CHANGELOG_PATH, 'w', encoding='utf-8')
    f.write('# CHANGELOG\n\n')
    f.write('\n\n'.join(entries) + '\n')
    f.close()

    print('Updated CHANGELOG.md')


if __name__ == '__main__':
    main()
