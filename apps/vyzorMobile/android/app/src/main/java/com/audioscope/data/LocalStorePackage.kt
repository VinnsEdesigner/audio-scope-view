package com.audioscope.data

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage that registers LocalStoreModule with the bridge / New
 * Architecture host. Registered from MainApplication.getPackages() alongside
 * DspPackage.
 */
class LocalStorePackage : ReactPackage {
    override fun createNativeModules(rc: ReactApplicationContext): List<NativeModule> =
        listOf(LocalStoreModule(rc))

    override fun createViewManagers(rc: ReactApplicationContext): List<ViewManager<View, ReactShadowNode<*>>> =
        emptyList()
}
