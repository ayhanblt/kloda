import Foundation

// Native mirror of homeStatus (src/pages/home/model/home-status.ts) for the Live Activity; keep both in step.
// The only intended difference: a user pause or paused run is shown as "paused" (the lock-screen design state)
// where the home screen says "waiting". A paused manual WebDAV run stays "waiting": only the app can start it again,
// so the lock screen offers Open, not Resume.
enum IosLiveActivityStatus {
  static func state(pc: Bool, queue: [String: Any], webdav: [String: Any]) -> KlodaBackupState? {
    let dav = webdav["enabled"] as? Bool == true
    let targets = (pc ? ["pc"] : []) + (dav ? ["webdav"] : [])
    let files = pc ? queue : [:], remote = dav ? webdav : [:]
    let filesRun = files["run"] as? [String: Any], automaticRun = files["automaticRun"] as? [String: Any]
    let remoteRun = remote["run"] as? [String: Any]
    let jobs = files["jobs"] as? [[String: Any]] ?? []
    func phase(_ value: String, _ progress: (Int64, Int64)? = nil, operations: Bool = false) -> KlodaBackupState {
      var state = KlodaBackupState(phase: value, targets: targets)
      if let (done, total) = progress, total > 0, done >= 0, done <= total {
        state.percent = Int(done * 100 / total)
        if operations { state.completed = done; state.total = total }
      }
      return state
    }
    if filesRun?["state"] as? String == "needs_attention" || remoteRun?["state"] as? String == "needs_attention"
      || jobs.contains(where: { ["blocked", "owner_deleted"].contains($0["state"] as? String) }) { return phase("attention") }
    let errors = [files["errorCode"], files["automaticError"], remote["errorCode"], remote["automaticError"]].compactMap { $0 as? String }
    if !errors.isEmpty || filesRun?["state"] as? String == "failed" || remoteRun?["state"] as? String == "exhausted" { return phase("error") }
    if files["running"] as? Bool == true || remote["running"] as? Bool == true {
      if remote["running"] as? Bool == true, let counts = remoteRun?["counts"] as? [String: String],
        let done = counts["completedOperations"].flatMap(Int64.init), let total = counts["operations"].flatMap(Int64.init) {
        return phase("syncing", (done, total), operations: true)
      }
      let sizes = jobs.map { (Int64($0["acknowledgedBytes"] as? String ?? ""), Int64($0["totalBytes"] as? String ?? "")) }
      let known = files["hasMore"] as? Bool != true && !jobs.isEmpty && sizes.allSatisfy { $0.0 != nil && $0.1 != nil }
      return phase("syncing", known ? (sizes.reduce(0) { $0 + $1.0! }, sizes.reduce(0) { $0 + $1.1! }) : nil)
    }
    if targets.isEmpty { return nil }
    if queue["automaticPaused"] as? Bool == true || filesRun?["state"] as? String == "paused"
      || automaticRun?["state"] as? String == "paused"
      || (remoteRun?["state"] as? String == "paused" && remoteRun?["automatic"] as? Bool != false) { return phase("paused") }
    let pcDone = !pc || (filesRun?["state"] as? String == "finished" && files["hasMore"] as? Bool != true && !jobs.isEmpty
      && jobs.allSatisfy { $0["state"] as? String == "completed" })
    let counts = remoteRun?["counts"] as? [String: String]
    let davDone = !dav || (remoteRun?["state"] as? String == "finished" && (counts?["operations"].flatMap(Int64.init) ?? 0) > 0
      && counts?["completedOperations"] == counts?["operations"])
    return phase(pcDone && davDone ? "safe" : "waiting")
  }
}
