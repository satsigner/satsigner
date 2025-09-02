package com.satsigner.satsigner

import android.os.Build
import android.os.Bundle
import android.view.KeyEvent

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import com.github.kevinejohn.keyevent.KeyEventModule

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  //  Add this method if you want to react to keyDown
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    // A. Prevent multiple events on long button press
    //    In the default behavior multiple events are fired if a button
    //    is pressed for a while. You can prevent this behavior if you
    //    forward only the first event:
    //        if (event.getRepeatCount() == 0) {
    //            KeyEventModule.getInstance().onKeyDownEvent(keyCode, event);
    //        }
    //
    // B. If multiple Events shall be fired when the button is pressed
    //    for a while use this code:
    //        KeyEventModule.getInstance().onKeyDownEvent(keyCode, event);
    //
    // Using B.
    KeyEventModule.getInstance().onKeyDownEvent(keyCode, event);
    // There are 2 ways this can be done:
    //  1.  Override the default keyboard event behavior
    //    super.onKeyDown(keyCode, event);
    //    return true;
    //  2.  Keep default keyboard event behavior
    //    return super.onKeyDown(keyCode, event);
    // Using method #1 without blocking multiple
    super.onKeyDown(keyCode, event)
    return true
    // Using method #2
    return super.onKeyDown(keyCode, event)
  }

  // Add this method if you want to react to keyUp
  override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
    KeyEventModule.getInstance().onKeyUpEvent(keyCode, event);
    // There are 2 ways this can be done:
    //  1.  Override the default keyboard event behavior
    //    super.onKeyUp(keyCode, event)
    //    return true
    //  2.  Keep default keyboard event behavior
    //    return super.onKeyUp(keyCode, event)
    // Using method #1
    super.onKeyUp(keyCode, event)
    return true
    // Using method #2
    return super.onKeyUp(keyCode, event)
  }

  override fun onKeyMultiple(keyCode: Int, repeatCount: Int, event: KeyEvent): Boolean {
    KeyEventModule.getInstance().onKeyMultipleEvent(keyCode, repeatCount, event)
    return super.onKeyMultiple(keyCode, repeatCount, event)
  }
}
