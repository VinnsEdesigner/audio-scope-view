package com.audioscope.dsp

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage that registers DspModule with the bridge / New Architecture
 * host. Registered from MainApplication.getPackages().
 */
class DspPackage : ReactPackage {
    override fun createNativeModules(rc: ReactApplicationContext): List<NativeModule> =
        listOf(DspModule(rc))

    override fun createViewManagers(rc: ReactApplicationContext): List<ViewManager<View, ReactShadowNode<*>>> =
        emptyList()
}
