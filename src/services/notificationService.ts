import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export class NotificationService {
  public static async requestPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalNotifications.requestPermissions();
        return result.display === "granted";
      } catch (err) {
        console.error("Capacitor requestPermissions failed:", err);
        return false;
      }
    } else {
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        return permission === "granted";
      }
      return false;
    }
  }

  public static async getPermissionStatus(): Promise<"granted" | "denied" | "default"> {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalNotifications.checkPermissions();
        if (result.display === "granted") return "granted";
        if (result.display === "denied") return "denied";
        return "default";
      } catch {
        return "default";
      }
    } else {
      if ("Notification" in window) {
        return Notification.permission;
      }
      return "denied";
    }
  }

  public static async sendNotification(title: string, body: string, icon?: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Math.floor(Math.random() * 100000),
              schedule: { at: new Date(Date.now() + 100) },
              sound: "default"
            }
          ]
        });
      } catch (err) {
        console.error("Capacitor LocalNotification failed:", err);
      }
    } else {
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, {
            body,
            icon: icon || "/favicon.ico"
          });
        } catch (e) {
          console.warn("Browser Notification instantiation failed:", e);
        }
      }
    }
  }

  public static async scheduleNotification(title: string, body: string, delayMs: number, notificationId?: number): Promise<void> {
    const id = notificationId || Math.floor(Math.random() * 100000);
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id,
              schedule: { at: new Date(Date.now() + delayMs) },
              sound: "default"
            }
          ]
        });
      } catch (err) {
        console.error("Capacitor LocalNotification schedule failed:", err);
      }
    } else {
      setTimeout(() => {
        this.sendNotification(title, body);
      }, delayMs);
    }
  }
}
