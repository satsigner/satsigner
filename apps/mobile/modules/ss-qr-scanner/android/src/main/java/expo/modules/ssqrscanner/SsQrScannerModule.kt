package expo.modules.ssqrscanner

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SsQrScannerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SsQrScanner")

    View(SsQrScannerView::class) {
      Events("onCodeScanned")

      Prop("scanning") { view: SsQrScannerView, scanning: Boolean ->
        view.scanning = scanning
      }

      Prop("zoom") { view: SsQrScannerView, zoom: Float ->
        view.setZoom(zoom)
      }

      OnViewDestroys { view: SsQrScannerView ->
        view.release()
      }
    }
  }
}
