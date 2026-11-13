package io.privategames07.staycalm;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.exifinterface.media.ExifInterface;
import androidx.webkit.WebViewAssetLoader;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://appassets.androidplatform.net/assets/web/index.html";
    private static final int PICK_IMAGE = 10;
    private WebView web;
    private Bitmap importImage;
    private boolean pickerOpen;
    private String updateURL = "https://github.com/privategames07-dot/Stay-Calm/releases/latest";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final TextRecognizer recognizer = TextRecognition.getClient(new KoreanTextRecognizerOptions.Builder().build());

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setSupportZoom(false);
        web.getSettings().setBuiltInZoomControls(false);
        web.addJavascriptInterface(new Bridge(), "Android");
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse local = loader.shouldInterceptRequest(request.getUrl());
                return local != null ? local : new WebResourceResponse("text/plain", "UTF-8", new java.io.ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !APP_URL.equals(request.getUrl().toString());
            }
        });
        setContentView(web);
        getWindow().getDecorView().setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        web.loadUrl(APP_URL);
    }

    public final class Bridge {
        @JavascriptInterface public void postMessage(String data) {
            try {
                JSONObject payload = new JSONObject(data);
                String name = payload.getString("name");
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    try {
                        switch (name) {
                            case "feedback":
                                web.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
                                break;
                            case "cache":
                                web.clearCache(true);
                                worker.execute(() -> {
                                    if (importImage != null) { importImage.recycle(); importImage = null; }
                                    js("window.cacheCleared()");
                                });
                                break;
                            case "updateCheck":
                                boolean manual = payload.getJSONObject("body").optBoolean("manual", false);
                                new Thread(() -> checkUpdate(manual)).start();
                                break;
                            case "updates":
                                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(updateURL)));
                                break;
                            case "timetable":
                                if (!pickerOpen) {
                                    pickerOpen = true;
                                    Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                                    pick.setType("image/*");
                                    pick.addCategory(Intent.CATEGORY_OPENABLE);
                                    startActivityForResult(pick, PICK_IMAGE);
                                }
                                break;
                            case "courseNames":
                                JSONObject body = payload.getJSONObject("body");
                                JSONArray regions = body.getJSONArray("regions");
                                String token = body.getString("token");
                                if (regions.length() <= 336) worker.execute(() -> readTitles(token, regions));
                                break;
                        }
                    } catch (Exception error) { pickerOpen = false; failure(); }
                });
            } catch (Exception ignored) { }
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != PICK_IMAGE) return;
        pickerOpen = false;
        if (result != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        worker.execute(() -> {
            try {
                Bitmap bitmap = loadImage(uri);
                JSONArray words = textLines(bitmap);
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, output);
                if (importImage != null) importImage.recycle();
                importImage = bitmap;
                String src = "data:image/jpeg;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
                js("window.receiveTimetable(" + JSONObject.quote(src) + "," + words + ")");
            } catch (Exception error) { failure(); }
        });
    }

    private void checkUpdate(boolean manual) {
        java.net.HttpURLConnection connection = null;
        JSONObject result = new JSONObject();
        try {
            result.put("manual", manual);
            connection = (java.net.HttpURLConnection) new java.net.URL(
                "https://github.com/privategames07-dot/Stay-Calm/releases/latest/download/source.json").openConnection();
            connection.setConnectTimeout(7000); connection.setReadTimeout(7000);
            connection.setUseCaches(false);
            try (InputStream input = connection.getInputStream()) {
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096]; int length;
                while ((length = input.read(buffer)) != -1) {
                    if (output.size() + length > 262144) throw new IllegalArgumentException("Version response size");
                    output.write(buffer, 0, length);
                }
                JSONObject app = new JSONObject(output.toString("UTF-8")).getJSONArray("apps").getJSONObject(0);
                int build = Integer.parseInt(app.getString("buildVersion"));
                if (build <= 0) throw new IllegalArgumentException("Build number");
                result.put("build", build).put("version", "0." + build);
                String download = "https://github.com/privategames07-dot/Stay-Calm/releases/download/build-" + build + "/stay-calm-" + build + ".apk";
                if (build > getPackageManager().getPackageInfo(getPackageName(), 0).versionCode) {
                    java.net.HttpURLConnection check = (java.net.HttpURLConnection)new java.net.URL(download).openConnection();
                    try {
                        check.setRequestMethod("HEAD"); check.setConnectTimeout(7000); check.setReadTimeout(7000);
                        if (check.getResponseCode() != 200) throw new IllegalStateException("APK not published yet");
                    } finally { check.disconnect(); }
                }
                runOnUiThread(() -> updateURL = download);
            }
        } catch (Exception error) {
            try { result.put("error", true); } catch (Exception ignored) { }
        } finally { if (connection != null) connection.disconnect(); }
        js("window.receiveUpdate(" + result + ")");
    }

    private Bitmap loadImage(Uri uri) throws Exception {
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        try (InputStream input = getContentResolver().openInputStream(uri)) { BitmapFactory.decodeStream(input, null, options); }
        int sample = 1;
        while (Math.max(options.outWidth, options.outHeight) / sample > 4400) sample *= 2;
        options.inJustDecodeBounds = false;
        options.inSampleSize = sample;
        Bitmap decoded;
        try (InputStream input = getContentResolver().openInputStream(uri)) { decoded = BitmapFactory.decodeStream(input, null, options); }
        if (decoded == null) throw new IllegalArgumentException("Image decode");
        Matrix matrix = new Matrix();
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            ExifInterface exif = new ExifInterface(input);
            if (exif.isFlipped()) matrix.postScale(-1, 1);
            matrix.postRotate(exif.getRotationDegrees());
        }
        Bitmap oriented = Bitmap.createBitmap(decoded, 0, 0, decoded.getWidth(), decoded.getHeight(), matrix, true);
        if (oriented != decoded) decoded.recycle();
        float ratio = Math.min(1f, 2200f / Math.max(oriented.getWidth(), oriented.getHeight()));
        Bitmap scaled = Bitmap.createScaledBitmap(oriented, Math.max(1, Math.round(oriented.getWidth()*ratio)),
            Math.max(1, Math.round(oriented.getHeight()*ratio)), true);
        if (scaled != oriented) oriented.recycle();
        return scaled;
    }

    private JSONArray textLines(Bitmap bitmap) throws Exception {
        Text result = Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap, 0)));
        JSONArray words = new JSONArray();
        for (Text.TextBlock block : result.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                Rect box = line.getBoundingBox();
                if (box == null) continue;
                words.put(new JSONObject().put("text", line.getText())
                    .put("x", box.exactCenterX()/bitmap.getWidth()).put("y", box.exactCenterY()/bitmap.getHeight())
                    .put("h", (double)box.height()/bitmap.getHeight()));
            }
        }
        return words;
    }

    private void readTitles(String token, JSONArray regions) {
        JSONArray groups = new JSONArray();
        try {
            if (importImage == null) throw new IllegalStateException("No image");
            for (int i=0; i<regions.length(); i++) {
                JSONArray group = new JSONArray();
                Bitmap crop = null;
                try {
                    JSONArray point = regions.getJSONArray(i);
                    if (point.length() != 4) throw new IllegalArgumentException("Region");
                    for (int j=0; j<4; j++) {
                        double n = point.getDouble(j);
                        if (!Double.isFinite(n) || n<0 || n>1) throw new IllegalArgumentException("Coordinate");
                    }
                    int left = (int)Math.floor(point.getDouble(0)*importImage.getWidth());
                    int top = (int)Math.floor(point.getDouble(1)*importImage.getHeight());
                    int right = Math.min(importImage.getWidth(), (int)Math.ceil(point.getDouble(2)*importImage.getWidth()));
                    int bottom = Math.min(importImage.getHeight(), (int)Math.ceil(point.getDouble(3)*importImage.getHeight()));
                    crop = Bitmap.createBitmap(importImage, left, top, right-left, bottom-top);
                    group = textLines(crop);
                } catch (Exception ignored) {
                    // The review form allows correcting cells whose recognition failed.
                } finally { if (crop != null && crop != importImage) crop.recycle(); }
                groups.put(group);
            }
            js("window.receiveCourseNames(" + JSONObject.quote(token) + "," + groups + ")");
        } catch (Exception error) {
            js("window.receiveCourseNames(" + JSONObject.quote(token) + ",[])");
        }
    }

    private void js(String script) {
        runOnUiThread(() -> { if (!isFinishing() && !isDestroyed()) web.evaluateJavascript(script, null); });
    }
    private void failure() { js("window.importFailure('사진을 읽지 못했어. 다른 캡처를 선택해줘.')"); }
    @Override protected void onPause() { super.onPause(); js("if(typeof petTimer!=='undefined'){clearInterval(petTimer);resetCombo();}"); web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); js("if(typeof startPet==='function'){startPet();if(page==='인내')render();}"); } }
    @Override public void onBackPressed() {
        js("(()=>{const d=document.querySelector('dialog[open]');if(d)d.close();else go('인내');})()");
    }
    @Override protected void onDestroy() {
        super.onDestroy();
        worker.execute(() -> { recognizer.close(); if (importImage != null) importImage.recycle(); });
        worker.shutdown();
        web.removeJavascriptInterface("Android");
        web.destroy();
    }
}
