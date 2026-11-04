import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'

const SIGINT_EXIT_CODE = 130

function mutedOutput() {
  return new Writable({
    write(_chunk, _encoding, next) {
      next()
    }
  })
}

function readHiddenLine(
  question,
  input = process.stdin,
  output = process.stdout
) {
  output.write(question)
  const reader = createInterface({
    input,
    output: mutedOutput(),
    terminal: Boolean(input.isTTY)
  })
  reader.on('SIGINT', () => {
    output.write('\n')
    process.exit(SIGINT_EXIT_CODE)
  })
  return new Promise((resolve) => {
    reader.question('', (answer) => {
      reader.close()
      output.write('\n')
      resolve(answer)
    })
  })
}

export { readHiddenLine }
