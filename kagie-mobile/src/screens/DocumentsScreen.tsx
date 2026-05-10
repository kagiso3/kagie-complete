import type { DocumentRecord } from "@kagie/shared";
import * as DocumentPicker from "expo-document-picker";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, Chip, Notice, SectionTitle, ScreenScroll } from "../components/ui";
import { useKagieData } from "../data/KagieDataProvider";
import { colors } from "../theme";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];
const documentTypes = [
  "ID Document",
  "Latest Results",
  "Proof of Residence",
  "Proof of Payment",
  "Other"
];

function validatePickedFile(asset: DocumentPicker.DocumentPickerAsset) {
  const mimeType = asset.mimeType || "";
  if (!allowedMimeTypes.includes(mimeType)) {
    return "Upload a PDF, JPG, or PNG document.";
  }
  if (asset.size && asset.size > MAX_UPLOAD_BYTES) {
    return "Keep each upload below 20 MB so it stays fast on mobile data.";
  }
  return "";
}

function formatDocumentDate(document: DocumentRecord) {
  const raw = document.updatedAt || document.createdAt;
  if (!raw) return "Date pending";
  return new Date(raw).toLocaleDateString();
}

export function DocumentsScreen() {
  const { documents, draft, syncing, uploadDocument } = useKagieData();
  const [documentType, setDocumentType] = useState(documentTypes[0]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warn" | "info"; text: string } | null>(null);

  async function pickAndUploadDocument() {
    if (syncing) return;
    setNotice(null);
    setUploadProgress(0);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedMimeTypes,
        multiple: false,
        copyToCacheDirectory: true
      });

      if (result.canceled || !result.assets?.[0]) {
        setNotice({ tone: "info", text: "Document upload cancelled." });
        return;
      }

      const asset = result.assets[0];
      const validationMessage = validatePickedFile(asset);
      if (validationMessage) {
        setNotice({ tone: "warn", text: validationMessage });
        return;
      }

      await uploadDocument({
        applicationId: draft?.id,
        uri: asset.uri,
        documentType,
        fileName: asset.name,
        mimeType: asset.mimeType || "application/octet-stream"
      }, setUploadProgress);

      setNotice({ tone: "success", text: `${asset.name} uploaded and sent to Kagie for review.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not upload this document." });
    }
  }

  return (
    <ScreenScroll>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Documents</Text>
        <Text style={styles.heroText}>Upload the files Kagie needs for your applications without storing document contents in the app.</Text>
      </View>

      {notice ? <Notice tone={notice.tone} message={notice.text} /> : null}

      <Card>
        <SectionTitle title="Upload a document" hint="Choose the type first, then pick a PDF, JPG, or PNG from your Android device." />
        <Text style={styles.smallLabel}>Document type</Text>
        <View style={styles.wrapRow}>
          {documentTypes.map((item) => (
            <Chip key={item} label={item} active={documentType === item} onPress={() => setDocumentType(item)} tone="gold" />
          ))}
        </View>
        <Button
          label={syncing ? "Uploading..." : "Choose and upload file"}
          onPress={pickAndUploadDocument}
          disabled={syncing}
        />
        {syncing && uploadProgress > 0 ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
          </View>
        ) : null}
        {syncing && uploadProgress > 0 ? (
          <Text style={styles.meta}>{Math.round(uploadProgress * 100)}% uploaded</Text>
        ) : null}
      </Card>

      <Card>
        <SectionTitle title="Uploaded documents" hint="Kagie staff will review these and update the status where needed." />
        {documents.length ? (
          documents.map((document) => (
            <View key={document.id} style={styles.documentRow}>
              <View style={styles.documentCopy}>
                <Text style={styles.documentTitle}>{document.fileName}</Text>
                <Text style={styles.meta}>{document.type} | {formatDocumentDate(document)}</Text>
              </View>
              <Text style={styles.status}>{document.status}</Text>
            </View>
          ))
        ) : (
          <Notice tone="info" message="No documents uploaded yet. Your uploaded files will appear here." />
        )}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: "#102a56",
    borderRadius: 28,
    padding: 22,
    gap: 8
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900"
  },
  heroText: {
    color: "rgba(255,255,255,0.88)",
    lineHeight: 20
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.textMuted
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#edf2f9",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.sky
  },
  documentRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  documentCopy: {
    flex: 1,
    gap: 3
  },
  documentTitle: {
    color: colors.text,
    fontWeight: "900"
  },
  meta: {
    color: colors.textMuted,
    lineHeight: 19
  },
  status: {
    color: colors.brandDark,
    fontWeight: "900"
  }
});
