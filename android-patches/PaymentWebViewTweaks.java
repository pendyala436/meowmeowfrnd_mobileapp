package in.co.meowmeow;

import android.webkit.WebSettings;
import android.webkit.WebView;

/** Shared WebView tweaks so Razorpay bank pages treat the app like Chrome. */
public final class PaymentWebViewTweaks {
    private PaymentWebViewTweaks() {}

    /** Strip the "; wv" WebView marker banks often block. */
    public static String chromeMobileUserAgent(WebView webView) {
        String ua = webView.getSettings().getUserAgentString();
        if (ua == null || ua.isEmpty()) {
            return "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
        }
        return ua.replace("; wv", "").replace(" Version/4.0", "");
    }

    public static void apply(WebView webView) {
        if (webView == null) return;
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setUserAgentString(chromeMobileUserAgent(webView));
    }
}
