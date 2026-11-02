import Foundation
extension IosSmbJournal {
  func createReviewEntries() throws {
    try database.execute("CREATE TABLE IF NOT EXISTS smb_review_required(job TEXT PRIMARY KEY,reason TEXT NOT NULL,resolved INTEGER NOT NULL DEFAULT 0 CHECK(resolved IN(0,1)))")
  }
  func reviewMismatch(_ job: IosSmbUpload) throws {
    _ = try ownReceipt(id: job.id, target: job.target); try createReviewEntries()
    try database.execute("INSERT INTO smb_review_required(job,reason,resolved) VALUES(?,'native_7',0) ON CONFLICT(job) DO UPDATE SET resolved=0", values: [job.id])
  }
  func reviewVerified(_ job: IosSmbUpload) throws {
    _ = try ownReceipt(id: job.id, target: job.target); try createReviewEntries()
    try database.execute("UPDATE smb_review_required SET resolved=1 WHERE job=?", values: [job.id])
  }
}
