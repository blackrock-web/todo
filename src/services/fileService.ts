import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

export class FileService {
  /**
   * Universal export helper that saves and shares on Capacitor, or downloads on web.
   */
  public static async exportFile(content: string | Blob, fileName: string, mimeType: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        let base64Data = "";
        if (content instanceof Blob) {
          base64Data = await this.blobToBase64(content);
        } else {
          base64Data = btoa(unescape(encodeURIComponent(content)));
        }

        // Save to Cache directory first
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        // Share the native file URI
        await Share.share({
          title: `Share ${fileName}`,
          url: writeResult.uri,
          dialogTitle: `Export ${fileName}`
        });
      } catch (err) {
        console.error("Capacitor Filesystem / Share failed:", err);
        // Fallback to standard web download
        this.webDownload(content, fileName, mimeType);
      }
    } else {
      this.webDownload(content, fileName, mimeType);
    }
  }

  private static webDownload(content: string | Blob, fileName: string, mimeType: string) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Content = base64String.split(",")[1] || "";
        resolve(base64Content);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
