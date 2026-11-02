import Foundation

// UI/lock loss must remain observable while the source/profile transaction lock is held.
final class IosSmbUi {
  private let lock = NSLock()
  private var owner: UUID?
  private var active = false
  private var protected = false
  private func read<T>(_ action: () -> T) -> T { lock.lock(); defer { lock.unlock() }; return action() }
  var foreground: Bool { read { active } }
  var protectedData: Bool { read { protected } }
  func attach(_ token: UUID) { read { owner = token; active = false } }
  func owns(_ token: UUID) -> Bool { read { owner == token } }
  func interactive(_ token: UUID) -> Bool { read { owner == token && active } }
  func activate(_ token: UUID, protected value: Bool) { read { if owner == token { active = true; protected = value } } }
  func setProtected(_ value: Bool) { read { protected = value } }
  func deactivate(_ token: UUID) -> Bool { read { guard owner == token else { return false }; active = false; return true } }
}
