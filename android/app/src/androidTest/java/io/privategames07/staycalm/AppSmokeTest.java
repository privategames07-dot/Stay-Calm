package io.privategames07.staycalm;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Color;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.lang.reflect.Method;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AppSmokeTest {
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        String[] result = new String[1];
        scenario.onActivity(activity -> {
            WebView web = activity.findViewById(android.R.id.content).findViewWithTag("unused");
            try {
                java.lang.reflect.Field field = MainActivity.class.getDeclaredField("web");
                field.setAccessible(true);
                web = (WebView)field.get(activity);
                web.evaluateJavascript(script, value -> { result[0]=value; done.countDown(); });
            } catch (Exception e) { throw new AssertionError(e); }
        });
        assertTrue("JavaScript response",done.await(10,TimeUnit.SECONDS));
        return result[0];
    }
    @Test public void localAppRecordsScoresAndRecognizesTimetableTime() throws Exception {
        try (ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            String ready="false";
            for (int i=0;i<60 && !"true".equals(ready);i++) {
                Thread.sleep(250);
                ready=evaluate(scenario,"!!document.querySelector('#tap')");
            }
            assertEquals("true",ready);
            assertEquals("true",evaluate(scenario,"!!window.webkit.messageHandlers.courseNames"));
            assertEquals("true",evaluate(scenario,"document.querySelector('#tap').click();events(Calm.key(new Date())).length===1"));
            assertEquals("true",evaluate(scenario,"Growth.score({pet:20,petPower:4},'pet',14)===1400"));
            assertEquals("true",evaluate(scenario,"go('상점');document.querySelector('select').options[0].textContent==='전체'"));
            assertEquals("true",evaluate(scenario,"go('인내');getComputedStyle(screen).touchAction==='none'"));
            assertEquals("true",evaluate(scenario,"window.webkit.messageHandlers.cache.postMessage('clear');true"));
            Thread.sleep(500);
            assertEquals("true",evaluate(scenario,"events(Calm.key(new Date())).length===1"));
            CountDownLatch finished=new CountDownLatch(1);
            String[] recognized=new String[1];
            scenario.onActivity(activity -> new Thread(() -> {
                try {
                    Bitmap bitmap=Bitmap.createBitmap(600,140,Bitmap.Config.ARGB_8888);
                    Canvas canvas=new Canvas(bitmap);canvas.drawColor(Color.WHITE);
                    Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);paint.setColor(Color.BLACK);paint.setTextSize(66);
                    canvas.drawText("1 (09:10)",30,90,paint);
                    Method method=MainActivity.class.getDeclaredMethod("textLines",Bitmap.class);
                    method.setAccessible(true);
                    recognized[0]=method.invoke(activity,bitmap).toString();
                    bitmap.recycle();
                } catch (Exception e) { recognized[0]=e.toString(); }
                finally { finished.countDown(); }
            }).start());
            assertTrue("Bundled OCR finishes",finished.await(45,TimeUnit.SECONDS));
            assertTrue(recognized[0],recognized[0].contains("09:10"));
        }
    }
}
