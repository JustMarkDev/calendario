package expo.modules.materialyou

import android.annotation.SuppressLint
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Material You (Android 12+): the system palettes derived from the wallpaper, as "#rrggbb" keyed like "accent1_600".
class MaterialYouModule : Module() {
  @SuppressLint("DiscouragedApi")
  override fun definition() = ModuleDefinition {
    Name("MaterialYou")

    Function("getColors") {
      val context = appContext.reactContext
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || context == null) return@Function null
      buildMap {
        for (palette in listOf("accent1", "neutral1", "neutral2")) {
          for (tone in listOf(0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000)) {
            val id = context.resources.getIdentifier("system_${palette}_$tone", "color", "android")
            put("${palette}_$tone", String.format("#%06x", context.getColor(id) and 0xffffff))
          }
        }
      }
    }
  }
}
