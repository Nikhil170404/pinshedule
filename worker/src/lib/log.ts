type Fields = Record<string, unknown>
function emit(level: string, msg: string, f?: Fields) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...f })
  level === 'error' ? console.error(line) : console.log(line)
}
export const log = {
  info: (msg: string, f?: Fields) => emit('info', msg, f),
  warn: (msg: string, f?: Fields) => emit('warn', msg, f),
  error: (msg: string, f?: Fields) => emit('error', msg, f),
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))
