/** Kurzer Alarm ohne externe Audiodatei. Audio wird beim Start-Tippen freigegeben. */
export class TimerAlarm {
  private context: AudioContext | null = null
  private sources = new Set<OscillatorNode>()
  constructor(private createContext = () => {
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Audio) throw new Error('Dieser Browser unterstützt keinen Alarmton.')
    return new Audio()
  }) {}

  async prepare() {
    try {
      this.context ??= this.createContext()
      if (this.context.state !== 'running') await this.context.resume()
      return this.context.state === 'running'
    } catch { return false }
  }

  async ring() {
    if (!await this.prepare()) return false
    const context = this.context
    if (!context) return false
    this.stop()
    try {
      for (let i = 0; i < 4; i += 1) {
        const start = context.currentTime + 0.03 + i * 0.55
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(i % 2 ? 880 : 660, start)
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.2, start + 0.02)
        gain.gain.setValueAtTime(0.2, start + 0.22)
        gain.gain.linearRampToValueAtTime(0, start + 0.3)
        oscillator.connect(gain)
        gain.connect(context.destination)
        this.sources.add(oscillator)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.sources.delete(oscillator) }
        oscillator.start(start)
        oscillator.stop(start + 0.31)
      }
      return true
    } catch { this.stop(); return false }
  }

  stop() {
    for (const source of this.sources) {
      try { source.stop() } catch { /* Bereits beendeter Ton. */ }
    }
    this.sources.clear()
  }

  dispose() {
    this.stop()
    void this.context?.close().catch(() => undefined)
    this.context = null
  }
}
