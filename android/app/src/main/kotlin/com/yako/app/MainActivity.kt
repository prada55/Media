// android/app/src/main/kotlin/com/yako/app/MainActivity.kt
//
// FlutterFragmentActivity : requis par local_auth (BiometricPrompt).
// FLAG_SECURE sur toute l'application : chaque écran de Yako affiche des
// données financières, donc captures d'écran, enregistrement d'écran et
// aperçu dans le sélecteur d'applications sont bloqués partout.
package com.yako.app

import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterFragmentActivity

class MainActivity : FlutterFragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE,
        )
        super.onCreate(savedInstanceState)
    }
}
