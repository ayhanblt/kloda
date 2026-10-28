import Foundation

// C fixture tests lifetime ordering only. It is not a key/receiver/foreground-UI acceptance.
@main struct IosPairingSessionChecks {
  final class Reply {
    let done = DispatchSemaphore(value: 0)
    var result: Result<[String: Any]?, IosPairingFailure>?
    func receive(_ value: Result<[String: Any]?, IosPairingFailure>) { result = value; done.signal() }
    func wait() -> Result<[String: Any]?, IosPairingFailure> {
      precondition(done.wait(timeout: .now() + 3) == .success)
      return result!
    }
  }

  static func expect(_ reply: Reply, _ code: String) {
    guard case .failure(let failure) = reply.wait() else { fatalError("Unexpected fake-owner success") }
    precondition(failure.code == code)
  }

  static func waitForOpen() {
    let deadline = Date().addingTimeInterval(3)
    while kloda_test_opens() == 0 && Date() < deadline { Thread.sleep(forTimeInterval: 0.001) }
    precondition(kloda_test_opens() == 1)
  }

  static func main() {
    kloda_test_reset(0, 0)
    let inactive = KlodaPairingSession(), denied = Reply()
    inactive.request(["kind": "scan", "wire": "fixture"], foreground: true, completion: denied.receive)
    expect(denied, "candidate_stale")
    precondition(kloda_test_opens() == 0)
    print("PASS inactive Swift session rejects before owner creation")

    for destroy in [false, true] {
      kloda_test_reset(1, 0)
      let session = KlodaPairingSession(), first = Reply(), queued = Reply(), closed = Reply()
      session.updateActive(true)
      session.request(["kind": "status"], foreground: false, completion: first.receive)
      waitForOpen()
      session.request(["kind": "scan", "wire": "fixture"], foreground: true, completion: queued.receive)
      if destroy { session.close(destroy: true, completion: closed.receive) }
      else { session.updateActive(false) }
      kloda_test_release_open()
      expect(first, "cancelled")
      expect(queued, "candidate_stale")
      if destroy { guard case .success = closed.wait() else { fatalError("Empty close failed") } }
      precondition(kloda_test_closes() == 1 && kloda_test_activations() == 0 && kloda_test_requests() == 0)
    }
    print("PASS delayed open after suspend/destroy closes without activation or queued trust call")

    kloda_test_reset(0, 0)
    let raced = KlodaPairingSession(), initial = Reply(), stale = Reply(), ended = Reply()
    raced.updateActive(true)
    raced.request(["kind": "status"], foreground: false, completion: initial.receive)
    guard case .success = initial.wait() else { fatalError("Fixture activation failed") }
    let accepted = kloda_test_requests()
    kloda_test_block_request()
    raced.request(["kind": "scan", "wire": "fixture"], foreground: true, completion: stale.receive)
    let deadline = Date().addingTimeInterval(3)
    while kloda_test_entered_requests() == 0 && Date() < deadline { Thread.sleep(forTimeInterval: 0.001) }
    precondition(kloda_test_entered_requests() == 1)
    raced.updateActive(false)
    raced.updateActive(true)
    kloda_test_release_request()
    expect(stale, "candidate_stale")
    precondition(kloda_test_requests() == accepted)
    raced.close(completion: ended.receive)
    guard case .success = ended.wait() else { fatalError("Fixture close failed") }
    print("PASS request keeps original native epoch across inactive-active race")

    kloda_test_reset(0, 0)
    let unpaired = KlodaPairingSession(), refused = DispatchSemaphore(value: 0), unpairedClose = Reply()
    unpaired.updateActive(true)
    unpaired.fileConnection(record: "AAAAAAAAAAAAAAAAAAAAAA") { value in
      guard case .failure(.native("candidate_stale")) = value else { fatalError("History authorized an inactive pairing") }
      refused.signal()
    }
    precondition(refused.wait(timeout: .now() + 3) == .success)
    unpaired.close(completion: unpairedClose.receive)
    guard case .success = unpairedClose.wait() else { fatalError("Fixture close failed") }
    print("PASS Files connection requires the actual current complete native pairing")

    kloda_test_reset(0, 1)
    let session = KlodaPairingSession(), opened = Reply(), close = Reply(), after = Reply()
    session.updateActive(true)
    session.request(["kind": "status"], foreground: false, completion: opened.receive)
    guard case .success = opened.wait() else { fatalError("Host fixture open failed") }
    session.close(completion: close.receive)
    expect(close, "outcome_unknown")
    session.updateActive(true)
    session.request(["kind": "status"], foreground: false, completion: after.receive)
    expect(after, "candidate_stale")
    precondition(kloda_test_opens() == 1 && kloda_test_closes() == 1)
    print("PASS failed close never creates a second owner or reports success")
  }
}
