package com.kloda.sync

import android.app.Instrumentation
import org.json.JSONObject
import java.util.UUID

internal object AndroidS3RedirectChecks {
  fun run(instrumentation: Instrumentation) {
    check(instrumentation.targetContext.packageName == "com.kloda.sync.test")
    val generation = UUID.randomUUID().toString()
    val profile = AndroidS3Profile(S3Target("s3-compatible", "https://localhost:52410", "us-east-1", "owned-bucket", "owned", true,
      S3Target.hash("synthetic-access"), generation, generation), "synthetic-access", "synthetic-secret", "synthetic-session-token")
    val reply = AndroidS3Client(instrumentation.targetContext, profile) {}.send("owned-redirect", JSONObject().put("kind", "create").put("job", generation.replace("-", "")))
    check(reply.status == 307 && reply.body.isEmpty())
  }
}
