package expo.modules.safsave

import android.app.Activity
import android.content.Intent
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.toCodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException
import java.nio.charset.StandardCharsets

private const val REQUEST_CODE = 74

class SafSaveInProgressException :
  CodedException("A save is already in progress")

class SafSaveModule : Module() {
  private var pendingBase64 = false
  private var pendingContents: String? = null
  private var pendingPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("SafSave")

    AsyncFunction("saveDocument") { filename: String, mimeType: String, contents: String, encoding: String, promise: Promise ->
      if (pendingPromise != null) {
        throw SafSaveInProgressException()
      }
      val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = mimeType
        putExtra(Intent.EXTRA_TITLE, filename)
      }
      pendingContents = contents
      pendingBase64 = encoding == "base64"
      pendingPromise = promise
      appContext.throwingActivity.startActivityForResult(intent, REQUEST_CODE)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) {
        return@OnActivityResult
      }
      val promise = pendingPromise
      val contents = pendingContents
      val isBase64 = pendingBase64
      pendingPromise = null
      pendingContents = null
      pendingBase64 = false
      if (promise == null) {
        return@OnActivityResult
      }
      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(false)
        return@OnActivityResult
      }
      val uri = payload.data?.data
      if (uri == null || contents == null) {
        promise.resolve(false)
        return@OnActivityResult
      }
      val resolver = appContext.reactContext?.contentResolver
      if (resolver == null) {
        promise.reject(CodedException("React context lost"))
        return@OnActivityResult
      }
      try {
        val bytes =
          if (isBase64) {
            Base64.decode(contents, Base64.DEFAULT)
          } else {
            contents.toByteArray(StandardCharsets.UTF_8)
          }
        resolver.openOutputStream(uri, "wt")?.use { output ->
          output.write(bytes)
        } ?: throw IOException("Unable to open the selected file")
        promise.resolve(true)
      } catch (error: Throwable) {
        promise.reject(error.toCodedException())
      }
    }
  }
}
