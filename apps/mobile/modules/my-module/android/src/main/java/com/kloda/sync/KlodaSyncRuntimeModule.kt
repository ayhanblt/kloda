package com.kloda.sync

import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KlodaSyncRuntimeModule : Module() {
  override fun definition() = ModuleDefinition {
    lateinit var directoryPicker: AppContextActivityResultLauncher<DirectoryPickerInput, String?>

    RegisterActivityContracts {
      directoryPicker = registerForActivityResult(DirectoryPickerContract(this@KlodaSyncRuntimeModule))
    }

    Name("KlodaSyncRuntime")
    AsyncFunction("pickDirectory") Coroutine { request: String ->
      directoryPicker.launch(DirectoryPickerInput(request))
    }

    AsyncFunction("loadSchedule") {
      val preferences = appContext.reactContext?.getSharedPreferences("kloda-sync", 0)
        ?: throw IllegalStateException("Application context is unavailable.")
      mapOf(
        "intervalHours" to preferences.getInt("intervalHours", 12),
        "localTime" to preferences.getString("localTime", "12:00")
      )
    }

    AsyncFunction("saveSchedule") { intervalHours: Int, localTime: String ->
      if (intervalHours != 12 && intervalHours != 24) throw IllegalArgumentException("Interval must be 12 or 24 hours.")
      if (!Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(localTime)) throw IllegalArgumentException("Time must use HH:mm.")
      val preferences = appContext.reactContext?.getSharedPreferences("kloda-sync", 0)
        ?: throw IllegalStateException("Application context is unavailable.")
      if (!preferences.edit().putInt("intervalHours", intervalHours).putString("localTime", localTime).commit()) {
        throw IllegalStateException("Could not persist the schedule.")
      }
    }
  }
}
