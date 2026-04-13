import { getDb, runTransaction } from '../connection'

function getTags(): string[] {
  const db = getDb()
  const { results } = db.execute('SELECT tag FROM tags')
  return (results ?? []).map((r) => r.tag as string)
}

function setTags(tags: string[]) {
  runTransaction((tx) => {
    tx.execute('DELETE FROM tags')
    for (const tag of tags) {
      tx.execute('INSERT INTO tags (tag) VALUES (?)', [tag])
    }
  })
}

function deleteTags() {
  const db = getDb()
  db.execute('DELETE FROM tags')
}

export { deleteTags, getTags, setTags }
