package com.kloda.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkAddress
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.RouteInfo
import android.os.Build
import android.system.Os
import android.system.OsConstants
import org.json.JSONObject
import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.net.NetworkInterface

/** Native-owned OS evidence; never constructed from JavaScript network claims. */
internal class NativeLanRoutes(context: Context) : AutoCloseable {
  private val manager = context.applicationContext
    .getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
  private val lock = Any()
  private val states = mutableMapOf<Network, State>()
  private var sequence = 0L
  private var registered = false
  private var closed = false

  private data class State(
    var generation: Long,
    var capabilities: NetworkCapabilities? = null,
    var links: LinkProperties? = null,
    var addresses: List<LinkAddress> = emptyList(),
    var blocked: Boolean = false,
  )

  private fun generation(): Long {
    check(sequence < Long.MAX_VALUE) { "lan_unavailable" }
    sequence += 1
    return sequence
  }

  private val callback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) = synchronized(lock) {
      if (closed) return@synchronized
      states[network] = State(generation())
    }

    override fun onLost(network: Network) = synchronized(lock) {
      states.remove(network)
      Unit
    }

    override fun onCapabilitiesChanged(network: Network, value: NetworkCapabilities) = synchronized(lock) {
      val state = states[network] ?: return@synchronized
      if (state.capabilities != value) {
        state.capabilities = NetworkCapabilities(value)
        state.generation = generation()
      }
    }

    override fun onLinkPropertiesChanged(network: Network, value: LinkProperties) = synchronized(lock) {
      val state = states[network] ?: return@synchronized
      if (state.links != value) {
        // Retain the OS callback snapshot; Kloda never mutates it.
        state.links = value
        state.addresses = value.linkAddresses.sortedWith(compareBy<LinkAddress>(
          { if (it.address is Inet4Address) 0 else 1 }, { it.address.hostAddress ?: "" },
        ))
        state.generation = generation()
      }
    }

    override fun onBlockedStatusChanged(network: Network, blocked: Boolean) = synchronized(lock) {
      val state = states[network] ?: return@synchronized
      if (state.blocked != blocked) {
        state.blocked = blocked
        state.generation = generation()
      }
    }
  }

  init {
    // Public type proof is API33+; older platforms receive an additional native rtnetlink proof.
    // https://developer.android.com/reference/android/net/RouteInfo#getType()
    if (Build.VERSION.SDK_INT >= 23) {
      val builder = NetworkRequest.Builder()
      if (Build.VERSION.SDK_INT >= 30) builder.clearCapabilities()
      else builder.removeCapability(NetworkCapabilities.NET_CAPABILITY_TRUSTED)
        .removeCapability(NetworkCapabilities.NET_CAPABILITY_NOT_RESTRICTED)
      val request = builder
        .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
        .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
        .addTransportType(NetworkCapabilities.TRANSPORT_ETHERNET).build()
      manager.registerNetworkCallback(request, callback)
      registered = true
    }
  }

  /** Empty peer selects an advertised address; otherwise peer is a native-validated numeric IP. */
  fun snapshot(peer: String): String {
    if (Build.VERSION.SDK_INT < 23) return "unsupported"
    val target = if (peer.isEmpty()) null else {
      require(peer.length <= 39 && peer.all { it in "0123456789abcdefABCDEF:." }) { "lan_unavailable" }
      val family = if (peer.contains(':')) OsConstants.AF_INET6 else OsConstants.AF_INET
      Os.inet_pton(family, peer) ?: throw IllegalStateException("lan_unavailable")
    }
    return synchronized(lock) {
      check(!closed && registered) { "lan_unavailable" }
      for ((network, state) in states) {
        val capabilities = state.capabilities ?: continue
        val links = state.links ?: continue
        if (state.blocked || manager.getNetworkCapabilities(network) != capabilities
          || manager.getLinkProperties(network) != links) continue
        val transport = transport(capabilities) ?: continue
        val name = links.interfaceName ?: continue
        if (name.isEmpty() || name.length >= 16 || name.any { it.code !in 33..126 }) continue
        val iface = NetworkInterface.getByName(name) ?: continue
        if (iface.index <= 0 || !iface.isUp || iface.isLoopback || iface.isPointToPoint) continue
        // These sockets never use DNS/proxies; also reject an explicit proxy on this network.
        if (links.httpProxy != null) continue
        val actualAddresses = iface.interfaceAddresses
        val routes = links.routes
        for (link in state.addresses) {
          val local = link.address
          val prefix = link.prefixLength
          if (!supported(local) || !host(local, local, prefix)) continue
          if (link.flags and (OsConstants.IFA_F_TENTATIVE or OsConstants.IFA_F_DADFAILED
              or OsConstants.IFA_F_DEPRECATED) != 0) continue
          if (actualAddresses.none { it.address == local && it.networkPrefixLength.toInt() == prefix }) continue
          if (target != null && (!supported(target) || local == target || !host(local, target, prefix))) continue
          val destination = target ?: witness(local, prefix) ?: continue
          var route: RouteInfo? = null
          var longest = -1
          var tied = false
          for (candidate in routes) {
            if (!candidate.matches(destination)) continue
            val width = candidate.destination.prefixLength
            if (width > longest) {
              route = candidate
              longest = width
              tied = false
            } else if (width == longest) { tied = true }
          }
          if (tied) continue
          val direct = route ?: continue
          if (Build.VERSION.SDK_INT >= 33 && direct.type != RouteInfo.RTN_UNICAST) continue
          // API21 gateway getter, without invoking API29 hasGateway on older platforms.
          val gateway = direct.gateway
          if (gateway != null && !gateway.isAnyLocalAddress
            || direct.`interface` != name || direct.destination.prefixLength == 0) continue
          val handle = network.networkHandle
          if (handle == 0L || state.generation <= 0) continue
          // Requery only outside callbacks; disagreement with callback data means unknown/change.
          if (manager.getNetworkCapabilities(network) != capabilities
            || manager.getLinkProperties(network) != links) continue
          return@synchronized JSONObject().put("network", handle)
            .put("generation", state.generation).put("index", iface.index).put("api", Build.VERSION.SDK_INT)
            .put("interface", name).put("local", local.hostAddress)
            .put("prefix", prefix).put("transport", transport)
            .put("routePrefix", direct.destination.prefixLength).toString()
        }
      }
      throw IllegalStateException("lan_unavailable")
    }
  }

  companion object {
    fun transport(value: NetworkCapabilities): String? {
    if (!value.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)) return null
    // hasTransport safely returns false for unknown enum slots, including future non-LAN transports.
    if ((0..63).any { it != NetworkCapabilities.TRANSPORT_WIFI
        && it != NetworkCapabilities.TRANSPORT_ETHERNET && value.hasTransport(it) }) return null
    val wifi = value.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    val ethernet = value.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
    if (wifi == ethernet) return null
    return if (wifi) "wifi" else "ethernet"
  }

  }

  private fun supported(ip: InetAddress): Boolean {
    val bytes = ip.address
    if (ip is Inet6Address) {
      if (ip.scopeId != 0) return false
      val first = bytes[0].toInt() and 255
      return first and 254 == 252 || first and 224 == 32
    }
    if (ip !is Inet4Address) return false
    val a = bytes[0].toInt() and 255
    val b = bytes[1].toInt() and 255
    return a == 10 || a == 172 && b in 16..31 || a == 192 && b == 168 || a == 169 && b == 254
  }

  private fun host(local: InetAddress, peer: InetAddress, prefix: Int): Boolean {
    val own = local.address
    val other = peer.address
    if (own.size != other.size || prefix <= 0 || prefix >= own.size * 8 - 1) return false
    var nonzero = false
    var allOnes = true
    for (i in own.indices) {
      val bits = (prefix - i * 8).coerceIn(0, 8)
      val mask = (255 shl (8 - bits)) and 255
      val a = own[i].toInt() and 255
      val b = other[i].toInt() and 255
      if (a and mask != b and mask) return false
      val hostMask = mask xor 255
      if (b and hostMask != 0) nonzero = true
      if (b and hostMask != hostMask) allOnes = false
    }
    return nonzero && (local !is Inet4Address || !allOnes)
  }

  private fun witness(local: InetAddress, prefix: Int): InetAddress? {
    val bytes = local.address
    for (i in bytes.indices) {
      val bits = (prefix - i * 8).coerceIn(0, 8)
      bytes[i] = (bytes[i].toInt() and ((255 shl (8 - bits)) and 255)).toByte()
    }
    bytes[bytes.lastIndex] = (bytes.last().toInt() or 1).toByte()
    var target = InetAddress.getByAddress(bytes) // Literal bytes only, no resolver.
    if (target == local) {
      bytes[bytes.lastIndex] = (bytes.last().toInt() xor 3).toByte()
      target = InetAddress.getByAddress(bytes)
    }
    return if (host(local, target, prefix) && supported(target)) target else null
  }

  override fun close() {
    synchronized(lock) {
      closed = true
      states.clear()
      if (registered) {
        manager.unregisterNetworkCallback(callback)
        registered = false
      }
    }
  }
}
