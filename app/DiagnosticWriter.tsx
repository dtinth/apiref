export interface DiagnosticWriter {
  write(message: string): void
}

export class Diagnostic implements DiagnosticWriter {
  messages: string[] = []
  write(message: string) {
    const text = `[${new Date().toJSON()}] ${message}`
    console.log(text)
    this.messages.push(text)
  }
}
