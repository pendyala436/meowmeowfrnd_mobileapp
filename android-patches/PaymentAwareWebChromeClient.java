package in.co.meowmeow;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Message;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebView.WebViewTransport;
import android.webkit.WebViewClient;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.Logger;

/**
 * Razorpay netbanking/3DS opens a secondary window. Capacitor's default
 * WebChromeClient does not implement onCreateWindow, so bank selection fails
 * with "Payment could not be completed. Please use another method".
 */
public class PaymentAwareWebChromeClient extends BridgeWebChromeClient {
    private final Activity activity;
    private WebView popupWebView;

    public PaymentAwareWebChromeClient(Bridge bridge, Activity activity) {
        super(bridge);
        this.activity = activity;
    }

    @Override
    public boolean onCreateWindow(
        WebView view,
        boolean isDialog,
        boolean isUserGesture,
        Message resultMsg
    ) {
        try {
            popupWebView = new WebView(activity);
            WebSettings settings = popupWebView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setSupportMultipleWindows(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setUserAgentString(PaymentWebViewTweaks.chromeMobileUserAgent(view));

            popupWebView.setWebChromeClient(this);
            popupWebView.setWebViewClient(
                new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        Uri uri = request.getUrl();
                        if (uri == null) return false;
                        String scheme = uri.getScheme();
                        if (scheme != null) {
                            String s = scheme.toLowerCase();
                            if (
                                !s.equals("http") &&
                                !s.equals("https") &&
                                !s.equals("about") &&
                                !s.equals("data") &&
                                !s.equals("blob")
                            ) {
                                try {
                                    Intent intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
                                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    activity.startActivity(intent);
                                    return true;
                                } catch (Exception e) {
                                    Logger.warn("Popup deep link failed: " + scheme);
                                    return true;
                                }
                            }
                        }
                        return false;
                    }
                }
            );

            ViewGroup root = activity.findViewById(android.R.id.content);
            if (root != null) {
                root.addView(
                    popupWebView,
                    new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                );
            }

            WebViewTransport transport = (WebViewTransport) resultMsg.obj;
            transport.setWebView(popupWebView);
            resultMsg.sendToTarget();
            return true;
        } catch (Exception e) {
            Logger.error("Failed to create payment popup window", e);
            return false;
        }
    }

    @Override
    public void onCloseWindow(WebView window) {
        if (popupWebView != null) {
            ViewGroup parent = (ViewGroup) popupWebView.getParent();
            if (parent != null) {
                parent.removeView(popupWebView);
            }
            popupWebView.destroy();
            popupWebView = null;
        }
        super.onCloseWindow(window);
    }
}
