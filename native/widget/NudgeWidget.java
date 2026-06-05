package uk.co.nudgelive.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget showing today's and tomorrow's nudges. Data is cached by
 * the web app into Capacitor Preferences (SharedPreferences group
 * "CapacitorStorage", key "widget_today") whenever the app is opened; the
 * widget renders that snapshot as a JSON object {today:[…], tomorrow:[…]}.
 */
public class NudgeWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) updateWidget(context, mgr, id);
    }

    private static int appendSection(StringBuilder sb, String heading, JSONArray arr) {
        if (arr == null || arr.length() == 0) return 0;
        if (sb.length() > 0) sb.append("\n");
        sb.append(heading);
        int n = 0;
        for (int i = 0; i < arr.length() && i < 6; i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null) continue;
            String title = o.optString("title");
            String time = o.optString("time", "");
            sb.append("\n• ").append(title);
            if (time != null && !time.isEmpty()) sb.append("  ").append(time);
            n++;
        }
        return n;
    }

    static void updateWidget(Context context, AppWidgetManager mgr, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.nudge_widget);

        SharedPreferences prefs =
                context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String json = prefs.getString("widget_today", "{}");

        StringBuilder sb = new StringBuilder();
        int count = 0;
        try {
            JSONObject root = new JSONObject(json);
            count += appendSection(sb, "Today", root.optJSONArray("today"));
            count += appendSection(sb, "Tomorrow", root.optJSONArray("tomorrow"));
        } catch (Exception e) {
            /* leave defaults */
        }

        views.setTextViewText(R.id.widget_title, "nudge");
        views.setTextViewText(
                R.id.widget_body,
                count == 0 ? "Nothing due today or tomorrow 🎉" : sb.toString());

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            PendingIntent pi = PendingIntent.getActivity(
                    context, 0, launch,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }

        mgr.updateAppWidget(id, views);
    }
}
