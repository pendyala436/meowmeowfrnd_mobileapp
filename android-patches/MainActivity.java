package in.co.meowmeow;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

/** Mirror of android MainActivity — copy after regenerating Capacitor Android. */
public class MainActivity extends BridgeActivity {
    private static final int REQ_APP_PERMISSIONS = 1001;
    private static final String[] APP_PERMISSIONS = new String[] {
        Manifest.permission.CAMERA,
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.ACCESS_FINE_LOCATION,
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);

        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
        super.onCreate(savedInstanceState);

        installPaymentWebViewSupport();

        new Handler(Looper.getMainLooper()).postDelayed(this::requestAppPermissionsIfNeeded, 600);
    }

    private void installPaymentWebViewSupport() {
        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }
        WebView webView = bridge.getWebView();
        PaymentWebViewTweaks.apply(webView);
        webView.setWebViewClient(new PaymentAwareWebViewClient(bridge, this));
        webView.setWebChromeClient(new PaymentAwareWebChromeClient(bridge, this));
    }

    @Override
    public void onResume() {
        super.onResume();
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }

    private void requestAppPermissionsIfNeeded() {
        List<String> needed = new ArrayList<>();
        for (String permission : APP_PERMISSIONS) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                needed.add(permission);
            }
        }
        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                needed.toArray(new String[0]),
                REQ_APP_PERMISSIONS
            );
        }
    }
}
