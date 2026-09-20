package in.co.meowmeow;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.Logger;

/**
 * Copy into android/app/... when regenerating the Capacitor Android project.
 * See PaymentAwareWebViewClient in the android app module.
 */
public class PaymentAwareWebViewClient extends BridgeWebViewClient {
    private final Activity activity;

    public PaymentAwareWebViewClient(Bridge bridge, Activity activity) {
        super(bridge);
        this.activity = activity;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (uri == null) {
            return super.shouldOverrideUrlLoading(view, request);
        }
        if (openPaymentDeepLink(view, uri.toString(), uri.getScheme())) {
            return true;
        }
        return super.shouldOverrideUrlLoading(view, request);
    }

    @Deprecated
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (url != null) {
            Uri uri = Uri.parse(url);
            if (openPaymentDeepLink(view, url, uri.getScheme())) {
                return true;
            }
        }
        return super.shouldOverrideUrlLoading(view, url);
    }

    private boolean openPaymentDeepLink(WebView view, String url, String scheme) {
        if (scheme == null) {
            return false;
        }
        String s = scheme.toLowerCase();
        if (
            s.equals("http") ||
            s.equals("https") ||
            s.equals("file") ||
            s.equals("about") ||
            s.equals("data") ||
            s.equals("blob") ||
            s.equals("capacitor") ||
            s.equals("ionic")
        ) {
            return false;
        }

        try {
            Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (intent.resolveActivity(activity.getPackageManager()) != null) {
                activity.startActivity(intent);
                return true;
            }

            String fallback = intent.getStringExtra("browser_fallback_url");
            if (fallback != null && !fallback.isEmpty()) {
                view.loadUrl(fallback);
                return true;
            }

            Logger.warn("No app found for payment deep link scheme: " + scheme);
            return true;
        } catch (ActivityNotFoundException e) {
            Logger.warn("Payment deep link activity not found: " + scheme);
            return true;
        } catch (Exception e) {
            Logger.error("Failed to open payment deep link", e);
            return true;
        }
    }
}
