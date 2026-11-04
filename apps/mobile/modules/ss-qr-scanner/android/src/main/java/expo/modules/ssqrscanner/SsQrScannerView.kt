package expo.modules.ssqrscanner

import android.content.Context
import android.os.SystemClock
import android.view.ViewGroup
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import zxingcpp.BarcodeReader

// The same payload is reported again only after this long, so a QR code held
// in front of the camera doesn't flood JS with one event per frame. Animated
// multi-part QR codes change payload every frame and are always reported.
private const val REPEAT_INTERVAL_MS = 1_000L

class SsQrScannerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true

  private val onCodeScanned by EventDispatcher()
  private val previewView = PreviewView(context).apply {
    layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
  }
  private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private val reader = BarcodeReader(
    BarcodeReader.Options(
      formats = setOf(BarcodeReader.Format.QR_CODE),
      tryHarder = true,
      tryRotate = true
    )
  )
  private var cameraProvider: ProcessCameraProvider? = null
  private var camera: Camera? = null
  private var zoom = 0f
  private var lastPayload: String? = null
  private var lastReportedAt = 0L

  @Volatile
  var scanning = true

  init {
    addView(previewView)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    startCamera()
  }

  override fun onDetachedFromWindow() {
    cameraProvider?.unbindAll()
    super.onDetachedFromWindow()
  }

  fun setZoom(value: Float) {
    zoom = value.coerceIn(0f, 1f)
    camera?.cameraControl?.setLinearZoom(zoom)
  }

  fun release() {
    cameraProvider?.unbindAll()
    analysisExecutor.shutdown()
  }

  private fun startCamera() {
    val lifecycleOwner = appContext.currentActivity as? LifecycleOwner ?: return
    val providerFuture = ProcessCameraProvider.getInstance(context)
    providerFuture.addListener({
      val provider = providerFuture.get()
      cameraProvider = provider
      val preview = Preview.Builder().build().also {
        it.surfaceProvider = previewView.surfaceProvider
      }
      val analysis = ImageAnalysis.Builder()
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .build()
      analysis.setAnalyzer(analysisExecutor, ::analyze)
      provider.unbindAll()
      camera = provider.bindToLifecycle(
        lifecycleOwner,
        CameraSelector.DEFAULT_BACK_CAMERA,
        preview,
        analysis
      )
      camera?.cameraControl?.setLinearZoom(zoom)
    }, ContextCompat.getMainExecutor(context))
  }

  private fun analyze(image: ImageProxy) {
    image.use {
      if (!scanning) {
        return
      }
      val payload = runCatching { reader.read(image) }
        .getOrNull()
        ?.firstNotNullOfOrNull { result -> result.text?.takeIf { it.isNotEmpty() } }
        ?: return
      val now = SystemClock.elapsedRealtime()
      if (payload == lastPayload && now - lastReportedAt < REPEAT_INTERVAL_MS) {
        return
      }
      lastPayload = payload
      lastReportedAt = now
      post { onCodeScanned(mapOf("data" to payload)) }
    }
  }
}
