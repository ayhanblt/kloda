package com.kloda.sync

import android.content.Context
import android.net.Network
import android.os.Build
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import android.system.StructPollfd
import org.json.JSONObject
import java.net.InetSocketAddress

// Native OS evidence + exact family/network/source-bound socket; no DNS or fallback.
internal class AndroidSmbLan(context: Context) : AutoCloseable {
  private val routes = NativeLanRoutes(context)
  fun publish(profiles: AndroidSmbProfiles, job: SmbUpload, snapshot: ParcelFileDescriptor, completedSource: (() -> Boolean)? = null, currentSource: () -> Boolean) {
    if (Looper.myLooper() == Looper.getMainLooper()) throw SmbFailure("worker_required")
    // NativeLanRoutes exposes route type proof on API33+; older SDKs remain blocked.
    if (Build.VERSION.SDK_INT < 33) throw SmbFailure("lan_unavailable")
    job.validate()
    val captured = profiles.capture() ?: throw SmbFailure("profile_missing")
    if (captured.profile.target != job.target || captured.context != job.context || !currentSource()) throw SmbFailure("context_changed")
    withSocket(job.target, {
      if (!profiles.current(captured) || !currentSource()) throw SmbFailure("context_changed")
    }) { socket, current -> profiles.publishBound(job, snapshot, socket, current) { current() && (completedSource ?: currentSource)() } }
  }
  fun withSocket(target: SmbTarget, admission: () -> Unit, body: (ParcelFileDescriptor, () -> Boolean) -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) throw SmbFailure("worker_required")
    if (Build.VERSION.SDK_INT < 33) throw SmbFailure("lan_unavailable")
    admission()
    val binding = routes.snapshot(target.address)
    val evidence = JSONObject(binding)
    val family = if (target.address.contains(':')) OsConstants.AF_INET6 else OsConstants.AF_INET
    val peer = Os.inet_pton(family, target.address) ?: throw SmbFailure("lan_unavailable")
    val local = Os.inet_pton(family, evidence.getString("local")) ?: throw SmbFailure("lan_unavailable")
    // Java dual-stack Socket may expose a mapped-v6 peer to Rust for a v4 request.
    val socket = Os.socket(family, OsConstants.SOCK_STREAM or OsConstants.SOCK_NONBLOCK or OsConstants.SOCK_CLOEXEC, 0)
    try {
      Network.fromNetworkHandle(evidence.getLong("network")).bindSocket(socket)
      Os.bind(socket, local, 0)
      val currentCheck = {
        admission()
        if (routes.snapshot(target.address) != binding) throw SmbFailure("context_changed")
      }
      currentCheck()
      val deadline = SystemClock.elapsedRealtime() + 5000
      try { Os.connect(socket, peer, target.port) }
      catch (error: ErrnoException) {
        if (error.errno !in listOf(OsConstants.EINPROGRESS, OsConstants.EALREADY, OsConstants.EINTR)) throw error
        val poll = StructPollfd().apply { fd = socket; events = OsConstants.POLLOUT.toShort() }
        while (true) {
          currentCheck()
          val remaining = deadline - SystemClock.elapsedRealtime()
          if (remaining <= 0) throw SmbFailure("connection_unavailable")
          try { if (Os.poll(arrayOf(poll), remaining.coerceAtMost(25).toInt()) == 0) continue }
          catch (interrupted: ErrnoException) { if (interrupted.errno == OsConstants.EINTR) continue else throw interrupted }
          if (poll.revents.toInt() and (OsConstants.POLLERR or OsConstants.POLLHUP or OsConstants.POLLNVAL) != 0) throw SmbFailure("connection_unavailable")
          if (poll.revents.toInt() and OsConstants.POLLOUT != 0) break
        }
      }
      val actual = Os.getpeername(socket) as? InetSocketAddress
      val own = Os.getsockname(socket) as? InetSocketAddress
      if (actual?.address != peer || actual.port != target.port || own?.address != local || own.port <= 0 ||
        SystemClock.elapsedRealtime() >= deadline) throw SmbFailure("context_changed")
      // The SMB engine may close its session after verified bytes; Completed rechecks OS authority, not TCP liveness.
      ParcelFileDescriptor.dup(socket).use { body(it) { currentCheck(); true } }
    } finally { Os.close(socket) }
  }
  override fun close() = routes.close()
}
