import readline from 'node:readline';
import { CliError } from './errors.js';

export function createPrompter(input, output) {
  const lineReader = readline.createInterface({ input, terminal: false });
  const lines = lineReader[Symbol.asyncIterator]();
  return {
    async ask(question) {
      output.write(`${question} `);
      const { value, done } = await lines.next();
      if (done) throw new CliError('Không nhận được câu trả lời (stdin đã đóng).');
      return value.trim();
    },
    close() {
      lineReader.close();
    },
  };
}
