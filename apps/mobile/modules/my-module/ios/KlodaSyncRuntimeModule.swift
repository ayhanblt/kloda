import ExpoModulesCore

public class KlodaSyncRuntimeModule: Module {
  private let intervalKey = "kloda.sync.intervalHours"
  private let timeKey = "kloda.sync.localTime"

  public func definition() -> ModuleDefinition {
    Name("KlodaSyncRuntime")

    AsyncFunction("loadSchedule") { () -> [String: Any] in
      let defaults = UserDefaults.standard
      return [
        "intervalHours": defaults.object(forKey: self.intervalKey) as? Int ?? 12,
        "localTime": defaults.string(forKey: self.timeKey) ?? "12:00"
      ]
    }

    AsyncFunction("saveSchedule") { (intervalHours: Int, localTime: String) in
      guard intervalHours == 12 || intervalHours == 24 else {
        throw NSError(domain: "KlodaSyncRuntime", code: 1, userInfo: [NSLocalizedDescriptionKey: "Interval must be 12 or 24 hours."])
      }
      guard localTime.range(of: "^([01]\\d|2[0-3]):[0-5]\\d$", options: .regularExpression) != nil else {
        throw NSError(domain: "KlodaSyncRuntime", code: 2, userInfo: [NSLocalizedDescriptionKey: "Time must use HH:mm."])
      }
      UserDefaults.standard.set(intervalHours, forKey: self.intervalKey)
      UserDefaults.standard.set(localTime, forKey: self.timeKey)
    }
  }
}
