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
        installCrashReporter();
        super.onCreate(savedInstanceState);
        showPreviousCrashIfAny();
    }

    /**
     * اگر خطای مدیریت‌نشده‌ای رخ دهد، stack trace پیش از مرگ process به‌صورت
     * هم‌زمان ذخیره می‌شود. در اجرای بعدی، پیام قابل کپی برای پشتیبانی نمایش داده
     * می‌شود — برخلاف نمایش Dialog روی thread در حال crash که قابل اتکا نیست.
     */
    private void installCrashReporter() {
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                java.io.StringWriter writer = new java.io.StringWriter();
                throwable.printStackTrace(new java.io.PrintWriter(writer));
                String trace = writer.toString();
                Log.e(TAG, "Uncaught crash:\n" + trace);
                getSharedPreferences("carpart_diagnostics", MODE_PRIVATE)
                    .edit()
                    .putString("last_crash", trace.substring(0, Math.min(12000, trace.length())))
                    .putLong("last_crash_at", System.currentTimeMillis())
                    .commit(); // هم‌زمان: باید قبل از پایان process نوشته شود
            } catch (Throwable ignored) {
                // نگذارید crash reporter خودش crash کند
            }
            if (previous != null) previous.uncaughtException(thread, throwable);
            else android.os.Process.killProcess(android.os.Process.myPid());
        });
    }

    /** نمایش گزارش crash قبلی فقط یک‌بار در اجرای بعدی. */
    private void showPreviousCrashIfAny() {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("carpart_diagnostics", MODE_PRIVATE);
            String trace = prefs.getString("last_crash", null);
            if (trace == null || trace.isEmpty()) return;
            prefs.edit().remove("last_crash").apply();
            String visible = trace.substring(0, Math.min(3000, trace.length()));
            new androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("گزارش خطای اجرای قبل")
                .setMessage("برنامه در اجرای قبل با خطا بسته شد. لطفاً متن زیر را برای پشتیبانی بفرستید:\n\n" + visible)
                .setPositiveButton("متوجه شدم", null)
                .setNeutralButton("کپی متن خطا", (dialog, which) -> {
                    android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    clipboard.setPrimaryClip(android.content.ClipData.newPlainText("CarPart crash report", trace));
                })
                .show();
        } catch (Throwable error) {
            Log.w(TAG, "Could not show previous crash report: " + error);
        }
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
