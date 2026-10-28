import Foundation
import Darwin

enum IosAutomaticClock {
  static func read() throws -> (now: Int64, uptime: Int64, boot: String?) {
    let now = Date().timeIntervalSince1970 * 1000
    let uptime = ProcessInfo.processInfo.systemUptime * 1000
    guard now.isFinite, uptime.isFinite, now >= 0, uptime >= 0,
      now < Double(Int64.max), uptime < Double(Int64.max) else { throw IosAutomaticPolicy.error("retry_clock_unavailable") }
    var time = timeval()
    var size = MemoryLayout<timeval>.size
    let valid = sysctlbyname("kern.boottime", &time, &size, nil, 0) == 0 && size == MemoryLayout<timeval>.size
      && time.tv_sec >= 0 && time.tv_usec >= 0 && time.tv_usec < 1_000_000
    return (Int64(now), Int64(uptime), valid ? "\(time.tv_sec):\(time.tv_usec)" : nil)
  }
}
