import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface DriveUploadResult {
  image_url: string | null;
  image_drive_file_id: string | null;
  image_drive_folder_id: string | null;
  image_storage_provider: string | null;
  error?: string;
}

/**
 * Build a JWT from the service account key JSON, exchange it for an access token.
 */
async function getAccessToken(keyJson: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: keyJson.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: keyJson.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsignedToken = `${enc(header)}.${enc(claim)}`;

  // Import the RSA private key
  const pemBody = keyJson.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${signature}`;

  const tokenRes = await fetch(keyJson.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google token exchange failed [${tokenRes.status}]: ${text}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  return tokenData.access_token;
}

export const uploadProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string; mimeType: string; base64Data: string }) => {
    if (!input.fileName || !input.mimeType || !input.base64Data) {
      throw new Error("fileName, mimeType and base64Data are required");
    }
    if (!input.mimeType.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }
    if (input.base64Data.length > 14_000_000) {
      throw new Error("Image too large (max 10 MB)");
    }
    return input;
  })
  .handler(async ({ data }): Promise<DriveUploadResult> => {
    try {
      const keyJsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!keyJsonStr) {
        console.error("GOOGLE_SERVICE_ACCOUNT_KEY is not configured");
        return { image_url: null, image_drive_file_id: null, image_drive_folder_id: null, image_storage_provider: null, error: "Credenciales de Google Drive no configuradas" };
      }
      if (!folderId) {
        console.error("GOOGLE_DRIVE_FOLDER_ID is not configured");
        return { image_url: null, image_drive_file_id: null, image_drive_folder_id: null, image_storage_provider: null, error: "Carpeta de Google Drive no configurada" };
      }

      let keyJson: { client_email: string; private_key: string; token_uri: string };
      try {
        keyJson = JSON.parse(keyJsonStr);
      } catch {
        console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON");
        return { image_url: null, image_drive_file_id: null, image_drive_folder_id: null, image_storage_provider: null, error: "Credenciales de Google Drive inválidas (JSON malformado)" };
      }

      if (!keyJson.client_email || !keyJson.private_key || !keyJson.token_uri) {
        console.error("Service account key missing required fields");
        return { image_url: null, image_drive_file_id: null, image_drive_folder_id: null, image_storage_provider: null, error: "Credenciales de Google Drive incompletas" };
      }

      const accessToken = await getAccessToken(keyJson);

      const metadata = JSON.stringify({
        name: data.fileName,
        parents: [folderId],
      });

      const boundary = "---despensapp-boundary---";
      const body = [
        `--${boundary}\r\n`,
        `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
        metadata,
        `\r\n--${boundary}\r\n`,
        `Content-Type: ${data.mimeType}\r\n`,
        `Content-Transfer-Encoding: base64\r\n\r\n`,
        data.base64Data,
        `\r\n--${boundary}--`,
      ].join("");

      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error(`Google Drive upload failed [${uploadRes.status}]: ${errText}`);
        return { image_url: null, image_drive_file_id: null, image_drive_folder_id: null, image_storage_provider: null, error: `Error al subir a Google Drive (${uploadRes.status})` };
      }

      const fileData = (await uploadRes.json()) as { id: string };

      // Make file publicly readable
      const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });

      if (!permRes.ok) {
        console.warn(`Failed to set permissions: ${permRes.status}`);
      }

      const imageUrl = `https://drive.google.com/thumbnail?id=${fileData.id}&sz=w800`;

      return {
        image_url: imageUrl,
        image_drive_file_id: fileData.id,
        image_drive_folder_id: folderId,
        image_storage_provider: "google_drive",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido al subir imagen";
      console.error("uploadProductImage error:", msg);
      return { image_url: null, image_drive_file_id: null, image_drive_folder_id: null, image_storage_provider: null, error: msg };
    }
  });
