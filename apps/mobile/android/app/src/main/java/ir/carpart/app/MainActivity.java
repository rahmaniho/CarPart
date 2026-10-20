package ir.carpart.app;

import android.content.Context;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.util.List;

/**
 * فعالیت اصلی اپ کارپارت.
 *
 * نکته حیاتی: افزونه اعلان فشاری (Push) به Firebase وابسته است. اگر
 * `google-services.json` موجود نباشد، هر تماس Firebase با
 * «Default FirebaseApp is not initialized» می‌شکند. برای اینکه اپ هرگز به‌خاطر
 * نبود پیکربندی Firebase کرش نکند، یک FirebaseApp جایگزین (placeholder) با
 * reflection می‌سازیم؛ نتیجه: ثبت توکن push شکست می‌خورد (کلاینت آن را مدیریت
 * می‌کند) ولی اپ پایدار می‌ماند. با وجود `google-services.json` واقعی، این
 * مقداردهی انجام نمی‌شود.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "CarPart";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        ensureFirebaseForPushSafety();
        super.onCreate(savedInstanceState);
    }

    private void ensureFirebaseForPushSafety() {
        try {
            Class<?> firebaseApp = Class.forName("com.google.firebase.FirebaseApp");
            Class<?> options = Class.forName("com.google.firebase.FirebaseOptions");
            Class<?> builder = Class.forName("com.google.firebase.FirebaseOptions$Builder");

            Object existing = firebaseApp.getMethod("getApps", Context.class).invoke(null, (Context) this);
            if (existing instanceof List && !((List<?>) existing).isEmpty()) {
                return; // پیکربندی واقعی Firebase موجود است
            }

            Object builderInstance = builder.getDeclaredConstructor().newInstance();
            builder.getMethod("setApiKey", String.class).invoke(builderInstance, "AIzaSyA-PLACEHOLDER-NOT-A-REAL-KEY");
            builder.getMethod("setApplicationId", String.class).invoke(builderInstance, "1:000000000000:android:0000000000000000000000");
            builder.getMethod("setProjectId", String.class).invoke(builderInstance, "carpart-placeholder");
            Object optionsInstance = builder.getMethod("build").invoke(builderInstance);

            firebaseApp.getMethod("initializeApp", Context.class, options).invoke(null, (Context) this, optionsInstance);
            Log.i(TAG, "FirebaseApp placeholder initialized (push simulated until real config)");
        } catch (Throwable error) {
            // هیچ خطایی نباید بالا آمدن اپ را مختل کند
            Log.w(TAG, "Firebase placeholder init skipped: " + error);
        }
    }
}
