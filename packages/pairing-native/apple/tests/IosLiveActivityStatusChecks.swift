import Foundation

// Step19: the Live Activity state mapping must follow homeStatus (src/pages/home/model/home-status.ts).
@main struct IosLiveActivityStatusChecks {
  static func expect(_ condition: Bool, _ reason: String) { if !condition { fatalError(reason) } }
  static func state(pc: Bool = false, queue: [String: Any] = [:], webdav: [String: Any] = [:]) -> KlodaBackupState? {
    IosLiveActivityStatus.state(pc: pc, queue: queue, webdav: webdav)
  }
  static func dav(_ run: [String: Any]? = nil, running: Bool = false, extra: [String: Any] = [:]) -> [String: Any] {
    var value: [String: Any] = ["enabled": true, "running": running]
    if let run { value["run"] = run }
    return value.merging(extra) { $1 }
  }
  static func counts(_ done: String, _ total: String) -> [String: String] { ["completedOperations": done, "operations": total] }

  static func main() {
    expect(state() == nil, "no destination shows nothing")
    expect(state(webdav: ["enabled": false, "running": true]) == nil, "disabled WebDAV is ignored")

    let syncing = state(webdav: dav(["state": "running", "counts": counts("3", "4")], running: true))
    expect(syncing == KlodaBackupState(phase: "syncing", percent: 75, completed: 3, total: 4, targets: ["webdav"]), "WebDAV operations")
    expect(state(webdav: dav(["state": "running", "counts": counts("5", "4")], running: true))?.percent == nil, "invalid counts")

    let jobs: [[String: Any]] = [["state": "uploading", "acknowledgedBytes": "50", "totalBytes": "200"], ["state": "queued", "acknowledgedBytes": "0", "totalBytes": "200"]]
    let pcSyncing = state(pc: true, queue: ["running": true, "jobs": jobs, "hasMore": false])
    expect(pcSyncing?.phase == "syncing" && pcSyncing?.percent == 12 && pcSyncing?.completed == nil && pcSyncing?.targets == ["pc"], "PC bytes")
    expect(state(pc: true, queue: ["running": true, "jobs": jobs, "hasMore": true])?.percent == nil, "partial job page has no total")

    expect(state(pc: true, queue: ["run": ["state": "needs_attention"]])?.phase == "attention", "attention")
    expect(state(pc: true, queue: ["jobs": [["state": "blocked"]]])?.phase == "attention", "blocked job")
    expect(state(webdav: dav(extra: ["errorCode": "webdav_auth"]))?.phase == "error", "error")
    expect(state(queue: ["errorCode": "x"], webdav: dav(["state": "finished", "counts": counts("1", "1")]))?.phase == "safe",
      "errors of a disabled PC are ignored")
    expect(state(webdav: dav(["state": "exhausted"]))?.phase == "error", "exhausted")
    expect(state(webdav: dav(["state": "finished", "counts": counts("1", "1")], extra: ["automaticError": "automatic_unavailable"]))?.phase == "error",
      "WebDAV automatic error wins over a finished run, as on the home screen")

    expect(state(pc: true, queue: ["automaticPaused": true])?.phase == "paused", "user pause")
    expect(state(webdav: dav(["state": "paused"]))?.phase == "paused", "paused run")
    expect(state(webdav: dav(["state": "paused", "automatic": true]))?.phase == "paused", "paused automatic run")
    expect(state(webdav: dav(["state": "paused", "automatic": false]))?.phase == "waiting", "paused manual run has no lock-screen Resume")
    expect(state(pc: true, queue: ["automaticPaused": true], webdav: dav(["state": "paused", "automatic": false]))?.phase == "paused",
      "automatic pause still offers Resume")
    expect(state(webdav: dav(["state": "finished", "counts": counts("0", "0")]))?.phase == "waiting", "empty run is not safe")
    let done: [[String: Any]] = [["state": "completed", "acknowledgedBytes": "1", "totalBytes": "1"]]
    let safe = state(pc: true, queue: ["run": ["state": "finished"], "jobs": done, "hasMore": false],
      webdav: dav(["state": "finished", "counts": counts("2", "2")]))
    expect(safe?.phase == "safe" && safe?.targets == ["pc", "webdav"], "both finished")
    expect(state(pc: true, queue: ["run": ["state": "finished"], "jobs": done, "hasMore": true])?.phase == "waiting", "unseen jobs")

    let encoded = try! JSONEncoder().encode(safe!)
    expect(encoded.count < 4096, "ActivityKit content limit")
    expect(!String(decoding: encoded, as: UTF8.self).contains("name"), "no names in the payload")
    print("PASS Live Activity state mirrors homeStatus: syncing bytes/operations, attention, error, paused, waiting, safe; payload has no names")
  }
}
